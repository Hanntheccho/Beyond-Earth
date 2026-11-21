// data-view.js - Data view toggle: inside <main>, swaps the scenario briefing article
// (#briefing-view) for the data article (#data-view) with the treemaps, data
// grids and relations graph. The title, ticker and layout of <main> are shared.
import { isMainVisible, setMainVisible } from './main-visibility.js';

const toggle = document.getElementById('data-view-toggle');
const briefingView = document.getElementById('briefing-view');
const dataView = document.getElementById('data-view');

export function isDataViewOpen() {
    return toggle?.getAttribute('aria-pressed') === 'true';
}

export function setDataViewOpen(open) {
    if (!toggle || !briefingView || !dataView) return;
    toggle.setAttribute('aria-pressed', String(open));
    toggle.setAttribute('aria-label', open ? 'Hide data view' : 'Show data view');

    briefingView.hidden = open;
    dataView.hidden = !open;

    // Both views live in <main>, so bring it back if it was hidden.
    if (!isMainVisible()) setMainVisible(true);
    window.scrollTo(0, 0);
}

toggle?.addEventListener('click', () => setDataViewOpen(!isDataViewOpen()));
