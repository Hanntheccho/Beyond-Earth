// Shared treemap layout, labels, colors, and optional hierarchical navigation.
(function () {
    const svgNS = 'http://www.w3.org/2000/svg';
    const width = 800;
    const height = 800;
    const numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const percentFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

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
        // Keep an inset inside each tile; render() also passes % of the tile dimensions.
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
        const breadcrumbs = options.breadcrumbs || null;
        const status = options.status || null;

        function render() {
            const current = path.length ? path[path.length - 1] : { node: options.root, depth: -1 };
            const children = getChildren(current.node);
            const items = children.length ? children : [current.node];
            const total = items.reduce((sum, node) => sum + getValue(node), 0);
            host.replaceChildren();
            const svg = add(host, 'svg', { viewBox: `0 0 ${width} ${height}`, role: options.accessible ? 'img' : 'presentation', 'aria-hidden': options.accessible ? 'false' : 'true', 'aria-label': options.accessible ? `${getName(current.node)} treemap` : null });

            squarify(items, 0, 0, width, height, getValue).forEach(({ item, x, y, w, h }) => {
                const change = Number(item.change);
                const direction = Number.isFinite(change) ? (change > 0 ? 'up' : (change < 0 ? 'down' : 'neutral')) : 'neutral';
                const nested = getChildren(item);
                const canDrill = nested.length > 0;
                const name = getLabel(item);
                const valueText = formatValue(item);
                const changeText = `${percentFormat.format(Number(item.changePercent) || 0)}`;
                const group = add(svg, 'g', { class: `treemap-tile${canDrill ? ' has-children' : ''}`, 'data-direction': direction, tabindex: canDrill ? '0' : null, role: canDrill ? 'button' : null, 'aria-label': `${getName(item)}: ${valueText}${canDrill ? ', open details' : ''}` });
                add(group, 'rect', { x: x + 2, y: y + 2, width: Math.max(0, w - 4), height: Math.max(0, h - 4), class: 'treemap-surface' });
                // Use % of the tile dimensions to leave a margin; label font comes from inherited CSS.
                const fit = fitLabel(name, valueText, changeText, w * 0.9, h * 0.9);
                const centerX = x + w / 2;
                const topY = y + (h - fit.requiredHeight) / 2 + fit.size;
                if (fit.size >= 2) {
                    const label = add(group, 'text', { x: centerX, y: topY, class: 'treemap-label treemap-label-name', style: `font-size:${fit.size}px`, 'text-anchor': 'middle' });
                    fit.lines.forEach((line, index) => add(label, 'tspan', { x: centerX, dy: index === 0 ? 0 : fit.lineHeight }, line));
                    // These baseline offsets control the gaps from name to value and value to change.
                    const valueY = topY + (fit.lines.length - 1) * fit.lineHeight + fit.size * 1;
                    add(group, 'text', { x: centerX, y: valueY, class: 'treemap-label treemap-label-value', style: `font-size:${fit.valueSize}px`, 'text-anchor': 'middle' }, valueText);
                    add(group, 'text', { x: centerX, y: valueY + fit.size * 1, class: 'treemap-label treemap-label-change', style: `font-size:${fit.changeSize}px`, 'text-anchor': 'middle' }, changeText);
                }
                add(group, 'title', {}, `${getName(item)} — ${valueText} (${changeText})${canDrill ? ' · Click to expand' : ''}`);
                if (canDrill) {
                    const drill = () => { path.push({ node: item, depth: current.depth + 1 }); render(); };
                    group.addEventListener('click', drill);
                    group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); drill(); } });
                }
            });

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

    let loadedSources = 0;

    async function loadSource(host) {
        const panel = host.closest('[treemap-panel]');
        const status = panel && panel.querySelector('.data-status');
        try {
            const response = await fetch(host.dataset.source);
            if (!response.ok) throw new Error('Treemap data could not be loaded.');
            const rawRoot = await response.json();
            const useTags = host.dataset.useTags === 'true';
            const root = normalizeNode(rawRoot, useTags);
            const chart = mount(host, {
                root,
                rootLabel: root.name,
                breadcrumbs: panel && panel.querySelector('.treemap-breadcrumbs'),
                status,
                accessible: true
            });
            const marketKey = host.dataset.treemap === 'market' ? 'company' : (host.dataset.treemap === 'gdp' ? 'country' : null);
            window.valueChanges.registerSource(marketKey, root, chart.update);
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
