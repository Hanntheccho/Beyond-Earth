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
        const margin = { top: 20, right: 28, bottom: 48, left: 64 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        let min = Math.min(...sorted.map(point => point.value));
        let max = Math.max(...sorted.map(point => point.value));
        if (min === max) { min -= 1; max += 1; }
        const padding = (max - min) * 0.12;
        const fixedMin = Number(plot.dataset.min);
        const fixedMax = Number(plot.dataset.max);
        if (Number.isFinite(fixedMin)) min = fixedMin;
        else min -= padding;
        if (Number.isFinite(fixedMax)) max = fixedMax;
        else max += padding;
        const x = year => margin.left + ((year - sorted[0].year) / ((sorted.at(-1).year - sorted[0].year) || 1)) * innerWidth;
        const y = value => margin.top + ((max - value) / (max - min)) * innerHeight;
        const color = plot.dataset.color || '#d94141';
        plot.style.setProperty('--chart-accent', color);
        plot.style.setProperty('--chart-accent', color);

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

        const firstYear = sorted[0].year;
        const lastYear = sorted[sorted.length - 1].year;
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('role', 'presentation');
        svg.setAttribute('aria-hidden', 'true');
        const era = { start: 2070, end: 2100, label: 'DARK AGE' };
        if (era.start < lastYear && era.end > firstYear) {
            const eraStart = Math.max(era.start, firstYear);
            const eraEnd = Math.min(era.end, lastYear);
            add(svg, 'rect', {
                x: x(eraStart), y: margin.top, width: x(eraEnd) - x(eraStart),
                height: innerHeight, class: 'chart-era-band'
            });
        }
        for (let tick = 0; tick <= 4; tick++) {
            const value = max - (max - min) * tick / 4;
            const yy = y(value);
            add(svg, 'line', { x1: margin.left, x2: width - margin.right, y1: yy, y2: yy, class: 'chart-grid-line' });
            add(svg, 'text', { x: margin.left - 10, y: yy + 4, 'text-anchor': 'end' }, Number(value.toPrecision(3)).toString());
        }
        const yearTicks = [];
        for (let year = firstYear; year <= lastYear; year += 25) yearTicks.push(year);
        if (yearTicks[yearTicks.length - 1] !== lastYear) yearTicks.push(lastYear);
        yearTicks.forEach(year => {
            const xx = x(year);
            add(svg, 'line', { x1: xx, x2: xx, y1: height - margin.bottom, y2: height - margin.bottom + 5, class: 'chart-year-tick' });
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
            add(svg, 'line', { x1: eventX, x2: eventX, y1: margin.top - 12, y2: height - margin.bottom, class: 'chart-event-line' });
            const tagWidth = 100, tagHeight = 18;
            const tagX = Math.max(margin.left, Math.min(eventX - tagWidth / 2, width - margin.right - tagWidth));
            add(svg, 'rect', { x: tagX, y: margin.top - 18, width: tagWidth, height: tagHeight, rx: 3, class: 'chart-event-tag' });
            add(svg, 'text', { x: tagX + tagWidth / 2, y: margin.top - 5, 'text-anchor': 'middle', class: 'chart-event-label' }, 'GREAT MISTAKE');
        }
        if (era.start >= firstYear && era.end <= lastYear) {
            const eraX = (x(era.start) + x(era.end)) / 2;
            add(svg, 'text', {
                x: eraX, y: margin.top + 16, 'text-anchor': 'middle', class: 'chart-era-label'
            }, era.label);
            add(svg, 'line', {
                x1: x(era.end), x2: x(era.end), y1: margin.top, y2: height - margin.bottom,
                class: 'chart-era-boundary'
            });
        }
        const baseline = height - margin.bottom;
        const areaPath = [
            `M ${x(sorted[0].year)} ${baseline}`,
            ...sorted.map(point => `L ${x(point.year)} ${y(point.value)}`),
            `L ${x(sorted[sorted.length - 1].year)} ${baseline}`,
            'Z'
        ].join(' ');
        add(svg, 'path', { d: areaPath, class: 'chart-series-area' });
        for (let index = 1; index < sorted.length; index++) {
            const previous = sorted[index - 1], current = sorted[index];
            add(svg, 'path', {
                d: `M ${x(previous.year)} ${y(previous.value)} L ${x(current.year)} ${y(current.value)}`,
                class: 'chart-series-line'
            });
        }
        sorted.forEach(point => {
            const px = x(point.year), py = y(point.value);
            const dot = add(svg, 'circle', { cx: px, cy: py, class: 'chart-series-point' });
            add(dot, 'title', {}, `${point.year}: ${point.value} ${plot.dataset.unit || ''}`);
        });
        plot.replaceChildren(svg);
    }

    document.querySelectorAll('.scenario-chart-plot[data-series]').forEach(render);
})();
