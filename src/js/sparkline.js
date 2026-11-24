// sparkline.js - Small history sparklines shared by the ledgers (ledger.js) and the
// ticker (ticker.js): a faint area under the history with its line on top, colored by
// the trend through is-positive / is-negative. Points are set once per feed tick,
// never per frame.
import { appendSvg as add } from './svg.js';

// Sparkline viewBox: only the coordinate space the points are computed in, kept at the
// standard aspect ratio. preserveAspectRatio="none" lets CSS set the visible size; the
// svg's overflow is visible there, so the stroke at the peak and the low is not clipped.
const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 50;

// Line points for a history, scaled to fill a width x height box from the bottom up.
function linePoints(history, width, height) {
    if (!Array.isArray(history) || history.length < 2) return '';
    const min = Math.min(...history);
    const range = Math.max(...history) - min || 1;
    const step = width / (history.length - 1);
    return history.map((value, index) =>
        `${(index * step).toFixed(1)},${(height - (value - min) / range * height).toFixed(1)}`
    ).join(' ');
}

// The area under a line: the line closed down to the bottom corners of its box.
function areaPoints(points, width, height) {
    return points ? `${points} ${width},${height} 0,${height}` : '';
}

// Appends an empty sparkline to parent. className names the svg; its area and line get
// className-area and className-line.
export function createSparkline(parent, className) {
    const svg = add(parent, 'svg', {
        class: className,
        viewBox: `0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`,
        preserveAspectRatio: 'none',
        'aria-hidden': 'true'
    });
    const area = add(svg, 'polygon', { class: `${className}-area` });
    const line = add(svg, 'polyline', { class: `${className}-line` });
    return { svg, area, line };
}

// Redraws a sparkline from a history and colors it by the trend direction.
export function updateSparkline(spark, history, up) {
    const points = linePoints(history, SPARK_WIDTH, SPARK_HEIGHT);
    spark.line.setAttribute('points', points);
    spark.area.setAttribute('points', areaPoints(points, SPARK_WIDTH, SPARK_HEIGHT));
    spark.svg.classList.toggle('is-positive', up);
    spark.svg.classList.toggle('is-negative', !up);
}
