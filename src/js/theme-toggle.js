// theme-toggle.js - Light/dark theme toggle; the choice is remembered between visits like the music.
const THEME_STORAGE_KEY = "be-theme";

// Storage can be blocked (private windows, cleared site data), so every access is wrapped.
function readThemePreference() {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) === "light";
    } catch (e) {
        return false;
    }
}

function saveThemePreference(isLight) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, isLight ? "light" : "dark");
    } catch (e) { /* the preference just won't persist */ }
}

// The toggle is a checkbox: checked means light theme.
const themeToggle = document.getElementById('theme-toggle');

function applyTheme(isLight) {
    document.body.classList.toggle('light-theme', isLight);
    if (themeToggle) themeToggle.checked = isLight;
}

// Apply the saved theme right away (module scripts run after the DOM is parsed) to avoid a flash.
applyTheme(readThemePreference());

if (themeToggle) {
    themeToggle.addEventListener('change', () => {
        applyTheme(themeToggle.checked);
        saveThemePreference(themeToggle.checked);
    });
}
