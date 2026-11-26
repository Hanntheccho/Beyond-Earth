// chart.js - Scenario chart renderer. Everything a chart shows comes from
// data/scenario-data.json (explained in data/scenario-data.md): name, short label,
// unit, axis bounds and trend direction from `series`, events and eras from
// `timeline`, and the values from `points`. One button and panel is built per series that has points.
// index.html only needs an empty <div class="div-win btn-strip" data-chart-buttons></div>
// (the tab strip, styled in src/css/controls.css and chart.css); the panels are
// inserted right after it.
//
// Events and eras are drawn in red by default. Add `"positive": true` to one in the
// timeline to draw it in green instead (the .is-positive class).
//
// Each chart is drawn the first time it comes into view (its panel is shown and
// scrolled to), so hidden charts cost nothing at startup.
//
// Animation: the series (areas, lines) sit in a group clipped by a rect
// that grows left to right (see .chart-reveal in src/css/chart.css). Event tags fade
// in as the reveal passes them, using the --p custom property (0 to 1 across
// the chart width). The delay and duration are set in src/css/chart.css;
// keep the two rules there in sync.
import { observeVisibility } from './viewport-visibility.js';
import { CHAR_WIDTH, SVG_NS, appendSvg as add } from './svg.js';
import scenario from '../../data/scenario-data.json' with { type: 'json' };

