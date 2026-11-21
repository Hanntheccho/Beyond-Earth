// display-options.js - Screen effect toggles (scanlines, halftone, vignette) and the reduce motion toggle.
import {
    motionPreference,
    saveReducedMotionPreference,
    setReducedMotion,
    systemPrefersReducedMotion
} from './motion.js';

// Storage can be blocked (private windows, cleared site data), so every access is wrapped.
function readFlag(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        if (saved === "on") return true;
        if (saved === "off") return false;
    } catch (e) { /* use the fallback */ }
    return fallback;
}

function saveFlag(key, isOn) {
    try {
        localStorage.setItem(key, isOn ? "on" : "off");
    } catch (e) { /* the preference just won't persist */ }
}

// Screen effects: each one is on by default and hidden with body.vfx-off-<name>.
document.querySelectorAll('[data-vfx-toggle]').forEach(toggle => {
    const name = toggle.dataset.vfxToggle;
    const key = `be-vfx-${name}`;

    function applyEffect(isOn) {
        document.body.classList.toggle(`vfx-off-${name}`, !isOn);
        toggle.checked = isOn;
    }

    applyEffect(readFlag(key, true));

    toggle.addEventListener('change', () => {
        applyEffect(toggle.checked);
        saveFlag(key, toggle.checked);
    });
});

// Reduce motion: when the OS already asks for it, the box is ticked and locked.
const motionToggle = document.getElementById('reduced-motion-toggle');
if (motionToggle) {
    function syncMotionToggle() {
        const locked = systemPrefersReducedMotion();
        motionToggle.checked = motionPreference.matches;
        motionToggle.disabled = locked;
        motionToggle.title = locked ? 'Set by your system settings' : '';
    }

    syncMotionToggle();
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', syncMotionToggle);

    motionToggle.addEventListener('change', () => {
        setReducedMotion(motionToggle.checked);
        saveReducedMotionPreference(motionToggle.checked);
    });
}
