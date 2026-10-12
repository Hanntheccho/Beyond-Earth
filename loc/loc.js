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

    return { ...defaultData, ...pageData };
}


/**
 * Loads localization data and updates the page.
 *
 * @param {string} language - The language code (e.g. 'en', 'fr', etc.).
 */
async function loadLocalization(language) {
    try {
        const data = await fetchLocalization(language);

        Object.entries(data).forEach(([key, value]) => {
            const elements = document.querySelectorAll(`.${key}`);

            if (elements.length) {
                elements.forEach(element => {
                    element.innerHTML = value;
                });
            } else {
                console.warn(`No element found for key: ${key}`);
            }

            // Tooltip values can reference localized HTML keys. Show their
            // readable text without exposing markup in the tooltip.
            document.querySelectorAll(`[data-tooltip="${key}"]`).forEach(element => {
                const tooltipText = document.createElement('div');
                tooltipText.innerHTML = value;
                element.dataset.tooltip = tooltipText.textContent.trim();
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
