// Clicking a globe marker brings the content back and opens the POI panel with
// the same id (for example the "poiFRA" marker opens the "poiFRA" panel).
// Markers without a matching panel (poiANTT, poiGPGP, the NAU districts...) do nothing.
//
// Uses event delegation, so it works for the markers globe.js creates later.
// Needs data-id on each marker button (set in createMarkerButton in globe.js).
(function () {
    const PANEL_GROUP = 'lys-pois';
    const toggle = document.querySelector('.main-visibility-toggle');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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

        // default.js swaps the panels and loc.js formats the text on this click.
        poiButton.click();

        panel.scrollIntoView({
            block: 'start',
            behavior: reducedMotion.matches ? 'auto' : 'smooth'
        });
    });
})();
