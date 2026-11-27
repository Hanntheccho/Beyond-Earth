// treemap.js - Shared treemap layout, labels, colors, and optional hierarchical navigation.
// Tiles are persistent (keyed by tag/name) and tweened between feed ticks, so
// geometry, value, and change numbers animate instead of being rebuilt each tick.
import { motionPreference } from './motion.js';
import { simulation } from './simulation.js';
import { observeVisibility } from './viewport-visibility.js';
import { CHAR_WIDTH, appendSvg as add } from './svg.js';

(function () {
    const numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const tooltipNumberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
    const percentFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

    // Tween settings. Keep DURATION well below the feed tick interval.
    const DURATION = 700;
    const TWEEN_PROPS = ['x', 'y', 'w', 'h', 'value', 'pct'];
    const ease = t => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;

    // Tile layout, in pixels. Each tile's surface is inset by TILE_INSET on every side,
    // which makes the gaps between tiles. Labels keep LABEL_PADDING, a fraction of the
    // tile's size, from each edge: of its width on the left and right, of its height on
    // the top and bottom.
    const TILE_INSET = 2;
    const LABEL_PADDING = 0.08;

    // Label sizing (see fitLabel). The font size is capped at a fraction of the tile's
    // label area, and tried from there downwards in LABEL_SIZE_STEP pixel steps. A tile
    // whose labels only fit below MIN_LABEL_SIZE pixels shows no labels.
    const LABEL_SIZE_BY_WIDTH = 0.13;
    const LABEL_SIZE_BY_HEIGHT = 0.16;
    const LABEL_SIZE_STEP = 0.25;
    const MIN_LABEL_SIZE = 1;
    // Spacing between wrapped name lines, and the height of the name's first line plus
    // the value and change rows, both as fractions of the font size.
    const LABEL_LINE_HEIGHT = 0.8;
    const LABEL_BLOCK_HEIGHT = 2.8;

    const splitWords = name => String(name).trim().split(/\s+/);
    // Tiles show and color by the trend change (trendPercent in simulation.js).
    const trendOf = item => Number(item.trendPercent ?? item.changePercent) || 0;

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

    // Largest font size at which the wrapped name, value and change fit the tile, or
    // null when they only fit below MIN_LABEL_SIZE.
    function fitLabel(words, valueText, changeText, w, h) {
        const availableWidth = w * (1 - 2 * LABEL_PADDING);
        const availableHeight = h * (1 - 2 * LABEL_PADDING);
        const longestWordLength = words.reduce((longest, word) => Math.max(longest, word.length), 1);
        // Use the widest unwrapped label to size all three labels consistently.
        const longestLabelLength = Math.max(longestWordLength, valueText.length, changeText.length);
        const maxSizeByLabelWidth = availableWidth / (longestLabelLength * CHAR_WIDTH);
        const largestSize = Math.min(availableWidth * LABEL_SIZE_BY_WIDTH, availableHeight * LABEL_SIZE_BY_HEIGHT, maxSizeByLabelWidth);
        for (let size = largestSize; size >= MIN_LABEL_SIZE; size -= LABEL_SIZE_STEP) {
            const lines = wrapWords(words, Math.max(1, Math.floor(availableWidth / (size * CHAR_WIDTH))));
            const lineHeight = size * LABEL_LINE_HEIGHT;
            const requiredHeight = (lines.length - 1) * lineHeight + size * LABEL_BLOCK_HEIGHT;
            if (requiredHeight <= availableHeight) return { lines, size, lineHeight, requiredHeight };
        }
        return null;
    }

    function mount(host, options) {
        let path = [];
        const getChildren = node => Array.isArray(node.children) ? node.children : [];
        const getValue = node => Number(node.value) || 0;
        const getName = node => node.name || node.label || '';
        const getLabel = node => node.label || getName(node);
        const keyOf = node => node.tag || node.name;
        const backButton = options.backButton || null;
        backButton?.addEventListener('click', () => { path.pop(); render(); });

        // Persistent render state: tiles survive between ticks and only get new targets.
        const tiles = new Map();
        let pathSignature = null;
        let svg = null;
        let raf = 0;

        // The board is square and as wide as the host, with one SVG unit per CSS pixel,
        // so sizes, insets and font sizes are real pixels instead of being scaled by CSS.
        // mountTree only mounts a visible host, so its width is known here.
        let width = host.clientWidth;
        let height = width;

        function setBoardSize() {
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);
        }

        // Lays the tiles out again when the host's width changes. The SVG sets the host's
        // height, so only width changes count; a hidden host reports no width and is skipped.
        new ResizeObserver(([entry]) => {
            const nextWidth = Math.round(entry.contentRect.width);
            if (!nextWidth || nextWidth === width) return;
            width = height = nextWidth;
            if (svg) { setBoardSize(); render(); }
        }).observe(host);

        // A tile's tooltip: its name (with its label when that differs), value and change.
        function tooltipText(item) {
            const name = getName(item);
            const label = getLabel(item);
            const change = trendOf(item);
            return `${label === name ? name : `${name} (${label})`}\n${tooltipNumberFormat.format(getValue(item))}\n${change >= 0 ? '+' : ''}${tooltipNumberFormat.format(change)}%`;
        }

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
            // The browser closes a tooltip whose text changes, so the title is a snapshot
            // taken on entering the tile instead of being rewritten every tick.
            group.addEventListener('pointerenter', () => { tile.titleEl.textContent = tooltipText(tile.item); });
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

            tile.rect.setAttribute('x', x + TILE_INSET);
            tile.rect.setAttribute('y', y + TILE_INSET);
            tile.rect.setAttribute('width', Math.max(0, w - 2 * TILE_INSET));
            tile.rect.setAttribute('height', Math.max(0, h - 2 * TILE_INSET));

            // The fit is fixed for the whole tween, so the label size and visibility
            // only need writing when a new tick changes them. No fit hides the labels.
            const fit = tile.fit;
            const visibility = fit ? 'visible' : 'hidden';
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
            const change = trendOf(item);
            const direction = Number.isFinite(change) ? (change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutrale')) : 'neutrale';
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

        // The back key only depends on the path, so it is updated when the path changes:
        // shown below the root level, and named after the level it goes up to.
        function updateBackButton() {
            if (!backButton) return;
            backButton.hidden = path.length === 0;
            const parent = path.length > 1 ? path[path.length - 2].node : options.root;
            backButton.setAttribute('aria-label', `Back to ${getName(parent)}`);
        }

        function render() {
            const current = path.length ? path[path.length - 1] : { node: options.root, depth: -1 };
            const children = getChildren(current.node);
            const items = children.length ? children : [current.node];
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
                    role: options.accessible ? 'img' : 'presentation',
                    'aria-hidden': options.accessible ? 'false' : 'true',
                    'aria-label': options.accessible ? `${getName(current.node)} treemap` : null
                });
                setBoardSize();
                updateBackButton();
            }

            const now = performance.now();
            squarify(items, 0, 0, width, height, getValue).forEach(({ item, x, y, w, h }) => {
                const key = keyOf(item);
                const value = getValue(item);
                const change = trendOf(item);
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
                tile.fit = fitLabel(tile.words, numberFormat.format(value), percentFormat.format(change), w, h);

                const name = getName(item);
                tile.group.setAttribute('aria-label', `${name}: ${numberFormat.format(value)}${tile.canDrill ? ', open details' : ''}`);
                setDirection(tile, item);
                if (!tile.painted) { tile.painted = true; paint(tile); } // avoid an empty first frame
            });
            startLoop();
        }
        render();
        return { update: render };
    }

    function findHost(id) {
        return id ? document.querySelector(`.treemap[data-treemap="${CSS.escape(id)}"]`) : null;
    }

    // Draws the treemap the first time it is on screen, then follows its feed. The
    // board's first render replaces the loading message inside the host. The back key
    // sits beside the host in the treemap panel, outside what each render replaces.
    function mountTree(host, root) {
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
                backButton: host.closest('[data-treemap-panel]')?.querySelector('[data-treemap-back]') || null,
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
        const message = findHost(id)?.querySelector('.treemap-message');
        if (message) message.textContent = `${id || 'Treemap'} data could not be loaded. Check ${url || 'the data url'}.`;
    });
})();

