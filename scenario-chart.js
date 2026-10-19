// Shared renderer: each .scenario-chart-plot names a data series and unit.
(function () {
    const datasets = window.scenarioChartData || {};
    const svgNS = 'http://www.w3.org/2000/svg';

    function add(svg, tag, attrs, text) {
        const element = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        if (text !== undefined) element.textContent = text;
        svg.append(element);
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
        const line = sorted.map((point, index) => `${index ? 'L' : 'M'} ${x(point.year)} ${y(point.value)}`).join(' ');
        add(svg, 'path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        sorted.forEach(point => {
            const px = x(point.year), py = y(point.value);
            add(svg, 'circle', { cx: px, cy: py, r: 5, fill: color });
            add(svg, 'text', { x: px, y: height - 18, 'text-anchor': 'middle' }, String(point.year));
        });
        add(svg, 'text', { x: margin.left, y: 17, fill: '#fff' }, `${series.replace(/[_-]+/g, ' ')} (${plot.dataset.unit || ''})`);
        plot.replaceChildren(svg);
    }

    document.querySelectorAll('.scenario-chart-plot[data-series]').forEach(render);
})();
