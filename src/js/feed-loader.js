// feed-loader.js - Loads the static dataset files and registers them with the simulation.
// It starts right away because the loading screen waits for it (the ticker shows from
// the start). Every module has run by the time a file arrives, so the treemaps and grids
// are already listening for the feeds:loaded / feeds:error events.
import { loadRelations, loadTreemapTree } from './data-loader.js';
import { valueChanges } from './data-calc.js';
import { holdLoadingScreen } from './loading-screen.js';

async function loadFeeds() {
    try {
        valueChanges.setRelations(await loadRelations());
    } catch (error) {
        console.error('[Feeds] Failed to load relations.', error);
    }

    const hosts = Array.from(document.querySelectorAll('.treemap[data-url]'));
    const loaded = await Promise.all(hosts.map(async host => {
        const id = host.dataset.treemap;
        const url = host.dataset.url;
        try {
            const { root, parentValues } = await loadTreemapTree(url, host.dataset.useTags === 'true');
            if (parentValues.length) {
                console.warn(`[Feeds] Explicit parent values are ignored in ${url}: ${parentValues.join(', ')}.`);
            }
            valueChanges.registerTree(id, root);
            window.dispatchEvent(new CustomEvent('feeds:loaded', { detail: { id, root, url } }));
            return true;
        } catch (error) {
            console.error(`[Feeds] Failed to load ${url}.`, error);
            window.dispatchEvent(new CustomEvent('feeds:error', { detail: { id, url, error } }));
            return false;
        }
    }));

    if (loaded.some(Boolean)) valueChanges.start();
}

// The label is announced to screen readers while loading, so it stays plain wording.
holdLoadingScreen('data', loadFeeds());

