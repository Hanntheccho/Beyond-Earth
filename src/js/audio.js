// Audio elements
const backgroundMusic = document.getElementById("music");
const clickSound = document.getElementById("audio");
const musicToggle = document.getElementById("music-toggle");
const MUSIC_STORAGE_KEY = "be-music";

if (backgroundMusic) backgroundMusic.volume = 1.0;
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
