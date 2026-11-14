// Audio elements
let backgroundMusic = document.getElementById("music");
let clickSound = document.getElementById("audio");
backgroundMusic.volume = 1.0;
clickSound.volume = 1.0;

function loadMusic() {
    if (!backgroundMusic.src) {
        backgroundMusic.src = 'assets/sfx/sfx-music.ogg';
        backgroundMusic.load();
    }
}

// Load music on any user interaction
document.addEventListener('click', loadMusic, { once: true });
document.addEventListener('mouseover', loadMusic, { once: true });

document.body.addEventListener('click', function(event) {
    const btn = event.target.closest && event.target.closest('button, .treemap-tile.has-children, .globe-marker img');
    if (!btn) return;
    loadMusic();
    try {
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
    } catch (e) { console.error('Click sound failed:', e); }
});
