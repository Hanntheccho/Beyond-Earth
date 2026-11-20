(function () {
    const targets = new Map();
    const rootMargin = 80;

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

    const observer = 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const record = targets.get(entry.target);
                if (!record) return;
                setVisibility(record, entry.isIntersecting && entry.intersectionRatio > 0);
            });
        }, { rootMargin: `${rootMargin}px 0px`, threshold: 0.01 })
        : null;

    window.viewportVisibility = {
        observe(element, callback) {
            if (!(element instanceof Element)) throw new TypeError('Viewport target must be an Element');
            if (typeof callback !== 'function') throw new TypeError('Viewport callback must be a function');

            const record = { callback, isVisible: null };
            targets.set(element, record);
            if (observer) {
                observer.observe(element);
            } else {
                setVisibility(record, isInViewport(element));
            }

            return function unobserve() {
                targets.delete(element);
                if (observer) observer.unobserve(element);
            };
        }
    };

    if (!observer) window.addEventListener('resize', () => {
        targets.forEach((record, element) => setVisibility(record, isInViewport(element)));
    });
})();
