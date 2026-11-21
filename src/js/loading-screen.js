// loading-screen.js - Keeps the loading screen up until the page is ready, then fades it
// out. Ready means every task handed to holdLoadingScreen() has settled, loaded or
// failed: the page's own files and fonts (below), the text and POI panels (loc.js), the
// market data (market-data.js) and the globe's terrain (globe.js). MAX_WAIT_MS caps the
// wait, so one stuck request cannot keep the page covered. The console gets one line
// with the time each task finished, counted from when the page started loading.

const MAX_WAIT_MS = 10000;

const loadingScreen = document.getElementById('loading-screen');
const tasks = [];
let shown = false;
let resolveShown;

// Resolves as the loading screen starts to fade out (scroll-reveal.js waits for it).
export const pageShown = new Promise(resolve => { resolveShown = resolve; });

// Keeps the loading screen up until promise settles. label names the task in the console.
export function holdLoadingScreen(label, promise) {
    if (shown) return;
    const task = { label, ms: null };
    task.settled = Promise.resolve(promise)
        .catch(() => { /* the module reports its own errors; the page shows anyway */ })
        .then(() => { task.ms = performance.now(); });
    tasks.push(task);
}

// Modules keep adding tasks while they start up, so wait until a pass adds none.
async function allTasksSettled() {
    let count;
    do {
        count = tasks.length;
        await Promise.all(tasks.map(task => task.settled));
    } while (tasks.length !== count);
}

const seconds = ms => `${(ms / 1000).toFixed(2)} s`;

function show(timedOut) {
    if (shown) return;
    shown = true;

    const pending = tasks.filter(task => task.ms === null).map(task => task.label);
    if (timedOut && pending.length) {
        console.warn(`[Loading] Showing the page after ${seconds(MAX_WAIT_MS)} without waiting any longer for: ${pending.join(', ')}.`);
    } else {
        const finished = tasks.slice().sort((a, b) => b.ms - a.ms)
            .map(task => `${task.label} ${seconds(task.ms)}`);
        console.info(`[Loading] Ready after ${seconds(performance.now())}. Finished (slowest first): ${finished.join(', ')}.`);
    }

    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        // Remove it once it has faded, which also stops the spinner's endless animation.
        const remove = () => loadingScreen.remove();
        loadingScreen.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 1000); // in case no transition runs
    }
    resolveShown();
}

const pageLoaded = new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
});
// Stylesheets, scripts, images and background art all hold up the load event.
holdLoadingScreen('page files', pageLoaded);
// A font only starts loading once text that uses it is laid out, so ask after the load event.
holdLoadingScreen('fonts', pageLoaded.then(() => document.fonts?.ready));

Promise.race([
    allTasksSettled().then(() => false),
    new Promise(resolve => setTimeout(resolve, MAX_WAIT_MS, true))
]).then(show);
