// Shared renderer. The chart buttons and panels are generated from
// window.scenarioSeries (one per series that has data), and everything about
// a chart (name, unit, axis bounds, trend direction) comes from
// window.scenarioSeries / window.scenarioConfig in scenario-data.js.
// index.html only needs an empty <div class="div-desc-win grid" data-scenario-buttons></div>;
// the panels are inserted right after it.
//
// Animation: the series (areas, lines) sit in a group clipped by a rect
// that grows left to right (see .chart-reveal in default.css). Event tags fade
// in as the reveal passes them, using the --p custom property (0 to 1 across
// the chart width). The delay and duration are set in default.css;
// keep the two rules there in sync..
(function () {
    const datasets = window.scenarioChartData || {};
    const seriesMeta = window.scenarioSeries || {};
    const config = window.scenarioConfig || {};
    const baselineYear = Number.isFinite(config.baselineYear) ? config.baselineYear : 2070;
    const svgNS = 'http://www.w3.org/2000/svg';
    const valueFormatter = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 });
    const changeFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, signDisplay: 'always' });

    const TAG_HEIGHT = 18;
    const PANEL_GROUP = 'mit-charts';
    const sortedData = new Map();

    function add(svg, tag, attrs, text) {
        const element = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        if (text !== undefined) element.textContent = text;
        svg.append(element);
        return element;
    }

    function metaFor(plot) {
        const key = plot.dataset.series;
        const meta = seriesMeta[key];
        if (!meta) console.warn(`No scenarioSeries metadata for "${key}".`);
        const safe = meta || {};
        return {
            key,
            name: safe.name || key,
            unit: safe.unit || '',
            trend: safe.trend || 'positive',
            min: Number.isFinite(safe.min) ? safe.min : undefined,
            max: Number.isFinite(safe.max) ? safe.max : undefined
        };
    }

    function sortedPoints(series) {
        if (sortedData.has(series)) return sortedData.get(series);
        const points = datasets[series];
        const sorted = Array.isArray(points)
            ? points.filter(point => Number.isFinite(point.year) && Number.isFinite(point.value))
                .sort((a, b) => a.year - b.year)
            : [];
        sortedData.set(series, sorted);
        return sorted;
    }

    function renderSummary(plots) {
        const host = document.querySelector('[data-scenario-summary]');
        if (!host) return;

        host.replaceChildren();
        plots.forEach(plot => {
            const meta = metaFor(plot);
            const sorted = sortedPoints(meta.key);
            if (!sorted.length) return;

            const row = document.createElement('div');
            row.className = 'data-grid-row';
            const name = document.createElement('span');
            name.className = 'data-grid-name';
            name.textContent = meta.name;
            const unit = document.createElement('span');
            unit.className = 'data-grid-unit';
            unit.textContent = meta.unit;
            const value = document.createElement('span');
            value.className = 'data-grid-value';
            value.textContent = valueFormatter.format(sorted.at(-1).value);
            const change = document.createElement('span');
            change.className = 'data-grid-change';
            const baseline = sorted.find(point => point.year === baselineYear);
            if (baseline && baseline.value !== 0) {
                const delta = sorted.at(-1).value - baseline.value;
                const percentageChange = delta / Math.abs(baseline.value) * 100;
                change.textContent = changeFormatter.format(percentageChange);
                change.setAttribute('aria-label', `${change.textContent} percent change since ${baselineYear}`);
                const favorableChange = meta.trend === 'negative' ? -delta : delta;
                change.classList.toggle('is-up', favorableChange >= 0);
                change.classList.toggle('is-down', favorableChange < 0);
            } else {
                change.textContent = 'N/A';
                change.setAttribute('aria-label', `Change since ${baselineYear} unavailable`);
            }
            row.append(name, unit, value, change);
            host.append(row);
        });
    }

    function render(plot) {
        const meta = metaFor(plot);
        const sorted = sortedPoints(meta.key);
        if (!sorted.length) return;

        const width = 800, height = 400;
        const margin = { top: 40, right: 40, bottom: 40, left: 40 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        let min = Infinity, max = -Infinity;
        sorted.forEach(point => {
            min = Math.min(min, point.value);
            max = Math.max(max, point.value);
        });
        if (min === max) { min -= 1; max += 1; }
        const padding = (max - min) * 0.12;
        if (meta.min !== undefined) min = meta.min;
        else min -= padding;
        if (meta.max !== undefined) max = meta.max;
        else max += padding;
        const x = year => margin.left + ((year - sorted[0].year) / ((sorted.at(-1).year - sorted[0].year) || 1)) * innerWidth;
        const y = value => margin.top + ((max - value) / (max - min)) * innerHeight;
        const coordinates = sorted.map(point => ({ x: x(point.year), y: y(point.value) }));
        const negativeTrend = meta.trend === 'negative';
        const trendClassForChange = change => {
            const direction = negativeTrend ? -change : change;
            return direction > 0 ? 'chart-trend-good' : direction < 0 ? 'chart-trend-bad' : 'chart-trend-flat';
        };
        const firstYear = sorted[0].year;
        const lastYear = sorted[sorted.length - 1].year;
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('role', 'presentation');
        svg.setAttribute('aria-hidden', 'true');

        // Eras (shaded bands) from scenarioConfig.eras, optionally limited via `series`.
        const eras = (Array.isArray(config.eras) ? config.eras : [])
            .filter(era => !Array.isArray(era.series) || era.series.includes(meta.key));
        eras.forEach(era => {
            if (!(era.start < lastYear && era.end > firstYear)) return;
            const eraStart = Math.max(era.start, firstYear);
            const eraEnd = Math.min(era.end, lastYear);
            add(svg, 'rect', {
                x: x(eraStart), y: margin.top, width: x(eraEnd) - x(eraStart),
                height: innerHeight, class: 'chart-era-band'
            });
        });

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

        // Events from scenarioConfig.events, optionally limited via `series`.
        const events = (Array.isArray(config.events) ? config.events : [])
            .filter(event => !Array.isArray(event.series) || event.series.includes(meta.key))
            .filter(event => Number.isFinite(event.year) && event.year >= firstYear && event.year <= lastYear)
            .sort((a, b) => a.year - b.year);

        // Era labels and boundaries (only when the whole era is in range).
        eras.forEach(era => {
            if (!(era.start >= firstYear && era.end <= lastYear)) return;
            add(svg, 'text', {
                x: (x(era.start) + x(era.end)) / 2, y: margin.top + 16, class: 'chart-era-label'
            }, era.label || '');
            [era.start, era.end].forEach(year => {
                add(svg, 'line', {
                    x1: x(year), x2: x(year), y1: margin.top, y2: height - margin.bottom,
                    class: 'chart-era-boundary'
                });
            });
        });

        // Reveal: everything in `series` is clipped by a rect that grows left to
        // right via CSS. The clip covers the full viewBox so glows are not cut off.
        const clipId = `chart-reveal-${meta.key}`;
        const defs = add(svg, 'defs', {});
        const clip = add(defs, 'clipPath', { id: clipId });
        add(clip, 'rect', { x: 0, y: 0, width, height, class: 'chart-reveal' });
        const series = add(svg, 'g', { 'clip-path': `url(#${clipId})` });

        const baseline = height - margin.bottom;
        for (let index = 1; index < sorted.length; index++) {
            const previous = sorted[index - 1], current = sorted[index];
            const previousPosition = coordinates[index - 1], currentPosition = coordinates[index];
            const trendClass = trendClassForChange(current.value - previous.value);
            const segmentArea = [
                `M ${previousPosition.x} ${previousPosition.y}`,
                `L ${currentPosition.x} ${currentPosition.y}`,
                `L ${currentPosition.x} ${baseline}`,
                `L ${previousPosition.x} ${baseline}`,
                'Z'
            ].join(' ');
            add(series, 'path', { d: segmentArea, class: `chart-series-area ${trendClass}` });
            add(series, 'path', {
                d: `M ${previousPosition.x} ${previousPosition.y} L ${currentPosition.x} ${currentPosition.y}`,
                class: `chart-series-line ${trendClass}`
            });
        }
        events.forEach(event => {
            const label = String(event.label || '');
            const eventX = x(event.year);
            const tagWidth = Math.max(56, label.length * 6.6 + 16);
            const tagX = Math.max(margin.left, Math.min(eventX - tagWidth / 2, width - margin.right - tagWidth));
            // Default tag sits just above the plot; `y` shifts it down (positive) or up (negative).
            const tagY = margin.top - TAG_HEIGHT + (Number.isFinite(event.y) ? event.y : 0);
            const rightIndex = sorted.findIndex(point => point.year >= event.year);
            const right = sorted[rightIndex];
            const left = right.year === event.year ? right : sorted[rightIndex - 1];
            const eventValue = right.year === event.year
                ? right.value
                : left.value + (event.year - left.year) / (right.year - left.year) * (right.value - left.value);
            // --p is how far across the chart the event sits (0 to 1); CSS uses it
            // to delay the fade so the tag appears as the reveal reaches it.
            const eventGroup = add(svg, 'g', {
                class: 'chart-event-group',
                style: `--p:${(eventX / width).toFixed(3)}`
            });
            add(eventGroup, 'line', {
                x1: eventX, x2: eventX, y1: tagY + TAG_HEIGHT, y2: y(eventValue),
                class: 'chart-event-line'
            });
            add(eventGroup, 'rect', { x: tagX, y: tagY, width: tagWidth, height: TAG_HEIGHT, rx: 3, class: 'chart-event-tag' });
            add(eventGroup, 'text', { x: tagX + tagWidth / 2, y: tagY + TAG_HEIGHT - 6, class: 'chart-event-label' }, label);
        });
        plot.replaceChildren(svg);
    }

    // Build the button row and chart panels from scenarioSeries, in key order.
    function buildChartUi() {
        const buttonHost = document.querySelector('[data-scenario-buttons]');
        if (!buttonHost) return;

        const keys = Object.keys(seriesMeta).filter(key => sortedPoints(key).length);
        const buttons = [];
        const panels = [];
        keys.forEach((key, index) => {
            const id = `chart-${key}`;
            const active = index === 0;

            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.panelGroup = PANEL_GROUP;
            button.dataset.panelTarget = id;
            button.setAttribute('aria-pressed', String(active));
            button.textContent = seriesMeta[key].name || key;
            buttons.push(button);

            const panel = document.createElement('div');
            panel.className = 'div-desc-win';
            panel.id = id;
            panel.dataset.panelGroup = PANEL_GROUP;
            panel.hidden = !active;
            panel.setAttribute('aria-hidden', String(!active));
            const plot = document.createElement('div');
            plot.className = 'scenario-chart-plot';
            plot.dataset.series = key;
            plot.setAttribute('role', 'img');
            panel.append(plot);
            panels.push(panel);
        });
        buttonHost.replaceChildren(...buttons);
        buttonHost.after(...panels);
    }

    buildChartUi();
    const plots = [...document.querySelectorAll('.scenario-chart-plot[data-series]')];
    plots.forEach(render);
    renderSummary(plots);
})();
