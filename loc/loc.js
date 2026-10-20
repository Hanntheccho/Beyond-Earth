/**
 * Gets the localization data.
 *
 * Loads every localization JSON listed in loc/{language}/manifest.json.
 * Missing translations fall back to the corresponding English values.
 */
async function fetchLocalization(language) {
    const requestedLanguage = language || 'en';
    const englishData = await fetchLanguageLocalization('en');
    let localization = englishData;
    if (requestedLanguage !== 'en') {
        try {
            localization = { ...englishData, ...await fetchLanguageLocalization(requestedLanguage) };
        } catch (error) {
            console.warn(`Could not load localization for ${requestedLanguage}; using English:`, error);
        }
    }
    const keywords = await fetchKeywords();

    return applyKeywordFormatting(localization, keywords);
}

/** Load and merge all localization files listed for a language. */
async function fetchLanguageLocalization(language) {
    const manifestPath = `loc/${language}/manifest.json`;
    const manifestResponse = await fetch(manifestPath);
    if (!manifestResponse.ok) {
        throw new Error(`Failed to load localization manifest ${manifestPath}`);
    }

    const files = await manifestResponse.json();
    if (!Array.isArray(files) || files.some(file => typeof file !== 'string' || !file.endsWith('.json'))) {
        throw new Error(`Invalid localization manifest ${manifestPath}`);
    }

    const entries = await Promise.all(files.map(async file => {
        const path = `loc/${language}/${file}`;
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to load localization file ${path}`);
        return response.json();
    }));

    return Object.assign({}, ...entries);
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
    const cacheKey = language || 'en';

    if (localizationCache[cacheKey]) {
        return localizationCache[cacheKey];
    }

    const data = await fetchLocalization(language);

    // Cache using the requested page/language combination
    localizationCache[cacheKey] = data;

    return data;
}


// Auto-detect the user's language preference from the browser
const userLang = navigator.language || 'en';

// Load localization
loadLocalization(userLang.split('-')[0]);
