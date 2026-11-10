import { P_WAVE_KM_S, S_WAVE_KM_S } from '@/lib/earthquakes/waves';
import { FELT_RING_LOOK } from '@/lib/globe/felt-rings';
import { EARTH_RADIUS_KM } from '@/lib/globe/quakes';

function getGlslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

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
varying vec4 vColor;
varying float vSize;

void main() {
  vec3 r = getRotated(position);
  float z = r.z;
  vec3 base = mix(uOcean, uLand, aLand);
  float face = 0.35 + 0.65 * z;
  float rim = pow(max(1.0 - z, 0.0), 5.0) * uRim;
  float vy = clamp((1.0 - r.y) * 0.5, 0.0, 1.0);
  vec3 tint = vec3(90.0 + 165.0 * vy, 210.0 - 90.0 * vy, 255.0 - 165.0 * vy) / 255.0;
  float alpha = min(1.0, mix(uOceanAlpha, uLandAlpha, aLand) * face + rim * 0.6);
  if (z < 0.0 || alpha <= 0.005) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vSize = uDotSize * mix(1.0, uLandScale, aLand) * (0.75 + 0.35 * z) * uDpr;
  vColor = vec4(mix(base, tint, min(rim, 1.0)), alpha);
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

export const QUAKE_VERTEX_SHADER = `
${VIEW_CHUNK}
attribute float aRadius;
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec4 vColor;
varying float vSize;

void main() {
  vec3 r = getRotated(position);
  if (r.z < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vSize = 2.0 * aSize * uDpr;
  vColor = vec4(aColor, aAlpha);
  gl_PointSize = ceil(vSize) + 2.0;
  gl_Position = getClipPosition(r.xy * aRadius * uRadius);
}
`;

export const QUAKE_FRAGMENT_SHADER = `
varying vec4 vColor;
varying float vSize;

void main() {
  float offset = length(gl_PointCoord - 0.5) * (ceil(vSize) + 2.0);
  float coverage = clamp(vSize * 0.5 + 0.5 - offset, 0.0, 1.0);
  if (coverage <= 0.0) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * coverage);
}
`;

export const NEEDLE_VERTEX_SHADER = `
${VIEW_CHUNK}
attribute float aRadius;
attribute vec3 aColor;
attribute float aAlpha;
varying vec4 vColor;

void main() {
  vec3 r = getRotated(position);
  if (r.z < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vColor = vec4(aColor, aAlpha);
  gl_Position = getClipPosition(r.xy * aRadius * uRadius);
}
`;

export const NEEDLE_FRAGMENT_SHADER = `
varying vec4 vColor;

void main() {
  gl_FragColor = vColor;
}
`;

export const RING_VERTEX_SHADER = `
${VIEW_CHUNK}
attribute vec3 aDirection;
attribute float aReachAngle;
attribute float aMinPx;
attribute vec3 aColor;
attribute float aDepthKm;
attribute float aLife;
attribute float aGlowPx;
attribute float aWaveStart;
uniform float uTime;
varying vec2 vOffset;
varying vec3 vEpicentre;
varying vec3 vColor;
varying float vReachAngle;
varying float vMinPx;
varying float vGlowPx;
varying float vProgress;
varying float vSAngle;
varying float vPAngle;

float getProgress() {
  if (aWaveStart < 0.0 || aReachAngle <= 0.0) return -1.0;
  float progress = (uTime - aWaveStart) / aLife;
  if (progress < 0.0 || progress > 1.0) return -1.0;
  return progress;
}

float getFrontKm(float seconds, float speedKmS) {
  float slantKm = max(seconds, 0.0) * speedKmS;
  return sqrt(max(slantKm * slantKm - aDepthKm * aDepthKm, 0.0));
}

float getQuadHalfPx() {
  float ringPx = aReachAngle >= ${getGlslFloat(Math.PI / 2)} ? 2.0 * uRadius : aReachAngle * uRadius;
  return max(max(ringPx, aMinPx), aGlowPx) + 2.0;
}

void main() {
  vec3 e = getRotated(aDirection);
  if (e.z < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float progress = getProgress();
  float reachKm = aReachAngle * ${getGlslFloat(EARTH_RADIUS_KM)};
  float seconds = clamp(progress, 0.0, 1.0) * length(vec2(reachKm, aDepthKm)) / ${getGlslFloat(S_WAVE_KM_S)};
  float pKm = getFrontKm(seconds, ${getGlslFloat(P_WAVE_KM_S)});
  vSAngle = getFrontKm(seconds, ${getGlslFloat(S_WAVE_KM_S)}) / ${getGlslFloat(EARTH_RADIUS_KM)};
  vPAngle = pKm > reachKm ? -1.0 : pKm / ${getGlslFloat(EARTH_RADIUS_KM)};
  vProgress = progress;
  vEpicentre = e;
  vColor = aColor;
  vReachAngle = aReachAngle;
  vMinPx = aMinPx;
  vGlowPx = aGlowPx;
  vOffset = e.xy * uRadius + position.xy * getQuadHalfPx();
  gl_Position = getClipPosition(vOffset);
}
`;

export const RING_FRAGMENT_SHADER = `
uniform float uRadius;
uniform float uDpr;
varying vec2 vOffset;
varying vec3 vEpicentre;
varying vec3 vColor;
varying float vReachAngle;
varying float vMinPx;
varying float vGlowPx;
varying float vProgress;
varying float vSAngle;
varying float vPAngle;

float getPixelDistance(float signedPx) {
  return signedPx / max(length(vec2(dFdx(signedPx), dFdy(signedPx))), 1e-4);
}

float getStroke(float pixelDistance, float widthPx) {
  return clamp(widthPx * uDpr * 0.5 + 0.5 - abs(pixelDistance), 0.0, 1.0);
}

float getStaticAlpha(float pixelDistance) {
  float stroke = getStroke(pixelDistance, ${getGlslFloat(FELT_RING_LOOK.strokePx)});
  if (vReachAngle <= 0.0) return ${getGlslFloat(FELT_RING_LOOK.hollowA)} * stroke;
  float fill = clamp(0.5 - pixelDistance, 0.0, 1.0);
  return ${getGlslFloat(FELT_RING_LOOK.fillA)} * fill * (1.0 - stroke) + ${getGlslFloat(FELT_RING_LOOK.strokeA)} * stroke;
}

float getWaveAlpha(float sDistance, float pDistance, float screenPx) {
  float s = getStroke(sDistance, ${getGlslFloat(FELT_RING_LOOK.frontPx)});
  float p = step(0.0, vPAngle) * ${getGlslFloat(FELT_RING_LOOK.pFrontK)} * getStroke(pDistance, ${getGlslFloat(FELT_RING_LOOK.frontPx)});
  float glow = pow(max(1.0 - screenPx / vGlowPx, 0.0), 2.0);
  return (1.0 - vProgress) * (${getGlslFloat(FELT_RING_LOOK.frontA)} * (s + p) + ${getGlslFloat(FELT_RING_LOOK.glowA)} * glow);
}

void main() {
  vec2 q = vOffset / uRadius;
  float q2 = dot(q, q);
  vec3 surface = vec3(q, sqrt(max(1.0 - q2, 0.0)));
  float groundPx = 2.0 * asin(min(0.5 * length(surface - vEpicentre), 1.0)) * uRadius;
  float screenPx = length(vOffset - vEpicentre.xy * uRadius);
  float minSigned = screenPx - vMinPx;
  float staticSigned = vReachAngle > 0.0 ? min(groundPx - vReachAngle * uRadius, minSigned) : minSigned;
  float staticDistance = getPixelDistance(staticSigned);
  float sDistance = getPixelDistance(groundPx - vSAngle * uRadius);
  float pDistance = getPixelDistance(groundPx - vPAngle * uRadius);
  float alpha = vProgress < 0.0 ? getStaticAlpha(staticDistance) : getWaveAlpha(sDistance, pDistance, screenPx);
  if (q2 > 1.0 || alpha <= 0.0) discard;
  gl_FragColor = vec4(vColor, min(alpha, 1.0));
}
`;
