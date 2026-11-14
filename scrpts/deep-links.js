// Deep links: the URL hash names the open panel, so "index.html#poiFRA" opens
// the Franco-Iberia panel and scrolls to it. Works for the POI panels (#poiFRA),
// the chart panels (#chart-seaLevel) and the data panels (#data-market).
//
// Clicking a panel button updates the hash with history.replaceState, which
// avoids a scroll jump and keeps the back button free of one entry per click.
// The hash holds a single panel, so the last one you opened is the one a copied
// link will open.
//
// Load this script last in index.html: it needs the chart and data buttons to
// exist, and it waits for the POI panels and the localization on its own.
(function () {
    const TRACKED_GROUPS = new Set(['lys-pois', 'mit-charts', 'data-categories']);
    const toggle = document.querySelector('.main-visibility-toggle');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function currentId() {
        try {
            return decodeURIComponent(location.hash.slice(1));
        } catch (_) {
            return '';
        }
    }

    function open(id, behavior) {
        const panel = id ? document.getElementById(id) : null;
        const group = panel && panel.dataset.panelGroup;
        if (!group || !TRACKED_GROUPS.has(group)) return false;

        const button = document.querySelector(
            `[data-panel-group="${group}"][data-panel-target="${CSS.escape(id)}"]`
        );
        if (!button) return false;

        // aria-expanded="false" means the content is currently hidden.
        if (toggle && toggle.getAttribute('aria-expanded') === 'false') toggle.click();

        // default.js swaps the panels and loc.js formats the text on this click.
        button.click();

        panel.scrollIntoView({
            block: 'start',
            behavior: behavior || (reducedMotion.matches ? 'auto' : 'smooth')
        });
        return true;
    }

    // loc.js registers its POI click handler right after it sets
    // window.localizationData, so waiting for that keeps the first click formatted.
    function whenLocalized() {
        return new Promise(resolve => {
            const started = performance.now();
            (function check() {
                if (window.localizationData || performance.now() - started > 5000) resolve();
                else setTimeout(check, 50);
            })();
        });
    }

    document.addEventListener('click', event => {
        const button = event.target.closest && event.target.closest('[data-panel-target][data-panel-group]');
        if (!button || !TRACKED_GROUPS.has(button.dataset.panelGroup)) return;
        history.replaceState(null, '', `#${button.dataset.panelTarget}`);
    });

    // Fires when the hash is edited by hand or an <a href="#..."> is followed.
    // replaceState above does not trigger it, so there is no loop.
    window.addEventListener('hashchange', () => open(currentId()));

    if (!currentId()) return;
    (async function () {
        try { await window.poisReady; } catch (_) { /* pois.js logs its own error */ }
        await whenLocalized();
        open(currentId(), 'auto');
    })();
})();
