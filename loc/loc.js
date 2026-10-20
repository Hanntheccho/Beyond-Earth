/**
 * Gets the localization data.
 *
 * Loads every localization JSON listed in loc/manifest.json.
 */
async function fetchLocalization() {
    const localization = await fetchLocalizationFiles();
    const keywords = await fetchKeywords();

    return applyKeywordFormatting(localization, keywords);
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

let keywordPromise;

/** Load the shared keyword list once; it stays separate from localization JSONs. */
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
 */
async function loadLocalization() {
    try {
        const data = await fetchLocalization();
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

        // Show one archived quote in the main description on every page load.
        const loadingTips = Object.entries(data)
            .filter(([key, value]) => key.startsWith('LOADING_TIP_') && typeof value === 'string' && value.length > 0)
            .map(([, value]) => value);
        const description = document.querySelector('.BE0-desc');
        if (description && loadingTips.length > 0) {
            description.innerHTML = loadingTips[Math.floor(Math.random() * loadingTips.length)];
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
