/**
 * This function loads localization data based on the provided language code.
 * It fetches a corresponding JSON file, updates the page content, and handles errors by falling back to English.
 * 
 * @param {string} language - The language code (e.g., 'en', 'fr', etc.) to load the localization for.
 */
async function loadLocalization(language) {
    try {
        // Get the HTML file name (without extension)
        const htmlFileName = window.location.pathname.split('/').pop().split('.').shift();
        
        // Construct the path based on the HTML file name
        const locPath = `loc/${htmlFileName}/${language}.json`;

        // Attempt to fetch the localization file for the specified language
        const response = await fetch(locPath);

        // If the response is not OK (e.g., file not found), throw an error
        if (!response.ok) throw new Error(`Failed to load ${locPath}`);

        // Parse the JSON response to extract localization data
        const data = await response.json();

        // Iterate over the key-value pairs in the localization data
        Object.entries(data).forEach(([key, value]) => {
            // For each key, look for elements on the page that match the class name (key)
            const elements = document.querySelectorAll(`.${key}`);

            // If elements are found, update their inner HTML with the localized value
            if (elements.length) {
                elements.forEach(element => element.innerHTML = value);
            } else {
                // If no elements are found, log a warning
                console.warn(`No element found for key: ${key}`);
            }
        });
    } catch (error) {
        // If there's an error loading the localization, log the error
        console.error(`Error loading localization for ${language}:`, error);

        // Fallback to English if not already attempted
        if (language !== 'en') {
            console.log('Falling back to English...');
            loadLocalization('en');
        }
    }
}

// Cache for storing localization data to avoid redundant network requests
const localizationCache = {};

/**
 * This function retrieves the localization data for a given language.
 * It caches the result so that subsequent calls for the same language don't need to fetch the data again.
 * 
 * @param {string} language - The language code (e.g., 'en', 'fr', etc.) to get the localization data for.
 * @returns {Promise<Object>} The parsed localization data.
 */
async function getLocalization(language) {
    // Get the HTML file name
    const htmlFileName = window.location.pathname.split('/').pop().split('.').shift();
    const locPath = `loc/${htmlFileName}/${language}.json`;

    // Check if the requested language's data is already in the cache
    if (localizationCache[locPath]) {
        return localizationCache[locPath];
    }

    // If not in cache, fetch the localization data from the server
    const response = await fetch(locPath);

    // Parse the JSON data
    const data = await response.json();

    // Cache the data for future use
    localizationCache[locPath] = data;

    // Return the fetched localization data
    return data;
}

// Auto-detect the user's language preference from the browser
const userLang = navigator.language || 'en';

// Load the localization data based on the detected language (defaults to the first part of the language code)
loadLocalization(userLang.split('-')[0]);
