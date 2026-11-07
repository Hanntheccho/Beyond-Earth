// Scrolling market ticker. Items are persistent (keyed by tag/name): percent values
// are tweened between ticks and flash when their direction flips. The marquee is
// driven in JS at a constant px/s, so changes in text width never make it jump.
(function () {
    const ticker = document.querySelector('.market-text-txt');
    if (!ticker) return;
    const line = ticker.closest('.market-text-line') || ticker;
    const bar = ticker.closest('.market-text') || line.parentElement;

    const market = (typeof window.valueChanges === 'object' && window.valueChanges.getMarket)
        ? window.valueChanges.getMarket('resources')
        : null;
    if (!market) return;

    const SPEED = 50;      // marquee speed in px per second
    const DURATION = 700;  // number tween; keep well below the market tick interval
    const DIRECTIONS = ['positive', 'negative', 'neutrale'];
    const ease = t => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const keyOf = item => item.tag || item.name;
    const format = pct => `${pct > 0 ? '+' : ''}${pct.toFixed(1)}`;

    const items = new Map();
    let signature = '';
    let lineWidth = 0;
    let x = bar.clientWidth;
    let raf = 0;
    let last = 0;

    function measure() {
        lineWidth = line.offsetWidth;
    }

    const lineResizeObserver = new ResizeObserver(entries => {
        lineWidth = entries[0].contentRect.width;
    });
    lineResizeObserver.observe(line);

    function applyTransform() {
        line.style.transform = reducedMotionQuery.matches ? '' : `translate3d(${x}px, 0, 0)`;
    }

    function paint(entry) {
        const text = format(entry.cur);
        if (text === entry.text) return;
        entry.text = text;
        entry.val.textContent = text;
    }

    function setDirection(entry, item) {
        const change = Number(item.change);
        const direction = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutrale');
        if (entry.dir === direction) return;
        const previous = entry.dir;
        entry.dir = direction;
        entry.val.classList.remove(...DIRECTIONS);
        entry.val.classList.add(direction);
        if (previous === null) return false;
        entry.val.classList.remove('is-flashing');
        return true;
    }

    function restartFlashes(entries) {
        if (!entries.length) return;
        void entries[0].offsetWidth;
        entries.forEach(entry => entry.classList.add('is-flashing'));
    }

    function build(current) {
        ticker.replaceChildren();
        items.clear();
        ticker.append(document.createTextNode('MondayMarket ||| '));
        current.forEach((item, index) => {
            if (index) ticker.append(document.createTextNode(' | '));
            const wrapper = document.createElement('span');
            wrapper.className = 'market-text-item';
            const val = document.createElement('span');
            val.className = 'market-text-val';
            wrapper.append(val, document.createTextNode(` ${item.name}`));
            ticker.append(wrapper);

            const pct = item.changePercent || 0;
            const entry = { val, cur: pct, from: pct, to: pct, t0: 0, done: true, dir: null, text: '' };
            paint(entry);
            setDirection(entry, item);
            items.set(keyOf(item), entry);
        });
        measure();
        applyTransform();
    }

    function frame(now) {
        const reduced = reducedMotionQuery.matches;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        let tweening = false;
        items.forEach(entry => {
            if (entry.done) return;
            const progress = reduced ? 1 : Math.min(1, (now - entry.t0) / DURATION);
            entry.cur = lerp(entry.from, entry.to, ease(progress));
            paint(entry);
            if (progress < 1) tweening = true; else entry.done = true;
        });

        if (reduced) {
            x = 0;
        } else {
            x -= SPEED * dt;
            if (x < -lineWidth) x = bar.clientWidth;
        }
        applyTransform();

        raf = (!document.hidden && (!reduced || tweening)) ? requestAnimationFrame(frame) : 0;
    }

    function startLoop() {
        if (raf) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }

    function render(current) {
        if (!current || !current.length) return;
        const nextSignature = current.map(keyOf).join('\u0001');
        if (nextSignature !== signature) {
            signature = nextSignature;
            build(current);
            startLoop();
            return;
        }
        const now = performance.now();
        const flashes = [];
        current.forEach(item => {
            const entry = items.get(keyOf(item));
            if (!entry) return;
            entry.from = entry.cur;
            entry.to = item.changePercent || 0;
            entry.t0 = now;
            entry.done = false;
            if (setDirection(entry, item)) flashes.push(entry.val);
        });
        restartFlashes(flashes);
        startLoop();
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && items.size) startLoop();
    });

    market.subscribe(render, { immediate: true });
})();
