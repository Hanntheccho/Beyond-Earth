(function () {
    const targets = new Map();
    const rootMargin = 80;
    let fallbackTimer = 0;

    function setVisibility(record, isVisible) {
        if (record.isVisible === isVisible) return;
        record.isVisible = isVisible;
        record.callback(isVisible);
    }

    function isInViewport(element) {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 &&
            bounds.bottom >= -rootMargin && bounds.top <= window.innerHeight + rootMargin &&
            bounds.right >= -rootMargin && bounds.left <= window.innerWidth + rootMargin;
    }

    function checkFallback() {
        fallbackTimer = 0;
        targets.forEach((record, element) => {
            if (!record.intersectionObserved) setVisibility(record, isInViewport(element));
        });
    }

    function scheduleFallback() {
        if (!fallbackTimer) fallbackTimer = window.setTimeout(checkFallback, 80);
    }

    const observer = 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const record = targets.get(entry.target);
                if (!record) return;
                record.intersectionObserved = true;
                setVisibility(record, entry.isIntersecting && entry.intersectionRatio > 0);
            });
        }, { rootMargin: `${rootMargin}px 0px`, threshold: 0.01 })
        : null;

    window.viewportVisibility = {
        observe(element, callback) {
            if (!(element instanceof Element)) throw new TypeError('Viewport target must be an Element');
            if (typeof callback !== 'function') throw new TypeError('Viewport callback must be a function');

            const record = { callback, intersectionObserved: false, isVisible: null };
            targets.set(element, record);
            if (observer) observer.observe(element);
            scheduleFallback();

            return function unobserve() {
                targets.delete(element);
                if (observer) observer.unobserve(element);
            };
        }
    };

    window.addEventListener('scroll', scheduleFallback, { passive: true });
    window.addEventListener('resize', scheduleFallback, { passive: true });

    const hiddenAttributeObserver = new MutationObserver(scheduleFallback);
    hiddenAttributeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['hidden'],
        subtree: true
    });
})();
