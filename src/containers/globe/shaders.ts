import { ARRIVAL_PULSE } from '@/lib/earthquakes/arrivals';
import {
  FELT_RING_LOOK,
  GLOBE_RING_LOOK,
  MAX_GLOBE_WAVES,
  REPLAY_LIFE_K,
} from '@/lib/globe/felt-rings';
import { GLOBE_LOOK } from '@/lib/globe/look';
import { QUAKE_AGE_LOOK } from '@/lib/globe/quakes';

function getGlslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function getGlslRgb(rgb: readonly number[]): string {
  return `vec3(${rgb.map((channel) => getGlslFloat(channel / 255)).join(', ')})`;
}

const RING = GLOBE_RING_LOOK;
const AGE = QUAKE_AGE_LOOK;
const BACK_K = getGlslFloat(AGE.backK);
const BACK_GREY = getGlslRgb([150, 156, 196]);

const VIEW_CHUNK = `
uniform float uLon;
uniform float uLat;
uniform float uRadius;
uniform vec2 uCenter;
uniform float uDpr;

vec3 getRotated(vec3 p) {
  float ca = cos(uLon);
  float sa = sin(uLon);
  float cb = cos(uLat);
  float sb = sin(uLat);
  float x1 = p.x * ca - p.z * sa;
  float z1 = p.x * sa + p.z * ca;
  return vec3(x1, p.y * cb - z1 * sb, p.y * sb + z1 * cb);
}

vec4 getClipPosition(vec2 offsetPx) {
  return projectionMatrix * modelViewMatrix * vec4(uCenter + offsetPx, 0.0, 1.0);
}

void cull() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
}
`;

const QUAKE_STATE_CHUNK = `
attribute vec3 aState;
attribute float aReplay;
uniform float uFront;
uniform float uDataT;
uniform float uHasData;
uniform float uEmber;
uniform float uLifeK;
uniform float uTime;
uniform float uMotion;
uniform float uSelected;

bool isOtherFace(float z) {
  return (z >= 0.0) != (uFront > 0.5);
}

vec3 getQuakeState() {
  bool selected = aState.z == uSelected;
  float age = uDataT - aState.x;
  float fade = selected || uHasData < 0.5 ? 1.0 : max(${getGlslFloat(AGE.fadeFloor)}, 1.0 - age / uEmber);
  float replay = (uTime - aReplay) / (aState.y * ${getGlslFloat(REPLAY_LIFE_K)});
  if (uMotion < 0.5) return vec3(fade, 0.0, 0.0);
  if (aReplay >= 0.0 && replay >= 0.0 && replay < 1.0) return vec3(fade, replay, 1.0);
  float life = aState.y * uLifeK;
  if (selected || uHasData < 0.5 || age > life) return vec3(fade, 0.0, 0.0);
  return vec3(fade, age / life, 1.0);
}

float getAgeAlpha(float fade) {
  return (${getGlslFloat(AGE.alphaBase)} + ${getGlslFloat(1 - AGE.alphaBase)} * fade) * mix(${BACK_K}, 1.0, uFront);
}

vec3 getFaceColor(vec3 color) {
  return mix(color, ${BACK_GREY}, 0.6 * (1.0 - uFront));
}
`;

