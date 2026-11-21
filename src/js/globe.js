import { motionPreference } from './motion.js';
import { DEG_R, makeProgram, decodeElevation } from './globe-gl.js';
import { MESH_VS, MESH_FS } from './globe-shaders.js';
import { createGlobeMarkers } from './globe-markers.js';
/*
 * Interactive Earth sea-level globe renderer.
 * Adapted from MIT-licensed source.
 *
 * Rendering: a lon/lat grid mesh is projected either as an equirectangular
 * flat map (drawn in wrapping copies for seamless horizontal panning) or as
 * an orthographic globe; the vertex shader blends the two by uMorph, so
 * zooming out "rolls" the map onto a sphere. The fragment shader decodes a
 * 16-bit elevation heightmap packed into the R/G channels of a PNG, colors
 * ocean and land, and draws screen-space contour lines, coastline, and hillshade.
 *
 * Split across: globe-shaders.js (GLSL), globe-gl.js (GL and elevation helpers),
 * globe-markers.js (hotspot buttons). This file owns the view, render loop and input.
 */

'use strict';

const DEFAULT_SEA_LEVEL = 50; // 2200 value, keeps today's look as the fallback

// Resolved from src/js/. The WebP is the shipped file; the PNG is the untouched
// source, only fetched if the WebP cannot be decoded.
const ELEVATION_SOURCES = ['../../data/elev-1080.webp', '../../data/elev-1080.png'];

const GLOBE_COLORS = {
  dark: { ocean: [0.1, 0.1, 0.1], land: [0.4, 0.4, 0.4], contour: [1,1,1], grid: [0.2,0.2,0.2], coast: [0.9,0.9,0.9] },
  light: { ocean: [0.8, 0.8, 0.8], land: [0.6, 0.6, 0.6], contour: [0,0,0], grid: [0.7,0.7,0.7], coast: [0.1,0.1,0.1] }
};

// ------------------------------------------------------------------ main

