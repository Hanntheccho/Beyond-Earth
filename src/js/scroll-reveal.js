// scroll-reveal.js - Fades the content windows (.div-win) in as they scroll into
// view, with their text (.scroll-copy) staggered by --copy-order. Windows and text
// added later (POI panels, charts, localized copy) are picked up automatically.
// Nothing is revealed before the loading screen lifts, so the windows already in view
// make their entrance as it fades instead of behind it.
import { observeVisibility } from './viewport-visibility.js';
import { pageShown } from './loading-screen.js';

const REVEAL_SELECTOR = '.div-win';
const COPY_SELECTOR = 'p, h1, h2, .ph1, .ph2, .ph3';
const observed = new WeakSet();
const preparedCopy = new WeakSet();

function prepareCopy(container) {
    let order = 0;
    container.querySelectorAll(COPY_SELECTOR).forEach(element => {
        if (preparedCopy.has(element)) return;
        preparedCopy.add(element);
        element.classList.add('scroll-copy');
        element.style.setProperty('--copy-order', String(order++));
    });
}

function observeReveal(element) {
    if (observed.has(element)) return;
    observed.add(element);
    element.classList.add('scroll-reveal');
    prepareCopy(element);
    pageShown.then(() => {
        observeVisibility(element, isVisible => {
            element.classList.toggle('is-inview', isVisible);
        });
    });
}

document.documentElement.classList.add('scroll-reveal-ready');
document.querySelectorAll(REVEAL_SELECTOR).forEach(observeReveal);

// Only added elements matter: text-only changes (ticker, treemap and ledger numbers)
// cannot add copy, so they are skipped without touching the DOM. Each window is
// prepared once per batch of mutations.
const mutationObserver = new MutationObserver(mutations => {
    const containers = new Set();
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches(REVEAL_SELECTOR)) observeReveal(node);
            node.querySelectorAll(REVEAL_SELECTOR).forEach(observeReveal);
            const container = node.parentElement?.closest(REVEAL_SELECTOR);
            if (container) containers.add(container);
        });
    });
    containers.forEach(prepareCopy);
});
mutationObserver.observe(document.getElementById('main-content') || document.body, {
    childList: true,
    subtree: true
});

