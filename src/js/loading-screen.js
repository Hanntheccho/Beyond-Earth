/* loading-screen.js — Hides the loading screen after a minimum duration. */

const LOADING_MIN_DURATION = 1000; // minimum ms the loading screen is shown

const loadingScreen = document.getElementById('loading-screen');
if (loadingScreen) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, LOADING_MIN_DURATION);
    });
}
