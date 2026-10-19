// Treemap renderer for the fictional corporate market.
(function () {
    const companies = (window.marketData || []).filter(company =>
        company && typeof company.name === 'string' && typeof company.tag === 'string' &&
        Number.isFinite(company.value) && company.value > 0
    ).sort((a, b) => b.value - a.value);
    if (!companies.length) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const width = 600, height = 600, gap = 0;

    function add(parent, tag, attrs, text) {
        const element = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        if (text !== undefined) element.textContent = text;
        parent.append(element);
        return element;
    }

    function labelSize(value) {
        if (value > 10000) return 32;
        if (value > 7000) return 26;
        if (value > 5000) return 20;
        if (value > 3000) return 14;
        if (value > 1500) return 10;
        return 10;
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
                const rect = add(svg, 'rect', {
                    x, y, width: Math.max(0, w - gap), height: Math.max(0, h - gap),
                    rx: 2, fill: company.color || '#626b70', stroke: '#17191c', 'stroke-width': 1
                });
                add(rect, 'title', {}, `${company.name}: €$${company.value.toLocaleString()} billion`);
                if (w > 38 && h > 22) {
                    add(svg, 'text', {
                        x: x + (w - gap) / 2, y: y + (h - gap) / 2,
                        'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'market-tag',
                        'font-size': `${labelSize(company.value)}px`
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

        layout(companies, 0, 0, width, height);
        plot.replaceChildren(svg);
    }

    document.querySelectorAll('.market-chart').forEach(render);
})();