function main() {
  const canvas = document.getElementById('map');
  const markerLayer = document.getElementById('globe-markers');
  if (!markerLayer) {
    console.error('The globe marker layer is missing; markers cannot be displayed.');
    return;
  }
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

  // elevation texture
  const elevTex = gl.createTexture();
  let data = null;
  function uploadElevation(d) {
    data = { W: d.W, H: d.H };
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, elevTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    if (d.bmp) {
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, d.bmp);
      } finally {
        d.bmp.close();
      }
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, d.W, d.H, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array(d.px.buffer, d.px.byteOffset, d.px.length));
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    dirty = true;
  }

  // --------------------------------------------------------- view state

  const params = new URLSearchParams(canvas.dataset.view || location.search);
  const num = (k, d) => (params.has(k) && isFinite(+params.get(k)) ? +params.get(k) : d);

  const markers = createGlobeMarkers(markerLayer, canvas);
  const coordinateReadout = document.createElement('output');
  coordinateReadout.className = 'globe-coordinates';
  coordinateReadout.setAttribute('aria-label', 'Cursor coordinates');
  coordinateReadout.hidden = true;
  canvas.parentElement.append(coordinateReadout);
  let pointerPosition = null;

  let vw = 0, vh = 0, dpr = 1;
  const reducedMotion = motionPreference;
  const view = {
    lon: num('lon', 105),
    lat: num('lat', 25),
    s: num('z', 0), // px per degree; 0 -> globe fit, resolved on first resize
  };
  let interacted = num('spin', 1) === 0;
  let dirty = true;
  let seaLevel = Number.isFinite(window.__seaLevel) ? window.__seaLevel : DEFAULT_SEA_LEVEL;
  window.addEventListener('sealevelchange', (ev) => {
    seaLevel = ev.detail.meters;
    dirty = true;
  });
  // Markers are only positioned while the globe is emphasized (the marker layer is
  // invisible and inert otherwise), so redraw once when that class changes.
  new MutationObserver(() => { dirty = true; })
    .observe(canvas, { attributes: true, attributeFilter: ['class'] });
  let dataError = false;
  let lastFrame = performance.now();
  const SPIN_DEG_PER_SEC = 3.6; // constant angular velocity
  const AUTO_SPIN_MIN_MORPH = 0.8;
  // While content covers the globe it is only a faint backdrop (see .globe-canvas.is-loaded
  // in globe.css), so it redraws less often. It runs at the full rate while the globe is the
  // focus or an animation is playing. The spin uses real elapsed time, so its speed is the same.
  const FRAME_MS_FOCUSED = 33;  // about 30 fps
  const FRAME_MS_BACKDROP = 80; // about 12 fps

  const sMax = 7;
  const sMin = () => 240 / DEG_R;
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
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    vw = canvas.clientWidth;
    vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    if (view.s === 0) view.s = sMin();
    clampView();
    dirty = true;
  }
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(canvas);
  }
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
    updateCoordinateReadout();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

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
    gl.uniform1f(mesh.u.uSeaLevel, seaLevel);
    gl.uniform1f(mesh.u.uInterval, autoInterval(view.s));
    gl.uniform1f(mesh.u.uMetersPerPx, 111320 / (view.s * dpr));

    const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    const c = GLOBE_COLORS[theme];
    gl.uniform3fv(mesh.u.uOceanColor, c.ocean);
    gl.uniform3fv(mesh.u.uLandColor, c.land);
    gl.uniform3fv(mesh.u.uContourColor, c.contour);
    gl.uniform3fv(mesh.u.uGridColor, c.grid);
    gl.uniform3fv(mesh.u.uCoastColor, c.coast);

    const halfW = vw / 2 / view.s;
    for (let k = -3; k <= 3; k++) {
      if (k !== 0 && t > 0.95) continue;
      const lo = k * 360 - 180 - view.lon, hi = k * 360 + 180 - view.lon;
      if (hi < -halfW || lo > halfW) continue;
      gl.uniform1f(mesh.u.uCopyOffset, k * 360);
      gl.uniform1f(mesh.u.uAlpha, k === 0 ? 1 : 1 - t);
      gl.drawElements(gl.TRIANGLES, MESH_COUNT, gl.UNSIGNED_INT, 0);
    }
    markers.render(view, vw, vh, t, halfW);
  }

  // ---------------------------------------------------------- animation

  let zoomAnim = null; // { s0, s1, lon0, lon1, lat0, lat1, t0, dur }

  let hidden = document.hidden || false;
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (!hidden) {
      lastFrame = performance.now();
      requestAnimationFrame(frame);
    }
  });

  function frame(now) {
    if (hidden) return; // pause when tab hidden
    requestAnimationFrame(frame);
    const minFrameMs = canvas.classList.contains('is-emphasized') || zoomAnim
      ? FRAME_MS_FOCUSED : FRAME_MS_BACKDROP;
    if (now - lastFrame < minFrameMs) return;
    if (data && !dataError && !reducedMotion.matches
      && morphT(view.s) >= AUTO_SPIN_MIN_MORPH) {
      const dt = (now - lastFrame) / 1000;
      view.lon = wrapLon(view.lon + SPIN_DEG_PER_SEC * dt);
      dirty = true;
    }
    lastFrame = now;
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
      if (data) canvas.classList.add('is-loaded');
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

  function updateCoordinateReadout() {
    if (!pointerPosition) {
      coordinateReadout.hidden = true;
      return;
    }
    const coordinates = screenToLonLat(pointerPosition.x, pointerPosition.y);
    if (!coordinates || coordinates[1] < -90 || coordinates[1] > 90) {
      coordinateReadout.hidden = true;
      return;
    }
    const [lon, lat] = coordinates;
    coordinateReadout.textContent = `LAT ${lat >= 0 ? '+' : ''}${lat.toFixed(2)}°   LON ${lon >= 0 ? '+' : ''}${lon.toFixed(2)}°`;
    coordinateReadout.hidden = false;
  }

  const globePreview = canvas.parentElement;
  globePreview.addEventListener('pointermove', (ev) => {
    const bounds = canvas.getBoundingClientRect();
    pointerPosition = { x: ev.clientX - bounds.left, y: ev.clientY - bounds.top };
    dirty = true;
  });
  globePreview.addEventListener('pointerleave', () => {
    pointerPosition = null;
    coordinateReadout.hidden = true;
  });

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
    if (pointers.size === 0) {
      canvas.classList.remove('dragging');
      dirty = true; // reposition the markers for where the drag ended
    }
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
    if (!canvas.classList.contains('is-emphasized')) return;
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
    if (canvas.dataset.updateUrl === 'false') return;
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
      const { default: definitions } = await import('../../data/globe-markers.json', {
        with: { type: 'json' },
      });
      markers.add(definitions);
      dirty = true;
    } catch (err) {
      console.error('Failed to load globe marker data.', err);
    }
  })();

  (async () => {
    for (const [index, url] of ELEVATION_SOURCES.entries()) {
      try {
        uploadElevation(await decodeElevation(url));
        return;
      } catch (err) {
        const last = index === ELEVATION_SOURCES.length - 1;
        if (last) console.error('Failed to load globe elevation data.', err);
        else console.warn(`Globe elevation ${url} failed; trying the next source.`, err);
      }
    }
    dataError = true;
  })();

  canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    location.reload();
  });

  requestAnimationFrame(frame);
}

const start = () => ('requestIdleCallback' in window
    ? requestIdleCallback(main, { timeout: 2500 })
    : setTimeout(main, 300));
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
