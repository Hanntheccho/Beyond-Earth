// viewport-visibility.js - Tells components when an element is on screen (or within
// MARGIN px of it vertically), so off-screen or hidden panels can skip their redraws.
// An element inside a hidden panel has no box, so it reports as not visible.
const MARGIN = 80;

// element -> { isVisible: true | false | null (not known yet), callbacks: Set }
const targets = new Map();

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        const target = targets.get(entry.target);
        if (!target) return;
        const isVisible = entry.isIntersecting && entry.intersectionRatio > 0;
        if (target.isVisible === isVisible) return;
        target.isVisible = isVisible;
        target.callbacks.forEach(callback => callback(isVisible));
    });
}, { rootMargin: `${MARGIN}px 0px`, threshold: 0.01 });

// Calls callback(isVisible) once the state is known and again whenever it changes.
// Returns a function that stops the updates.
export function observeVisibility(element, callback) {
    if (!(element instanceof Element)) throw new TypeError('Viewport target must be an Element');
    if (typeof callback !== 'function') throw new TypeError('Viewport callback must be a function');

    let target = targets.get(element);
    if (!target) {
        target = { isVisible: null, callbacks: new Set() };
        targets.set(element, target);
        observer.observe(element);
    } else if (target.isVisible !== null) {
        // Already observed: the observer will not report again until something
        // changes, so hand this callback the known state.
        queueMicrotask(() => {
            if (target.callbacks.has(callback)) callback(target.isVisible);
        });
    }
    target.callbacks.add(callback);

    return function unobserve() {
        target.callbacks.delete(callback);
        if (target.callbacks.size || targets.get(element) !== target) return;
        targets.delete(element);
        observer.unobserve(element);
    };
}
