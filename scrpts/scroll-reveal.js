(function () {
    const revealSelector = '.div-desc-win';
    const copySelector = 'p, h1, h2, .ph1, .ph2, .ph3';
    const observed = new WeakSet();
    const preparedCopy = new WeakSet();

    function prepareCopy(container) {
        let order = 0;
        container.querySelectorAll(copySelector).forEach(element => {
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
        window.viewportVisibility.observe(element, isVisible => {
            element.classList.toggle('is-inview', isVisible);
        });
    }

    function prepareSubtree(root) {
        if (root.nodeType !== Node.ELEMENT_NODE) return;
        if (root.matches(revealSelector)) observeReveal(root);
        root.querySelectorAll(revealSelector).forEach(observeReveal);

        const container = root.closest(revealSelector);
        if (container) prepareCopy(container);
        root.querySelectorAll(revealSelector).forEach(prepareCopy);
    }

    document.documentElement.classList.add('scroll-reveal-ready');
    document.querySelectorAll(revealSelector).forEach(observeReveal);

    const mutationObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(prepareSubtree);
            if (mutation.target.nodeType === Node.ELEMENT_NODE) {
                const container = mutation.target.closest(revealSelector);
                if (container) prepareCopy(container);
            }
        });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
})();
