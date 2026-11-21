/*
 * globe-shaders.js - GLSL for the globe mesh (see src/js/globe.js).
 *
 * The vertex shader blends an equirectangular flat map and an orthographic
 * globe by uMorph. The fragment shader decodes the 16-bit heightmap packed
 * into R/G, colors ocean and land, and draws contours, coastline and hillshade.
 */

import { DEG_R } from './globe-gl.js';

// Water deeper than this (below the current sea level) does not affect the
// coastline. elev-1080.webp flattens deep ocean on that assumption, so keep it
// equal to COAST_BAND_M in tools/make-elevation-webp.py. Requires sea level >= 0.
const COAST_BAND_M = 2000;

export const MESH_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aLonLat;
uniform vec2 uCenter;
uniform float uScale;
uniform float uMorph;
uniform vec2 uViewport;
uniform float uCopyOffset;
out vec2 vLonLat;
void main() {
  float lon = aLonLat.x + uCopyOffset;
  float lat = aLonLat.y;
  vLonLat = vec2(lon, lat);
  float dlon = lon - uCenter.x;
  vec2 flatPos = vec2(dlon, lat - uCenter.y) * uScale;
  float R = uScale * ${DEG_R};
  float lam = radians(dlon);
  float phi = radians(lat);
  float phi0 = radians(uCenter.y);
  vec3 p = vec3(cos(phi) * sin(lam), sin(phi), cos(phi) * cos(lam));
  float y2 = p.y * cos(phi0) - p.z * sin(phi0);
  float z2 = p.y * sin(phi0) + p.z * cos(phi0);
  vec2 globePos = vec2(p.x, y2) * R;
  vec2 pos = mix(flatPos, globePos, uMorph);
  gl_Position = vec4(pos * 2.0 / uViewport, -z2 * uMorph * 0.5, 1.0);
}`;

export const MESH_FS = `#version 300 es
precision highp float;
in vec2 vLonLat;
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform float uSeaLevel;
uniform float uInterval;
uniform float uAlpha;
uniform float uMetersPerPx;
out vec4 fragColor;

uniform vec3 uOceanColor;
uniform vec3 uLandColor;
uniform vec3 uContourColor;
uniform vec3 uGridColor;
uniform vec3 uCoastColor;

float decode(vec4 c) { return c.r * 65280.0 + c.g * 255.0 - 11000.0; }

float elevAt(vec2 ll) {
  float W = uTexSize.x, H = uTexSize.y;
  float fx = (ll.x + 180.0) / 360.0 * W;
  float fy = (90.0 - ll.y) / 180.0 * H;
  fx -= W * floor(fx / W);
  fy = clamp(fy, 0.0, H - 1.0001);
  float x0 = floor(fx), y0 = floor(fy);
  vec2 f = vec2(fx - x0, fy - y0);
  int ix0 = int(x0), iy0 = int(y0);
  int ix1 = ix0 + 1 == int(W) ? 0 : ix0 + 1;
  int iy1 = min(iy0 + 1, int(H) - 1);
  float e00 = decode(texelFetch(uTex, ivec2(ix0, iy0), 0));
  float e10 = decode(texelFetch(uTex, ivec2(ix1, iy0), 0));
  float e01 = decode(texelFetch(uTex, ivec2(ix0, iy1), 0));
  float e11 = decode(texelFetch(uTex, ivec2(ix1, iy1), 0));
  return mix(mix(e00, e10, f.x), mix(e01, e11, f.x), f.y);
}

float lineAA(float f, float w) {
  float d = abs(fract(f + 0.5) - 0.5) / max(fwidth(f), 1e-7);
  return 1.0 - smoothstep(0.0, w, d);
}

void main() {
  float e = elevAt(vLonLat);
  float rel = e - uSeaLevel;
  bool water = rel < 0.0;

  vec3 col = water ? uOceanColor : uLandColor;

  if (!water) {
    vec2 g = vec2(dFdx(e), dFdy(e)) / max(uMetersPerPx, 1.0);
    vec3 n = normalize(vec3(-g.x, -g.y, 1.8));
    float lit = clamp(dot(n, normalize(vec3(-0.55, 0.62, 0.72))), 0.0, 1.0);
    col *= 0.68 + 0.32 * (0.35 + 1.15 * lit);

    float f = rel / uInterval;
    float fadeMinor = 1.0 - smoothstep(0.30, 0.65, fwidth(f));
    float fadeMajor = 1.0 - smoothstep(0.30, 0.65, fwidth(f) / 5.0);
    col = mix(col, uContourColor, lineAA(f, 1.0) * 0.78 * fadeMinor);
    col = mix(col, uContourColor, lineAA(f / 5.0, 1.25) * 0.95 * fadeMajor);
  }

  // Clamp the water side so deep (flattened) ocean cannot add offshore lines.
  float relCoast = max(rel, -${COAST_BAND_M.toFixed(1)});
  float coast = 1.0 - smoothstep(0.0, 1.0, abs(relCoast) / max(fwidth(relCoast), 1e-7));

  vec2 gf = vLonLat / 15.0;
  vec2 gg = abs(fract(gf + 0.5) - 0.5) / max(fwidth(gf), vec2(1e-7));
  float grat = 1.0 - smoothstep(0.0, 1.0, min(gg.x, gg.y));
  float gridAlpha = grat * 1.0;
  vec3 gridColor = uGridColor;

  float surfaceAlpha = water ? 0.0 : 0.1;
  float baseAlpha = gridAlpha + surfaceAlpha * (1.0 - gridAlpha);
  vec3 baseColor = (
    gridColor * gridAlpha + col * surfaceAlpha * (1.0 - gridAlpha)
  ) / max(baseAlpha, 1e-6);
  float coastCoverage = coast * 1.0;
  vec3 coastColor = uCoastColor;
  float finalAlpha = coastCoverage + baseAlpha * (1.0 - coastCoverage);
  vec3 finalColor = (
    coastColor * coastCoverage + baseColor * baseAlpha * (1.0 - coastCoverage)
  ) / max(finalAlpha, 1e-6);
  fragColor = vec4(finalColor, finalAlpha * uAlpha);
}`;
