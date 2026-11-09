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
