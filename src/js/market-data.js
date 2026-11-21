// market-data.js - Loads the static market data and registers it with the simulation.
// It starts right away because the loading screen waits for it (the ticker shows from
// the start). Every module has run by the time a file arrives, so the treemaps and grids
// are already listening for the market-data:loaded / market-data:error events.
import { loadRelations, loadTreemapSource } from './data-loader.js';
import { valueChanges } from './data-calc.js';
import { holdLoadingScreen } from './loading-screen.js';

async function loadMarketData() {
    try {
        valueChanges.setRelations(await loadRelations());
    } catch (error) {
        console.error('[Market data] Failed to load relations.', error);
    }

    const hosts = Array.from(document.querySelectorAll('.treemap[data-source]'));
    const loaded = await Promise.all(hosts.map(async host => {
        const id = host.dataset.treemap;
        const source = host.dataset.source;
        try {
            const { root, parentValues } = await loadTreemapSource(source, host.dataset.useTags === 'true');
            if (parentValues.length) {
                console.warn(`[Market data] Explicit parent values are ignored in ${source}: ${parentValues.join(', ')}.`);
            }
            valueChanges.registerSource(id, root);
            window.dispatchEvent(new CustomEvent('market-data:loaded', { detail: { id, root, source } }));
            return true;
        } catch (error) {
            console.error(`[Market data] Failed to load ${source}.`, error);
            window.dispatchEvent(new CustomEvent('market-data:error', { detail: { id, source, error } }));
            return false;
        }
    }));

    if (loaded.some(Boolean)) valueChanges.start();
}

holdLoadingScreen('market data', loadMarketData());
