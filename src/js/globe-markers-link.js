// globe-markers-link.js - Clicking a globe marker brings the content back and opens the
// POI panel with the same id (for example the "poiFRA" marker opens the "poiFRA" panel).
// Markers without a matching panel (poiANTT, poiNSA, poiCOOP, poiPLY...) do nothing.
//
// Uses event delegation, so it works for the markers globe-markers.js creates later.
// Needs data-id on each marker button (set in createButton in globe-markers.js).
import { motionPreference } from './motion.js';
import { isMainVisible, setMainVisible } from './main-visibility.js';
import { isDataViewOpen, setDataViewOpen } from './data-view.js';
import { POI_PANEL_GROUP } from './loc.js';

document.addEventListener('click', event => {
    const marker = event.target.closest?.('.globe-marker');
    const id = marker?.dataset.id;
    if (!id) return;

    const poiButton = document.querySelector(
        `[data-panel-group="${POI_PANEL_GROUP}"][data-panel-target="${CSS.escape(id)}"]`
    );
    const panel = document.getElementById(id);
    if (!poiButton || !panel) return;

    if (!isMainVisible()) setMainVisible(true);
    // POI panels live in the briefing, so leave the data view.
    if (isDataViewOpen()) setDataViewOpen(false);

    // panel-toggle.js swaps the panels and loc.js formats the text on this click.
    poiButton.click();

    panel.scrollIntoView({
        block: 'start',
        behavior: motionPreference.matches ? 'auto' : 'smooth'
    });
});