export const DOT_VERTEX_SHADER = `
${VIEW_CHUNK}
attribute float aLand;
uniform vec3 uOcean;
uniform vec3 uLand;
uniform float uOceanAlpha;
uniform float uLandAlpha;
uniform float uLandScale;
uniform float uDotSize;
uniform float uRim;
uniform float uFront;
uniform int uWaveCount;
uniform vec4 uWaveCentre[${MAX_GLOBE_WAVES}];
uniform vec4 uWaveShape[${MAX_GLOBE_WAVES}];
uniform vec3 uWaveColor[${MAX_GLOBE_WAVES}];
varying vec4 vColor;
varying float vSize;

void main() {
  float sum = 0.0;
  float energy = 0.0;
  float weight = 0.0;
  vec3 waveColor = vec3(0.0);
  for (int i = 0; i < ${MAX_GLOBE_WAVES}; i++) {
    if (i >= uWaveCount) break;
    vec4 centre = uWaveCentre[i];
    vec4 shape = uWaveShape[i];
    float d = dot(position, centre.xyz);
    if (d < shape.w) continue;
    float angle = acos(min(d, 1.0));
    float behind = centre.w - angle;
    if (behind <= 0.0) continue;
    float disp = sin(behind / shape.y * 6.2832) * shape.z * exp(-behind / (shape.x * 0.55)) / sqrt(1.0 + angle / (shape.x * 0.25));
    float size = abs(disp);
    if (size < 0.002) continue;
    sum += disp;
    energy += max(0.0, disp) + 0.3 * size;
    weight += size;
    waveColor += size * uWaveColor[i];
  }
  vec3 r = getRotated(position * (1.0 + 0.035 * clamp(sum, -1.5, 1.5)));
  float z = r.z;
  float front = step(0.0, z);
  if (front != uFront) {
    cull();
    return;
  }
  float face = front > 0.5 ? 0.35 + 0.65 * z : ${getGlslFloat(GLOBE_LOOK.backFace)} * (1.0 + z);
  float rim = pow(1.0 - abs(z), 5.0) * uRim;
  float vy = clamp((1.0 - r.y) * 0.5, 0.0, 1.0);
  vec3 tint = vec3(90.0 + 165.0 * vy, 210.0 - 90.0 * vy, 255.0 - 165.0 * vy) / 255.0;
  vec3 color = mix(mix(uOcean, uLand, aLand), tint, min(rim, 1.0));
  float alpha = mix(uOceanAlpha, uLandAlpha, aLand) * face + rim * 0.6 * mix(0.5, 1.0, front);
  if (energy > 0.0) {
    color = mix(color, waveColor / weight, min(1.0, energy * 1.1));
    alpha += min(0.6, energy * 0.7) * mix(0.55, 1.0, front);
  }
  if (alpha <= 0.005) {
    cull();
    return;
  }
  float faceSize = front > 0.5 ? 0.75 + 0.35 * z : 0.6;
  vSize = (uDotSize * mix(1.0, uLandScale, aLand) * faceSize + min(0.9, energy * 0.7)) * uDpr;
  vColor = vec4(color, min(alpha, 1.0));
  gl_PointSize = ceil(vSize) + 1.0;
  gl_Position = getClipPosition(r.xy * uRadius);
}
`;

export const DOT_FRAGMENT_SHADER = `
varying vec4 vColor;
varying float vSize;

void main() {
  vec2 offset = (gl_PointCoord - 0.5) * (ceil(vSize) + 1.0);
  vec2 halfSize = vec2(vSize * 0.5);
  vec2 overlap = clamp(min(offset + 0.5, halfSize) - max(offset - 0.5, -halfSize), 0.0, 1.0);
  float coverage = overlap.x * overlap.y;
  if (coverage <= 0.0) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * coverage);
}
`;

export const DISC_VERTEX_SHADER = `
${VIEW_CHUNK}
uniform float uOuter;
varying vec2 vOffset;

void main() {
  vOffset = position.xy * (uOuter * uRadius + 2.0);
  gl_Position = getClipPosition(vOffset);
}
`;

export const DISC_FRAGMENT_SHADER = `
uniform float uRadius;
uniform float uDpr;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uInner;
uniform float uOuter;
varying vec2 vOffset;

void main() {
  float d = length(vOffset);
  float ramp = max((uOuter - uInner) * uRadius, 1.0 / uDpr);
  float alpha = uAlpha * clamp((uOuter * uRadius - d) / ramp, 0.0, 1.0);
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export const COAST_VERTEX_SHADER = `
${VIEW_CHUNK}
attribute vec3 aOther;

void main() {
  vec3 r = getRotated(position);
  if (min(r.z, getRotated(aOther).z) < 0.0) {
    cull();
    return;
  }
  gl_Position = getClipPosition(r.xy * uRadius);
}
`;

export const COAST_FRAGMENT_SHADER = `
uniform float uAlpha;

void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, uAlpha);
}
`;

export const QUAKE_VERTEX_SHADER = `
${VIEW_CHUNK}
${QUAKE_STATE_CHUNK}
attribute float aRadius;
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec4 vColor;
varying float vSize;
varying float vBox;

void main() {
  vec3 r = getRotated(position);
  if (isOtherFace(r.z)) {
    cull();
    return;
  }
  vec3 state = getQuakeState();
  vSize = 2.0 * aSize * mix(${BACK_K}, 1.0, uFront) * uDpr;
  vBox = ceil(vSize + 2.0 * uDpr) + 2.0;
  vColor = vec4(getFaceColor(aColor), aAlpha * getAgeAlpha(state.x));
  gl_PointSize = vBox;
  gl_Position = getClipPosition(r.xy * aRadius * uRadius);
}
`;

export const QUAKE_FRAGMENT_SHADER = `
uniform float uFront;
uniform float uDpr;
varying vec4 vColor;
varying float vSize;
varying float vBox;

