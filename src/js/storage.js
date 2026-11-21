// storage.js - Saved preferences (theme, audio, screen effects, motion).
// Storage can be blocked (private windows, cleared site data), so every access is
// wrapped: a failure only means the choice is not remembered between visits.

export function readStored(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeStored(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch { /* the preference just won't persist */ }
}

// "on"/"off" flags. Nothing saved (or anything else) gives the fallback.
export function readFlag(key, fallback) {
    const saved = readStored(key);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
    return fallback;
}

export function writeFlag(key, isOn) {
    writeStored(key, isOn ? 'on' : 'off');
}

// Whole number from 0 to 100 (volume sliders), or the fallback.
export function readPercent(key, fallback = 100) {
    const saved = parseInt(readStored(key), 10);
    return Number.isFinite(saved) ? Math.min(100, Math.max(0, saved)) : fallback;
}
