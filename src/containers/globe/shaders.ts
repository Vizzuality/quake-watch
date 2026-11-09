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
uniform float uFront;
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
  float front = step(0.0, z);
  vec3 base = mix(uOcean, uLand, aLand);
  float face = mix(0.18 * (1.0 + z), 0.35 + 0.65 * z, front);
  float rim = pow(1.0 - abs(z), 5.0) * uRim;
  float vy = clamp((1.0 - r.y) * 0.5, 0.0, 1.0);
  vec3 tint = vec3(90.0 + 165.0 * vy, 210.0 - 90.0 * vy, 255.0 - 165.0 * vy) / 255.0;
  float alpha = min(1.0, mix(uOceanAlpha, uLandAlpha, aLand) * face + rim * 0.6 * mix(0.5, 1.0, front));
  if (front != uFront || alpha <= 0.005) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vSize = uDotSize * mix(1.0, uLandScale, aLand) * mix(0.6, 0.75 + 0.35 * z, front) * uDpr;
  vColor = vec4(mix(base, tint, rim), alpha);
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
uniform float uExtent;
varying vec2 vOffset;

void main() {
  vOffset = position.xy * uRadius * uExtent;
  gl_Position = getClipPosition(vOffset);
}
`;

export const GLOW_FRAGMENT_SHADER = `
uniform float uRadius;
uniform float uFrom;
uniform float uTo;
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vOffset;

void main() {
  float t = clamp((length(vOffset) / uRadius - uFrom) / (uTo - uFrom), 0.0, 1.0);
  gl_FragColor = vec4(uColor, uAlpha * (1.0 - t));
}
`;

export const VEIL_FRAGMENT_SHADER = `
uniform float uRadius;
uniform float uDpr;
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vOffset;

void main() {
  float coverage = clamp((uRadius - length(vOffset)) * uDpr + 0.5, 0.0, 1.0);
  if (coverage <= 0.0) discard;
  gl_FragColor = vec4(uColor, uAlpha * coverage);
}
`;

export const BORDER_VERTEX_SHADER = `
${VIEW_CHUNK}
varying float vDepth;

void main() {
  vec3 r = getRotated(position);
  vDepth = r.z;
  gl_Position = getClipPosition(r.xy * uRadius);
}
`;

export const BORDER_FRAGMENT_SHADER = `
uniform float uAlpha;
varying float vDepth;

void main() {
  if (vDepth < 0.0) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, uAlpha);
}
`;
