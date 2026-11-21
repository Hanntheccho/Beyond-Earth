/*
 * globe-gl.js - WebGL and elevation helpers for the globe (see src/js/globe.js).
 * Pure functions with no shared state.
 */

export const DEG_R = 57.29577951308232; // 180/pi: globe radius = scale(px/deg) * DEG_R
export const EARTH_RADIUS_KM = 6371;

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

export function makeProgram(gl, vs, fs) {
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

// url is resolved from src/js/, this file's directory.
export async function decodeElevation(url) {
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
  if (typeof createImageBitmap === 'function') {
    try {
      bmp = await createImageBitmap(img, {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      });
    } catch (_) {
      // Safari versions that reject these options use the canvas fallback.
    }
  }
  const W = bmp ? bmp.width : img.naturalWidth;
  const H = bmp ? bmp.height : img.naturalHeight;
  if (bmp) return { W, H, bmp };

  const cnv = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(W, H)
    : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, W, H).data;
  return { W, H, px };
}
