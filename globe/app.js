/*
 * Interactive Earth sea-level globe renderer.
 * Adapted from MIT-licensed source; see LICENSE for the required notice.
 *
 * Rendering: a lon/lat grid mesh is projected either as an equirectangular
 * flat map (drawn in wrapping copies for seamless horizontal panning) or as
 * an orthographic globe; the vertex shader blends the two by uMorph, so
 * zooming out "rolls" the map onto a sphere. The fragment shader decodes a
 * 16-bit elevation heightmap packed into the R/G channels of a PNG, colors
 * ocean and land, and draws screen-space contour lines, coastline, and hillshade.
 */

'use strict';

const DEG_R = 57.29577951308232; // 180/pi: globe radius = scale(px/deg) * DEG_R
const SEA_LEVEL = 50;

// ---------------------------------------------------------------- shaders

const MESH_VS = `#version 300 es
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

const MESH_FS = `#version 300 es
precision highp float;
in vec2 vLonLat;
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform float uSeaLevel;
uniform float uInterval;
uniform float uAlpha;
uniform float uMetersPerPx;
out vec4 fragColor;

const vec3 OCEAN_COLOR = vec3(0.1);
const vec3 LAND_COLOR = vec3(0.4);
const vec3 CONTOUR_COLOR = vec3(1.0);

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

  vec3 col = water ? OCEAN_COLOR : LAND_COLOR;

  if (!water) {
    vec2 g = vec2(dFdx(e), dFdy(e)) / max(uMetersPerPx, 1.0);
    vec3 n = normalize(vec3(-g.x, -g.y, 1.8));
    float lit = clamp(dot(n, normalize(vec3(-0.55, 0.62, 0.72))), 0.0, 1.0);
    col *= 0.68 + 0.32 * (0.35 + 1.15 * lit);

    float f = rel / uInterval;
    float fadeMinor = 1.0 - smoothstep(0.30, 0.65, fwidth(f));
    float fadeMajor = 1.0 - smoothstep(0.30, 0.65, fwidth(f) / 5.0);
    col = mix(col, CONTOUR_COLOR, lineAA(f, 1.0) * 0.78 * fadeMinor);
    col = mix(col, CONTOUR_COLOR, lineAA(f / 5.0, 1.25) * 0.95 * fadeMajor);
  }

  float coast = 1.0 - smoothstep(0.0, 1.0, abs(rel) / max(fwidth(rel), 1e-7));

  vec2 gf = vLonLat / 15.0;
  vec2 gg = abs(fract(gf + 0.5) - 0.5) / max(fwidth(gf), vec2(1e-7));
  float grat = 1.0 - smoothstep(0.0, 1.0, min(gg.x, gg.y));
  float gridAlpha = grat * 1.0;
  vec3 gridColor = vec3(0.2);

  float surfaceAlpha = water ? 0.0 : 0.1;
  float baseAlpha = gridAlpha + surfaceAlpha * (1.0 - gridAlpha);
  vec3 baseColor = (
    gridColor * gridAlpha + col * surfaceAlpha * (1.0 - gridAlpha)
  ) / max(baseAlpha, 1e-6);
  float coastCoverage = coast * 1.0;
  vec3 coastColor = vec3(0.9);
  float finalAlpha = coastCoverage + baseAlpha * (1.0 - coastCoverage);
  vec3 finalColor = (
    coastColor * coastCoverage + baseColor * baseAlpha * (1.0 - coastCoverage)
  ) / max(finalAlpha, 1e-6);
  fragColor = vec4(finalColor, finalAlpha * uAlpha);
}`;

const BG_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const BG_FS = `#version 300 es
precision highp float;
uniform vec2 uViewport;
uniform float uR;
uniform float uMorph;
out vec4 fragColor;
void main() {
  float d = length(gl_FragCoord.xy - uViewport * 0.5) - uR;
  float glow = 0.0;
  if (d > 0.0 && uMorph > 0.01) {
    glow = (exp(-d / (uR * 0.05)) * 0.5 + exp(-d / (uR * 0.18)) * 0.13) * uMorph;
  }
  float alpha = clamp(glow, 0.0, 0.0);
  fragColor = vec4(vec3(0.1) * alpha, alpha);
}`;

// ----------------------------------------------------------- GL utilities

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Shader error: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function makeProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('Link error: ' + gl.getProgramInfoLog(p));
  }
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name;
    uniforms[name] = gl.getUniformLocation(p, name);
  }
  return { prog: p, u: uniforms };
}

// ------------------------------------------------------------- data load

async function decodeElevation(url) {
  // Load through an image element so the globe also works when the site is
  // opened directly from disk, where fetch() cannot read file:// URLs.
  const img = new Image();
  img.src = new URL(url, import.meta.url);
  try {
    await img.decode();
  } catch (err) {
    throw new Error(`Could not decode elevation image ${img.src}: ${err.message}`);
  }
  let bmp;
  try {
    bmp = await createImageBitmap(img, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    });
  } catch (_) {
    // older Safari rejects the options bag; the PNG is fully opaque, so
    // premultiplication is a no-op and a plain decode is still lossless
    bmp = await createImageBitmap(img);
  }
  const W = bmp.width, H = bmp.height;
  const cnv = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(W, H)
    : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const px = ctx.getImageData(0, 0, W, H).data;
  return { W, H, px };
}

// ------------------------------------------------------------------ main

function main() {
  const canvas = document.getElementById('map');
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    depth: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  if (!gl) {
    console.error('WebGL2 is not available; the globe cannot render.');
    return;
  }

  const mesh = makeProgram(gl, MESH_VS, MESH_FS);
  const bg = makeProgram(gl, BG_VS, BG_FS);

  // lon/lat grid mesh
  const SEG_X = 24, SEG_Y = 12;
  let meshVao;
  {
    const verts = new Float32Array((SEG_X + 1) * (SEG_Y + 1) * 2);
    let vi = 0;
    for (let y = 0; y <= SEG_Y; y++) {
      for (let x = 0; x <= SEG_X; x++) {
        verts[vi++] = -180 + (360 * x) / SEG_X;
        verts[vi++] = 90 - (180 * y) / SEG_Y;
      }
    }
    const idx = new Uint32Array(SEG_X * SEG_Y * 6);
    let ii = 0;
    for (let y = 0; y < SEG_Y; y++) {
      for (let x = 0; x < SEG_X; x++) {
        const a = y * (SEG_X + 1) + x, b = a + 1, c = a + SEG_X + 1, d = c + 1;
        idx[ii++] = a; idx[ii++] = c; idx[ii++] = b;
        idx[ii++] = b; idx[ii++] = c; idx[ii++] = d;
      }
    }
    meshVao = gl.createVertexArray();
    gl.bindVertexArray(meshVao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  }
  const MESH_COUNT = SEG_X * SEG_Y * 6;
  const bgVao = gl.createVertexArray();

  // elevation texture
  const elevTex = gl.createTexture();
  let data = null; // { W, H, px }
  function uploadElevation(d) {
    data = d;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, elevTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, d.W, d.H, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array(d.px.buffer, d.px.byteOffset, d.px.length));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    dirty = true;
  }

  // --------------------------------------------------------- view state

  const params = new URLSearchParams(location.search);
  const num = (k, d) => (params.has(k) && isFinite(+params.get(k)) ? +params.get(k) : d);

  let vw = 0, vh = 0, dpr = 1;
  const view = {
    lon: num('lon', 105),
    lat: num('lat', 25),
    s: num('z', 0), // px per degree; 0 -> globe fit, resolved on first resize
  };
  let interacted = num('spin', 1) === 0;
  let dirty = true;
  let dataError = false;

  const sMax = 140;
  const sMin = () => 0.44 * Math.min(vw, vh) / DEG_R;
  const morphT = (s) => {
    const e0 = sMin() * 1.15, e1 = sMin() * 2.6;
    const x = Math.min(1, Math.max(0, (s - e0) / (e1 - e0)));
    return 1 - x * x * (3 - 2 * x);
  };
  const wrapLon = (x) => ((((x + 180) % 360) + 360) % 360) - 180;

  function clampView() {
    view.s = Math.min(sMax, Math.max(sMin(), view.s));
    const t = morphT(view.s);
    const hh = vh / 2 / view.s;
    const flatLimit = Math.max(0, 90 - hh);
    const limit = flatLimit * (1 - t) + 90 * t;
    view.lat = Math.min(limit, Math.max(-limit, view.lat));
    view.lon = wrapLon(view.lon);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = canvas.clientWidth;
    vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    if (view.s === 0) view.s = sMin();
    clampView();
    dirty = true;
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------- render

  function autoInterval(s) {
    if (s < 3) return 1000;
    if (s < 10) return 500;
    if (s < 30) return 200;
    if (s < 80) return 100;
    return 50;
  }

  function draw() {
    const t = morphT(view.s);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    gl.useProgram(bg.prog);
    gl.bindVertexArray(bgVao);
    gl.uniform2f(bg.u.uViewport, canvas.width, canvas.height);
    gl.uniform1f(bg.u.uR, view.s * DEG_R * dpr);
    gl.uniform1f(bg.u.uMorph, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!data) return;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(mesh.prog);
    gl.bindVertexArray(meshVao);
    gl.uniform1i(mesh.u.uTex, 0);
    gl.uniform2f(mesh.u.uTexSize, data.W, data.H);
    gl.uniform2f(mesh.u.uCenter, view.lon, view.lat);
    gl.uniform1f(mesh.u.uScale, view.s);
    gl.uniform1f(mesh.u.uMorph, t);
    gl.uniform2f(mesh.u.uViewport, vw, vh);
    gl.uniform1f(mesh.u.uSeaLevel, SEA_LEVEL);
    gl.uniform1f(mesh.u.uInterval, autoInterval(view.s));
    gl.uniform1f(mesh.u.uMetersPerPx, 111320 / (view.s * dpr));

    const halfW = vw / 2 / view.s;
    for (let k = -3; k <= 3; k++) {
      if (k !== 0 && t > 0.95) continue;
      const lo = k * 360 - 180 - view.lon, hi = k * 360 + 180 - view.lon;
      if (hi < -halfW || lo > halfW) continue;
      gl.uniform1f(mesh.u.uCopyOffset, k * 360);
      gl.uniform1f(mesh.u.uAlpha, k === 0 ? 1 : 1 - t);
      gl.drawElements(gl.TRIANGLES, MESH_COUNT, gl.UNSIGNED_INT, 0);
    }
  }

  // ---------------------------------------------------------- animation

  let zoomAnim = null; // { s0, s1, lon0, lon1, lat0, lat1, t0, dur }

  function frame(now) {
    requestAnimationFrame(frame);
    if (morphT(view.s) === 1 && data && !dataError) {
      view.lon = wrapLon(view.lon + 0.06);
      dirty = true;
    }
    if (zoomAnim) {
      const a = Math.min(1, (now - zoomAnim.t0) / zoomAnim.dur);
      const e = 1 - (1 - a) * (1 - a);
      view.s = zoomAnim.s0 + (zoomAnim.s1 - zoomAnim.s0) * e;
      view.lon = zoomAnim.lon0 + (zoomAnim.lon1 - zoomAnim.lon0) * e;
      view.lat = zoomAnim.lat0 + (zoomAnim.lat1 - zoomAnim.lat0) * e;
      clampView();
      if (a >= 1) zoomAnim = null;
      dirty = true;
    }
    if (dirty) {
      dirty = false;
      draw();
      scheduleUrlUpdate();
    }
  }

  function animateZoomTo(s1, lon1, lat1, dur = 400) {
    zoomAnim = {
      s0: view.s, s1, lon0: view.lon, lon1: lon1 ?? view.lon,
      lat0: view.lat, lat1: lat1 ?? view.lat, t0: performance.now(), dur,
    };
  }

  // -------------------------------------------------------- interaction

  function screenToLonLat(px, py) {
    const t = morphT(view.s);
    if (t < 0.5) {
      return [wrapLon(view.lon + (px - vw / 2) / view.s), view.lat - (py - vh / 2) / view.s];
    }
    const R = view.s * DEG_R;
    const X = (px - vw / 2) / R, Y = -(py - vh / 2) / R;
    const r2 = X * X + Y * Y;
    if (r2 > 1) return null;
    const Z = Math.sqrt(1 - r2);
    const phi0 = view.lat / DEG_R;
    const y = Y * Math.cos(phi0) + Z * Math.sin(phi0);
    const z = -Y * Math.sin(phi0) + Z * Math.cos(phi0);
    return [wrapLon(view.lon + Math.atan2(X, z) * DEG_R), Math.asin(Math.max(-1, Math.min(1, y))) * DEG_R];
  }

  function zoomAt(px, py, factor) {
    const t = morphT(view.s);
    const before = t < 0.5 ? screenToLonLat(px, py) : null;
    view.s = Math.min(sMax, Math.max(sMin(), view.s * factor));
    if (before && morphT(view.s) < 0.5) {
      view.lon = before[0] - (px - vw / 2) / view.s;
      view.lat = before[1] + (py - vh / 2) / view.s;
    }
    clampView();
    dirty = true;
  }

  const pointers = new Map();
  let pinchDist = 0;

  canvas.addEventListener('pointerdown', (ev) => {
    interacted = true;
    try { canvas.setPointerCapture(ev.pointerId); } catch (_) { /* synthetic events */ }
    pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    canvas.classList.add('dragging');
    zoomAnim = null;
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    const prev = pointers.get(ev.pointerId);
    pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pointers.size === 1) {
      view.lon -= (ev.clientX - prev[0]) / view.s;
      view.lat += (ev.clientY - prev[1]) / view.s;
      clampView();
      dirty = true;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinchDist > 0 && d > 0) {
        zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinchDist);
      }
      pinchDist = d;
    }
  });

  const endPointer = (ev) => {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 0) canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    interacted = true;
    zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.0016));
  }, { passive: false });

  canvas.addEventListener('dblclick', (ev) => {
    interacted = true;
    zoomAt(ev.clientX, ev.clientY, 1.7);
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT') return;
    const pan = 60 / view.s;
    let handled = true;
    if (ev.key === '+' || ev.key === '=') zoomAt(vw / 2, vh / 2, 1.35);
    else if (ev.key === '-') zoomAt(vw / 2, vh / 2, 1 / 1.35);
    else if (ev.key === 'ArrowLeft') view.lon -= pan;
    else if (ev.key === 'ArrowRight') view.lon += pan;
    else if (ev.key === 'ArrowUp') view.lat += pan;
    else if (ev.key === 'ArrowDown') view.lat -= pan;
    else if (ev.key === 'Home') animateZoomTo(sMin());
    else handled = false;
    if (handled) {
      interacted = true;
      clampView();
      dirty = true;
      ev.preventDefault();
    }
  });

  // ----------------------------------------------------------------- UI

  // shareable URL
  let urlTimer = 0;
  function scheduleUrlUpdate() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const p = new URLSearchParams();
      p.set('lon', view.lon.toFixed(2));
      p.set('lat', view.lat.toFixed(2));
      p.set('z', view.s.toFixed(2));
      history.replaceState(null, '', '?' + p.toString());
    }, 500);
  }

  // ------------------------------------------------------------ terrain load
  (async () => {
    try {
      uploadElevation(await decodeElevation('elev-1080.png'));
    } catch (err) {
      console.error('Failed to load globe elevation data.', err);
      dataError = true;
    }
  })();

  canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    location.reload();
  });

  requestAnimationFrame(frame);
}

main();
