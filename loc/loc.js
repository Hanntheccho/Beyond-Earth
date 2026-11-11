/**
 * Gets the localization data.
 *
 * Loads every localization JSON listed in loc/manifest.json.
 */
async function fetchLocalization() {
    return applyDescriptionTitles(await fetchLocalizationFiles());
}

/** Replace {{title}} in each description with its matching localization title. */
function applyDescriptionTitles(localization) {
    for (const [key, description] of Object.entries(localization)) {
        if (!key.endsWith('-desc') || typeof description !== 'string') continue;

        const title = localization[key.slice(0, -5)];
        if (typeof title !== 'string') continue;

        const escapedTitle = title.replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
        localization[key] = description.replaceAll('{{title}}', escapedTitle);
    }

    return localization;
}

/** Load and merge all localization files listed in the root localization manifest. */
async function fetchLocalizationFiles() {
    const manifestPath = 'loc/manifest.json';
    const manifestResponse = await fetch(manifestPath);
    if (!manifestResponse.ok) {
        throw new Error(`Failed to load localization manifest ${manifestPath}`);
    }

    const files = await manifestResponse.json();
    if (!Array.isArray(files) || files.some(file => typeof file !== 'string' || !file.endsWith('.json'))) {
        throw new Error(`Invalid localization manifest ${manifestPath}`);
    }

    const entries = await Promise.all(files.map(async file => {
        const path = `loc/${file}`;
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to load localization file ${path}`);
        return response.json();
    }));

    return Object.assign({}, ...entries);
}

const keywordPromises = new Map();

/** Load a keyword list once per file; it stays separate from localization JSONs. */
function fetchKeywords(path) {
    if (!keywordPromises.has(path)) {
        keywordPromises.set(path, fetch(path).then(response => {
            if (!response.ok) throw new Error(`Failed to load ${path}`);
            return response.json();
        }).catch(error => {
            console.warn(`Could not load shared localization keywords from ${path}:`, error);
            return [];
        }));
    }
    return keywordPromises.get(path);
}

/** Wrap whole keyword matches in <tag> in text nodes, leaving existing HTML markup intact. */
function applyKeywordFormatting(localization, keywords, tagName) {
    if (!Array.isArray(keywords) || keywords.length === 0) return localization;

    const escaped = keywords
        .filter(keyword => typeof keyword === 'string' && keyword.length > 0)
        .sort((a, b) => b.length - a.length)
        .map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (escaped.length === 0) return localization;

    // Unicode letters, numbers, and underscores count as word characters.
    const matcher = new RegExp(`(?<![\\p{L}\\p{N}_])(${escaped.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');

    for (const [key, value] of Object.entries(localization)) {
        if (typeof value !== 'string' || !value) continue;

        const template = document.createElement('template');
        template.innerHTML = value;
        const textNodes = [];
        // Keywords are for descriptive copy only. Leave labels and other
        // localization strings outside paragraphs untouched.
        template.content.querySelectorAll('p').forEach(paragraph => {
            const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) textNodes.push(walker.currentNode);
        });

        for (const textNode of textNodes) {
            if (textNode.parentElement?.closest(tagName)) continue;
            matcher.lastIndex = 0;
            const text = textNode.nodeValue;
            if (!matcher.test(text)) continue;
            matcher.lastIndex = 0;

            const replacement = document.createDocumentFragment();
            let lastIndex = 0;
            for (const match of text.matchAll(matcher)) {
                replacement.append(document.createTextNode(text.slice(lastIndex, match.index)));
                let tag = tagName;
                let cls = '';
                if (tagName.startsWith('.')) {
                    tag = 'span';
                    cls = tagName.slice(1);
                } else if (tagName.includes('.')) {
                    const parts = tagName.split('.');
                    tag = parts[0] || 'span';
                    cls = parts.slice(1).join(' ');
                }
                const wrapper = document.createElement(tag);
                if (cls) wrapper.className = cls;
                wrapper.textContent = match[0];
                replacement.append(wrapper);
                lastIndex = match.index + match[0].length;
            }
            replacement.append(document.createTextNode(text.slice(lastIndex)));
            textNode.replaceWith(replacement);
        }

        localization[key] = template.innerHTML;
    }
    return localization;
}

const formattedLocalization = new Map();

/** Format one localization string on demand, sharing keyword fetches across callers. */
function formatLocalizationValue(key) {
    if (formattedLocalization.has(key)) return formattedLocalization.get(key);

    const value = window.localizationData && window.localizationData[key];
    if (typeof value !== 'string') return Promise.resolve(value);

    const formatted = Promise.all([
        fetchKeywords('loc/keywords-ph3.json'),
        fetchKeywords('loc/keywords-ph2.json'),
        fetchKeywords('loc/keywords-ph1.json')
    ]).then(([ph3Keywords, ph2Keywords, ph1Keywords]) => {
        const localized = { [key]: value };
        applyKeywordFormatting(localized, ph3Keywords, '.ph3');
        applyKeywordFormatting(localized, ph2Keywords, '.ph2');
        applyKeywordFormatting(localized, ph1Keywords, '.ph1');
        return localized[key];
    });

    formattedLocalization.set(key, formatted);
    return formatted;
}

window.formatLocalizationValue = formatLocalizationValue;

function buildLocalizationElementLookup() {
    const elementsByClass = new Map();
    document.querySelectorAll('[class]').forEach(element => {
        element.classList.forEach(className => {
            if (!elementsByClass.has(className)) elementsByClass.set(className, []);
            elementsByClass.get(className).push(element);
        });
    });
    return elementsByClass;
}


/**
 * Loads localization data and updates the page.
 *
 */
async function loadLocalization() {
    try {
        const data = await fetchLocalization();
        if (window.poisReady) await window.poisReady;
        window.localizationData = data;

        const elementsByClass = buildLocalizationElementLookup();
        Object.entries(data).forEach(([key, value]) => {
            const elements = elementsByClass.get(key);
            if (elements) elements.forEach(element => {
                element.innerHTML = value;
            });
        });

        const formattedPoiDescriptions = new Set();
        function formatPoiPanel(button) {
            const key = `${button.dataset.panelTarget}-desc`;
            const elements = elementsByClass.get(key);
            if (!elements || !Object.prototype.hasOwnProperty.call(data, key) ||
                formattedPoiDescriptions.has(key)) return;

            formattedPoiDescriptions.add(key);
            formatLocalizationValue(key).then(value => {
                elements.forEach(element => {
                    element.innerHTML = value;
                });
            }).catch(error => {
                formattedPoiDescriptions.delete(key);
                console.error(`Error formatting localization ${key}:`, error);
            });
        }

        document.addEventListener('click', event => {
            const button = event.target.closest &&
                event.target.closest('[data-panel-target][data-panel-group="lys-pois"]');
            if (!button) return;
            formatPoiPanel(button);
        });

        const initialPoiButton = document.querySelector(
            '[data-panel-target][data-panel-group="lys-pois"][aria-pressed="true"]'
        );
        if (initialPoiButton) {
            window.requestAnimationFrame(() => {
                const initialPanel = document.getElementById(initialPoiButton.dataset.panelTarget);
                if (initialPanel && !initialPanel.hidden) formatPoiPanel(initialPoiButton);
            });
        }

        // Let the title cycle the main description through archived quotes.
        const loadingTips = Object.entries(data)
            .filter(([key, value]) => key.startsWith('LOADING_TIP_') && typeof value === 'string' && value.length > 0)
            .map(([, value]) => value);
        const description = document.querySelector('.BE0-desc');
        const title = document.querySelector('.main-title');
        if (description && title && loadingTips.length > 0 && !title.dataset.loadingTipsBound) {
            const initialIndex = Math.floor(Math.random() * loadingTips.length);
            description.dataset.loadingTipIndex = '' + initialIndex;
            description.innerHTML = loadingTips[initialIndex];

            title.dataset.loadingTipsBound = 'true';
            title.addEventListener('click', () => {
                let nextIndex = Math.floor(Math.random() * loadingTips.length);
                if (loadingTips.length > 1 && description.dataset.loadingTipIndex === '' + nextIndex) {
                    // Keep the tip changing on each click, including consecutive clicks.
                    while ('' + nextIndex === description.dataset.loadingTipIndex) {
                        nextIndex = Math.floor(Math.random() * loadingTips.length);
                    }
                }
                description.dataset.loadingTipIndex = '' + nextIndex;
                description.innerHTML = loadingTips[nextIndex];
            });
        }
    } catch (error) {
        console.error('Error loading localization:', error);
    }
}


// Cache for storing localization data
const localizationCache = {};


/**
 * Retrieves the localization data.
 *
 * @returns {Promise<Object>} The parsed localization data.
 */
async function getLocalization() {
    if (localizationCache.data) {
        return localizationCache.data;
    }

    const data = await fetchLocalization();

    localizationCache.data = data;

    return data;
}


// Load localization
loadLocalization();
