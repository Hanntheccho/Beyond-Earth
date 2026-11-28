// audio.js - Background music and interface click sounds, each with an on/off toggle
// and a volume slider in the options menu. Every choice is remembered between visits.
import { readFlag, readPercent, writeFlag, writeStored } from './storage.js';

const MUSIC_STORAGE_KEY = 'be-music';
const MUSIC_VOLUME_STORAGE_KEY = 'be-music-volume';
const SFX_STORAGE_KEY = 'be-sfx';
const SFX_VOLUME_STORAGE_KEY = 'be-sfx-volume';

// Clicks on these play the click sound (globe markers are buttons too; the ticker
// toggles the data view).
const CLICK_SOUND_TARGETS = 'button, input[type="checkbox"], .treemap-tile.has-children, .ticker';

const backgroundMusic = document.getElementById('music');
const clickSound = document.getElementById('audio');
const musicToggle = document.getElementById('music-toggle');
const sfxToggle = document.getElementById('sfx-toggle');

// Volume slider, 0 to 100, applied to one audio element.
function bindVolume(audio, input, readout, storageKey) {
    function apply(percent, save) {
        if (audio) audio.volume = percent / 100;
        if (input) input.value = String(percent);
        if (readout) readout.textContent = `${percent}%`;
        if (save) writeStored(storageKey, String(percent));
    }

    apply(readPercent(storageKey), false);
    input?.addEventListener('input', () => apply(Number(input.value), true));
}

// ---------------------------------------------------------------- music

// Music is off until the player turns it on. The toggle is a checkbox: checked means on.
let musicWanted = readFlag(MUSIC_STORAGE_KEY, false);

function setMusicWanted(isOn) {
    musicWanted = isOn;
    writeFlag(MUSIC_STORAGE_KEY, isOn);
    if (musicToggle) musicToggle.checked = isOn;
}

if (musicToggle) musicToggle.checked = musicWanted;
bindVolume(backgroundMusic, document.getElementById('music-volume'),
    document.getElementById('music-volume-readout'), MUSIC_VOLUME_STORAGE_KEY);

// Browsers only allow audio after a user gesture. If music was left on last visit,
// it starts with the first click or key press.
const firstGesture = new AbortController();
function resumeMusic() {
    firstGesture.abort();
    if (musicWanted && backgroundMusic?.paused) backgroundMusic.play().catch(() => {});
}
document.addEventListener('click', resumeMusic, { signal: firstGesture.signal });
document.addEventListener('keydown', resumeMusic, { signal: firstGesture.signal });

musicToggle?.addEventListener('change', () => {
    setMusicWanted(musicToggle.checked);
    if (!backgroundMusic) return;
    if (musicWanted) {
        // Playback was refused, so show the toggle as off again.
        backgroundMusic.play().catch(() => setMusicWanted(false));
    } else {
        backgroundMusic.pause();
    }
});

// ----------------------------------------------------- interface sounds

// On by default, with their own volume.
let sfxWanted = readFlag(SFX_STORAGE_KEY, true);
if (sfxToggle) sfxToggle.checked = sfxWanted;
bindVolume(clickSound, document.getElementById('sfx-volume'),
    document.getElementById('sfx-volume-readout'), SFX_VOLUME_STORAGE_KEY);

sfxToggle?.addEventListener('change', () => {
    sfxWanted = sfxToggle.checked;
    writeFlag(SFX_STORAGE_KEY, sfxWanted);
});

document.body.addEventListener('click', event => {
    if (!clickSound || !sfxWanted || !event.target.closest?.(CLICK_SOUND_TARGETS)) return;
    try {
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
    } catch (error) {
        console.error('Click sound failed:', error);
    }
});

