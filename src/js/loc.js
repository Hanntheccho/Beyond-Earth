// loc.js - Localization. Loads every JSON listed in data/loc/manifest.json and fills
// each element whose class matches a key (class="poiFRA" gets the "poiFRA" text).
// Keywords (keywords-ph1/2/3.json) are highlighted in descriptions when they are first
// shown, so the cost is only paid for the panels and tooltips people actually open.
// Matching ignores case, except for keywords written with a leading "=" ("=Trust").
// Where keywords overlap, the longest one is highlighted whole ("Central Asian
// Federation" beats "=Central" and "=Federation"), whichever lists they are in.
// Inline POI links: "{{poiFRA005|Padania}}" in any text becomes a tooltip button that
// opens poiFRA005's description, and "{{poiFRA005}}" uses its localized name as the text.
// Keywords are not highlighted inside links.
//
// Exports for other modules:
//   getLocalization()            the merged localization data (fetched once)
//   formatLocalizationValue(key) one string with its keywords highlighted
//   localizationData             that data once the page is localized, null before
//   localizeAfter(promise)       wait for a promise (pois.js building its panels)
//                                before localizing the page
//
// The loading screen waits until the page is localized and the open POI panel's
// keywords are highlighted, so no text changes after it lifts.
import { holdLoadingScreen } from './loading-screen.js';

const MANIFEST_PATH = 'data/loc/manifest.json';
// Panel group of the POI buttons and panels; pois.js and globe-markers-link.js import it.
export const POI_PANEL_GROUP = 'pois';
// All lists are matched in one pass and the longest keyword wins where two overlap;
// this order only settles keywords of the same length (the earlier list wins).
const KEYWORD_LISTS = [
    { path: 'data/loc/keywords-ph3.json', selector: '.ph3' },
    { path: 'data/loc/keywords-ph2.json', selector: '.ph2' },
    { path: 'data/loc/keywords-ph1.json', selector: '.ph1' }
];

export let localizationData = null;

const setupTasks = [];
export function localizeAfter(promise) {
    setupTasks.push(promise);
}

