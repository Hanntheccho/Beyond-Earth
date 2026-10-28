// Builds the POI buttons and description panels from loc/pois.json, so adding
// a POI only means adding its "poiXXX" and "poiXXX-desc" keys to the JSON.
// Top-level POIs are the keys starting with "poi" that do not end in "-desc".
// Nested POIs (e.g. "FRApoi001") are not listed here: they are referenced from
// inside their parent's description as tooltip buttons.
//
// index.html only needs an empty <div class="div-desc-win grid" data-poi-buttons></div>;
// the panels are inserted right after it. The elements carry the same classes
// loc.js already fills ("poiXXX" for the title, "poiXXX-desc" for the text), and
// loc.js waits for window.poisReady so the elements exist before it localizes.
(function () {
    const PANEL_GROUP = 'lys-pois';
    const POI_SOURCE = 'loc/pois.json';

    const buttonHost = document.querySelector('[data-poi-buttons]');
    if (!buttonHost) return;

    function buildButton(id, active) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.panelGroup = PANEL_GROUP;
        button.dataset.panelTarget = id;
        button.setAttribute('aria-pressed', String(active));

        const label = document.createElement('span');
        label.className = id;
        button.append(label);
        return button;
    }

    function buildPanel(id, active) {
        const panel = document.createElement('div');
        panel.className = 'div-desc-win';
        panel.id = id;
        panel.dataset.panelGroup = PANEL_GROUP;
        panel.hidden = !active;
        panel.setAttribute('aria-hidden', String(!active));

        const desc = document.createElement('div');
        desc.className = 'div-desc';
        const text = document.createElement('span');
        text.className = `${id}-desc`;
        desc.append(text);
        panel.append(desc);
        return panel;
    }

    window.poisReady = (async function () {
        try {
            const response = await fetch(POI_SOURCE);
            if (!response.ok) throw new Error(`Failed to load ${POI_SOURCE}`);
            const pois = await response.json();

            const ids = Object.keys(pois)
                .filter(key => key.startsWith('poi') && !key.endsWith('-desc'));

            const buttons = [];
            const panels = [];
            ids.forEach((id, index) => {
                const active = index === 0;
                buttons.push(buildButton(id, active));
                panels.push(buildPanel(id, active));
            });

            buttonHost.replaceChildren(...buttons);
            buttonHost.after(...panels);
        } catch (error) {
            console.error('Error building POIs:', error);
        }
    })();
})();
