// Treemap renderer for the fictional corporate market.
(function () {
    const companies = (window.marketData || []).filter(company =>
        company && typeof company.name === 'string' && typeof company.tag === 'string' &&
        Number.isFinite(company.value) && company.value > 0
    ).sort((a, b) => b.value - a.value);
    if (!companies.length) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const width = 600, height = 600, gap = 8;

    function add(parent, tag, attrs, text) {
        const element = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        if (text !== undefined) element.textContent = text;
        parent.append(element);
        return element;
    }

    function labelSize(value) {
        if (value > 10000) return 200;
        if (value > 7000) return 160;
        if (value > 5000) return 130;
        if (value > 3000) return 100;
        if (value > 1500) return 80;
        return 60;
    }

    function render(plot) {
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('role', 'presentation');
        svg.setAttribute('aria-hidden', 'true');

        // Split each group into two balanced value totals, alternating direction.
        function layout(items, x, y, w, h) {
            if (items.length === 1) {
                const company = items[0];
                const outlineColor = company.color || '#626b70';
                const tile = add(svg, 'g', { class: 'market-tile' });
                const clipId = `market-clip-${companies.indexOf(company)}`;
                const defs = svg.querySelector('defs') || add(svg, 'defs', {});
                const clip = add(defs, 'clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
                add(clip, 'rect', {
                    x, y, width: Math.max(0, w - gap), height: Math.max(0, h - gap)
                });
                const rect = add(tile, 'rect', {
                    x, y, width: Math.max(0, w - gap), height: Math.max(0, h - gap),
                    rx: 0, class: 'market-tile-surface', fill: '#1b1b1bed',
                    color: company.color || '#626b70',
                    stroke: outlineColor, 'stroke-width': 1, 'stroke-opacity': 0.82
                });
                add(rect, 'title', {}, `${company.name}: €$${company.value.toLocaleString()} billion`);
                {
                    const fontSize = labelSize(company.value);
                    const label = add(tile, 'text', {
                        x: x + (w - gap) / 2,
                        y: y + (h - gap) / 2,
                        'text-anchor': 'middle', 'dominant-baseline': 'central',
                        'alignment-baseline': 'central',
                        class: 'market-tag', 'clip-path': `url(#${clipId})`,
                        fill: outlineColor,
                        'font-size': `${fontSize}px`
                    }, company.tag);
                }
                return;
            }
            const total = items.reduce((sum, company) => sum + company.value, 0);
            let accumulated = 0, split = 1;
            for (; split < items.length; split++) {
                accumulated += items[split - 1].value;
                if (accumulated >= total / 2) break;
            }
            const firstTotal = items.slice(0, split).reduce((sum, company) => sum + company.value, 0);
            const ratio = firstTotal / total;
            if (w >= h) {
                const firstWidth = w * ratio;
                layout(items.slice(0, split), x, y, firstWidth, h);
                layout(items.slice(split), x + firstWidth, y, w - firstWidth, h);
            } else {
                const firstHeight = h * ratio;
                layout(items.slice(0, split), x, y, w, firstHeight);
                layout(items.slice(split), x, y + firstHeight, w, h - firstHeight);
            }
        }

        const padding = 6;
        layout(companies, padding, padding, width - padding * 2, height - padding * 2);
        plot.replaceChildren(svg);
    }

    document.querySelectorAll('.market-chart').forEach(render);
})();