(function () {
    const pointsBySeries = scenario.points || {};
    const seriesMeta = scenario.series || {};
    const timeline = scenario.timeline || {};
    const baselineYear = Number.isFinite(timeline.baselineYear) ? timeline.baselineYear : 2070;
    const valueFormatter = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 });
    const changeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, signDisplay: 'always' });

    const PANEL_GROUP = 'charts';

    // Chart layout, in pixels. The plot area keeps CHART_MARGIN free on every side for
    // the axis labels and event tags. Text is placed by its vertical center
    // (dominant-baseline in src/css/chart.css).
    const CHART_MARGIN = 40;
    const AXIS_LABEL_GAP = 10;     // value labels' right edge, left of the plot area
    const YEAR_TICK_LENGTH = 5;    // year ticks below the plot area
    const YEAR_LABEL_GAP = 20;     // year labels' center, below the plot area
    const ERA_LABEL_GAP = 12;      // era labels' center, below the plot area's top
    // Event tags: TAG_PADDING is the room beside the label, split between both sides.
    const TAG_HEIGHT = 18;
    const TAG_PADDING = 12;

    // Value axis: GRID_STEPS spaces between its grid lines, and VALUE_PADDING of the
    // value range added above and below the data when the series sets no min or max.
    // Year axis: a tick every YEAR_STEP years, plus one at the last year.
    const GRID_STEPS = 4;
    const VALUE_PADDING = 0.12;
    const YEAR_STEP = 25;
    // Chart aspect ratio. The plot reserves it before its chart is drawn, so drawing
    // it later does not shift the page; the chart itself is drawn at the plot's size.
    const CHART_WIDTH = 2;
    const CHART_HEIGHT = 1;
    const sortedData = new Map();

    function metaFor(plot) {
        const key = plot.dataset.series;
        const meta = seriesMeta[key];
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

    function sortedPoints(key) {
        if (sortedData.has(key)) return sortedData.get(key);
        const points = pointsBySeries[key];
        const sorted = Array.isArray(points)
            ? points.filter(point => Number.isFinite(point.year) && Number.isFinite(point.value))
                .sort((a, b) => a.year - b.year)
            : [];
        sortedData.set(key, sorted);
        return sorted;
    }

    function renderSummary(plots) {
        const host = document.querySelector('[data-chart-summary]');
        if (!host) return;

        host.replaceChildren();
        plots.forEach(plot => {
            const meta = metaFor(plot);
            const sorted = sortedPoints(meta.key);
            if (!sorted.length) return;

            const row = document.createElement('div');
            row.className = 'ledger-row';
            const name = document.createElement('span');
            name.className = 'ledger-name';
            name.textContent = meta.name;
            const unit = document.createElement('span');
            unit.className = 'ledger-unit';
            unit.textContent = meta.unit;
            const value = document.createElement('span');
            value.className = 'ledger-value';
            value.textContent = valueFormatter.format(sorted.at(-1).value);
            const change = document.createElement('span');
            change.className = 'ledger-change';
            const baseline = sorted.find(point => point.year === baselineYear);
            if (baseline && baseline.value !== 0) {
                const delta = sorted.at(-1).value - baseline.value;
                const percentageChange = delta / Math.abs(baseline.value) * 100;
                change.textContent = changeFormatter.format(percentageChange);
                change.setAttribute('aria-label', `${change.textContent} percent change since ${baselineYear}`);
                const favorableChange = meta.trend === 'negative' ? -delta : delta;
                change.classList.toggle('is-positive', favorableChange >= 0);
                change.classList.toggle('is-negative', favorableChange < 0);
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

        // One SVG unit per CSS pixel: the chart is drawn at the plot's real size, so
        // margins, tags, strokes and text are real pixels instead of being scaled by CSS.
        // The height comes from the width and the aspect ratio rather than from layout,
        // so a plot measured mid-layout can never hand back a stretched height.
        const width = plot.clientWidth, height = Math.round(width * CHART_HEIGHT / CHART_WIDTH);
        if (!width || !height) return;
        const margin = { top: CHART_MARGIN, right: CHART_MARGIN, bottom: CHART_MARGIN, left: CHART_MARGIN };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        let min = Infinity, max = -Infinity;
        sorted.forEach(point => {
            min = Math.min(min, point.value);
            max = Math.max(max, point.value);
        });
        if (min === max) { min -= 1; max += 1; }
        const padding = (max - min) * VALUE_PADDING;
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
            return direction > 0 ? 'is-positive' : direction < 0 ? 'is-negative' : 'is-neutrale';
        };
        // Appends the green variant class when an event or era has `positive: true`.
        const positiveClass = item => (item.positive ? ' is-positive' : '');
        const firstYear = sorted[0].year;
        const lastYear = sorted.at(-1).year;
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('role', 'presentation');
        svg.setAttribute('aria-hidden', 'true');
        // In the page from the start, so the event tags can read their label's font size.
        plot.replaceChildren(svg);

        // Eras (shaded bands) from timeline.eras, optionally limited via `series`.
        const eras = (Array.isArray(timeline.eras) ? timeline.eras : [])
            .filter(era => !Array.isArray(era.series) || era.series.includes(meta.key));
        eras.forEach(era => {
            if (!(era.start < lastYear && era.end > firstYear)) return;
            const eraStart = Math.max(era.start, firstYear);
            const eraEnd = Math.min(era.end, lastYear);
            add(svg, 'rect', {
                x: x(eraStart), y: margin.top, width: x(eraEnd) - x(eraStart),
                height: innerHeight, class: `chart-era-band${positiveClass(era)}`
            });
        });

        for (let tick = 0; tick <= GRID_STEPS; tick++) {
            const value = max - (max - min) * tick / GRID_STEPS;
            const yy = y(value);
            add(svg, 'line', { x1: margin.left, x2: width - margin.right, y1: yy, y2: yy, class: 'chart-grid-line' });
            add(svg, 'text', { x: margin.left - AXIS_LABEL_GAP, y: yy, class: 'chart-axis-label' }, Number(value.toPrecision(3)).toString());
        }
        const plotBottom = height - margin.bottom;
        const yearTicks = [];
        for (let year = firstYear; year <= lastYear; year += YEAR_STEP) yearTicks.push(year);
        if (yearTicks[yearTicks.length - 1] !== lastYear) yearTicks.push(lastYear);
        yearTicks.forEach(year => {
            const xx = x(year);
            add(svg, 'line', { x1: xx, x2: xx, y1: plotBottom, y2: plotBottom + YEAR_TICK_LENGTH, class: 'chart-year-tick' });
            add(svg, 'text', { x: xx, y: plotBottom + YEAR_LABEL_GAP, class: 'chart-year-label' }, String(year));
        });

        // Events from timeline.events, optionally limited via `series`.
        const events = (Array.isArray(timeline.events) ? timeline.events : [])
            .filter(event => !Array.isArray(event.series) || event.series.includes(meta.key))
            .filter(event => Number.isFinite(event.year) && event.year >= firstYear && event.year <= lastYear)
            .sort((a, b) => a.year - b.year);

        // Era labels and boundaries (only when the whole era is in range).
        eras.forEach(era => {
            if (!(era.start >= firstYear && era.end <= lastYear)) return;
            add(svg, 'text', {
                x: (x(era.start) + x(era.end)) / 2, y: margin.top + ERA_LABEL_GAP,
                class: `chart-era-label${positiveClass(era)}`
            }, era.label || '');
            [era.start, era.end].forEach(year => {
                add(svg, 'line', {
                    x1: x(year), x2: x(year), y1: margin.top, y2: height - margin.bottom,
                    class: `chart-era-boundary${positiveClass(era)}`
                });
            });
        });

        // Reveal: everything in `seriesGroup` is clipped by a rect that grows left to
        // right via CSS. The clip covers the full viewBox so glows are not cut off.
        const clipId = `chart-reveal-${meta.key}`;
        const defs = add(svg, 'defs', {});
        const clip = add(defs, 'clipPath', { id: clipId });
        add(clip, 'rect', { x: 0, y: 0, width, height, class: 'chart-reveal' });
        const seriesGroup = add(svg, 'g', { 'clip-path': `url(#${clipId})` });

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
            add(seriesGroup, 'path', { d: segmentArea, class: `chart-series-area ${trendClass}` });
            add(seriesGroup, 'path', {
                d: `M ${previousPosition.x} ${previousPosition.y} L ${currentPosition.x} ${currentPosition.y}`,
                class: `chart-series-line ${trendClass}`
            });
        }
        sorted.forEach((point, index) => {
            const { x: px, y: py } = coordinates[index];
            const segmentIndex = index === 0 ? 1 : index;
            const previous = sorted[segmentIndex - 1];
            const current = sorted[segmentIndex];
            const pointTrendClass = previous && current
                ? trendClassForChange(current.value - previous.value)
                : 'is-neutrale';
            const dot = add(seriesGroup, 'circle', {
                cx: px, cy: py, class: `chart-series-point ${pointTrendClass}`
            });
            add(dot, 'title', {}, `${point.year}: ${point.value} ${meta.unit}`);
        });
        // Read from the first event label, so the tags follow the font size in chart.css.
        let labelFontSize = null;
        events.forEach(event => {
            const label = String(event.label || '');
            const eventX = x(event.year);
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
                class: `chart-event-group${positiveClass(event)}`,
                style: `--p:${(eventX / width).toFixed(3)}`
            });
            add(eventGroup, 'line', {
                x1: eventX, x2: eventX, y1: tagY + TAG_HEIGHT, y2: y(eventValue),
                class: 'chart-event-line'
            });
            const tag = add(eventGroup, 'rect', { y: tagY, height: TAG_HEIGHT, class: 'chart-event-tag' });
            const text = add(eventGroup, 'text', { y: tagY + TAG_HEIGHT / 2, class: 'chart-event-label' }, label);
            labelFontSize ??= parseFloat(getComputedStyle(text).fontSize);
            const tagWidth = label.length * CHAR_WIDTH * labelFontSize + TAG_PADDING;
            const tagX = Math.max(margin.left, Math.min(eventX - tagWidth / 2, width - margin.right - tagWidth));
            tag.setAttribute('x', tagX);
            tag.setAttribute('width', tagWidth);
            text.setAttribute('x', tagX + tagWidth / 2);
        });
    }

    // Build the button row and chart panels from the series, in key order.
    function buildChartUi() {
        const buttonHost = document.querySelector('[data-chart-buttons]');
        if (!buttonHost) return;

        const keys = Object.keys(seriesMeta).filter(key => sortedPoints(key).length);
        const buttons = [];
        const panels = [];
        keys.forEach((key, index) => {
            const id = `chart-${key}`;
            const active = index === 0;
            const name = seriesMeta[key].name || key;
            const points = sortedPoints(key);

            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.panelGroup = PANEL_GROUP;
            button.dataset.panelTarget = id;
            button.setAttribute('aria-pressed', String(active));
            // The short label is what the tab strip shows; the full name stays the
            // accessible name and the hover tooltip.
            const short = seriesMeta[key].short;
            button.textContent = short || name;
            if (short) {
                button.setAttribute('aria-label', name);
                button.title = name;
            }
            buttons.push(button);

            const panel = document.createElement('div');
            panel.className = 'div-win';
            panel.id = id;
            panel.dataset.panelGroup = PANEL_GROUP;
            panel.hidden = !active;
            panel.setAttribute('aria-hidden', String(!active));
            const plot = document.createElement('div');
            plot.className = 'chart-plot';
            plot.dataset.series = key;
            plot.setAttribute('role', 'img');
            plot.setAttribute('aria-label', `${name} chart, ${points[0].year} to ${points.at(-1).year}`);
            plot.style.aspectRatio = `${CHART_WIDTH} / ${CHART_HEIGHT}`;
            panel.append(plot);
            panels.push(panel);
        });
        buttonHost.replaceChildren(...buttons);
        buttonHost.after(...panels);
    }

    buildChartUi();
    const plots = [...document.querySelectorAll('.chart-plot[data-series]')];
    renderSummary(plots);
    plots.forEach(plot => {
        let drawnWidth = 0;
        const draw = () => {
            drawnWidth = plot.clientWidth;
            render(plot);
        };
        const stop = observeVisibility(plot, isVisible => {
            if (!isVisible) return;
            stop();
            draw();
            // Draws the chart again when the plot's width changes (this replays the
            // reveal); a hidden plot reports no width and is skipped.
            new ResizeObserver(() => {
                const width = plot.clientWidth;
                if (width && width !== drawnWidth) draw();
            }).observe(plot);
        });
    });
})();

