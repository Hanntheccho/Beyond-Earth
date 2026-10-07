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

    // First try the page-specific localization
    const pageLocPath = `loc/${htmlFileName}/${language}.json`;

    try {
        let response = await fetch(pageLocPath);

        if (response.ok) {
            return await response.json();
        }

        // If the language doesn't exist for this page, try English
        if (language !== 'en') {
            const englishPath = `loc/${htmlFileName}/en.json`;
            response = await fetch(englishPath);

            if (response.ok) {
                return await response.json();
            }
        }
    } catch (error) {
        console.warn(`Could not load ${pageLocPath}`, error);
    }

    // Page-specific localization doesn't exist.
    // Fall back to the default localization.
    const defaultPath = 'loc/default.json';

    try {
        const response = await fetch(defaultPath);

        if (!response.ok) {
            throw new Error(`Failed to load ${defaultPath}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to load default localization:', error);
        throw error;
    }
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
