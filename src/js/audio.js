// Audio elements
const backgroundMusic = document.getElementById("music");
const clickSound = document.getElementById("audio");
const musicToggle = document.getElementById("music-toggle");
const MUSIC_STORAGE_KEY = "be-music";

if (clickSound) clickSound.volume = 1.0;

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
    if (musicToggle) musicToggle.setAttribute("aria-pressed", String(musicWanted));
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
    musicToggle.addEventListener("click", function() {
        musicWanted = !musicWanted;
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

document.body.addEventListener('click', function(event) {
    const btn = event.target.closest && event.target.closest('button, .treemap-tile.has-children, .globe-marker img');
    if (!btn || !clickSound) return;
    try {
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
    } catch (e) { console.error('Click sound failed:', e); }
});
