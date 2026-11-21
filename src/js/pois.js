// pois.js - Builds the POI buttons and description panels from POI localization data, so
// adding a POI only means adding its "poiXXX" and "poiXXX-desc" keys to a localization JSON.
// Top-level POIs are the keys starting with "poi" that do not end in "-desc".
// Nested POIs (e.g. "FRApoi001") are tooltip buttons in their parent's panel.
//
// index.html only needs an empty <div class="div-desc-win grid" data-poi-buttons></div>;
// the panels are inserted right after it. The elements carry the same classes
// loc.js already fills ("poiXXX" for the title, "poiXXX-desc" for the text), and
// loc.js waits for them to be built (localizeAfter) before it localizes the page.
import { getLocalization, localizeAfter } from './loc.js';

(function () {
    const PANEL_GROUP = 'lys-pois';

    const buttonHost = document.querySelector('[data-poi-buttons]');
    if (!buttonHost) return;

    function buildLabel(id) {
        const label = document.createElement('span');
        label.className = id;
        return label;
    }

    function buildButton(id, active) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.panelGroup = PANEL_GROUP;
        button.dataset.panelTarget = id;
        button.setAttribute('aria-pressed', String(active));
        button.append(buildLabel(id));
        return button;
    }

    // Shows as pressed while hovered; tooltips.js opens the description.
    function buildTooltipButton(id) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'poi has-tooltip';
        button.dataset.tooltip = `${id}-desc`;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('mouseenter', () => button.setAttribute('aria-pressed', 'true'));
        button.addEventListener('mouseleave', () => button.setAttribute('aria-pressed', 'false'));
        button.append(buildLabel(id));
        return button;
    }

    function buildPanel(id, active, nestedIds) {
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
        desc.append(text, ...nestedIds.map(buildTooltipButton));

        panel.append(desc);
        return panel;
    }

    localizeAfter((async function () {
        try {
            const pois = await getLocalization();
            const keys = Object.keys(pois);
            const ids = keys.filter(key => key.startsWith('poi') && !key.endsWith('-desc'));

            const buttons = [];
            const panels = [];
            ids.forEach((id, index) => {
                const active = index === 0;
                // "poiFRA" -> nested keys "FRApoi001", "FRApoi002"... that have a description.
                const nestedPrefix = `${id.slice(3)}poi`;
                const nestedIds = keys.filter(key => key.startsWith(nestedPrefix) &&
                    /^\d+$/.test(key.slice(nestedPrefix.length)) &&
                    Object.hasOwn(pois, `${key}-desc`));
                buttons.push(buildButton(id, active));
                panels.push(buildPanel(id, active, nestedIds));
            });

            buttonHost.replaceChildren(...buttons);
            buttonHost.after(...panels);
        } catch (error) {
            console.error('Error building POIs:', error);
        }
    })());
})();
