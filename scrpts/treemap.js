// Shared treemap layout, labels, colors, and optional hierarchical navigation.
// Tiles are persistent (keyed by tag/name) and tweened between market ticks, so
// geometry, value, and change numbers animate instead of being rebuilt each tick.
(function () {
    const svgNS = 'http://www.w3.org/2000/svg';
    const width = 800;
    const height = 800;
    const numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const percentFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

    // Tween settings. Keep DURATION well below the market tick interval.
    const DURATION = 700;
    const TWEEN_PROPS = ['x', 'y', 'w', 'h', 'value', 'pct'];
    const ease = t => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    function add(parent, tag, attrs, text) {
        const element = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => { if (value !== null && value !== undefined) element.setAttribute(key, value); });
        if (text !== undefined) element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function wrapName(name, maxChars) {
        const lines = [];
        let line = '';
        String(name).trim().split(/\s+/).forEach(word => {
            // Wrap at spaces only; fitLabel accounts for long unbroken words by reducing the font size.
            if (line && `${line} ${word}`.length > maxChars) { lines.push(line); line = word; }
            else line = line ? `${line} ${word}` : word;
        });
        if (line) lines.push(line);
        return lines;
    }

    function squarify(items, x, y, w, h, getValue) {
        const total = items.reduce((sum, item) => sum + getValue(item), 0);
        if (!total || !items.length || w <= 0 || h <= 0) return [];
        const remaining = items.map(item => ({ item, area: getValue(item) * w * h / total })).sort((a, b) => b.area - a.area);
        const rectangles = [];
        let row = [], rx = x, ry = y, rw = w, rh = h;
        function worst(testRow, side) {
            if (!testRow.length) return Infinity;
            const sum = testRow.reduce((value, entry) => value + entry.area, 0);
            const largest = Math.max(...testRow.map(entry => entry.area));
            const smallest = Math.min(...testRow.map(entry => entry.area));
            return Math.max(side * side * largest / (sum * sum), sum * sum / (side * side * smallest));
        }
        function placeRow(entries) {
            const area = entries.reduce((sum, entry) => sum + entry.area, 0);
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
        while (remaining.length) {
            const next = remaining[0];
            if (!row.length || worst(row.concat(next), Math.min(rw, rh)) <= worst(row, Math.min(rw, rh))) row.push(remaining.shift());
            else { placeRow(row); row = []; }
        }
        if (row.length) placeRow(row);
        return rectangles;
    }

    function fitLabel(name, valueText, changeText, w, h) {
        // Keep an inset inside each tile; paint() also passes % of the tile dimensions.
        const availableWidth = Math.max(1, w - 8);
        const availableHeight = Math.max(1, h - 6);
        const longestWordLength = String(name).trim().split(/\s+/).reduce((longest, word) => Math.max(longest, word.length), 1);
        // These character-width factors approximate the used font; increase them for more conservative sizing.
        const maxSizeByWordWidth = availableWidth / (longestWordLength * 0.6);
        for (let size = Math.min(availableWidth * 0.13, availableHeight * 0.16, maxSizeByWordWidth); size >= 1.5; size -= 0.25) {
            const lines = wrapName(name, Math.max(1, Math.floor(availableWidth / (size * 0.65))));
            // Number text is sized against the tile width and remains at most the name's font size.
            const valueSize = Math.min(size * 1, availableWidth / Math.max(1, valueText.length * 0.68));
            const changeSize = Math.min(size * 1, availableWidth / Math.max(1, changeText.length * 0.68));
            // Vertical spacing between wrapped name lines; requiredHeight reserves room for all three text rows.
            const lineHeight = size * 0.8;
            const requiredHeight = (lines.length - 1) * lineHeight + size * 2.8 + 2;
            if (requiredHeight <= availableHeight) return { lines, size, valueSize, changeSize, lineHeight, requiredHeight };
        }
        const size = 1.5;
        const lines = wrapName(name, Math.max(1, Math.floor(availableWidth / (size * 0.65))));
        return { lines, size, valueSize: 1, changeSize: 1, lineHeight: size, requiredHeight: h };
    }

    function mount(host, options) {
        let path = [];
        const getChildren = node => Array.isArray(node.children) ? node.children : [];
        const getValue = node => Number(node.value) || 0;
        const getName = node => node.name || node.label || '';
        const getLabel = node => node.label || getName(node);
        const formatValue = node => `${numberFormat.format(getValue(node))}`;
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
            const tile = {
                item,
                canDrill,
                group,
                name: getLabel(item),
                lastLines: '',
                lastValueText: null,
                lastChangeText: null
            };
            tile.rect = add(group, 'rect', { class: 'treemap-surface' });
            tile.nameEl = add(group, 'text', { class: 'treemap-label treemap-label-name', 'text-anchor': 'middle' });
            tile.valueEl = add(group, 'text', { class: 'treemap-label treemap-label-value', 'text-anchor': 'middle' });
            tile.changeEl = add(group, 'text', { class: 'treemap-label treemap-label-change', 'text-anchor': 'middle' });
            tile.titleEl = add(group, 'title', {});
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
            const valueText = numberFormat.format(value);
            const changeText = percentFormat.format(pct);

            tile.rect.setAttribute('x', x + 2);
            tile.rect.setAttribute('y', y + 2);
            tile.rect.setAttribute('width', Math.max(0, w - 4));
            tile.rect.setAttribute('height', Math.max(0, h - 4));

            // Use % of the tile dimensions to leave a margin; label font comes from inherited CSS.
            const fit = fitLabel(tile.name, valueText, changeText, w * 0.9, h * 0.9);
            const visibility = fit.size >= 2 ? 'visible' : 'hidden';
            [tile.nameEl, tile.valueEl, tile.changeEl].forEach(element => element.setAttribute('visibility', visibility));
            if (visibility === 'hidden') return;

            const centerX = x + w / 2;
            const topY = y + (h - fit.requiredHeight) / 2 + fit.size;
            // These baseline offsets control the gaps from name to value and value to change.
            const valueY = topY + (fit.lines.length - 1) * fit.lineHeight + fit.size * 1;

            tile.nameEl.setAttribute('x', centerX);
            tile.nameEl.setAttribute('y', topY);
            tile.nameEl.style.fontSize = `${fit.size}px`;
            const linesKey = fit.lines.join('|');
            if (linesKey !== tile.lastLines) {
                // Only rebuild the tspans when the wrapping actually changes.
                tile.lastLines = linesKey;
                tile.nameEl.replaceChildren();
                fit.lines.forEach((line, index) => add(tile.nameEl, 'tspan', { x: centerX, dy: index === 0 ? 0 : fit.lineHeight }, line));
            } else {
                tile.nameEl.childNodes.forEach(span => span.setAttribute('x', centerX));
            }

            tile.valueEl.setAttribute('x', centerX);
            tile.valueEl.setAttribute('y', valueY);
            tile.valueEl.style.fontSize = `${fit.valueSize}px`;
            if (valueText !== tile.lastValueText) {
                tile.lastValueText = valueText;
                tile.valueEl.textContent = valueText;
            }

            tile.changeEl.setAttribute('x', centerX);
            tile.changeEl.setAttribute('y', valueY + fit.size * 1);
            tile.changeEl.style.fontSize = `${fit.changeSize}px`;
            if (changeText !== tile.lastChangeText) {
                tile.lastChangeText = changeText;
                tile.changeEl.textContent = changeText;
            }
        }

        function setDirection(tile, item) {
            const change = Number(item.change);
            const direction = Number.isFinite(change) ? (change > 0 ? 'up' : (change < 0 ? 'down' : 'neutral')) : 'neutral';
            const previous = tile.group.dataset.direction;
            if (previous === direction) return;
            tile.group.dataset.direction = direction;
            if (previous === undefined) return false;
            tile.group.classList.remove('is-flashing');
            return true;
        }

        function restartFlashes(groups) {
            if (!groups.length) return;
            void groups[0].getBoundingClientRect();
            groups.forEach(group => group.classList.add('is-flashing'));
        }

        function step(now) {
            const reduced = reducedMotionQuery.matches;
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

        function render() {
            const current = path.length ? path[path.length - 1] : { node: options.root, depth: -1 };
            const children = getChildren(current.node);
            const items = children.length ? children : [current.node];
            const total = items.reduce((sum, node) => sum + getValue(node), 0);

            // Drilling in or out changes which tiles exist, so rebuild from scratch.
            // Normal market ticks keep the same path and only update tile targets.
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
            }

            const flashes = [];
            squarify(items, 0, 0, width, height, getValue).forEach(({ item, x, y, w, h }) => {
                const key = keyOf(item);
                const target = { x, y, w, h, value: getValue(item), pct: Number(item.changePercent) || 0 };
                let tile = tiles.get(key);
                if (!tile) {
                    tile = createTile(item);
                    tile.cur = { ...target };
                    tiles.set(key, tile);
                }
                tile.item = item;
                tile.from = { ...tile.cur };
                tile.to = target;
                tile.t0 = performance.now();
                tile.titleEl.textContent = `${getName(item)} — ${formatValue(item)}${tile.canDrill ? ' · Click to expand' : ''}`;
                tile.group.setAttribute('aria-label', `${getName(item)}: ${formatValue(item)}${tile.canDrill ? ', open details' : ''}`);
                if (setDirection(tile, item)) flashes.push(tile.group);
                if (!tile.painted) { tile.painted = true; paint(tile); } // avoid an empty first frame
            });
            restartFlashes(flashes);
            startLoop();

            if (breadcrumbs) {
                breadcrumbs.replaceChildren();
                const addCrumb = (name, onClick) => {
                    const button = document.createElement('button');
                    button.type = 'button'; button.textContent = name;
                    button.addEventListener('click', onClick); breadcrumbs.appendChild(button);
                };
                addCrumb(options.rootLabel || 'World', () => { path = []; render(); });
                path.forEach((entry, index) => {
                    const separator = document.createElement('span'); separator.textContent = ' | '; separator.setAttribute('aria-hidden', 'true'); breadcrumbs.appendChild(separator);
                    addCrumb(getName(entry.node), () => { path = path.slice(0, index + 1); render(); });
                });
            }
            if (status) {
                const totalText = `€$${numberFormat.format(total)}B`;
                status.textContent = `MONDAYMARKET · ${getName(current.node)} · ${totalText} · ${items.length} ${items.length === 1 ? 'A01' : 'A10'}`;
            }
        }
        render();
        return { update: render };
    }

    function normalizeNode(source, useTags) {
        const node = { ...source };
        node.name = String(source.name || source.tag || 'Unnamed');
        node.label = useTags && source.tag ? String(source.tag) : node.name;
        node.value = Number(source.value) || 0;
        node.children = Array.isArray(source.children) ? source.children.map(child => normalizeNode(child, useTags)) : [];
        return node;
    }

    function findParentValues(node, path = []) {
        const name = String(node.name || node.tag || 'Unnamed');
        const currentPath = path.concat(name);
        const children = Array.isArray(node.children) ? node.children : [];
        const warnings = children.length && Object.prototype.hasOwnProperty.call(node, 'value')
            ? [currentPath.join(' > ')]
            : [];
        return warnings.concat(children.flatMap(child => findParentValues(child, currentPath)));
    }

    let loadedSources = 0;

    async function loadSource(host) {
        const panel = host.closest('[treemap-panel]');
        const status = panel && panel.querySelector('.data-status');
        try {
            const response = await fetch(host.dataset.source);
            if (!response.ok) throw new Error('Treemap data could not be loaded.');
            const rawRoot = await response.json();
            const parentValues = findParentValues(rawRoot);
            if (parentValues.length) {
                const message = `Explicit values on parent nodes are ignored; parent values are calculated from their children. Found in ${host.dataset.source}: ${parentValues.join(', ')}.`;
                console.error(`[Treemap] ${message}`);
            }
            const useTags = host.dataset.useTags === 'true';
            const root = normalizeNode(rawRoot, useTags);
            let chart;
            window.valueChanges.registerSource(host.dataset.treemap, root, () => {
                if (document.hidden) return;
                const wrapper = host.closest('[data-panel-group]');
                if (wrapper && wrapper.hidden) return;
                if (chart) chart.update();
            });
            chart = mount(host, {
                root,
                rootLabel: root.name,
                breadcrumbs: panel && panel.querySelector('.treemap-breadcrumbs'),
                status,
                accessible: true
            });
            loadedSources += 1;
        } catch (error) {
            if (status) status.textContent = `${host.dataset.treemap || 'Treemap'} data could not be loaded. Check ${host.dataset.source}.`;
        }
    }

    window.defaultTreemap = { mount };
    Promise.all(Array.from(document.querySelectorAll('.treemap[data-source]'), loadSource)).then(() => {
        if (loadedSources) window.valueChanges.start();
    });
})();
