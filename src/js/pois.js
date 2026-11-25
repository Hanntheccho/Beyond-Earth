// pois.js - Builds the POI buttons and description panels from data/pois.json (read by
// poi-data.js), in its order. Adding a POI means adding its entry there and its "<id>" and
// "<id>-desc" keys to a localization JSON. A POI without a localized name gets no button
// or panel (it can still have a globe marker). Its "children" are tooltip buttons in a
// collapsed "See also" list after its description, which stays in view at the bottom of
// the scrolling text; a child without a localized description is skipped. The list's
// label is CHILDREN_LABEL.
//
// index.html only needs an empty <div class="div-desc-win grid" data-poi-buttons></div>;
// the panels are inserted right after it. The elements carry the same classes
// loc.js already fills ("poiXXX" for the title, "poiXXX-desc" for the text), and
// loc.js waits for them to be built (localizeAfter) before it localizes the page.
// A POI with a "background" shows its icon behind its panel text at that size (the
// "has-icon" class, --poi-icon and --poi-icon-size, styled in pois.css).
import { getLocalization, localizeAfter, POI_PANEL_GROUP } from './loc.js';
import { getPois } from './poi-data.js';

(function () {
    const buttonHost = document.querySelector('[data-poi-buttons]');
    if (!buttonHost) return;

    const CHILDREN_LABEL = ':datalinks';

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

    function buildChildren(nestedIds) {
        const details = document.createElement('details');
        details.className = 'poi-children';

        const summary = document.createElement('summary');
        const label = document.createElement('span');
        label.textContent = CHILDREN_LABEL;
        const count = document.createElement('span');
        count.className = 'poi-children-count';
        count.textContent = ` (${nestedIds.length})`;
        summary.append(label, count);

        const list = document.createElement('div');
        list.className = 'poi-children-list';
        list.append(...nestedIds.map(buildTooltipButton));

        details.append(summary, list);
        return details;
    }

    function buildPanel(poi, active, nestedIds) {
        const { id, icon, background } = poi;
        const panel = document.createElement('div');
        panel.className = 'div-desc-win';
        if (background) {
            panel.classList.add('has-icon');
            panel.style.setProperty('--poi-icon', `url("${icon}")`);
            panel.style.setProperty('--poi-icon-size', `${background.size}%`);
        }
        panel.id = id;
        panel.dataset.panelGroup = POI_PANEL_GROUP;
        panel.hidden = !active;
        panel.setAttribute('aria-hidden', String(!active));

        const desc = document.createElement('div');
        desc.className = 'div-desc';
        const text = document.createElement('span');
        text.className = `${id}-desc`;
        desc.append(text);
        if (nestedIds.length) desc.append(buildChildren(nestedIds));

        panel.append(desc);
        return panel;
    }

    localizeAfter((async function () {
        try {
            const [localization, pois] = await Promise.all([getLocalization(), getPois()]);
            const hasText = key => typeof localization[key] === 'string';
            const shown = pois.filter(poi => hasText(poi.id));

            const buttons = [];
            const panels = [];
            shown.forEach((poi, index) => {
                const active = index === 0;
                const nestedIds = poi.children.filter(child => hasText(`${child}-desc`));
                buttons.push(buildButton(poi.id, active));
                panels.push(buildPanel(poi, active, nestedIds));
            });

            buttonHost.replaceChildren(...buttons);
            buttonHost.after(...panels);
        } catch (error) {
            console.error('Error building POIs:', error);
        }
    })());
})();
