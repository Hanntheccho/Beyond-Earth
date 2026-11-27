// feed-loader.js - Loads the static dataset files and registers them with the simulation.
// It starts right away because the loading screen waits for it (the ticker shows from
// the start). Every module has run by the time a file arrives, so the treemaps and ledgers
// are already listening for the feeds:loaded / feeds:error events.
import { loadRelations, loadTree } from './feed-files.js';
import { simulation } from './simulation.js';
import { holdLoadingScreen } from './loading-screen.js';

async function loadFeeds() {
    try {
        simulation.setRelations(await loadRelations());
    } catch (error) {
        console.error('[Feeds] Failed to load relations.', error);
    }

    // Every element with a data-url declares a feed: a treemap names it in data-treemap,
    // any other consumer (the ticker, for the goods) in data-feed.
    const hosts = Array.from(document.querySelectorAll('[data-url][data-treemap], [data-url][data-feed]'));
    const loaded = await Promise.all(hosts.map(async host => {
        const id = host.dataset.treemap || host.dataset.feed;
        const url = host.dataset.url;
        try {
            const { root, parentValues } = await loadTree(url, host.dataset.useTags === 'true');
            if (parentValues.length) {
                console.warn(`[Feeds] Explicit parent values are ignored in ${url}: ${parentValues.join(', ')}.`);
            }
            simulation.registerTree(id, root);
            window.dispatchEvent(new CustomEvent('feeds:loaded', { detail: { id, root, url } }));
            return true;
        } catch (error) {
            console.error(`[Feeds] Failed to load ${url}.`, error);
            window.dispatchEvent(new CustomEvent('feeds:error', { detail: { id, url, error } }));
            return false;
        }
    }));

    if (loaded.some(Boolean)) simulation.start();
}

// The label is announced to screen readers while loading, so it stays plain wording.
holdLoadingScreen('data', loadFeeds());

