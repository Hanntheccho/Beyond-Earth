// pois.js - Builds the POI buttons and description panels from data/pois.json (read by
// poi-data.js), in its order. Adding a POI means adding its entry there and its "<id>" and
// "<id>-desc" keys to a localization JSON. A POI without a localized name gets no button
// or panel (it can still have a globe marker). Its "children" are reached through the
// inline {{id|text}} links in the description text (see loc.js), not listed in the panel.
//
// index.html only needs an empty <div class="div-win btn-group" data-poi-buttons></div>;
// the panels are inserted right after it. The elements carry the same classes
// loc.js already fills ("poiXXX" for the title, "poiXXX-desc" for the text), and
// loc.js waits for them to be built (localizeAfter) before it localizes the page.
// Each panel starts with a nav bar (src/css/buttons.css) that names its POI: its [❮❮❮]
// key goes back to the POI shown before, and its [❯❯❯] key shows a random other one.
// Both press that POI's button, so the switch goes through panel-toggle.js and loc.js
// like any other.
// A POI with a "background" shows its icon behind its panel text at that size (the
// "has-icon" class, --poi-icon and --poi-icon-size, styled in pois.css).
import { getLocalization, localizeAfter, POI_PANEL_GROUP } from './loc.js';
import { getPois } from './poi-data.js';

(function () {
    const buttonHost = document.querySelector('[data-poi-buttons]');
    if (!buttonHost) return;

    const POI_BUTTON = `[data-panel-target][data-panel-group="${POI_PANEL_GROUP}"]`;
    const buttonFor = id => buttonHost.querySelector(`${POI_BUTTON}[data-panel-target="${CSS.escape(id)}"]`);
    // The POIs that have a panel, the one on screen, and the ones shown before it
    // (oldest first) for the back keys.
    let ids = [];
    let current = null;
    const visited = [];
    let goingBack = false;
    const backKeys = [];
    const randomKeys = [];

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

    function buildNavKey(nav, text) {
        const key = document.createElement('button');
        key.type = 'button';
        key.className = nav === 'random' ? 'btn-nav is-next' : 'btn-nav';
        key.dataset.poiNav = nav;
        key.textContent = text;
        return key;
    }

    // The name is the POI's localized name, which loc.js fills as it does the button's.
    function buildNavBar(id) {
        const bar = document.createElement('div');
        bar.className = 'nav-bar';
        const back = buildNavKey('back', '[❮❮❮]');
        back.hidden = true;
        back.addEventListener('click', () => goBack(back));
        const name = document.createElement('div');
        name.className = 'nav-bar-name';
        name.append(buildLabel(id));
        const random = buildNavKey('random', '[❯❯❯]');
        random.setAttribute('aria-label', 'Show a random point of interest');
        random.addEventListener('click', () => showRandom(random));
        backKeys.push(back);
        randomKeys.push(random);
        bar.append(back, name, random);
        return bar;
    }

    function buildPanel(poi, active) {
        const { id, icon, background } = poi;
        const panel = document.createElement('div');
        panel.className = 'div-win';
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
        desc.className = 'poi-desc';
        const text = document.createElement('span');
        text.className = `${id}-desc`;
        desc.append(text);

        panel.append(buildNavBar(id), desc);
        return panel;
    }

    // Shows a POI by pressing its button. The nav key pressed sits in the panel that is
    // hidden now, so when it had the focus, the focus goes on to the same key in the
    // panel shown, or to its other key while that one is hidden.
    function show(id, key) {
        const button = buttonFor(id);
        if (!button) return;
        const hadFocus = document.activeElement === key;
        button.click();
        if (!hadFocus) return;
        const keys = [...(document.getElementById(id)?.querySelectorAll('[data-poi-nav]') || [])]
            .filter(other => !other.hidden);
        (keys.find(other => other.dataset.poiNav === key.dataset.poiNav) || keys[0])?.focus();
    }

    function goBack(key) {
        const id = visited.pop();
        if (!id) return;
        goingBack = true;
        show(id, key);
        goingBack = false;
        updateBackKeys();
    }

    function showRandom(key) {
        const others = ids.filter(id => id !== current);
        if (others.length) show(others[Math.floor(Math.random() * others.length)], key);
    }

    // The back keys follow the visited list: hidden while it is empty, and named after
    // the POI they go back to.
    function updateBackKeys() {
        const previous = visited.at(-1);
        const name = previous && (buttonFor(previous)?.textContent.trim() || previous);
        backKeys.forEach(key => {
            key.hidden = !previous;
            if (previous) key.setAttribute('aria-label', `Back to ${name}`);
        });
    }

    // Every way to a POI presses its button (the POI buttons, the globe markers and the
    // nav keys), so the visited list is kept here.
    document.addEventListener('click', event => {
        const id = event.target.closest?.(POI_BUTTON)?.dataset.panelTarget;
        if (!id || id === current || !ids.includes(id)) return;
        if (current && !goingBack) visited.push(current);
        current = id;
        updateBackKeys();
    });

    localizeAfter((async function () {
        try {
            const [localization, pois] = await Promise.all([getLocalization(), getPois()]);
            const hasText = key => typeof localization[key] === 'string';
            const shown = pois.filter(poi => hasText(poi.id));

            const buttons = [];
            const panels = [];
            shown.forEach((poi, index) => {
                const active = index === 0;
                buttons.push(buildButton(poi.id, active));
                panels.push(buildPanel(poi, active));
            });

            buttonHost.replaceChildren(...buttons);
            buttonHost.after(...panels);
            ids = shown.map(poi => poi.id);
            current = ids[0] ?? null;
            // The random keys stay hidden while there is no other POI to pick.
            randomKeys.forEach(key => { key.hidden = ids.length < 2; });
        } catch (error) {
            console.error('Error building POIs:', error);
        }
    })());
})();

