// Loads static market data and registers it with the calculation service.
import { loadRelations, loadTreemapSource } from './data-loader.js';

async function loadMarketData() {
    try {
        window.valueChanges.setRelations(await loadRelations());
    } catch (error) {
        console.error('[Market data] Failed to load relations.', error);
    }

    const hosts = Array.from(document.querySelectorAll('.treemap[data-source]'));
    const loaded = await Promise.all(hosts.map(async host => {
        const id = host.dataset.treemap;
        try {
            const { root, parentValues } = await loadTreemapSource(
                host.dataset.source,
                host.dataset.useTags === 'true'
            );
            if (parentValues.length) {
                console.warn(`[Market data] Explicit parent values are ignored in ${host.dataset.source}: ${parentValues.join(', ')}.`);
            }
            window.valueChanges.registerSource(id, root);
            window.dispatchEvent(new CustomEvent('market-data:loaded', {
                detail: { id, root, source: host.dataset.source }
            }));
            return true;
        } catch (error) {
            console.error(`[Market data] Failed to load ${host.dataset.source}.`, error);
            window.dispatchEvent(new CustomEvent('market-data:error', {
                detail: { id, source: host.dataset.source, error }
            }));
            return false;
        }
    }));

    if (loaded.some(Boolean)) window.valueChanges.start();
}

if ('requestIdleCallback' in window) requestIdleCallback(loadMarketData, { timeout: 1500 });
else setTimeout(loadMarketData, 300);