void main() {
  float offset = length(gl_PointCoord - 0.5) * vBox;
  float radius = vSize * 0.5;
  float fill = clamp(radius + 0.5 - offset, 0.0, 1.0);
  float outline = clamp(uDpr * 0.5 + 0.5 - abs(offset - radius), 0.0, 1.0);
  float coverage = mix(outline, fill, uFront);
  if (coverage <= 0.0) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * coverage);
}
`;

export const NEEDLE_VERTEX_SHADER = `
${VIEW_CHUNK}
${QUAKE_STATE_CHUNK}
attribute float aRadius;
attribute vec3 aColor;
attribute float aAlpha;
varying vec4 vColor;
varying vec2 vPx;
varying vec2 vEpicentrePx;

void main() {
  vec3 r = getRotated(position);
  if (isOtherFace(r.z)) {
    cull();
    return;
  }
  vec3 state = getQuakeState();
  float flash = state.z * (1.0 - state.y) * ${getGlslFloat(RING.flashA)} * mix(${getGlslFloat(RING.backFlashK)}, 1.0, uFront);
  vColor = vec4(getFaceColor(aColor), aAlpha * getAgeAlpha(state.x) + flash);
  vEpicentrePx = r.xy * uRadius;
  vPx = vEpicentrePx * aRadius;
  gl_Position = getClipPosition(vPx);
}
`;

export const NEEDLE_FRAGMENT_SHADER = `
uniform float uFront;
varying vec4 vColor;
varying vec2 vPx;
varying vec2 vEpicentrePx;

void main() {
  if (uFront < 0.5 && mod(distance(vPx, vEpicentrePx), 5.0) > 2.0) discard;
  gl_FragColor = vec4(vColor.rgb, min(vColor.a, 1.0));
}
`;

export const RING_VERTEX_SHADER = `
${VIEW_CHUNK}
${QUAKE_STATE_CHUNK}
attribute vec3 aDirection;
attribute float aRadius;
attribute vec3 aColor;
attribute vec3 aShape;
uniform float uHovered;
varying vec2 vOffset;
varying vec3 vEpicentre;
varying vec3 vColor;
varying vec3 vFelt;
varying vec4 vRings;
varying vec4 vRingAlpha;
varying vec4 vPulse;

float getFeltStrokeAlpha(bool selected, vec3 state) {
  if (selected) return ${getGlslFloat(RING.selectedA)};
  if (state.z > 0.5) return (1.0 - state.y) * ${getGlslFloat(RING.growA)};
  return ${getGlslFloat(RING.fadedA)} + ${getGlslFloat(RING.fadeA)} * state.x;
}

float getMarkAlpha(bool selected, bool hovered) {
  if (selected) return ${getGlslFloat(RING.selectedMarkA)};
  return hovered ? ${getGlslFloat(RING.hoverA)} : 0.0;
}

void main() {
  vec3 e = getRotated(aDirection);
  if (isOtherFace(e.z)) {
    cull();
    return;
  }
  vec3 state = getQuakeState();
  bool selected = aState.z == uSelected;
  float front = uFront;
  float k = mix(${BACK_K}, 1.0, front);
  float amp = aShape.x;
  float isFelt = aShape.z;
  float isActive = state.z;
  float p = state.y;
  float epicentrePx = (1.3 + 2.2 * amp) * 0.5 * k;
  float grow = isActive > 0.5 && !selected ? min(1.0, p * ${getGlslFloat(RING.growRate)}) : 1.0;
  float feltAngle = aShape.y * grow * front;
  float feltA = getFeltStrokeAlpha(selected, state);
  float fillA = e.z > 0.05 ? ${getGlslFloat(RING.fillK)} * min(1.0, feltA / ${getGlslFloat(RING.fillFullA)}) : 0.0;
  vFelt = vec3(feltAngle, feltA, fillA);
  float hollowA = (1.0 - isFelt) * front * ${getGlslFloat(FELT_RING_LOOK.hollowA)} * getAgeAlpha(state.x);
  float glowPx = ${getGlslFloat(FELT_RING_LOOK.glowBasePx)} + ${getGlslFloat(FELT_RING_LOOK.glowAmpPx)} * amp;
  float glowA = isActive * isFelt * front * ${getGlslFloat(FELT_RING_LOOK.glowA)} * (1.0 - p);
  float markPx = epicentrePx + ${getGlslFloat(RING.markRingGapPx)};
  float markA = getMarkAlpha(selected, aState.z == uHovered);
  vRings = vec4(epicentrePx + ${getGlslFloat(FELT_RING_LOOK.hollowGapPx)}, glowPx, markPx, 0.0);
  vRingAlpha = vec4(hollowA, glowA, markA, 0.0);
  vec2 epicentre = e.xy * uRadius;
  vec2 hypocentre = epicentre * aRadius;
  float pulsePx = (${getGlslFloat(RING.pulseBasePx)} + ${getGlslFloat(RING.pulseAmpPx)} * amp) * (1.0 - pow(1.0 - p, 2.0)) * k;
  float pulseA = isActive * (1.0 - p) * ${getGlslFloat(RING.pulseA)} * mix(${getGlslFloat(RING.backFlashK)}, 1.0, front);
  vPulse = vec4(hypocentre, pulsePx, pulseA);
  float feltPx = feltAngle >= ${getGlslFloat(Math.PI / 2)} ? 2.0 * uRadius : feltAngle * uRadius;
  float halfPx = max(max(feltPx, glowPx * sign(glowA)), max(markPx, vRings.x));
  halfPx = max(halfPx, (distance(epicentre, hypocentre) + pulsePx) * sign(pulseA)) + 2.0;
  vEpicentre = e;
  vColor = getFaceColor(aColor);
  vOffset = epicentre + position.xy * halfPx;
  gl_Position = getClipPosition(vOffset);
}
`;

export const RING_FRAGMENT_SHADER = `
uniform float uRadius;
uniform float uDpr;
varying vec2 vOffset;
varying vec3 vEpicentre;
varying vec3 vColor;
varying vec3 vFelt;
varying vec4 vRings;
varying vec4 vRingAlpha;
varying vec4 vPulse;

