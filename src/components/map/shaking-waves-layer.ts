import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from 'maplibre-gl';

import { EARTH_RADIUS_KM } from '@/lib/earthquakes/distance';
import { ALLEN_2012_RHYPO, FELT_INTENSITY } from '@/lib/earthquakes/intensity';
import {
  MAX_MERCATOR_LATITUDE,
  WAVE_FULL_OPACITY_STEPS,
  WAVE_MIN_OPACITY,
  WAVE_RAMP,
  getFloat32Split,
  getMercatorX,
  getMercatorY,
  getRgb,
  getTranslatedMatrix,
  getWorldCopies,
} from '@/lib/map/shaking-waves';
import type { WaveInstances } from '@/lib/map/shaking-waves';

export type WaveFrame = { tMs: number; waveSpanMs: number; reducedMotion: boolean };

export type ShakingWavesLayer = {
  layer: CustomLayerInterface;
  setInstances(instances: WaveInstances): void;
  setFrame(frame: WaveFrame): void;
};

const TILE_SIZE_PX = 512;
const BYTES_PER_FLOAT = 4;
const QUAD_CORNERS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

export const WAVE_VERTEX_SHADER = `#version 300 es
precision highp float;

const float PI = 3.141592653589793;
const float MAX_LATITUDE = ${((MAX_MERCATOR_LATITUDE * Math.PI) / 180).toFixed(10)};
const float PAD_PX = 4.0;
const float MIN_RADIUS_PX = 1.0;
const int RAMP_SIZE = ${WAVE_RAMP.length};

uniform mat4 u_matrix;
uniform vec4 u_origin;
uniform float u_time_sec;
uniform float u_span_sec;
uniform float u_reduced_motion;
uniform float u_merc_per_px;
uniform float u_earth_radius_km;
uniform float u_felt_intensity;
uniform float u_min_opacity;
uniform float u_full_opacity_steps;
uniform float u_c0;
uniform float u_c1;
uniform float u_c2;
uniform float u_c4;
uniform float u_m1;
uniform float u_m2;
uniform float u_anelastic_distance_km;
uniform float u_ramp_intensity[RAMP_SIZE];
uniform vec3 u_ramp_color[RAMP_SIZE];

in vec2 a_corner;
in vec4 a_position;
in vec4 a_wave;

out vec2 v_offset;
flat out float v_psi;
flat out float v_radius_km;
flat out vec4 v_color;

float getIntensity(float magnitude, float depthKm, float distanceKm) {
  float rhypo = length(vec2(distanceKm, depthKm));
  float rM = u_m1 + u_m2 * exp(magnitude - 5.0);
  float anelastic = u_c4 * log(max(rhypo, u_anelastic_distance_km) / u_anelastic_distance_km);
  return u_c0 + u_c1 * magnitude + u_c2 * log(length(vec2(rhypo, rM))) + anelastic;
}

float getOpacity(float intensity) {
  float opacity = (intensity - u_felt_intensity) / u_full_opacity_steps;
  return step(u_felt_intensity, intensity) * clamp(opacity, u_min_opacity, 1.0);
}

vec3 getRampColor(float intensity) {
  vec3 color = u_ramp_color[0];
  for (int i = 1; i < RAMP_SIZE; i++) {
    float lower = u_ramp_intensity[i - 1];
    float weight = clamp((intensity - lower) / (u_ramp_intensity[i] - lower), 0.0, 1.0);
    color = mix(color, u_ramp_color[i], weight);
  }
  return color;
}

void main() {
  float age = u_time_sec - a_wave.x;
  float progress = age / u_span_sec;
  float magnitude = a_wave.z;
  float depthKm = a_wave.w;
  float radiusKm = a_wave.y * mix(progress, 1.0, u_reduced_motion);
  float delta = radiusKm / u_earth_radius_km;
  float mercatorY = a_position.y + a_position.w;
  float psi = PI * (1.0 - 2.0 * mercatorY);
  float radiusPx = delta * cosh(psi) / (2.0 * PI * u_merc_per_px);

  if (age < 0.0 || age > u_span_sec || radiusPx < MIN_RADIUS_PX) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  // Any path of length delta moves at most delta / cos(highest latitude) in longitude and in psi.
  float reachLatitude = abs(atan(sinh(psi))) + delta;
  float pad = PAD_PX * u_merc_per_px;
  float worldHalf = 0.5 + pad;
  float capHalf = delta / (2.0 * PI * cos(min(reachLatitude, MAX_LATITUDE))) + pad;
  vec2 halfSize = reachLatitude < MAX_LATITUDE ? vec2(capHalf) : vec2(worldHalf, 1.0 + pad);
  vec2 minCorner = max(-halfSize, vec2(-worldHalf, -mercatorY - pad));
  vec2 maxCorner = min(halfSize, vec2(worldHalf, 1.0 - mercatorY + pad));

  float frontIntensity = getIntensity(magnitude, depthKm, radiusKm);
  float epicentralIntensity = getIntensity(magnitude, depthKm, 0.0);
  float intensity = max(mix(frontIntensity, epicentralIntensity, u_reduced_motion), u_felt_intensity);
  float alpha = getOpacity(intensity) * mix(1.0, 1.0 - progress, u_reduced_motion);

  vec2 centre = (a_position.xy - u_origin.xy) + (a_position.zw - u_origin.zw);
  v_offset = mix(minCorner, maxCorner, a_corner);
  v_psi = psi;
  v_radius_km = radiusKm;
  v_color = vec4(getRampColor(intensity) * alpha, alpha);
  gl_Position = u_matrix * vec4(centre + v_offset, 0.0, 1.0);
}`;

