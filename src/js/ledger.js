// ledger.js - Live ledgers, one per <div data-ledger="feed id"> in index.html (the
// blocs, corps and goods ledgers of the data view). Rows are persistent (keyed by
// tag/name): value and change numbers are tweened between ticks, and rows slide to
// their new position when the sort order changes (FLIP technique via the Web
// Animations API). data-sort picks the order: "value" (the default) or "change", both
// biggest first.
// The change column and the colors follow each item's trend change (trendPercent in
// simulation.js), and a sparkline of its recent history ends each row.
// When every row has the same unit, the ledger's status bar (.div-win-top) adds the
// total of the rows to its title, tweened with them. Goods each have their own unit,
// so their ledger shows no total.
// Each row's browser tooltip lists the goods that push its item or an entry above it
// (data/relations.json), with the link weight and the effect: how far the good's move
// from its start shifts where the item rests, in percent. It is filled when the pointer
// enters the row, since the browser closes a tooltip whose text changes.
import { motionPreference } from './motion.js';
import { simulation } from './simulation.js';
import { observeVisibility } from './viewport-visibility.js';
import { createSparkline, updateSparkline } from './sparkline.js';

(function () {
    const valueFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const percentFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });
    const weightFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

    // Keep both durations well below the feed tick interval.
    const DURATION = 700;
    const REORDER_DURATION = 500;
    const ease = t => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;
    const keyOf = item => item.tag || item.name;
    const trendOf = item => Number(item.trendPercent ?? item.changePercent) || 0;
    // A shift of where an item rests, in log terms (weight x log distance, as
    // restingShifts() in simulation.js sums it), as a percent.
    const toPercent = shift => (Math.exp(shift) - 1) * 100;
    // Row orders for data-sort, biggest first.
    const SORTS = {
        value: (a, b) => b.value - a.value,
        change: (a, b) => trendOf(b) - trendOf(a)
    };

    function renderLedger(host) {
        const feedId = host.dataset.ledger;
        if (!feedId) return;
        const wrapper = host.closest('[data-panel-group]');
        const feed = simulation.getFeed(feedId);
        const sortBy = host.dataset.sort || 'value';
        if (!SORTS[sortBy]) console.warn(`Ledger "${feedId}": unknown data-sort="${sortBy}", sorting by value`);
        const compare = SORTS[sortBy] || SORTS.value;
        const rows = new Map();
        const titleEl = host.closest('.div-win')?.querySelector('.div-win-top > span') || null;
        const title = titleEl?.textContent || '';
        let lastTotalText = null;
        // Whether the rows share one unit, so their total means something.
        let showTotal = false;
        let displayedItems = null;
        let raf = 0;
        let inViewport = false;
        let renderQueued = false;
        // Every node of the feed's tree by key, with its parent, so a row (a snapshot copy
        // or a node the treemap reports) leads to the live nodes the relations target.
        // Built once the tree is loaded; trees never change shape.
        let nodesByKey = null;

        function indexTree() {
            if (nodesByKey || !feed.root) return nodesByKey;
            nodesByKey = new Map();
            const visit = (node, parent) => {
                nodesByKey.set(keyOf(node), { node, parent });
                node.children.forEach(child => visit(child, node));
            };
            feed.root.children.forEach(child => visit(child, null));
            return nodesByKey;
        }

        // A row's tooltip: the combined effect of the goods that push the item or an entry
        // above it, then each good with its link weight and effect, the biggest first.
        function goodsTooltip(item) {
            const goods = simulation.getFeed('goods').root;
            const index = indexTree();
            let entry = index ? index.get(keyOf(item)) : null;
            if (!goods || !entry) return '';
            const own = new Set(goods.children);
            const weights = new Map();
            while (entry) {
                simulation.getRelationsTo(entry.node).forEach(({ from, weight }) => {
                    if (own.has(from)) weights.set(from, (weights.get(from) || 0) + weight);
                });
                entry = entry.parent ? index.get(keyOf(entry.parent)) : null;
            }
            if (!weights.size) return `${item.name}`;
            const links = [...weights]
                .map(([good, weight]) => ({ good, weight, shift: weight * simulation.distanceFromStart(good) }))
                .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
            const total = links.reduce((sum, link) => sum + link.shift, 0);
            return [
                `${item.name} [${percentFormat.format(toPercent(total))}%]`,
                ...links.map(link => `${link.good.name} (${weightFormat.format(link.weight)}) ${percentFormat.format(toPercent(link.shift))}%`)
            ].join('\n');
        }

        function createRow(item, key) {
            const row = document.createElement('div');
            row.className = 'ledger-row';
            row.dataset.itemKey = key;
            const cell = (className, text = '') => {
                const span = document.createElement('span');
                span.className = className;
                span.textContent = text;
                row.append(span);
                return span;
            };
            cell('ledger-name', item.name);
            cell('ledger-unit', item.unit || '');
            const valueEl = cell('ledger-value');
            const changeEl = cell('ledger-change');
            // The sparkline is the last column (sparkline.js).
            const spark = createSparkline(row, 'ledger-spark');
            const entry = {
                row,
                item,
                spark,
                valueEl,
                changeEl,
                cur: null,
                from: null,
                to: null,
                t0: 0,
                lastValueText: null,
                lastChangeText: null
            };
            // The tooltip is a snapshot taken on entering the row (entry.item is the
            // latest item, set on every render).
            row.addEventListener('pointerenter', () => { row.title = goodsTooltip(entry.item); });
            return entry;
        }

        function paint(entry) {
            const valueText = valueFormat.format(entry.cur.value);
            if (valueText !== entry.lastValueText) {
                entry.lastValueText = valueText;
                entry.valueEl.textContent = valueText;
            }
            const changeText = percentFormat.format(entry.cur.pct);
            if (changeText !== entry.lastChangeText) {
                entry.lastChangeText = changeText;
                entry.changeEl.textContent = changeText;
            }
        }

        function paintTotal(total) {
            if (!titleEl || !showTotal) return;
            const totalText = `${title} · €$${valueFormat.format(total)}B`;
            if (totalText === lastTotalText) return;
            lastTotalText = totalText;
            titleEl.textContent = totalText;
        }

        function step(now) {
            const reduced = motionPreference.matches;
            let active = false;
            let total = 0;
            rows.forEach(entry => {
                const progress = reduced ? 1 : Math.min(1, (now - entry.t0) / DURATION);
                const eased = ease(progress);
                entry.cur.value = lerp(entry.from.value, entry.to.value, eased);
                entry.cur.pct = lerp(entry.from.pct, entry.to.pct, eased);
                paint(entry);
                total += entry.cur.value;
                if (progress < 1) active = true;
            });
            paintTotal(total);
            raf = active && !document.hidden && inViewport ? requestAnimationFrame(step) : 0;
        }

        function startLoop() {
            if (!raf && inViewport) raf = requestAnimationFrame(step);
        }

        function render(current) {
            if (!current.length) return;
            const sorted = current.slice().sort(compare);
            showTotal = sorted.every(item => item.unit === sorted[0].unit);
            const keys = new Set(sorted.map(keyOf));
            const now = performance.now();
            const reduced = motionPreference.matches;
            const orderChanged = host.children.length !== sorted.length
                || sorted.some((item, index) => host.children[index].dataset.itemKey !== keyOf(item));

            // FLIP "first": remember where each existing row is before reordering.
            const firstRects = new Map();
            if (!reduced && orderChanged) {
                rows.forEach((entry, key) => firstRects.set(key, entry.row.getBoundingClientRect()));
            }

            // Drop rows whose items disappeared; create rows for new items.
            rows.forEach((entry, key) => {
                if (!keys.has(key)) { entry.row.remove(); rows.delete(key); }
            });
            sorted.forEach(item => {
                const key = keyOf(item);
                if (rows.has(key)) return;
                const entry = createRow(item, key);
                entry.cur = { value: item.value, pct: trendOf(item) };
                paint(entry);
                rows.set(key, entry);
                host.appendChild(entry.row);
            });

            // Apply the new order, then set tween targets and direction state.
            const flashes = [];
            sorted.forEach((item, index) => {
                const entry = rows.get(keyOf(item));
                if (host.children[index] !== entry.row) {
                    host.insertBefore(entry.row, host.children[index] || null);
                }

                entry.from = { ...entry.cur };
                entry.to = { value: item.value, pct: trendOf(item) };
                entry.t0 = now;
                entry.item = item;
                const up = trendOf(item) >= 0;
                updateSparkline(entry.spark, item.history, up);
                const newDir = up ? 'up' : 'down';
                const prevDir = entry.row.dataset.direction;
                entry.changeEl.classList.toggle('is-positive', up);
                entry.changeEl.classList.toggle('is-negative', !up);
                entry.row.classList.toggle('is-positive', up);
                entry.row.classList.toggle('is-negative', !up);
                entry.row.dataset.direction = newDir;
                if (prevDir && prevDir !== newDir) {
                    entry.row.classList.remove('is-flashing');
                    flashes.push(entry.row);
                }
            });
            if (flashes.length) {
                void flashes[0].offsetWidth; // restart the flash animation
                flashes.forEach(row => row.classList.add('is-flashing'));
            }

            // FLIP "last/invert/play": slide rows from their old position to the new one.
            if (!reduced && orderChanged) {
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
        }

        // A feed tick reaches the ledger twice: through its own subscription and
        // through the treemap's treemap:items event. Both land in the same task, so
        // they are merged into one render with the latest items.
        function requestRender() {
            if (renderQueued) return;
            renderQueued = true;
            queueMicrotask(() => {
                renderQueued = false;
                if (document.hidden || !inViewport || wrapper?.hidden) return;
                render(displayedItems || feed.getSnapshot());
            });
        }

        observeVisibility(host, isVisible => {
            const changed = inViewport !== isVisible;
            inViewport = isVisible;
            if (!inViewport) {
                cancelAnimationFrame(raf);
                raf = 0;
            } else if (changed) {
                requestRender();
            }
        });

        document.addEventListener('visibilitychange', requestRender);

        // The treemap reports which items it shows (it can be drilled into).
        document.addEventListener('treemap:items', event => {
            const detail = event.detail;
            if (!detail || detail.feedId !== feedId) return;
            displayedItems = detail.items;
            requestRender();
        });

        feed.subscribe(requestRender);
    }

    document.querySelectorAll('[data-ledger]').forEach(renderLedger);
})();

