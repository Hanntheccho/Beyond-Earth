// theme-toggle.js - Light/dark theme toggle; the choice is remembered between visits like the music.
import { readStored, writeStored } from './storage.js';

const THEME_STORAGE_KEY = 'be-theme';

// The toggle is a checkbox: checked means light theme.
const themeToggle = document.getElementById('theme-toggle');

function applyTheme(isLight) {
    document.body.classList.toggle('light-theme', isLight);
    if (themeToggle) themeToggle.checked = isLight;
}

// Apply the saved theme right away (module scripts run after the DOM is parsed) to avoid a flash.
applyTheme(readStored(THEME_STORAGE_KEY) === 'light');

themeToggle?.addEventListener('change', () => {
    applyTheme(themeToggle.checked);
    writeStored(THEME_STORAGE_KEY, themeToggle.checked ? 'light' : 'dark');
});