float getPixelDistance(float signedPx) {
  return signedPx / max(length(vec2(dFdx(signedPx), dFdy(signedPx))), 1e-4);
}

float getStroke(float deviceDistance, float widthPx) {
  return clamp(widthPx * uDpr * 0.5 + 0.5 - abs(deviceDistance), 0.0, 1.0);
}

float getRing(float distancePx, float radiusPx, float widthPx) {
  return getStroke((distancePx - radiusPx) * uDpr, widthPx);
}

void main() {
  vec2 q = vOffset / uRadius;
  float q2 = dot(q, q);
  float screenPx = length(vOffset - vEpicentre.xy * uRadius);
  float colorA = vRingAlpha.x * getRing(screenPx, vRings.x, ${getGlslFloat(FELT_RING_LOOK.strokePx)});
  colorA += vRingAlpha.y * max(0.0, 1.0 - screenPx / vRings.y);
  colorA += vPulse.w * getRing(length(vOffset - vPulse.xy), vPulse.z, ${getGlslFloat(RING.pulsePx)});
  vec3 surface = vec3(q, sqrt(max(1.0 - q2, 0.0)));
  float groundPx = 2.0 * asin(min(0.5 * length(surface - vEpicentre), 1.0)) * uRadius;
  float edge = getPixelDistance(min(groundPx - vFelt.x * uRadius, screenPx - vRings.x));
  if (vFelt.x > 0.0 && q2 <= 1.0) {
    colorA += vFelt.z * clamp(0.5 - edge, 0.0, 1.0) + vFelt.y * getStroke(edge, ${getGlslFloat(FELT_RING_LOOK.strokePx)});
  }
  float whiteA = vRingAlpha.z * getRing(screenPx, vRings.z, ${getGlslFloat(RING.markRingPx)});
  float alpha = colorA + whiteA;
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4((vColor * colorA + whiteA) / alpha, min(alpha, 1.0));
}
`;

export const PULSE_VERTEX_SHADER = `
${VIEW_CHUNK}
uniform vec3 uPulseDirection;
varying vec2 vOffset;

void main() {
  vec3 e = getRotated(uPulseDirection);
  if (e.z < 0.02) {
    cull();
    return;
  }
  vOffset = position.xy * ${getGlslFloat(ARRIVAL_PULSE.ringStartPx + ARRIVAL_PULSE.ringGrowPx + 2)};
  gl_Position = getClipPosition(e.xy * uRadius + vOffset);
}
`;

export const PULSE_FRAGMENT_SHADER = `
uniform float uDpr;
uniform vec3 uRingPx;
uniform vec3 uRingAlpha;
uniform float uGlowAlpha;
varying vec2 vOffset;

void main() {
  float d = length(vOffset);
  vec3 rings = clamp(uDpr * 0.5 + 0.5 - abs(d - uRingPx) * uDpr, 0.0, 1.0);
  float ringA = 1.0 - (1.0 - rings.x * uRingAlpha.x) * (1.0 - rings.y * uRingAlpha.y) * (1.0 - rings.z * uRingAlpha.z);
  float glowA = uGlowAlpha * max(0.0, 1.0 - d / ${getGlslFloat(ARRIVAL_PULSE.glowPx)});
  float alpha = glowA + ringA * (1.0 - glowA);
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(${getGlslRgb(ARRIVAL_PULSE.rgb)}, alpha);
}
`;
