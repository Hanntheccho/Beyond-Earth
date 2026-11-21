// motion.js - Shared reduced-motion preference.
// Motion is reduced when the OS asks for it, or when the player turns on "Reduce motion"
// in the options menu (saved under be-reduced-motion, applied as body.reduced-motion).
const REDUCED_MOTION_STORAGE_KEY = "be-reduced-motion";
const systemQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function readReducedMotionPreference() {
    try {
        return localStorage.getItem(REDUCED_MOTION_STORAGE_KEY) === "on";
    } catch (e) {
        return false;
    }
}

export function saveReducedMotionPreference(isOn) {
    try {
        localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, isOn ? "on" : "off");
    } catch (e) { /* the preference just won't persist */ }
}

export function setReducedMotion(isOn) {
    document.body.classList.toggle('reduced-motion', isOn);
}

export function systemPrefersReducedMotion() {
    return systemQuery.matches;
}

// Drop-in for a MediaQueryList: modules read motionPreference.matches each frame.
export const motionPreference = {
    get matches() {
        return systemQuery.matches || document.body.classList.contains('reduced-motion');
    }
};

// Apply the saved choice right away so the first frames already respect it.
setReducedMotion(readReducedMotionPreference());
