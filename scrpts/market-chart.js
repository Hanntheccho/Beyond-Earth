// Treemap renderer for the fictional corporate market.
(function () {
    const svgNS = 'http://www.w3.org/2000/svg';
    const formatter = new Intl.NumberFormat('en-US');
    const changeFormatter = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: 'always'
    });
    const width = 600, height = 600, gap = 2;

    function add(parent, tag, attrs, text) {
        const element = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        if (text !== undefined) element.textContent = text;
        parent.append(element);
        return element;
    }

    function render(plot, companies) {
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
                tile.dataset.direction = movement > 0 ? 'up' : (movement < 0 ? 'down' : 'neutral');
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
                const changeText = `${changeFormatter.format(Number(company.changePercent) || 0)}%`;
                add(rect, 'title', {}, `${company.name} — €$${formatter.format(company.value)} billion (${changeText})`);
                {
                    const availableWidth = Math.max(0, (w - gap) * 0.7);
                    const availableHeight = Math.max(0, (h - gap) * 0.7);
                    const valueLabel = `€$${formatter.format(company.value)}B`;
                    const valueScale = 0.68;
                    const changeText = `${changeFormatter.format(Number(company.changePercent) || 0)}%`;
                    const changeScale = 0.56;
                    // Leave room for font metrics and tile edges to prevent clipping.
                    const fontSize = Math.floor(Math.min(
                        availableHeight * 0.3,
                        availableWidth / (Math.max(company.tag.length, valueLabel.length * valueScale, changeText.length * changeScale) * 0.72)
                    ));
                    const valueFontSize = fontSize * valueScale;
                    const changeFontSize = fontSize * changeScale;
                    if (fontSize >= 2 && valueFontSize >= 2 && changeFontSize >= 2) {
                        add(tile, 'text', {
                            x: x + (w - gap) / 2,
                            y: y + (h - gap) / 2 - fontSize * 0.68,
                            'text-anchor': 'middle', 'dominant-baseline': 'central',
                            'alignment-baseline': 'central',
                            class: 'market-tag', 'clip-path': `url(#${clipId})`,
                            'font-size': `${fontSize}px`
                        }, company.tag);
                        add(tile, 'text', {
                            x: x + (w - gap) / 2,
                            y: y + (h - gap) / 2 + fontSize * 0.12,
                            'text-anchor': 'middle', 'dominant-baseline': 'central',
                            'alignment-baseline': 'central',
                            class: 'market-value', 'clip-path': `url(#${clipId})`,
                            'font-size': `${valueFontSize}px`
                        }, valueLabel);
                        add(tile, 'text', {
                            x: x + (w - gap) / 2,
                            y: y + (h - gap) / 2 + fontSize * 0.72,
                            'text-anchor': 'middle', 'dominant-baseline': 'central',
                            'alignment-baseline': 'central',
                            class: 'market-change', 'clip-path': `url(#${clipId})`,
                            'font-size': `${changeFontSize}px`
                        }, changeText);
                    }
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

    function renderAll(snapshot) {
        const source = snapshot || (window.companyMarket ? window.companyMarket.getSnapshot() : window.marketData) || [];
        const companies = source.filter(company =>
            company && typeof company.name === 'string' && typeof company.tag === 'string' &&
            Number.isFinite(company.value) && company.value > 0
        ).sort((a, b) => b.value - a.value);
        if (!companies.length) return;
        document.querySelectorAll('.market-chart').forEach(plot => render(plot, companies));
    }

    renderAll();
    if (window.companyMarket) window.companyMarket.subscribe(renderAll, { immediate: false });
})();
