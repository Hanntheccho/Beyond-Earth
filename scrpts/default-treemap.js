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

    const sources = [];
    let timer = null;
    let marketMood = 0;

    function normalizeNode(source, useTags, inherited = {}) {
        const node = { ...source };
        node.name = String(source.name || source.tag || 'Unnamed');
        node.label = useTags && source.tag ? String(source.tag) : node.name;
        node.value = Number(source.value) || 0;
        node.children = Array.isArray(source.children) ? source.children.map(child => normalizeNode(child, useTags, node)) : [];
        node.change = 0;
        node.changePercent = 0;
        node.baseValue = node.value;
        node.volatility = node.children.length ? 0 : Math.max(0.0035, Math.min(0.016, 0.014 / Math.sqrt(Math.max(node.value, 1) / 100)));
        return node;
    }

    function walk(node, callback) {
        callback(node);
        node.children.forEach(child => walk(child, callback));
    }

    function advanceValues() {
        const previous = new Map();
        sources.forEach(source => walk(source.root, node => previous.set(node, node.value)));
        marketMood = Math.max(-0.02, Math.min(0.02, marketMood * 0.86 + (Math.random() - 0.5) * 0.006));

        function update(node) {
            if (node.children.length) {
                node.children.forEach(update);
                node.value = node.children.reduce((sum, child) => sum + child.value, 0);
            } else {
                const drift = (Math.random() - 0.5) * 0.0012;
                const shock = (Math.random() * 2 - 1) * node.volatility;
                node.value = Math.max(node.baseValue * 0.25, node.value * (1 + marketMood * 0.2 + drift + shock));
            }
            const oldValue = previous.get(node) || 0;
            node.change = node.value - oldValue;
            node.changePercent = oldValue ? node.change / oldValue * 100 : 0;
        }

        sources.forEach(source => {
            update(source.root);
            source.chart.update();
        });
        Object.values(markets).forEach(market => market.publish());
    }

    // One shared timer drives every treemap and every market list.
    function startTicker(options = {}) {
        if (timer) clearInterval(timer);
        timer = setInterval(advanceValues, Math.max(250, Number(options.intervalMs) || 2000));
    }

    function stopTicker() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    // Rows and quotes are keyed by tag, falling back to name for data sets without tags (e.g. countries).
    const itemKey = item => item.tag || item.name;

    // A "market" is the list-facing view of one treemap data set (companies, countries, ...).
    //   key      -> names the DOM hooks: [data-<key>-market] and [data-<key>-market-status]
    //   treemap  -> the data-treemap value of the treemap host that supplies the data
    function createMarket(key, treemap) {
        const market = {
            key,
            treemap,
            root: null,
            listeners: new Set(),
            getSnapshot() {
                return market.root ? market.root.children.map(item => ({ ...item })) : [];
            },
            getQuote(tag) {
                const item = market.root && market.root.children.find(child => itemKey(child) === tag);
                return item ? { ...item } : null;
            },
            subscribe(listener, options = {}) {
                if (typeof listener !== 'function') throw new TypeError('Market subscriber must be a function');
                market.listeners.add(listener);
                if (options.immediate !== false) listener(market.getSnapshot());
                return () => market.listeners.delete(listener);
            },
            publish() {
                if (!market.root) return;
                const current = market.getSnapshot();
                market.listeners.forEach(listener => listener(current));
            },
            tick: advanceValues,
            start(options) { startTicker(options); return market; },
            stop() { stopTicker(); return market; }
        };
        return market;
    }

    const markets = {
        company: createMarket('company', 'market'),
        country: createMarket('country', 'gdp')
    };
    window.companyMarket = markets.company;
    window.countryMarket = markets.country;

    // Renders one row per top-level item of a market and keeps the rows updated.
    function renderRows(market) {
        if (!market.root) return;
        const host = document.querySelector(`[data-${market.key}-market]`);
        if (!host) return;
        const status = document.querySelector(`[data-${market.key}-market-status]`);
        const rows = new Map();
        const valueFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        host.replaceChildren();
        market.root.children.forEach(item => {
            const row = document.createElement('div');
            row.className = 'data-grid-row';
            row.dataset[`${market.key}Tag`] = itemKey(item);
            row.innerHTML = '<span class="data-grid-name"></span><span class="data-grid-unit">€$B</span><span class="data-grid-price"></span><span class="data-grid-change"></span>';
            row.querySelector('.data-grid-name').textContent = item.name;
            host.appendChild(row);
            rows.set(itemKey(item), row);
        });
        market.subscribe(current => {
            current.forEach(item => {
                const row = rows.get(itemKey(item));
                if (!row) return;
                row.querySelector('.data-grid-price').textContent = valueFormat.format(item.value);
                const change = row.querySelector('.data-grid-change');
                change.textContent = percentFormat.format(item.changePercent);
                change.classList.toggle('is-up', item.change >= 0);
                change.classList.toggle('is-down', item.change < 0);
                row.dataset.direction = item.change >= 0 ? 'up' : 'down';
            });
            if (status) status.textContent = `MONDAYMARKET · updated ${new Date().toLocaleTimeString()}`;
        });
    }

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
            sources.push({ host, root, chart });

            const market = Object.values(markets).find(item => item.treemap === host.dataset.treemap);
            if (market) {
                market.root = root;
                window[market.key === 'company' ? 'marketData' : 'countryData'] = root.children;
                renderRows(market);
            }
        } catch (error) {
            if (status) status.textContent = `${host.dataset.treemap || 'Treemap'} data could not be loaded. Check ${host.dataset.source}.`;
        }
    }

    window.defaultTreemap = { mount };
    Promise.all(Array.from(document.querySelectorAll('.treemap[data-source]'), loadSource)).then(() => {
        if (sources.length) startTicker();
    });
})();
