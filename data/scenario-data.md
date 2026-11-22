# Scenario data

`scenario-data.json` holds the fictional global indicators behind the scenario charts. The values are narrative estimates, not model output, and pre-modern values are especially approximate. The dip after the Great Mistake represents temporary nuclear-winter cooling, followed by recovery as ash settles.

`src/js/chart.js` draws one chart per series that has points. `src/js/globe-sea-level.js` also reads the `seaLevel` points for the globe's year slider.

## series

One entry per indicator, keyed by series id.

- `name`: label on the chart button and in the summary grid
- `unit`: unit shown in tooltips and the summary grid
- `trend`: `"positive"` (higher is better, the default) or `"negative"` (higher is worse). It decides which changes are drawn green and which red.
- `min` / `max`: optional fixed y-axis bounds

## timeline

- `baselineYear`: the summary grid shows each series' change since this year. A series without a point in that year shows N/A.
- `events`: a `year` and a `label`, plus these optional fields:
  - `series`: a list of series ids, to show the event on those charts only
  - `y`: moves the tag, in chart pixels. Positive moves it down, negative moves it up, and 0 or no `y` keeps it just above the plot.
  - `positive`: `true` draws the event in green instead of red
- `eras`: a `start`, an `end` and a `label`, plus the same optional `series` and `positive`. "AoP" is the Age of Plenty.

## points

One list of `{ "year", "value" }` points per series id, in any order (the chart sorts them).

- From the Antarctic Collapse on, `seaLevel` follows the ice lost since then, in proportion to the drop in `iceVolume`, so it slows and settles as the ice sheets do.
- The last `seaLevel` value should equal `DEFAULT_SEA_LEVEL` in `src/js/globe.js`, which the globe uses when there is no slider.
- `seaLevel` must never go below 0, or the flattened ocean in `data/elev-1080.webp` would show (see `tools/make-elevation-webp.py`).

