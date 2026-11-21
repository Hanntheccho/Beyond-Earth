// treemap.js - Shared treemap layout, labels, colors, and optional hierarchical navigation.
// Tiles are persistent (keyed by tag/name) and tweened between feed ticks, so
// geometry, value, and change numbers animate instead of being rebuilt each tick.
import { motionPreference } from './motion.js';
import { simulation } from './simulation.js';
import { observeVisibility } from './viewport-visibility.js';
import { appendSvg as add } from './svg.js';

(function () {
    const width = 800;
    const height = 800;
    const numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const tooltipNumberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    const percentFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

    // Tween settings. Keep DURATION well below the feed tick interval.
    const DURATION = 700;
    const TWEEN_PROPS = ['x', 'y', 'w', 'h', 'value', 'pct'];
    const ease = t => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;

    const splitWords = name => String(name).trim().split(/\s+/);

    // Wrap at spaces only; fitLabel accounts for long unbroken words by reducing the font size.
    function wrapWords(words, maxChars) {
        const lines = [];
        let line = '';
        words.forEach(word => {
            if (line && line.length + 1 + word.length > maxChars) { lines.push(line); line = word; }
            else line = line ? `${line} ${word}` : word;
        });
        if (line) lines.push(line);
        return lines;
    }

    // Squarified layout: tiles are laid in rows along the shorter side, and a tile
    // joins the current row while that does not worsen the row's worst aspect ratio.
    // Items without a positive value get no tile.
    function squarify(items, x, y, w, h, getValue) {
        const weighted = items.filter(item => getValue(item) > 0);
        const total = weighted.reduce((sum, item) => sum + getValue(item), 0);
        if (!total || w <= 0 || h <= 0) return [];
        const remaining = weighted
            .map(item => ({ item, area: getValue(item) * w * h / total }))
            .sort((a, b) => b.area - a.area);
        const rectangles = [];
        let rx = x, ry = y, rw = w, rh = h;

        // Worst aspect ratio in a row with this total, smallest and largest area along `side`.
        const worst = (sum, smallest, largest, side) =>
            Math.max(side * side * largest / (sum * sum), sum * sum / (side * side * smallest));

        function placeRow(entries, area) {
            if (rw >= rh) {
                const strip = area / rh;
                let cy = ry;
                entries.forEach(entry => { const ch = entry.area / strip; rectangles.push({ item: entry.item, x: rx, y: cy, w: strip, h: ch }); cy += ch; });
                rx += strip; rw -= strip;
            } else {
                const strip = area / rw;
                let cx = rx;
                entries.forEach(entry => { const cw = entry.area / strip; rectangles.push({ item: entry.item, x: cx, y: ry, w: cw, h: strip }); cx += cw; });
                ry += strip; rh -= strip;
            }
        }

        // Running totals for the current row, so testing a tile costs O(1).
        let row = [], sum = 0, smallest = Infinity, largest = 0;
        let index = 0;
        while (index < remaining.length) {
            const next = remaining[index];
            const side = Math.min(rw, rh);
            const nextSum = sum + next.area;
            const nextSmallest = Math.min(smallest, next.area);
            const nextLargest = Math.max(largest, next.area);
            if (!row.length || worst(nextSum, nextSmallest, nextLargest, side) <= worst(sum, smallest, largest, side)) {
                row.push(next);
                sum = nextSum; smallest = nextSmallest; largest = nextLargest;
                index++;
            } else {
                placeRow(row, sum);
                row = []; sum = 0; smallest = Infinity; largest = 0;
            }
        }
        if (row.length) placeRow(row, sum);
        return rectangles;
    }

    // Largest font size at which the wrapped name, value and change fit the tile.
    function fitLabel(words, valueText, changeText, w, h) {
        // Keep an inset inside each tile; paint() also passes % of the tile dimensions.
        const availableWidth = Math.max(1, w - 8);
        const availableHeight = Math.max(1, h - 6);
        const longestWordLength = words.reduce((longest, word) => Math.max(longest, word.length), 1);
        // Use the widest unwrapped label to size all three labels consistently.
        const longestLabelLength = Math.max(longestWordLength, valueText.length, changeText.length);
        const maxSizeByLabelWidth = availableWidth / (longestLabelLength * 0.68);
        for (let size = Math.min(availableWidth * 0.13, availableHeight * 0.16, maxSizeByLabelWidth); size >= 1.5; size -= 0.25) {
            const lines = wrapWords(words, Math.max(1, Math.floor(availableWidth / (size * 0.68))));
            // Vertical spacing between wrapped name lines; requiredHeight reserves room for all three text rows.
            const lineHeight = size * 0.8;
            const requiredHeight = (lines.length - 1) * lineHeight + size * 2.8 + 2;
            if (requiredHeight <= availableHeight) return { lines, size, lineHeight, requiredHeight };
        }
        const size = 1.5;
        const lines = wrapWords(words, Math.max(1, Math.floor(availableWidth / (size * 0.68))));
        return { lines, size, lineHeight: size, requiredHeight: h };
    }

    function mount(host, options) {
        let path = [];
        const getChildren = node => Array.isArray(node.children) ? node.children : [];
        const getValue = node => Number(node.value) || 0;
        const getName = node => node.name || node.label || '';
        const getLabel = node => node.label || getName(node);
        const keyOf = node => node.tag || node.name;
        const breadcrumbs = options.breadcrumbs || null;
        const status = options.status || null;

        // Persistent render state: tiles survive between ticks and only get new targets.
        const tiles = new Map();
        let pathSignature = null;
        let svg = null;
        let raf = 0;

        function createTile(item) {
            const canDrill = getChildren(item).length > 0;
            const group = add(svg, 'g', {
                class: `treemap-tile${canDrill ? ' has-children' : ''}`,
                tabindex: canDrill ? '0' : null,
                role: canDrill ? 'button' : null
            });
            const name = getLabel(item);
            const tile = {
                item,
                canDrill,
                group,
                name,
                words: splitWords(name),
                lastLines: '',
                lastLineHeight: null,
                lastSize: null,
                lastVisibility: null,
                lastValueText: null,
                lastChangeText: null
            };
            tile.rect = add(group, 'rect', { class: 'treemap-surface' });
            tile.nameEl = add(group, 'text', { class: 'treemap-label treemap-label-name', 'text-anchor': 'middle' });
            tile.valueEl = add(group, 'text', { class: 'treemap-label treemap-label-value', 'text-anchor': 'middle' });
            tile.changeEl = add(group, 'text', { class: 'treemap-label treemap-label-change', 'text-anchor': 'middle' });
            tile.labels = [tile.nameEl, tile.valueEl, tile.changeEl];
            tile.titleEl = add(group, 'title');
            if (canDrill) {
                // Reads tile.item at click time so it never goes stale across ticks.
                const drill = () => { path.push({ node: tile.item, depth: path.length }); render(); };
                group.addEventListener('click', drill);
                group.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); drill(); }
                });
            }
            return tile;
        }

        function paint(tile) {
            const { x, y, w, h, value, pct } = tile.cur;

            // Tile gap is defined here by the rectangle inset and dimensions.
            tile.rect.setAttribute('x', x + 2);
            tile.rect.setAttribute('y', y + 2);
            tile.rect.setAttribute('width', Math.max(0, w - 4));
            tile.rect.setAttribute('height', Math.max(0, h - 4));

            // The fit is fixed for the whole tween, so the label size and visibility
            // only need writing when a new tick changes them.
            const fit = tile.fit;
            const visibility = fit.size >= 2 ? 'visible' : 'hidden';
            if (visibility !== tile.lastVisibility) {
                tile.lastVisibility = visibility;
                tile.labels.forEach(element => element.setAttribute('visibility', visibility));
            }
            if (visibility === 'hidden') return;
            if (fit.size !== tile.lastSize) {
                tile.lastSize = fit.size;
                const fontSize = `${fit.size}px`;
                tile.labels.forEach(element => { element.style.fontSize = fontSize; });
            }

            const centerX = x + w / 2;
            const topY = y + (h - fit.requiredHeight) / 2 + fit.size;
            // These baseline offsets control the gaps from name to value and value to change.
            const valueY = topY + (fit.lines.length - 1) * fit.lineHeight + fit.size;

            tile.nameEl.setAttribute('x', centerX);
            tile.nameEl.setAttribute('y', topY);
            const linesKey = fit.lines.join('|');
            if (linesKey !== tile.lastLines) {
                // Only rebuild the tspans when the wrapping actually changes.
                tile.lastLines = linesKey;
                tile.nameEl.replaceChildren();
                fit.lines.forEach((line, index) => add(tile.nameEl, 'tspan', { x: centerX, dy: index === 0 ? 0 : fit.lineHeight }, line));
            } else {
                tile.nameEl.childNodes.forEach((span, index) => {
                    span.setAttribute('x', centerX);
                    if (fit.lineHeight !== tile.lastLineHeight) span.setAttribute('dy', index === 0 ? 0 : fit.lineHeight);
                });
            }
            tile.lastLineHeight = fit.lineHeight;

            const valueText = numberFormat.format(value);
            tile.valueEl.setAttribute('x', centerX);
            tile.valueEl.setAttribute('y', valueY);
            if (valueText !== tile.lastValueText) {
                tile.lastValueText = valueText;
                tile.valueEl.textContent = valueText;
            }

            const changeText = percentFormat.format(pct);
            tile.changeEl.setAttribute('x', centerX);
            tile.changeEl.setAttribute('y', valueY + fit.size);
            if (changeText !== tile.lastChangeText) {
                tile.lastChangeText = changeText;
                tile.changeEl.textContent = changeText;
            }
        }

        function setDirection(tile, item) {
            const change = Number(item.change);
            const direction = Number.isFinite(change) ? (change > 0 ? 'up' : (change < 0 ? 'down' : 'neutral')) : 'neutral';
            if (tile.group.dataset.direction !== direction) tile.group.dataset.direction = direction;
        }

        function step(now) {
            const reduced = motionPreference.matches;
            let active = false;
            tiles.forEach(tile => {
                const progress = reduced ? 1 : Math.min(1, (now - tile.t0) / DURATION);
                const eased = ease(progress);
                TWEEN_PROPS.forEach(prop => { tile.cur[prop] = lerp(tile.from[prop], tile.to[prop], eased); });
                paint(tile);
                if (progress < 1) active = true;
            });
            raf = active && !document.hidden ? requestAnimationFrame(step) : 0;
        }

        function startLoop() {
            if (!raf) raf = requestAnimationFrame(step);
        }

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && tiles.size) startLoop();
        });

        // Breadcrumbs only depend on the path, so they are rebuilt when it changes
        // (not on every tick, which would also drop keyboard focus from them).
        function renderBreadcrumbs() {
            if (!breadcrumbs) return;
            breadcrumbs.replaceChildren();
            const addCrumb = (name, onClick, pressed) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = name;
                button.setAttribute('aria-pressed', String(pressed));
                button.addEventListener('click', onClick);
                breadcrumbs.appendChild(button);
            };
            addCrumb(options.rootLabel || 'World', () => { path = []; render(); }, path.length === 0);
            path.forEach((entry, index) => {
                const separator = document.createElement('span');
                separator.textContent = ' | ';
                separator.setAttribute('aria-hidden', 'true');
                breadcrumbs.appendChild(separator);
                addCrumb(getName(entry.node), () => { path = path.slice(0, index + 1); render(); }, index === path.length - 1);
            });
        }

        function render() {
            const current = path.length ? path[path.length - 1] : { node: options.root, depth: -1 };
            const children = getChildren(current.node);
            const items = children.length ? children : [current.node];
            const total = items.reduce((sum, node) => sum + getValue(node), 0);
            if (options.feedId) {
                host.dispatchEvent(new CustomEvent('treemap:items', {
                    bubbles: true,
                    detail: { feedId: options.feedId, items }
                }));
            }

            // Drilling in or out changes which tiles exist, so rebuild from scratch.
            // Normal feed ticks keep the same path and only update tile targets.
            const signature = path.map(entry => getName(entry.node)).join('>');
            if (signature !== pathSignature || !svg) {
                pathSignature = signature;
                cancelAnimationFrame(raf);
                raf = 0;
                host.replaceChildren();
                tiles.clear();
                svg = add(host, 'svg', {
                    viewBox: `0 0 ${width} ${height}`,
                    role: options.accessible ? 'img' : 'presentation',
                    'aria-hidden': options.accessible ? 'false' : 'true',
                    'aria-label': options.accessible ? `${getName(current.node)} treemap` : null
                });
                renderBreadcrumbs();
            }

            const now = performance.now();
            squarify(items, 0, 0, width, height, getValue).forEach(({ item, x, y, w, h }) => {
                const key = keyOf(item);
                const value = getValue(item);
                const change = Number(item.changePercent) || 0;
                const target = { x, y, w, h, value, pct: change };
                let tile = tiles.get(key);
                if (!tile) {
                    tile = createTile(item);
                    tile.cur = { ...target };
                    tiles.set(key, tile);
                }
                tile.item = item;
                tile.from = { ...tile.cur };
                tile.to = target;
                tile.t0 = now;
                tile.fit = fitLabel(tile.words, numberFormat.format(value), percentFormat.format(change), w * 0.9, h * 0.9);

                const name = getName(item);
                const label = getLabel(item);
                const tooltipLabel = label === name ? name : `${name} (${label})`;
                tile.titleEl.textContent = `${tooltipLabel}\n${tooltipNumberFormat.format(value)}\n${change >= 0 ? '+' : ''}${tooltipNumberFormat.format(change)}`;
                tile.group.setAttribute('aria-label', `${name}: ${numberFormat.format(value)}${tile.canDrill ? ', open details' : ''}`);
                setDirection(tile, item);
                if (!tile.painted) { tile.painted = true; paint(tile); } // avoid an empty first frame
            });
            startLoop();

            if (status) {
                const totalText = `€$${numberFormat.format(total)}B`;
                status.textContent = `${getName(current.node)} · ${totalText} · ${items.length} ${items.length === 1 ? 'A01' : 'A10'}`;
            }
        }
        render();
        return { update: render };
    }

    function findHost(id) {
        return id ? document.querySelector(`.treemap[data-treemap="${CSS.escape(id)}"]`) : null;
    }

    function statusFor(host) {
        return host?.closest('[data-treemap-panel]')?.querySelector('.data-status') || null;
    }

    // Draws the treemap the first time it is on screen, then follows its feed.
    function mountTree(host, root) {
        const panel = host.closest('[data-treemap-panel]');
        const wrapper = host.closest('[data-panel-group]');
        let chart = null;
        let inViewport = false;

        function updateChart() {
            if (!inViewport || document.hidden || wrapper?.hidden) return;
            if (chart) {
                chart.update();
                return;
            }
            chart = mount(host, {
                root,
                feedId: host.dataset.treemap,
                rootLabel: root.name,
                breadcrumbs: panel?.querySelector('.treemap-breadcrumbs') || null,
                status: statusFor(host),
                accessible: true
            });
        }

        observeVisibility(host, isVisible => {
            const changed = inViewport !== isVisible;
            inViewport = isVisible;
            if (inViewport && changed) updateChart();
        });
        simulation.getFeed(host.dataset.treemap).subscribe(updateChart, { immediate: false });
    }

    window.addEventListener('feeds:loaded', event => {
        const { id, root } = event.detail || {};
        const host = findHost(id);
        if (host && root) mountTree(host, root);
    });
    window.addEventListener('feeds:error', event => {
        const { id, url } = event.detail || {};
        const status = statusFor(findHost(id));
        if (status) status.textContent = `${id || 'Treemap'} data could not be loaded. Check ${url || 'the data url'}.`;
    });
})();
