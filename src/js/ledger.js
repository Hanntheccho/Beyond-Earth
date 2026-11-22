// ledger.js - Live ledgers, one per <div data-ledger="feed id"> in index.html (the
// blocs, corps and goods panels). Rows are persistent (keyed by tag/name): value and
// change numbers are tweened between ticks, and rows slide to their new position when
// the sort order changes (FLIP technique via the Web Animations API).
// The change column and the colors follow each item's trend change (trendPercent in
// simulation.js), and a faint sparkline of its recent history fills the row's background.
// Above each ledger, an expanded chart draws one row's history large: the top row by
// default, or the row last clicked.
import { motionPreference } from './motion.js';
import { simulation } from './simulation.js';
import { observeVisibility } from './viewport-visibility.js';
import { appendSvg as add } from './svg.js';

(function () {
    const valueFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const percentFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

    // Keep both durations well below the feed tick interval.
    const DURATION = 700;
    const REORDER_DURATION = 500;
    const ease = t => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;
    const keyOf = item => item.tag || item.name;
    const trendOf = item => Number(item.trendPercent ?? item.changePercent) || 0;
    // Sparkline viewBox; CSS stretches it over the lower part of the row. SPARK_TOP_GAP
    // keeps the peak off the box's top edge.
    const SPARK_WIDTH = 100;
    const SPARK_HEIGHT = 30;
    const SPARK_TOP_GAP = 4;
    // Expanded chart viewBox; CSS sets its height and stretches it to the panel width.
    const CHART_WIDTH = 800;
    const CHART_HEIGHT = 160;
    const CHART_TOP_GAP = 12;

    // Line points for a history, scaled to fill a width x height box from the bottom up,
    // leaving topGap free above the peak.
    function linePoints(history, width, height, topGap) {
        if (!Array.isArray(history) || history.length < 2) return '';
        const min = Math.min(...history);
        const range = Math.max(...history) - min || 1;
        const step = width / (history.length - 1);
        return history.map((value, index) =>
            `${(index * step).toFixed(1)},${(height - (value - min) / range * (height - topGap)).toFixed(1)}`
        ).join(' ');
    }

    // The area under a line: the line closed down to the bottom corners of its box.
    function areaPoints(points, width, height) {
        return points ? `${points} ${width},${height} 0,${height}` : '';
    }

    // The expanded chart for a ledger, inserted right above it in the same panel: a
    // status line naming the shown item, and its history drawn with the same area and
    // line as the row sparklines.
    function createChart(host) {
        const box = document.createElement('div');
        box.className = 'ledger-chart';
        // .data-status lays out its children as rows, so the parts share one span.
        const title = document.createElement('div');
        title.className = 'data-status ledger-chart-title';
        const label = document.createElement('span');
        const name = document.createElement('span');
        const value = document.createElement('span');
        const change = document.createElement('span');
        label.append(name, ' · ', value, ' · ', change);
        title.append(label);
        box.append(title);
        const svg = add(box, 'svg', {
            class: 'ledger-chart-plot',
            viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
            preserveAspectRatio: 'none',
            'aria-hidden': 'true'
        });
        const area = add(svg, 'polygon', { class: 'ledger-spark-area' });
        const line = add(svg, 'polyline', { class: 'ledger-spark-line' });
        host.before(box);
        return { name, value, change, svg, area, line };
    }

    function renderLedger(host) {
        const feedId = host.dataset.ledger;
        if (!feedId) return;
        const wrapper = host.closest('[data-panel-group]');
        const feed = simulation.getFeed(feedId);
        const rows = new Map();
        const chart = createChart(host);
        let displayedItems = null;
        // The item the expanded chart shows, and the items of the last render (sorted)
        // so a click can redraw the chart right away.
        let selectedKey = null;
        let lastSorted = [];
        let raf = 0;
        let inViewport = false;
        let renderQueued = false;

        function drawChart(item) {
            if (!item) return;
            const points = linePoints(item.history, CHART_WIDTH, CHART_HEIGHT, CHART_TOP_GAP);
            chart.line.setAttribute('points', points);
            chart.area.setAttribute('points', areaPoints(points, CHART_WIDTH, CHART_HEIGHT));
            const up = trendOf(item) >= 0;
            chart.svg.classList.toggle('is-up', up);
            chart.svg.classList.toggle('is-down', !up);
            chart.name.textContent = item.name;
            chart.value.textContent = `${valueFormat.format(item.value)} ${item.unit || '€$B'}`;
            chart.change.textContent = percentFormat.format(trendOf(item));
            chart.change.className = up ? 'is-up' : 'is-down';
        }

        // Show an item in the expanded chart and mark its row.
        function select(key) {
            selectedKey = key;
            rows.forEach((entry, rowKey) => {
                entry.row.classList.toggle('is-selected', rowKey === key);
                entry.row.setAttribute('aria-pressed', String(rowKey === key));
            });
            drawChart(lastSorted.find(item => keyOf(item) === key));
        }

        function createRow(item, key) {
            const row = document.createElement('div');
            row.className = 'ledger-row';
            row.dataset.itemKey = key;
            // Clicking a row (or Enter/Space on it) shows it in the expanded chart.
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            row.setAttribute('aria-pressed', 'false');
            row.addEventListener('click', () => select(key));
            row.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(key); }
            });
            // The sparkline sits behind the cells (see .ledger-spark in ledger.css): a
            // faint area under the history, with its line on top.
            const spark = add(row, 'svg', {
                class: 'ledger-spark',
                viewBox: `0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`,
                preserveAspectRatio: 'none',
                'aria-hidden': 'true'
            });
            const sparkArea = add(spark, 'polygon', { class: 'ledger-spark-area' });
            const sparkLine = add(spark, 'polyline', { class: 'ledger-spark-line' });
            const cell = (className, text = '') => {
                const span = document.createElement('span');
                span.className = className;
                span.textContent = text;
                row.append(span);
                return span;
            };
            cell('ledger-name', item.name);
            cell('ledger-unit', item.unit || '€$B');
            return {
                row,
                spark,
                sparkArea,
                sparkLine,
                valueEl: cell('ledger-value'),
                changeEl: cell('ledger-change'),
                cur: null,
                from: null,
                to: null,
                t0: 0,
                lastValueText: null,
                lastChangeText: null
            };
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

        function step(now) {
            const reduced = motionPreference.matches;
            let active = false;
            rows.forEach(entry => {
                const progress = reduced ? 1 : Math.min(1, (now - entry.t0) / DURATION);
                const eased = ease(progress);
                entry.cur.value = lerp(entry.from.value, entry.to.value, eased);
                entry.cur.pct = lerp(entry.from.pct, entry.to.pct, eased);
                paint(entry);
                if (progress < 1) active = true;
            });
            raf = active && !document.hidden && inViewport ? requestAnimationFrame(step) : 0;
        }

        function startLoop() {
            if (!raf && inViewport) raf = requestAnimationFrame(step);
        }

        function render(current) {
            if (!current.length) return;
            const sorted = current.slice().sort((a, b) => b.value - a.value);
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
                const points = linePoints(item.history, SPARK_WIDTH, SPARK_HEIGHT, SPARK_TOP_GAP);
                entry.sparkLine.setAttribute('points', points);
                entry.sparkArea.setAttribute('points', areaPoints(points, SPARK_WIDTH, SPARK_HEIGHT));
                const up = trendOf(item) >= 0;
                entry.spark.classList.toggle('is-up', up);
                entry.spark.classList.toggle('is-down', !up);
                const newDir = up ? 'up' : 'down';
                const prevDir = entry.row.dataset.direction;
                entry.changeEl.classList.toggle('is-up', up);
                entry.changeEl.classList.toggle('is-down', !up);
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

            // The expanded chart starts on the top row, and goes back to the top row when
            // the shown item is gone (after drilling in or out of the treemap).
            lastSorted = sorted;
            if (keys.has(selectedKey)) drawChart(sorted.find(item => keyOf(item) === selectedKey));
            else select(keyOf(sorted[0]));

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

