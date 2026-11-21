// ticker.js - Scrolling live data ticker. Items are persistent (keyed by tag/name):
// percent values are tweened between ticks. The marquee is driven in JS at a constant
// px/s, so changes in text width never make it jump. It pauses while the ticker is
// off screen or hidden (for example while the globe is explored on its own).
import { motionPreference } from './motion.js';
import { valueChanges } from './data-calc.js';
import { observeVisibility } from './viewport-visibility.js';

(function () {
    const ticker = document.querySelector('.ticker-txt');
    if (!ticker) return;
    const line = ticker.closest('.ticker-line') || ticker;
    const bar = ticker.closest('.ticker') || line.parentElement;
    const feed = valueChanges.getFeed('goods');

    const SPEED = 50;      // marquee speed in px per second
    const DURATION = 700;  // number tween; keep well below the feed tick interval
    const DIRECTIONS = ['positive', 'negative', 'neutrale'];
    const ease = t => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;
    const keyOf = item => item.tag || item.name;
    const format = pct => `${pct > 0 ? '+' : ''}${pct.toFixed(1)}`;

    const items = new Map();
    let signature = '';
    let lineWidth = 0;
    let x = bar.clientWidth;
    let raf = 0;
    let last = 0;
    let onScreen = false;

    new ResizeObserver(() => { lineWidth = line.offsetWidth; }).observe(line);

    function applyTransform() {
        line.style.transform = motionPreference.matches ? '' : `translate3d(${x}px, 0, 0)`;
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
        entry.dir = direction;
        entry.val.classList.remove(...DIRECTIONS);
        entry.val.classList.add(direction);
    }

    function build(current) {
        ticker.replaceChildren();
        items.clear();
        ticker.append('MondayMarket ||| ');
        current.forEach((item, index) => {
            if (index) ticker.append(' | ');
            const wrapper = document.createElement('span');
            wrapper.className = 'ticker-item';
            const val = document.createElement('span');
            val.className = 'ticker-val';
            wrapper.append(val, ` ${item.name}`);
            ticker.append(wrapper);

            const pct = item.changePercent || 0;
            const entry = { val, cur: pct, from: pct, to: pct, t0: 0, done: true, dir: null, text: '' };
            paint(entry);
            setDirection(entry, item);
            items.set(keyOf(item), entry);
        });
        lineWidth = line.offsetWidth;
        applyTransform();
    }

    function frame(now) {
        const reduced = motionPreference.matches;
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

        const keepGoing = !document.hidden && onScreen && (!reduced || tweening);
        raf = keepGoing ? requestAnimationFrame(frame) : 0;
    }

    function startLoop() {
        if (raf || !onScreen || !items.size) return;
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
        current.forEach(item => {
            const entry = items.get(keyOf(item));
            if (!entry) return;
            entry.from = entry.cur;
            entry.to = item.changePercent || 0;
            entry.t0 = now;
            entry.done = false;
            setDirection(entry, item);
        });
        startLoop();
    }

    observeVisibility(bar, isVisible => {
        onScreen = isVisible;
        startLoop();
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) startLoop();
    });

    feed.subscribe(render, { immediate: true });
})();
