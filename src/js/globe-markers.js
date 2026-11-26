/*
 * globe-markers.js - Hotspot buttons drawn over the globe (see src/js/globe.js).
 *
 * Markers are HTML buttons in #globe-markers, positioned each frame with the
 * same flat-map/globe blend as the mesh shader. globe-markers-link.js relies on
 * the data-id set on each button. globe.js passes one entry per POI with a globe
 * marker, already checked by poi-data.js: { id, label, icon, lat, lon, altitudeKm, size }.
 */

import { DEG_R, EARTH_RADIUS_KM } from './globe-gl.js';

export function createGlobeMarkers(layer, canvas) {
  const instances = [];

  function createButton(entry) {
    const button = document.createElement('button');
    button.className = 'globe-marker btn-plain';
    button.type = 'button';
    button.hidden = true;
    button.style.setProperty('--marker-size', `${entry.size}px`);
    button.setAttribute('aria-label', entry.label);
    button.dataset.label = entry.label;
    button.dataset.id = entry.id;
    button.title = entry.label;
    const image = document.createElement('img');
    // poi-data.js has already resolved the icon to a full URL.
    image.src = entry.icon;
    image.alt = '';
    image.draggable = false;
    image.addEventListener('error', () => {
      console.error(`Could not load globe marker icon for "${entry.id}": ${image.src}`);
    }, { once: true });
    button.append(image);
    layer.append(button);
    return button;
  }

  function add(definitions) {
    if (!Array.isArray(definitions)) {
      throw new TypeError('Globe markers must be given as an array.');
    }
    definitions.map((marker) => ({ ...marker })).forEach((entry) => {
      // The wrap-around copies only matter on the flat map, so every copy except the
      // main one is created the first time it is on screen.
      const copies = [];
      for (let copy = -3; copy <= 3; copy++) {
        copies.push({ copy, button: copy === 0 ? createButton(entry) : null });
      }
      instances.push({ entry, copies });
    });
  }

  // view: { lon, lat, s }; vw/vh: viewport in CSS px; t: globe morph 0..1;
  // halfW: half the viewport width in degrees of longitude.
  function render(view, vw, vh, t, halfW) {
    // Markers are only positioned while the globe is emphasized (the layer is
    // invisible and inert otherwise).
    if (!canvas.classList.contains('is-emphasized')) return;
    // Markers are hidden by CSS while the globe is grabbed; they update once it is released.
    if (canvas.classList.contains('dragging')) return;
    const phi0 = view.lat / DEG_R;
    const cosPhi0 = Math.cos(phi0), sinPhi0 = Math.sin(phi0);
    const globeRadius = view.s * DEG_R;

    instances.forEach(({ entry, copies }) => {
      const phi = entry.lat / DEG_R;
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
      const radialScale = 1 + entry.altitudeKm / EARTH_RADIUS_KM;
      const visibleHorizon = -Math.sqrt(Math.max(0, 1 - 1 / (radialScale * radialScale)));

      copies.forEach((instance) => {
        const { copy } = instance;
        const dlon = entry.lon + copy * 360 - view.lon;
        const lam = dlon / DEG_R;
        const px = cosPhi * Math.sin(lam);
        const py = sinPhi;
        const pz = cosPhi * Math.cos(lam);
        const y2 = py * cosPhi0 - pz * sinPhi0;
        const z2 = py * sinPhi0 + pz * cosPhi0;
        const flatX = dlon * view.s;
        const flatY = (entry.lat - view.lat) * view.s;
        const globeX = px * globeRadius * radialScale;
        const globeY = y2 * globeRadius * radialScale;
        const x = vw / 2 + flatX * (1 - t) + globeX * t;
        const y = vh / 2 - (flatY * (1 - t) + globeY * t);
        const mapLeft = copy * 360 - 180 - view.lon;
        const mapRight = copy * 360 + 180 - view.lon;
        const mapCopyVisible = !(mapRight < -halfW || mapLeft > halfW);
        const backVisibility = Math.min(1, Math.max(0,
          (z2 - visibleHorizon + 0.025) / 0.05));
        const visibility = 1 - t * (1 - backVisibility);
        const copyAlpha = copy === 0 ? 1 : 1 - t;
        const visible = mapCopyVisible && (copy === 0 || t <= 0.95)
          && visibility > 0.01
          && x > -entry.size && x < vw + entry.size
          && y > -entry.size && y < vh + entry.size;

        let { button } = instance;
        if (!visible) {
          if (button && !button.hidden) button.hidden = true;
          return;
        }
        if (!button) button = instance.button = createButton(entry);
        if (button.hidden) button.hidden = false;

        // transform moves the button without a layout pass; left/top are 0 in globe.css.
        // Only write what changed, so steady markers cost nothing.
        const transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%, -50%)`;
        if (instance.transform !== transform) {
          button.style.transform = transform;
          instance.transform = transform;
        }
        const opacity = String(copyAlpha * visibility);
        if (instance.opacity !== opacity) {
          button.style.opacity = opacity;
          instance.opacity = opacity;
        }
      });
    });
  }

  return { add, render };
}
