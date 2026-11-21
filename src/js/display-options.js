// display-options.js - Screen effect toggles (scanlines, halftone, vignette) and the reduce motion toggle.
import {
    motionPreference,
    saveReducedMotionPreference,
    setReducedMotion,
    systemPrefersReducedMotion,
    watchSystemReducedMotion
} from './motion.js';
import { readFlag, writeFlag } from './storage.js';

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
        writeFlag(key, toggle.checked);
    });
});

// Reduce motion: when the OS already asks for it, the box is ticked and locked.
const motionToggle = document.getElementById('reduced-motion-toggle');

function syncMotionToggle() {
    const locked = systemPrefersReducedMotion();
    motionToggle.checked = motionPreference.matches;
    motionToggle.disabled = locked;
    motionToggle.title = locked ? 'Set by your system settings' : '';
}

if (motionToggle) {
    syncMotionToggle();
    watchSystemReducedMotion(syncMotionToggle);

    motionToggle.addEventListener('change', () => {
        setReducedMotion(motionToggle.checked);
        saveReducedMotionPreference(motionToggle.checked);
    });
}
