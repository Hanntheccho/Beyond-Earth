// Audio elements
const backgroundMusic = document.getElementById("music");
const clickSound = document.getElementById("audio");
const musicToggle = document.getElementById("music-toggle");
const MUSIC_STORAGE_KEY = "be-music";

// Music is off until the player turns it on, and the choice is remembered.
// Storage can be blocked (private windows, cleared site data), so every access is wrapped.
function readMusicPreference() {
    try {
        return localStorage.getItem(MUSIC_STORAGE_KEY) === "on";
    } catch (e) {
        return false;
    }
}

function saveMusicPreference(isOn) {
    try {
        localStorage.setItem(MUSIC_STORAGE_KEY, isOn ? "on" : "off");
    } catch (e) { /* the preference just won't persist */ }
}

let musicWanted = readMusicPreference();

function syncMusicToggle() {
    // The toggle is a checkbox: checked means music on.
    if (musicToggle) musicToggle.checked = musicWanted;
}

syncMusicToggle();

// Music volume, 0 to 100, remembered between visits like the on/off choice.
const musicVolumeInput = document.getElementById("music-volume");
const musicVolumeReadout = document.getElementById("music-volume-readout");
const MUSIC_VOLUME_STORAGE_KEY = "be-music-volume";

function readMusicVolume() {
    try {
        const saved = parseInt(localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY), 10);
        if (Number.isFinite(saved)) return Math.min(100, Math.max(0, saved));
    } catch (e) { /* fall back to full volume */ }
    return 100;
}

function applyMusicVolume(percent, save) {
    if (backgroundMusic) backgroundMusic.volume = percent / 100;
    if (musicVolumeInput) musicVolumeInput.value = String(percent);
    if (musicVolumeReadout) musicVolumeReadout.textContent = percent + "%";
    if (!save) return;
    try {
        localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(percent));
    } catch (e) { /* the volume just won't persist */ }
}

applyMusicVolume(readMusicVolume(), false);

if (musicVolumeInput) {
    musicVolumeInput.addEventListener("input", function() {
        applyMusicVolume(Number(musicVolumeInput.value), true);
    });
}

// Browsers only allow audio after a user gesture. If music was left on last visit,
// it starts with the first click or key press.
function resumeMusic() {
    if (musicWanted && backgroundMusic && backgroundMusic.paused) {
        backgroundMusic.play().catch(() => {});
    }
}
document.addEventListener("click", resumeMusic, { once: true });
document.addEventListener("keydown", resumeMusic, { once: true });

if (musicToggle) {
    musicToggle.addEventListener("change", function() {
        musicWanted = musicToggle.checked;
        saveMusicPreference(musicWanted);
        syncMusicToggle();
        if (!backgroundMusic) return;
        if (musicWanted) {
            backgroundMusic.play().catch(() => {
                // Playback was refused, so show the toggle as off again.
                musicWanted = false;
                saveMusicPreference(false);
                syncMusicToggle();
            });
        } else {
            backgroundMusic.pause();
        }
    });
}

// Interface sounds (the click sound): on by default, with their own volume, both remembered.
const sfxToggle = document.getElementById("sfx-toggle");
const sfxVolumeInput = document.getElementById("sfx-volume");
const sfxVolumeReadout = document.getElementById("sfx-volume-readout");
const SFX_STORAGE_KEY = "be-sfx";
const SFX_VOLUME_STORAGE_KEY = "be-sfx-volume";

function readSfxPreference() {
    try {
        return localStorage.getItem(SFX_STORAGE_KEY) !== "off";
    } catch (e) {
        return true;
    }
}

let sfxWanted = readSfxPreference();
if (sfxToggle) sfxToggle.checked = sfxWanted;

if (sfxToggle) {
    sfxToggle.addEventListener("change", function() {
        sfxWanted = sfxToggle.checked;
        try {
            localStorage.setItem(SFX_STORAGE_KEY, sfxWanted ? "on" : "off");
        } catch (e) { /* the preference just won't persist */ }
    });
}

function readSfxVolume() {
    try {
        const saved = parseInt(localStorage.getItem(SFX_VOLUME_STORAGE_KEY), 10);
        if (Number.isFinite(saved)) return Math.min(100, Math.max(0, saved));
    } catch (e) { /* fall back to full volume */ }
    return 100;
}

function applySfxVolume(percent, save) {
    if (clickSound) clickSound.volume = percent / 100;
    if (sfxVolumeInput) sfxVolumeInput.value = String(percent);
    if (sfxVolumeReadout) sfxVolumeReadout.textContent = percent + "%";
    if (!save) return;
    try {
        localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(percent));
    } catch (e) { /* the volume just won't persist */ }
}

applySfxVolume(readSfxVolume(), false);

if (sfxVolumeInput) {
    sfxVolumeInput.addEventListener("input", function() {
        applySfxVolume(Number(sfxVolumeInput.value), true);
    });
}

document.body.addEventListener('click', function(event) {
    const btn = event.target.closest && event.target.closest('button, input[type="checkbox"], .treemap-tile.has-children, .globe-marker img');
    if (!btn || !clickSound || !sfxWanted) return;
    try {
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
    } catch (e) { console.error('Click sound failed:', e); }
});
