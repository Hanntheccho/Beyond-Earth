// motion.js - Shared reduced-motion preference.
// Motion is reduced when the OS asks for it, or when the player turns on "Reduce motion"
// in the options menu (saved under be-reduced-motion, applied as body.reduced-motion).
import { readFlag, writeFlag } from './storage.js';

const REDUCED_MOTION_STORAGE_KEY = 'be-reduced-motion';
const systemQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

export function saveReducedMotionPreference(isOn) {
    writeFlag(REDUCED_MOTION_STORAGE_KEY, isOn);
}

export function setReducedMotion(isOn) {
    document.body.classList.toggle('reduced-motion', isOn);
}

export function systemPrefersReducedMotion() {
    return systemQuery.matches;
}

// Calls back whenever the OS setting changes.
export function watchSystemReducedMotion(callback) {
    systemQuery.addEventListener('change', callback);
}

// Drop-in for a MediaQueryList: modules read motionPreference.matches each frame.
export const motionPreference = {
    get matches() {
        return systemQuery.matches || document.body.classList.contains('reduced-motion');
    }
};

// Apply the saved choice right away so the first frames already respect it.
setReducedMotion(readFlag(REDUCED_MOTION_STORAGE_KEY, false));
