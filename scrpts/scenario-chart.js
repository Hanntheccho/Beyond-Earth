// Shared renderer: each .scenario-chart-plot names a data series and unit.
(function () {
    const datasets = window.scenarioChartData || {};
    const svgNS = 'http://www.w3.org/2000/svg';
    const seriesNames = {
        ecobalance: 'Global ecobalance',
        temperature: 'Global temperature',
        population: 'Global population',
        seaLevel: 'Sea level',
        cropYield: 'Crop yield',
        biodiversity: 'Biodiversity',
        freshwater: 'Freshwater availability',
        co2: 'Atmospheric CO₂',
        displaced: 'Displaced population',
        radiation: 'Radiation',
        airQuality: 'Air quality'
    };
    const valueFormatter = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 });
    const changeFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, signDisplay: 'always' });

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

        const width = 800, height = 400;
        const margin = { top: 40, right: 40, bottom: 40, left: 40 };
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
        const negativeTrend = plot.dataset.trend === 'negative';
        const trendClassForChange = change => {
            const direction = negativeTrend ? -change : change;
            return direction > 0 ? 'chart-trend-good' : direction < 0 ? 'chart-trend-bad' : 'chart-trend-flat';
        };
        const meta = document.createElement('div');
        meta.className = 'data-grid-row scenario-chart-meta';
        const nameLabel = document.createElement('span');
        nameLabel.className = 'data-grid-name';
        nameLabel.textContent = seriesNames[series] || series;
        const unitLabel = document.createElement('span');
        unitLabel.className = 'data-grid-unit';
        unitLabel.textContent = plot.dataset.unit || '';
        const valueLabel = document.createElement('span');
        valueLabel.className = 'data-grid-price';
        valueLabel.textContent = valueFormatter.format(sorted.at(-1).value);
        const changeLabel = document.createElement('span');
        changeLabel.className = 'data-grid-change';
        const greatMistakePoint = sorted.find(point => point.year === 2070);
        if (greatMistakePoint && greatMistakePoint.value !== 0) {
            const changeSinceGreatMistake = sorted.at(-1).value - greatMistakePoint.value;
            const percentageChange = changeSinceGreatMistake / Math.abs(greatMistakePoint.value) * 100;
            const formattedChange = changeFormatter.format(percentageChange);
            changeLabel.textContent = formattedChange;
            changeLabel.setAttribute('aria-label', `${formattedChange} percent change since 2070`);
            changeLabel.classList.add(trendClassForChange(changeSinceGreatMistake));
        } else {
            changeLabel.textContent = 'N/A';
            changeLabel.setAttribute('aria-label', 'Change since 2070 unavailable');
            changeLabel.classList.add('chart-trend-flat');
        }
        meta.append(nameLabel, unitLabel, valueLabel, changeLabel);
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
            add(svg, 'text', { x: margin.left - 10, y: yy + 4, class: 'chart-axis-label' }, Number(value.toPrecision(3)).toString());
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
            label.setAttribute('class', 'year-label');
            label.textContent = String(year);
            svg.append(label);
        });
        const eventYear = 2070;
        if (eventYear >= firstYear && eventYear <= lastYear) {
            const eventX = x(eventYear);
            add(svg, 'line', { x1: eventX, x2: eventX, y1: margin.top - 12, y2: height - margin.bottom, class: 'chart-event-line' });
            const tagWidth = 122, tagHeight = 18;
            const tagX = Math.max(margin.left, Math.min(eventX - tagWidth / 2, width - margin.right - tagWidth));
            add(svg, 'rect', { x: tagX, y: margin.top - 18, width: tagWidth, height: tagHeight, rx: 3, class: 'chart-event-tag' });
            add(svg, 'text', { x: tagX + tagWidth / 2, y: margin.top - 6, class: 'chart-event-label' }, 'GREAT MISTAKE');
        }
        if (era.start >= firstYear && era.end <= lastYear) {
            const eraX = (x(era.start) + x(era.end)) / 2;
            add(svg, 'text', {
                x: eraX, y: margin.top + 16, class: 'chart-era-label'
            }, era.label);
            add(svg, 'line', {
                x1: x(era.end), x2: x(era.end), y1: margin.top, y2: height - margin.bottom,
                class: 'chart-era-boundary'
            });
        }
        const baseline = height - margin.bottom;
        for (let index = 1; index < sorted.length; index++) {
            const previous = sorted[index - 1], current = sorted[index];
            const trendClass = trendClassForChange(current.value - previous.value);
            const segmentArea = [
                `M ${x(previous.year)} ${y(previous.value)}`,
                `L ${x(current.year)} ${y(current.value)}`,
                `L ${x(current.year)} ${baseline}`,
                `L ${x(previous.year)} ${baseline}`,
                'Z'
            ].join(' ');
            add(svg, 'path', { d: segmentArea, class: `chart-series-area ${trendClass}` });
            add(svg, 'path', {
                d: `M ${x(previous.year)} ${y(previous.value)} L ${x(current.year)} ${y(current.value)}`,
                class: `chart-series-line ${trendClass}`
            });
        }
        sorted.forEach((point, index) => {
            const px = x(point.year), py = y(point.value);
            const segmentIndex = index === 0 ? 1 : index;
            const previous = sorted[segmentIndex - 1];
            const current = sorted[segmentIndex];
            const pointTrendClass = previous && current
                ? trendClassForChange(current.value - previous.value)
                : 'chart-trend-flat';
            const dot = add(svg, 'circle', {
                cx: px, cy: py, class: `chart-series-point ${pointTrendClass}`
            });
            add(dot, 'title', {}, `${point.year}: ${point.value} ${plot.dataset.unit || ''}`);
        });
        plot.replaceChildren(svg);
    }

    document.querySelectorAll('.scenario-chart-plot[data-series]').forEach(render);
})();
