import { motionPreference } from './motion.js';
// Clicking a globe marker brings the content back and opens the POI panel with
// the same id (for example the "poiFRA" marker opens the "poiFRA" panel).
// Markers without a matching panel (poiANTT, poiNSA, poiCOOP, poiPLY...) do nothing.
//
// Uses event delegation, so it works for the markers globe-markers.js creates later.
// Needs data-id on each marker button (set in createButton in globe-markers.js).
(function () {
    const PANEL_GROUP = 'lys-pois';
    const toggle = document.querySelector('.main-visibility-toggle');
    const reducedMotion = motionPreference;

    document.addEventListener('click', event => {
        const marker = event.target.closest && event.target.closest('.globe-marker');
        if (!marker || !marker.dataset.id) return;

        const id = marker.dataset.id;
        const poiButton = document.querySelector(
            `[data-panel-group="${PANEL_GROUP}"][data-panel-target="${CSS.escape(id)}"]`
        );
        const panel = document.getElementById(id);
        if (!poiButton || !panel) return;

        // aria-expanded="false" means the content is currently hidden.
        if (toggle && toggle.getAttribute('aria-expanded') === 'false') toggle.click();

        // POI panels live in the briefing, so leave the data view (data-view.js).
        const dataViewToggle = document.getElementById('data-view-toggle');
        if (dataViewToggle && dataViewToggle.getAttribute('aria-pressed') === 'true') dataViewToggle.click();

        // panel-toggle.js swaps the panels and loc.js formats the text on this click.
        poiButton.click();

        panel.scrollIntoView({
            block: 'start',
            behavior: reducedMotion.matches ? 'auto' : 'smooth'
        });
    });
})();
