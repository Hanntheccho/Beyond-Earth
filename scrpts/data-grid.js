// Market data grids. Rows are persistent (keyed by tag/name): price and change
// numbers are tweened between ticks, and rows slide to their new position when
// the sort order changes (FLIP technique via the Web Animations API).
(function () {
    const valueFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const percentFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

    // Keep both durations well below the market tick interval (2000 ms).
    const DURATION = 700;
    const REORDER_DURATION = 500;
    const ease = t => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    function renderMarketGrid(host) {
        const marketId = host.dataset.marketGrid;
        if (!marketId) return;
        const status = Array.from(document.querySelectorAll('[data-market-status]'))
            .find(element => element.dataset.marketStatus === marketId);
        const market = window.valueChanges.getMarket(marketId);
        const rows = new Map();
        let raf = 0;

        function createRow(item, key) {
            const row = document.createElement('div');
            row.className = 'data-grid-row';
            row.dataset.itemKey = key;
            row.innerHTML = '<span class="data-grid-name"></span><span class="data-grid-unit"></span><span class="data-grid-price"></span><span class="data-grid-change"></span>';
            row.querySelector('.data-grid-name').textContent = item.name;
            row.querySelector('.data-grid-unit').textContent = item.unit || '€$B';
            return {
                row,
                priceEl: row.querySelector('.data-grid-price'),
                changeEl: row.querySelector('.data-grid-change'),
                cur: null,
                from: null,
                to: null,
                t0: 0
            };
        }

        function paint(entry) {
            entry.priceEl.textContent = valueFormat.format(entry.cur.value);
            entry.changeEl.textContent = percentFormat.format(entry.cur.pct);
        }

        function step(now) {
            const reduced = reducedMotionQuery.matches;
            let active = false;
            rows.forEach(entry => {
                const progress = reduced ? 1 : Math.min(1, (now - entry.t0) / DURATION);
                const eased = ease(progress);
                entry.cur.value = lerp(entry.from.value, entry.to.value, eased);
                entry.cur.pct = lerp(entry.from.pct, entry.to.pct, eased);
                paint(entry);
                if (progress < 1) active = true;
            });
            raf = active && !document.hidden ? requestAnimationFrame(step) : 0;
        }

        function startLoop() {
            if (!raf) raf = requestAnimationFrame(step);
        }

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && rows.size) startLoop();
        });

        function render(current) {
            if (!current.length) return;
            const sorted = current.slice().sort((a, b) => b.value - a.value);
            const keyOf = item => item.tag || item.name;
            const keys = new Set(sorted.map(keyOf));
            const now = performance.now();

            // FLIP "first": remember where each existing row is before reordering.
            const firstRects = new Map();
            rows.forEach((entry, key) => firstRects.set(key, entry.row.getBoundingClientRect()));

            // Drop rows whose items disappeared; create rows for new items.
            rows.forEach((entry, key) => {
                if (!keys.has(key)) { entry.row.remove(); rows.delete(key); }
            });
            sorted.forEach(item => {
                const key = keyOf(item);
                if (rows.has(key)) return;
                const entry = createRow(item, key);
                entry.cur = { value: item.value, pct: item.changePercent || 0 };
                paint(entry);
                rows.set(key, entry);
                host.appendChild(entry.row);
            });

            // Apply the new order, then set tween targets and direction state.
            sorted.forEach((item, index) => {
                const entry = rows.get(keyOf(item));
                if (host.children[index] !== entry.row) {
                    host.insertBefore(entry.row, host.children[index] || null);
                }

                const target = { value: item.value, pct: item.changePercent || 0 };
                entry.from = { ...entry.cur };
                entry.to = target;
                entry.t0 = now;

                const up = item.change >= 0;
                entry.changeEl.classList.toggle('is-up', up);
                entry.changeEl.classList.toggle('is-down', !up);
                const prevDir = entry.row.dataset.direction;
                const newDir = up ? 'up' : 'down';
                entry.row.classList.toggle('is-positive', up);
                entry.row.classList.toggle('is-negative', !up);
                entry.row.dataset.direction = newDir;
                if (prevDir && prevDir !== newDir) {
                    entry.row.classList.remove('is-flashing');
                    void entry.row.offsetWidth;
                    entry.row.classList.add('is-flashing');
                }
            });

            // FLIP "last/invert/play": slide rows from their old position to the new one.
            if (!reducedMotionQuery.matches) {
                rows.forEach((entry, key) => {
                    const first = firstRects.get(key);
                    if (!first) return;
                    const last = entry.row.getBoundingClientRect();
                    const dx = first.left - last.left;
                    const dy = first.top - last.top;
                    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
                    entry.row.animate(
                        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
                        { duration: REORDER_DURATION, easing: 'cubic-bezier(.2, .7, .2, 1)' }
                    );
                });
            }

            startLoop();
            if (status) status.textContent = `MONDAYMARKET · updated ${new Date().toLocaleTimeString()}`;
        }

        market.subscribe((current) => {
            if (document.hidden) return;
            const wrapper = host.closest('[data-panel-group]');
            if (wrapper && wrapper.hidden) return;
            render(current);
        });
    }

    document.querySelectorAll('[data-market-grid]').forEach(renderMarketGrid);
})();
