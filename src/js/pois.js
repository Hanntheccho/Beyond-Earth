// pois.js - Builds the POI buttons and description panels from POI localization data, so
// adding a POI only means adding its "poiXXX" and "poiXXX-desc" keys to a localization JSON.
// Top-level POIs are the keys starting with "poi" that do not end in "-desc".
// Nested POIs (e.g. "FRApoi001") are tooltip buttons in their parent's panel.
//
// index.html only needs an empty <div class="div-desc-win grid" data-poi-buttons></div>;
// the panels are inserted right after it. The elements carry the same classes
// loc.js already fills ("poiXXX" for the title, "poiXXX-desc" for the text), and
// loc.js waits for them to be built (localizeAfter) before it localizes the page.
// A panel whose id matches a globe marker (data/globe-markers.json) shows that marker's
// icon as its background (the "has-icon" class and --poi-icon, styled in layout.css).
import { getLocalization, localizeAfter, POI_PANEL_GROUP } from './loc.js';

(function () {
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
        button.dataset.panelGroup = POI_PANEL_GROUP;
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

    // Marker icons by id; a failed load only drops the backgrounds, not the POIs.
    async function loadMarkerIcons() {
        try {
            const { default: markers } = await import('../../data/globe-markers.json', {
                with: { type: 'json' },
            });
            const icons = new Map();
            for (const marker of Array.isArray(markers) ? markers : []) {
                if (typeof marker?.id === 'string' && typeof marker.icon === 'string' && marker.icon) {
                    // Icons are resolved from src/js/, like globe-markers.js does.
                    icons.set(marker.id, new URL(marker.icon, import.meta.url).href);
                }
            }
            return icons;
        } catch (error) {
            console.error('Could not load globe marker icons for POI panels:', error);
            return new Map();
        }
    }

    function buildPanel(id, active, nestedIds, icon) {
        const panel = document.createElement('div');
        panel.className = 'div-desc-win';
        if (icon) {
            panel.classList.add('has-icon');
            panel.style.setProperty('--poi-icon', `url("${icon}")`);
        }
        panel.id = id;
        panel.dataset.panelGroup = POI_PANEL_GROUP;
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
            const [pois, markerIcons] = await Promise.all([getLocalization(), loadMarkerIcons()]);
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
                panels.push(buildPanel(id, active, nestedIds, markerIcons.get(id)));
            });

            buttonHost.replaceChildren(...buttons);
            buttonHost.after(...panels);
        } catch (error) {
            console.error('Error building POIs:', error);
        }
    })());
})();
