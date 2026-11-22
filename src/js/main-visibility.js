// main-visibility.js - Hides or shows the page content so the globe can be explored
// on its own. While the content is hidden, the globe and its markers are emphasized
// (interactive); view-toggle.js and globe-markers-link.js bring the content back.
const toggle = document.querySelector('.main-visibility-toggle');
const mainContent = document.getElementById('main-content');
const globeCanvas = document.getElementById('map');
const markerLayer = document.getElementById('globe-markers');

// aria-expanded="false" on the toggle means the content is hidden.
export function isMainVisible() {
    return !toggle || toggle.getAttribute('aria-expanded') !== 'false';
}

export function setMainVisible(visible) {
    if (!toggle || !mainContent) return;
    mainContent.hidden = !visible;
    globeCanvas?.classList.toggle('is-emphasized', !visible);
    if (markerLayer) {
        markerLayer.classList.toggle('is-emphasized', !visible);
        markerLayer.inert = visible;
        markerLayer.setAttribute('aria-hidden', String(visible));
    }
    toggle.setAttribute('aria-expanded', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Hide content' : 'Show content');
}

toggle?.addEventListener('click', () => setMainVisible(!isMainVisible()));

