# Background candles: design

## Intent
Purely decorative: a faint candlestick chart behind the globe and the main panel that makes the page feel alive. It reads no data. It fails if it draws attention to itself or costs noticeable performance.

Revised from the first version, which drew lines from the live simulation feeds: after tuning it by hand, the user preferred decoration with no link to the data, styled as candlesticks for more character and motion.

## Approaches
- **A. SVG layer with a light timer (chosen).** A fixed full-screen `<svg>` with one reused group per candle. Only attributes change on each step. It reuses `svg.js` and takes its colors from the CSS tokens.
- **B. Canvas with its own animation loop.** The smoothest motion, but it redraws every frame next to the globe and has to handle theme colors and pausing by hand. Too heavy for decoration.
- **C. Drawing inside the globe's WebGL scene.** It would tie decoration to the globe's renderer for no visual gain. Dropped.

## Design
- **Prices:** a random walk with a slowly drifting trend, so the chart shows runs up and down rather than plain noise. It is seeded with a full screen of candles at load.
- **Motion:** on a short timer the newest candle moves (close, high, low). After a set number of steps it closes and a new candle opens on the right. The row slides one candle left. The chart rescales to the candles on screen.
- **Look:** rising candles are hollow in `--clr-positive`, falling ones filled in `--clr-negative`, at low opacity, with no labels or axes. The light theme works through the tokens.
- **Reduced motion** (`motionPreference`, `reduced-motion.css`): the chart redraws only when a candle closes, with no slide.
- **Cost:** the `viewBox` is stretched (`preserveAspectRatio="none"`) and strokes use `vector-effect: non-scaling-stroke`, so there is no resize handling. Steps are skipped while the tab is hidden or the layer is off.
- **Off switch:** a "CANDLES" checkbox in Options using `data-vfx-toggle="candles"` (`body.vfx-off-candles`, saved by `display-options.js`).
- **Layer:** placed before `#background-stage`, above the body background art and below the globe.

## Files
`src/js/background-candles.js` and `src/css/background-candles.css`. Edits to `index.html` (the svg, the stylesheet link, the Options row), `src/css/reduced-motion.css` and `src/default.js`.

## Left to the builder
Candle count, step timing, volatility, opacity and slide duration, set as named constants and tuned by eye.
