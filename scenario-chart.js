// Shared renderer: each .scenario-chart-plot names a data series and unit.
(function () {
    const datasets = window.scenarioChartData || {};
    const svgNS = 'http://www.w3.org/2000/svg';

    function add(svg, tag, attrs, text) {
        const element = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        if (text !== undefined) element.textContent = text;
        svg.append(element);
        return element;
    }

    function render(plot) {
        const series = plot.dataset.series;
        const points = datasets[series];
        if (!Array.isArray(points) || !points.length) return;

        const sorted = points.filter(point => Number.isFinite(point.year) && Number.isFinite(point.value))
            .sort((a, b) => a.year - b.year);
        if (!sorted.length) return;

        const width = 800, height = 360;
        const margin = { top: 28, right: 28, bottom: 48, left: 64 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        let min = Math.min(...sorted.map(point => point.value));
        let max = Math.max(...sorted.map(point => point.value));
        if (min === max) { min -= 1; max += 1; }
        const padding = (max - min) * 0.12;
        min -= padding;
        max += padding;
        const x = year => margin.left + ((year - sorted[0].year) / ((sorted.at(-1).year - sorted[0].year) || 1)) * innerWidth;
        const y = value => margin.top + ((max - value) / (max - min)) * innerHeight;
        const color = plot.dataset.color || '#d9a441';

        const meta = document.createElement('div');
        meta.className = 'scenario-chart-meta';
        meta.style.setProperty('--chart-accent', color);
        const metric = document.createElement('span');
        metric.className = 'scenario-chart-kpi';
        const yearLabel = document.createElement('span');
        yearLabel.textContent = `${sorted[sorted.length - 1].year} outlook`;
        const valueLabel = document.createElement('strong');
        valueLabel.textContent = `${Number(sorted[sorted.length - 1].value.toPrecision(4))} ${plot.dataset.unit || ''}`;
        metric.append(yearLabel, valueLabel);
        meta.append(metric);
        plot.before(meta);

        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('role', 'presentation');
        svg.setAttribute('aria-hidden', 'true');
        for (let tick = 0; tick <= 4; tick++) {
            const value = max - (max - min) * tick / 4;
            const yy = y(value);
            add(svg, 'line', { x1: margin.left, x2: width - margin.right, y1: yy, y2: yy, stroke: '#383838', 'stroke-width': 1 });
            add(svg, 'text', { x: margin.left - 10, y: yy + 4, 'text-anchor': 'end' }, Number(value.toPrecision(3)).toString());
        }
        const firstYear = sorted[0].year;
        const lastYear = sorted[sorted.length - 1].year;
        const yearTicks = [];
        for (let year = firstYear; year <= lastYear; year += 25) yearTicks.push(year);
        if (yearTicks[yearTicks.length - 1] !== lastYear) yearTicks.push(lastYear);
        yearTicks.forEach(year => {
            const xx = x(year);
            add(svg, 'line', { x1: xx, x2: xx, y1: height - margin.bottom, y2: height - margin.bottom + 5, stroke: '#888', 'stroke-width': 1 });
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', xx);
            label.setAttribute('y', height - 15);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('class', 'year-label');
            label.textContent = String(year);
            svg.append(label);
        });
        const eventYear = 2070;
        if (eventYear >= firstYear && eventYear <= lastYear) {
            const eventX = x(eventYear);
            add(svg, 'line', { x1: eventX, x2: eventX, y1: margin.top, y2: height - margin.bottom, stroke: '#ff3333', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' });
            const tagWidth = 132, tagHeight = 18;
            const tagX = Math.max(margin.left, Math.min(eventX - tagWidth / 2, width - margin.right - tagWidth));
            add(svg, 'rect', { x: tagX, y: margin.top + -7, width: tagWidth, height: tagHeight, rx: 3, fill: '#2a1111', stroke: '#ff3333', 'stroke-width': 0.8 });
            add(svg, 'text', { x: tagX + tagWidth / 2, y: margin.top + 6, 'text-anchor': 'middle', class: 'chart-event-label' }, '2070 · GREAT MISTAKE');
        }
        for (let index = 1; index < sorted.length; index++) {
            const previous = sorted[index - 1], current = sorted[index];
            add(svg, 'path', {
                d: `M ${x(previous.year)} ${y(previous.value)} L ${x(current.year)} ${y(current.value)}`,
                fill: 'none', stroke: color, 'stroke-width': 2.5,
                'stroke-linecap': 'round', 'stroke-linejoin': 'round'
            });
        }
        sorted.forEach(point => {
            const px = x(point.year), py = y(point.value);
            const dot = add(svg, 'circle', { cx: px, cy: py, r: 4, fill: color, stroke: '#17191c', 'stroke-width': 1.5 });
            add(dot, 'title', {}, `${point.year}: ${point.value} ${plot.dataset.unit || ''}`);
        });
        plot.replaceChildren(svg);
    }

    document.querySelectorAll('.scenario-chart-plot[data-series]').forEach(render);
})();