export const WAVE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

const float PI = 3.141592653589793;
const float BAND_HALF_PX = 1.0;
const float SERIES_LIMIT = 0.25;
const float ASIN_SERIES_LIMIT = 0.1;

uniform float u_earth_radius_km;
uniform float u_pixel_ratio;

in vec2 v_offset;
flat in float v_psi;
flat in float v_radius_km;
flat in vec4 v_color;

out vec4 fragColor;

// GLSL ES 3.00 §4.5.1 leaves trigonometric precision undefined, and metre-scale rings need it near 0:
// https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf
float getSin(float x) {
  float x2 = x * x;
  return abs(x) < SERIES_LIMIT ? x * (1.0 - x2 / 6.0 * (1.0 - x2 / 20.0)) : sin(x);
}

float getSinh(float x) {
  float x2 = x * x;
  return abs(x) < SERIES_LIMIT ? x * (1.0 + x2 / 6.0 * (1.0 + x2 / 20.0)) : sinh(x);
}

float getAsin(float x) {
  float x2 = x * x;
  return x < ASIN_SERIES_LIMIT ? x * (1.0 + x2 / 6.0 * (1.0 + 0.45 * x2)) : atan(x, sqrt(max(1.0 - x2, 0.0)));
}

void main() {
  float halfDeltaPsi = -PI * v_offset.y;
  float tanHalfDeltaLat = getSinh(halfDeltaPsi) / cosh(v_psi + halfDeltaPsi);
  float tan2 = tanHalfDeltaLat * tanHalfDeltaLat;
  float sinHalfDeltaLng = getSin(PI * v_offset.x);
  float cosLatitudes = 1.0 / (cosh(v_psi) * cosh(v_psi + 2.0 * halfDeltaPsi));
  float h = tan2 / (1.0 + tan2) + cosLatitudes * sinHalfDeltaLng * sinHalfDeltaLng;
  float distanceKm = 2.0 * u_earth_radius_km * getAsin(sqrt(h));
  float kmPerPx = max(length(vec2(dFdx(distanceKm), dFdy(distanceKm))), 1e-9);
  float offsetPx = abs(distanceKm - v_radius_km) / kmPerPx;
  float coverage = clamp(BAND_HALF_PX * u_pixel_ratio + 0.5 - offsetPx, 0.0, 1.0);
  if (coverage <= 0.0) discard;
  fragColor = v_color * coverage;
}`;

const FRAME_UNIFORMS = [
  'u_matrix',
  'u_origin',
  'u_time_sec',
  'u_span_sec',
  'u_reduced_motion',
  'u_merc_per_px',
  'u_pixel_ratio',
] as const;

type FrameUniform = (typeof FRAME_UNIFORMS)[number];

type GlResources = {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  cornerBuffer: WebGLBuffer;
  instanceBuffer: WebGLBuffer;
  uniforms: Record<FrameUniform, WebGLUniformLocation | null>;
};

function getShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Shaking waves: createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shaking waves: shader compile failed: ${log}`);
  }
  return shader;
}

function setStaticUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const set = (name: string, value: number) =>
    gl.uniform1f(gl.getUniformLocation(program, name), value);
  const { c0, c1, c2, c4, m1, m2, anelasticDistanceKm } = ALLEN_2012_RHYPO;

  gl.useProgram(program);
  set('u_earth_radius_km', EARTH_RADIUS_KM);
  set('u_felt_intensity', FELT_INTENSITY);
  set('u_min_opacity', WAVE_MIN_OPACITY);
  set('u_full_opacity_steps', WAVE_FULL_OPACITY_STEPS);
  set('u_c0', c0);
  set('u_c1', c1);
  set('u_c2', c2);
  set('u_c4', c4);
  set('u_m1', m1);
  set('u_m2', m2);
  set('u_anelastic_distance_km', anelasticDistanceKm);
  gl.uniform1fv(
    gl.getUniformLocation(program, 'u_ramp_intensity'),
    WAVE_RAMP.map(({ intensity }) => intensity),
  );
  gl.uniform3fv(
    gl.getUniformLocation(program, 'u_ramp_color'),
    WAVE_RAMP.flatMap(({ hex }) => getRgb(hex)),
  );
}

