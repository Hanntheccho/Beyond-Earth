// Treemap renderer for the fictional corporate market.
(function () {
    const companies = (window.marketData || []).filter(company =>
        company && typeof company.name === 'string' && typeof company.tag === 'string' &&
        Number.isFinite(company.value) && company.value > 0
    ).sort((a, b) => b.value - a.value);
    if (!companies.length) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const width = 600, height = 600, gap = 4;

    function add(parent, tag, attrs, text) {
        const element = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        if (text !== undefined) element.textContent = text;
        parent.append(element);
        return element;
    }

    function labelSize(value) {
        if (value > 10000) return 100;
        if (value > 9000) return 90;
        if (value > 8000) return 80;
        if (value > 7000) return 70;
        if (value > 6000) return 60;
        if (value > 5000) return 50;
        if (value > 4000) return 40;
        if (value > 3000) return 30;
        if (value > 2000) return 20;
        if (value > 1000) return 10;
        if (value > 500) return 5;
        if (value > 400) return 4;
        if (value > 300) return 3;
        if (value > 200) return 2;
        return 1;
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
                const tile = add(svg, 'g', { class: 'market-tile' });
                const movement = company.change || 0;
                const intensity = Math.min(1, Math.abs(company.changePercent || 0) / 3);
                const shade = Math.round(90 + intensity * 85);
                const color = movement > 0
                    ? `rgb(0 ${shade} 70)`
                    : (movement < 0 ? `rgb(${shade} 35 35)` : '#626b70');
                const outlineColor = movement > 0
                    ? `rgb(90 255 150)`
                    : (movement < 0 ? `rgb(255 105 105)` : '#aeb5ba');
                tile.style.setProperty('--market-color', color);
                tile.style.setProperty('--market-outline', outlineColor);
                tile.style.setProperty('--market-tile-fill', `color-mix(in srgb, ${color} 22%, transparent)`);
                const clipId = `market-clip-${companies.indexOf(company)}`;
                const defs = svg.querySelector('defs') || add(svg, 'defs', {});
                const clip = add(defs, 'clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
                add(clip, 'rect', {
                    x, y, width: Math.max(0, w - gap), height: Math.max(0, h - gap)
                });
                const rect = add(tile, 'rect', {
                    x, y, width: Math.max(0, w - gap), height: Math.max(0, h - gap),
                    rx: 0, class: 'market-tile-surface'
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

    function renderAll() {
        document.querySelectorAll('.market-chart').forEach(render);
    }

    renderAll();
    if (window.companyMarket) window.companyMarket.subscribe(renderAll, { immediate: false });
})();
