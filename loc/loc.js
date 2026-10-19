/**
 * Gets the HTML file name without extension.
 */
function getHtmlFileName() {
    return window.location.pathname.split('/').pop().split('.').shift();
}

/**
 * Gets the localization data.
 *
 * First tries:
 *     loc/{htmlFileName}/{language}.json
 *
 * If that doesn't exist, falls back to:
 *     loc/default.json
 */
async function fetchLocalization(language) {
    const htmlFileName = getHtmlFileName();
    const defaultPath = 'loc/default.json';
    let defaultData;
    try {
        const response = await fetch(defaultPath);
        if (!response.ok) {
            throw new Error(`Failed to load ${defaultPath}`);
        }
        defaultData = await response.json();
    } catch (error) {
        console.error('Failed to load default localization:', error);
        throw error;
    }

    // Use the page's requested language when available, otherwise its English
    // file. Any keys absent from that file retain their default.json values.
    const pageLanguages = language === 'en' ? ['en'] : [language, 'en'];
    let pageData = {};

    for (const pageLanguage of pageLanguages) {
        const pageLocPath = `loc/${htmlFileName}/${pageLanguage}.json`;
        try {
            const response = await fetch(pageLocPath);
            if (response.ok) {
                pageData = await response.json();
                break;
            }
        } catch (error) {
            console.warn(`Could not load ${pageLocPath}`, error);
        }
    }

    const localization = { ...defaultData, ...pageData };
    const keywords = await fetchKeywords();

    return applyKeywordFormatting(localization, keywords);
}

let keywordPromise;

/** Load the shared list once; it applies to default and page-specific locales. */
function fetchKeywords() {
    if (!keywordPromise) {
        keywordPromise = fetch('loc/keywords.json').then(response => {
            if (!response.ok) throw new Error('Failed to load loc/keywords.json');
            return response.json();
        }).catch(error => {
            console.warn('Could not load shared localization keywords:', error);
            return [];
        });
    }
    return keywordPromise;
}

/** Bold whole keyword matches in text nodes, leaving existing HTML markup intact. */
function applyKeywordFormatting(localization, keywords) {
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
            if (textNode.parentElement?.closest('b')) continue;
            matcher.lastIndex = 0;
            const text = textNode.nodeValue;
            if (!matcher.test(text)) continue;
            matcher.lastIndex = 0;

            const replacement = document.createDocumentFragment();
            let lastIndex = 0;
            for (const match of text.matchAll(matcher)) {
                replacement.append(document.createTextNode(text.slice(lastIndex, match.index)));
                const bold = document.createElement('b');
                bold.textContent = match[0];
                replacement.append(bold);
                lastIndex = match.index + match[0].length;
            }
            replacement.append(document.createTextNode(text.slice(lastIndex)));
            textNode.replaceWith(replacement);
        }

        localization[key] = template.innerHTML;
    }
    return localization;
}


/**
 * Loads localization data and updates the page.
 *
 * @param {string} language - The language code (e.g. 'en', 'fr', etc.).
 */
async function loadLocalization(language) {
    try {
        const data = await fetchLocalization(language);
        window.localizationData = data;

        Object.entries(data).forEach(([key, value]) => {
            const elements = document.querySelectorAll(`.${key}`);

            if (elements.length) {
                elements.forEach(element => {
                    element.innerHTML = value;
                });
            } else {
                console.warn(`No element found for key: ${key}`);
            }

            // Keep localized markup so tooltip descriptions can render basic
            // formatting such as paragraphs, bold, and italics.
            document.querySelectorAll(`[data-tooltip="${key}"]`).forEach(element => {
                element.dataset.tooltip = value;
            });
        });
    } catch (error) {
        console.error(`Error loading localization for ${language}:`, error);
    }
}


// Cache for storing localization data
const localizationCache = {};


/**
 * Retrieves localization data for a given language.
 *
 * @param {string} language - The language code.
 * @returns {Promise<Object>} The parsed localization data.
 */
async function getLocalization(language) {
    const htmlFileName = getHtmlFileName();
    const pageLocPath = `loc/${htmlFileName}/${language}.json`;

    // Check page-specific localization cache
    if (localizationCache[pageLocPath]) {
        return localizationCache[pageLocPath];
    }

    const data = await fetchLocalization(language);

    // Cache using the requested page/language combination
    localizationCache[pageLocPath] = data;

    return data;
}


// Auto-detect the user's language preference from the browser
const userLang = navigator.language || 'en';

// Load localization
loadLocalization(userLang.split('-')[0]);