export function getWaveProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = getShader(gl, gl.VERTEX_SHADER, WAVE_VERTEX_SHADER);
  const fragment = getShader(gl, gl.FRAGMENT_SHADER, WAVE_FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shaking waves: program link failed: ${log}`);
  }
  setStaticUniforms(gl, program);
  return program;
}

function setAttribute(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  attribute: { name: string; size: number; strideBytes: number; offsetBytes: number },
  divisor: number,
) {
  const location = gl.getAttribLocation(program, attribute.name);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(
    location,
    attribute.size,
    gl.FLOAT,
    false,
    attribute.strideBytes,
    attribute.offsetBytes,
  );
  gl.vertexAttribDivisor(location, divisor);
}

function getResources(gl: WebGL2RenderingContext, stride: number): GlResources {
  const program = getWaveProgram(gl);
  const vao = gl.createVertexArray();
  const cornerBuffer = gl.createBuffer();
  const instanceBuffer = gl.createBuffer();
  const strideBytes = stride * BYTES_PER_FLOAT;

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
  setAttribute(gl, program, { name: 'a_corner', size: 2, strideBytes: 0, offsetBytes: 0 }, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  setAttribute(gl, program, { name: 'a_position', size: 4, strideBytes, offsetBytes: 0 }, 1);
  setAttribute(
    gl,
    program,
    { name: 'a_wave', size: 4, strideBytes, offsetBytes: 4 * BYTES_PER_FLOAT },
    1,
  );
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const uniforms = Object.fromEntries(
    FRAME_UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]),
  ) as Record<FrameUniform, WebGLUniformLocation | null>;

  return { program, vao, cornerBuffer, instanceBuffer, uniforms };
}

function deleteResources(gl: WebGL2RenderingContext, resources: GlResources) {
  gl.deleteBuffer(resources.cornerBuffer);
  gl.deleteBuffer(resources.instanceBuffer);
  gl.deleteVertexArray(resources.vao);
  gl.deleteProgram(resources.program);
}

export function getShakingWavesLayer(id = 'shaking-waves'): ShakingWavesLayer {
  let map: MapLibreMap | null = null;
  let resources: GlResources | null = null;
  let instances: WaveInstances | null = null;
  let uploaded: WaveInstances | null = null;
  let frame: WaveFrame = { tMs: 0, waveSpanMs: 0, reducedMotion: false };

  function getReadyResources(gl: WebGL2RenderingContext, next: WaveInstances): GlResources {
    resources ??= getResources(gl, next.stride);
    if (uploaded !== next) {
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, next.data, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      uploaded = next;
    }
    return resources;
  }

  const layer: CustomLayerInterface = {
    id,
    type: 'custom',
    renderingMode: '2d',
    onAdd(nextMap) {
      map = nextMap;
    },
    render(gl: WebGL2RenderingContext, args: CustomRenderMethodInput) {
      if (!map || !instances || instances.count === 0 || frame.waveSpanMs <= 0) return;
      const { program, vao, uniforms } = getReadyResources(gl, instances);
      const { lng, lat } = map.getCenter();
      const bounds = map.getBounds();
      const originX = getMercatorX(lng);
      const originY = getMercatorY(lat);
      const [originYHigh, originYLow] = getFloat32Split(originY);
      const matrix = getTranslatedMatrix(args.defaultProjectionData.mainMatrix, originX, originY);

      gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.u_matrix, false, matrix);
      gl.uniform1f(uniforms.u_time_sec, (frame.tMs - instances.originMs) / 1000);
      gl.uniform1f(uniforms.u_span_sec, frame.waveSpanMs / 1000);
      gl.uniform1f(uniforms.u_reduced_motion, Number(frame.reducedMotion));
      gl.uniform1f(uniforms.u_merc_per_px, 1 / (TILE_SIZE_PX * 2 ** map.getZoom()));
      gl.uniform1f(uniforms.u_pixel_ratio, map.getPixelRatio());
      gl.bindVertexArray(vao);
      for (const copy of getWorldCopies(bounds.getWest(), bounds.getEast())) {
        const [originXHigh, originXLow] = getFloat32Split(originX - copy);
        gl.uniform4f(uniforms.u_origin, originXHigh, originYHigh, originXLow, originYLow);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instances.count);
      }
      gl.bindVertexArray(null);
    },
    onRemove(_removedMap, gl) {
      if (resources) deleteResources(gl, resources);
      resources = null;
      uploaded = null;
      map = null;
    },
  };

  return {
    layer,
    setInstances(next) {
      instances = next;
    },
    setFrame(next) {
      frame = next;
    },
  };
}
