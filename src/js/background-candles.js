// background-candles.js - A faint decorative candlestick chart behind the globe.
// Purely decorative: it reads no data. Prices are a random walk with a slowly
// drifting trend, so the chart shows runs up and down instead of plain noise.
// Every LIVE_STEP_MS the newest candle moves (its close, high and low), and every
// STEPS_PER_CANDLE steps it closes and a new one opens on the right, and the row
// slides one candle left (CSS, see src/css/background-candles.css). The chart
// rescales to the candles on screen.
// Under reduced motion it only redraws when a candle closes, without the slide.
// Turned off from the options menu (body.vfx-off-candles, see
// display-options.js); while it is off, or the tab is hidden, nothing updates.
import { motionPreference } from './motion.js';
import { appendSvg } from './svg.js';

(function () {
    const layer = document.getElementById('background-candles');
    if (!layer) return;

    const CANDLE_COUNT = 48;
    const LIVE_STEP_MS = 250;
    const STEPS_PER_CANDLE = 8;
    // Random walk: each step moves the price by the drift plus up to VOLATILITY
    // either way. The drift keeps DRIFT_KEEP of itself each step and takes a random
    // kick of up to DRIFT_KICK, which is what makes the runs.
    const START_PRICE = 100;
    const VOLATILITY = 1;
    const DRIFT_KEEP = 0.95;
    const DRIFT_KICK = 0.15;
    // Layout, in viewBox units (the viewBox is VIEW_SIZE by VIEW_SIZE, stretched
    // over the viewport): VERTICAL_PADDING is the share of the height left empty
    // above and below the chart, BODY_WIDTH_RATIO the share of each candle's slot
    // its body fills, and MIN_BODY_HEIGHT keeps flat candles visible.
    const VIEW_SIZE = 100;
    const VERTICAL_PADDING = 0.2;
    const BODY_WIDTH_RATIO = 0.6;
    const MIN_BODY_HEIGHT = 0.2;

    const SLOT_WIDTH = VIEW_SIZE / CANDLE_COUNT;
    const BODY_WIDTH = SLOT_WIDTH * BODY_WIDTH_RATIO;

    // Candles oldest first: { open, high, low, close }. The last one is still live.
    const candles = [];
    let price = START_PRICE;
    let drift = 0;
    let steps = 0;

    function randomSigned(size) {
        return (Math.random() * 2 - 1) * size;
    }

    function openCandle() {
        candles.push({ open: price, high: price, low: price, close: price });
        if (candles.length > CANDLE_COUNT) candles.shift();
    }

    function step() {
        drift = drift * DRIFT_KEEP + randomSigned(DRIFT_KICK);
        price += drift + randomSigned(VOLATILITY);
        const live = candles[candles.length - 1];
        live.close = price;
        live.high = Math.max(live.high, price);
        live.low = Math.min(live.low, price);
    }

    // One reused group per slot, so a redraw only changes attributes.
    const row = appendSvg(layer, 'g', { class: 'background-candle-row' });
    const slots = Array.from({ length: CANDLE_COUNT }, (_, i) => {
        const group = appendSvg(row, 'g', { class: 'background-candle' });
        const center = (i + 0.5) * SLOT_WIDTH;
        return {
            group,
            wick: appendSvg(group, 'line', { class: 'background-candle-wick', x1: center, x2: center }),
            body: appendSvg(group, 'rect', {
                class: 'background-candle-body',
                x: center - BODY_WIDTH / 2,
                width: BODY_WIDTH
            })
        };
    });

    function draw(closed) {
        const low = Math.min(...candles.map(candle => candle.low));
        const high = Math.max(...candles.map(candle => candle.high));
        const range = high - low;
        const top = VIEW_SIZE * VERTICAL_PADDING;
        const height = VIEW_SIZE * (1 - 2 * VERTICAL_PADDING);
        const yOf = value => top + height * (range > 0 ? (high - value) / range : 0.5);

        slots.forEach((slot, i) => {
            const candle = candles[i];
            slot.group.style.display = candle ? '' : 'none';
            if (!candle) return;
            const bodyTop = yOf(Math.max(candle.open, candle.close));
            const bodyBottom = yOf(Math.min(candle.open, candle.close));
            slot.wick.setAttribute('y1', yOf(candle.high).toFixed(2));
            slot.wick.setAttribute('y2', yOf(candle.low).toFixed(2));
            slot.body.setAttribute('y', bodyTop.toFixed(2));
            slot.body.setAttribute('height', Math.max(MIN_BODY_HEIGHT, bodyBottom - bodyTop).toFixed(2));
            slot.group.classList.toggle('is-up', candle.close >= candle.open);
            slot.group.classList.toggle('is-down', candle.close < candle.open);
        });

        if (!closed || motionPreference.matches) return;

        // Start one slot to the right, then glide back into place. On an SVG
        // element, CSS px are viewBox units.
        row.classList.remove('is-sliding');
        row.style.transform = `translateX(${SLOT_WIDTH}px)`;
        void row.getBoundingClientRect();
        row.classList.add('is-sliding');
        row.style.transform = '';
    }

    function tick() {
        if (document.hidden || document.body.classList.contains('vfx-off-candles')) return;
        steps += 1;
        const closed = steps % STEPS_PER_CANDLE === 0;
        if (closed) openCandle();
        step();
        if (closed || !motionPreference.matches) draw(closed);
    }

    // Start with a full screen of history.
    for (let i = 0; i < CANDLE_COUNT; i++) {
        openCandle();
        for (let s = 0; s < STEPS_PER_CANDLE; s++) step();
    }
    draw(false);
    setInterval(tick, LIVE_STEP_MS);
})();