// ------------------------------------------------------------------ loading

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = text => text.replace(/[&<>"']/g, character => HTML_ESCAPES[character]);

async function fetchJson(path, what) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${what} ${path} (${response.status})`);
    return response.json();
}

// Load and merge all localization files listed in the manifest.
async function fetchLocalizationFiles() {
    const files = await fetchJson(MANIFEST_PATH, 'localization manifest');
    if (!Array.isArray(files) || files.some(file => typeof file !== 'string' || !file.endsWith('.json'))) {
        throw new Error(`Invalid localization manifest ${MANIFEST_PATH}`);
    }
    const entries = await Promise.all(files.map(file => fetchJson(`data/loc/${file}`, 'localization file')));
    return Object.assign({}, ...entries);
}

// Class of the inline POI link buttons (styled in pois.css).
const POI_LINK_CLASS = 'poi-link';
const POI_LINK = /\{\{([^{}|]+)(?:\|([^{}]*))?\}\}/g;

// Replace each {{id|text}} with a tooltip button for "<id>-desc". A link to a key without
// a description is left as its plain text and logged.
function applyPoiLinks(localization) {
    for (const [key, value] of Object.entries(localization)) {
        if (typeof value !== 'string' || !value.includes('{{')) continue;
        localization[key] = value.replace(POI_LINK, (match, rawId, rawText) => {
            const id = rawId.trim();
            const name = localization[id];
            const text = rawText?.trim() || (typeof name === 'string' ? name : id);
            if (typeof localization[`${id}-desc`] !== 'string') {
                console.warn(`Localization "${key}" links to "${id}", which has no "${id}-desc"; it is shown as plain text.`);
                return text;
            }
            return `<button type="button" class="${POI_LINK_CLASS} btn-plain has-tooltip" data-tooltip="${escapeHtml(id)}-desc">${text}</button>`;
        });
    }
    return localization;
}

// Put each description's localized title in front of it as a heading.
function applyDescriptionTitles(localization) {
    for (const [key, description] of Object.entries(localization)) {
        if (!key.endsWith('-desc') || typeof description !== 'string') continue;
        const title = localization[key.slice(0, -5)];
        if (typeof title !== 'string') continue;
        localization[key] = `<h2>[${escapeHtml(title)}]</h2>${description}`;
    }
    return localization;
}

let localizationPromise = null;

// The first call starts the request; later calls share it, whether it is still
// loading or already done. A failed request is retried on the next call.
export function getLocalization() {
    localizationPromise ??= fetchLocalizationFiles()
        .then(applyPoiLinks)
        .then(applyDescriptionTitles)
        .catch(error => {
            localizationPromise = null;
            throw error;
        });
    return localizationPromise;
}

// ----------------------------------------------------------------- keywords

// ".cls" -> <span class="cls">, "tag.a.b" -> <tag class="a b">, "tag" -> <tag>.
function parseWrapper(selector) {
    if (selector.startsWith('.')) return { tag: 'span', className: selector.slice(1) };
    const [tag, ...classes] = selector.split('.');
    return { tag: tag || 'span', className: classes.join(' ') };
}

// Keywords that start with "=" match with exact case ("=Trust" highlights "Trust" but
// not "trust"); all others ignore case.
const EXACT_CASE_PREFIX = '=';

// A scanner for a group of keywords. The match is an empty lookahead, so it finds a
// keyword at every place a word can start, even inside or across another keyword
// ("Central Asian Federation" and the "Federation" in it are both found). The
// alternatives go longest first, so at each start it captures the longest keyword there.
// Unicode letters, numbers, and underscores count as word characters.
function buildScanner(keywords, flags) {
    const escaped = [...new Set(keywords)]
        .sort((a, b) => b.length - a.length)
        .map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!escaped.length) return null;
    return new RegExp(`(?<![\\p{L}\\p{N}_])(?=(${escaped.join('|')})(?![\\p{L}\\p{N}_]))`, flags);
}

// Up to two scanners per list: one for its case-insensitive keywords, one for its
// exact-case ones.
function buildScanners(keywords, path) {
    if (!Array.isArray(keywords)) {
        console.warn(`Keyword list ${path} is not an array; its keywords are not highlighted.`);
        return [];
    }
    const valid = keywords.filter(keyword => typeof keyword === 'string' && keyword.length > 0);
    const exact = valid
        .filter(keyword => keyword.startsWith(EXACT_CASE_PREFIX))
        .map(keyword => keyword.slice(EXACT_CASE_PREFIX.length))
        .filter(Boolean);
    const anyCase = valid.filter(keyword => !keyword.startsWith(EXACT_CASE_PREFIX));
    return [buildScanner(anyCase, 'giu'), buildScanner(exact, 'gu')].filter(Boolean);
}

let keywordFormatters = null;

// Fetches the keyword lists and compiles their scanners once, on first use. The
// formatters keep the order of KEYWORD_LISTS, which breaks ties between lists.
function getKeywordFormatters() {
    keywordFormatters ??= Promise.all(KEYWORD_LISTS.map(async list => {
        let keywords = [];
        try {
            keywords = await fetchJson(list.path, 'keyword list');
        } catch (error) {
            console.warn(`Could not load shared localization keywords from ${list.path}:`, error);
        }
        const wrapper = parseWrapper(list.selector);
        return buildScanners(keywords, list.path).map(scanner => ({ ...list, ...wrapper, scanner }));
    })).then(formatters => formatters.flat());
    return keywordFormatters;
}

// The keywords to highlight in one text, in reading order. Every list is scanned at
// once, then overlaps are settled: the longest keyword wins, so a phrase is never cut
// up by the shorter keywords inside it, whatever list or case rule each one has. Of two
// keywords the same length, the one from the earlier list wins, then the earlier one
// in the text.
function findKeywords(text, formatters) {
    const candidates = [];
    formatters.forEach((formatter, priority) => {
        for (const match of text.matchAll(formatter.scanner)) {
            const start = match.index;
            candidates.push({ start, end: start + match[1].length, formatter, priority });
        }
    });
    if (!candidates.length) return candidates;

    candidates.sort((a, b) =>
        (b.end - b.start) - (a.end - a.start) || a.priority - b.priority || a.start - b.start);
    const chosen = [];
    for (const candidate of candidates) {
        const overlaps = chosen.some(other => candidate.start < other.end && other.start < candidate.end);
        if (!overlaps) chosen.push(candidate);
    }
    return chosen.sort((a, b) => a.start - b.start);
}

// Wrap whole keyword matches in text nodes, leaving existing HTML markup intact.
// Keywords are for descriptive copy only, so only text inside paragraphs is touched,
// and text already inside a highlight or a POI link is left alone.
function wrapKeywords(root, formatters) {
    const skipSelector = [...new Set(formatters.map(formatter => formatter.selector)), `.${POI_LINK_CLASS}`].join(', ');
    const textNodes = [];
    root.querySelectorAll('p').forEach(paragraph => {
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) textNodes.push(walker.currentNode);
    });

    for (const textNode of textNodes) {
        if (textNode.parentElement?.closest(skipSelector)) continue;
        const text = textNode.nodeValue;
        const keywords = findKeywords(text, formatters);
        if (!keywords.length) continue;

        const replacement = document.createDocumentFragment();
        let lastIndex = 0;
        for (const { start, end, formatter } of keywords) {
            replacement.append(text.slice(lastIndex, start));
            const wrapper = document.createElement(formatter.tag);
            if (formatter.className) wrapper.className = formatter.className;
            wrapper.textContent = text.slice(start, end);
            replacement.append(wrapper);
            lastIndex = end;
        }
        replacement.append(text.slice(lastIndex));
        textNode.replaceWith(replacement);
    }
}

const formattedLocalization = new Map();

// Format one localization string on demand; each key is only formatted once.
export function formatLocalizationValue(key) {
    if (formattedLocalization.has(key)) return formattedLocalization.get(key);

    const value = localizationData?.[key];
    if (typeof value !== 'string') return Promise.resolve(value);

    const formatted = getKeywordFormatters().then(formatters => {
        if (!value || !formatters.length) return value;
        const template = document.createElement('template');
        template.innerHTML = value;
        wrapKeywords(template.content, formatters);
        return template.innerHTML;
    });
    formattedLocalization.set(key, formatted);
    return formatted;
}

// ------------------------------------------------------------------- page

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

// Change the main description quote whenever it, or any of its parents, is shown or hidden.
function bindLoadingTips(data) {
    const loadingTips = Object.entries(data)
        .filter(([key, value]) => key.startsWith('LOADING_TIP_') && typeof value === 'string' && value.length > 0)
        .map(([, value]) => value);
    const description = document.querySelector('.quote-txt');
    const quoteBox = document.getElementById('quote-div');
    if (!description || !quoteBox || !loadingTips.length || description.dataset.loadingTipsBound) return;

    let tipIndex = 0;
    function showTip(index) {
        tipIndex = index;
        description.dataset.loadingTipIndex = String(index);
        description.innerHTML = loadingTips[index];
    }
    showTip(Math.floor(Math.random() * loadingTips.length));

    description.dataset.loadingTipsBound = 'true';
    let quoteBoxWasVisible = !quoteBox.closest('[hidden]');
    const visibilityObserver = new MutationObserver(() => {
        const quoteBoxIsVisible = !quoteBox.closest('[hidden]');
        if (quoteBoxIsVisible === quoteBoxWasVisible) return;
        quoteBoxWasVisible = quoteBoxIsVisible;

        // Any tip but the current one, so every visibility change updates it.
        const offset = loadingTips.length > 1 ? 1 + Math.floor(Math.random() * (loadingTips.length - 1)) : 0;
        showTip((tipIndex + offset) % loadingTips.length);
    });
    for (let element = quoteBox; element; element = element.parentElement) {
        visibilityObserver.observe(element, { attributes: true, attributeFilter: ['hidden'] });
    }
}

async function loadLocalization() {
    try {
        const data = await getLocalization();
        await Promise.allSettled(setupTasks);
        localizationData = data;

        const elementsByClass = buildLocalizationElementLookup();
        Object.entries(data).forEach(([key, value]) => {
            elementsByClass.get(key)?.forEach(element => {
                element.innerHTML = value;
            });
        });

        // POI descriptions get their keywords highlighted when their panel is first opened.
        const formattedPoiDescriptions = new Set();
        function formatPoiPanel(button) {
            const key = `${button.dataset.panelTarget}-desc`;
            const elements = elementsByClass.get(key);
            if (!elements || !Object.hasOwn(data, key) || formattedPoiDescriptions.has(key)) return Promise.resolve();

            formattedPoiDescriptions.add(key);
            return formatLocalizationValue(key).then(value => {
                elements.forEach(element => {
                    element.innerHTML = value;
                });
            }).catch(error => {
                formattedPoiDescriptions.delete(key);
                console.error(`Error formatting localization ${key}:`, error);
            });
        }

        const poiButtonSelector = `[data-panel-target][data-panel-group="${POI_PANEL_GROUP}"]`;
        document.addEventListener('click', event => {
            const button = event.target.closest?.(poiButtonSelector);
            if (button) formatPoiPanel(button);
        });

        bindLoadingTips(data);

        // The open POI panel is on screen from the start, so its highlights are done
        // before the loading screen lifts.
        const initialPoiButton = document.querySelector(`${poiButtonSelector}[aria-pressed="true"]`);
        const initialPanel = initialPoiButton && document.getElementById(initialPoiButton.dataset.panelTarget);
        if (initialPanel && !initialPanel.hidden) await formatPoiPanel(initialPoiButton);
    } catch (error) {
        console.error('Error loading localization:', error);
    }
}

holdLoadingScreen('text', loadLocalization());

