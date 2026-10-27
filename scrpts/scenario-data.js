// Fictional interpretation of the scenario's global indicators.
// Pre-modern values are especially approximate. The dip after 2070 represents
// temporary nuclear-winter cooling, followed by recovery as ash settles.
// These are narrative estimates, not model output. Population and displacement
// use billions of people; crop yield is an index (2020 = 100); sea level is
// relative to 1900. Biodiversity is an index (1950 = 100), and freshwater is
// renewable freshwater availability per person. The 50 m sea-level endpoint
// and later trajectories are intentional extreme fiction. Radiation uses an
// approximate 3.0 mSv/year natural-background baseline; the post-2070 fallout
// pulse is a fictional global average, not a model of local exposure. Air
// quality is represented by fictional annual mean PM2.5 concentration in µg/m³.
// Ecobalance is an invented 0–100 index: 100 is near-optimal balance and 0 is
// ecological collapse, adapting Müninstek's local LED concept to a global scale.
//
// Ice sheet volume is Greenland + Antarctica grounded ice, in million km³.
// Real-world values (through ~2020) are almost flat, because even record
// mass loss (~7,500 Gt since 1992, per IMBIE) is a rounding error against
// ~29.3 million km³. From 2030 the fiction takes over and is deliberately
// kept consistent with the sea-level series (1 m of sea level ≈ 0.39 million
// km³ of ice, with the remainder of the rise from thermal expansion and
// mountain glaciers).
//
// World GDP is in trillions of US dollars at constant 2015 prices through the
// real-world period (World Bank-style series; pre-1960 values are rough
// Maddison-based conversions). After 2070 the scenario crash is fictional and
// the 2200 endpoint matches the 71,670 (€$B) total in gdp-data.json.
//
// ---------------------------------------------------------------------------
// Per-series metadata. The chart renderer reads everything about a series from
// here (label, unit, axis bounds, trend direction). HTML panels
// only need data-series; they no longer carry data-unit/min/max/trend.
//
//   name   : label shown in the summary grid
//   unit   : unit shown in tooltips and the summary grid
//   trend  : 'positive' (higher = better, default) or 'negative' (higher = worse)
//   min/max: optional fixed y-axis bounds
// ---------------------------------------------------------------------------
window.scenarioSeries = {
    ecobalance: { name: 'Ecobalance', unit: 'index / 100', min: 0, max: 100 },
    temperature: { name: 'Surface Temperature', unit: '°C', trend: 'negative' },
    population: { name: 'Population', unit: 'billion', min: 0 },
    seaLevel: { name: 'Sea Level', unit: 'meters', trend: 'negative', min: 0 },
    cropYield: { name: 'Crop Yield', unit: 'index', min: 0 },
    biodiversity: { name: 'Biodiversity', unit: 'index', min: 0 },
    co2: { name: 'Atmospheric CO₂', unit: 'ppm', trend: 'negative' },
    displaced: { name: 'Displaced Population', unit: 'billion', trend: 'negative', min: 0 },
    radiation: { name: 'Background Radiation', unit: 'mSv', trend: 'negative', min: 0 },
    airQuality: { name: 'Particulate PM2.5', unit: 'µg/m³', trend: 'negative', min: 0 },
    iceSheet: { name: 'Ice Sheet', unit: 'million km³', min: 0 },
    arableLand: { name: 'Arable Land', unit: 'million km²', min: 0 },
    lifeExpectancy: { name: 'Life Expectancy', unit: 'years', min: 0 },
    internetAvailability: { name: 'Internet Availability', unit: '% of population', min: 0, max: 100 }
};

// ---------------------------------------------------------------------------
// Add `series: ['seaLevel', 'iceSheet']` to an event or era to limit it to some charts.
// Events also take an optional `y` (chart pixels): positive moves the tag down,
// negative moves it up; 0 or omitted keeps it just above the plot.
// ---------------------------------------------------------------------------
window.scenarioConfig = {
    baselineYear: 2070, // the summary grid shows % change since this year
    events: [
        { year: 2070, label: 'Great Mistake' }
    ],
    eras: [
        { start: 2070, end: 2100, label: 'Dark Age' }
    ]
};

window.scenarioChartData = {
    temperature: [
        { year: 1950, value: 13.9 },
        { year: 1960, value: 14.0 },
        { year: 1970, value: 14.0 },
        { year: 1980, value: 14.2 },
        { year: 1990, value: 14.4 },
        { year: 2000, value: 14.6 },
        { year: 2010, value: 14.8 },
        { year: 2020, value: 15.0 },
        { year: 2030, value: 15.4 },
        { year: 2040, value: 15.9 },
        { year: 2050, value: 16.4 },
        { year: 2060, value: 17.0 },
        { year: 2065, value: 17.3 },
        { year: 2070, value: 17.6 },
        { year: 2071, value: 16.8 },
        { year: 2072, value: 16.1 },
        { year: 2073, value: 15.6 },
        { year: 2075, value: 15.2 },
        { year: 2080, value: 15.5 },
        { year: 2085, value: 15.9 },
        { year: 2090, value: 16.2 },
        { year: 2100, value: 16.7 },
        { year: 2110, value: 17.0 },
        { year: 2120, value: 17.2 },
        { year: 2130, value: 17.4 },
        { year: 2140, value: 17.5 },
        { year: 2150, value: 17.7 },
        { year: 2160, value: 17.8 },
        { year: 2170, value: 17.9 },
        { year: 2180, value: 18.0 },
        { year: 2190, value: 18.0 },
        { year: 2200, value: 18.1 }
    ],
    population: [
        { year: 1950, value: 2.53 },
        { year: 1960, value: 3.0 },
        { year: 1970, value: 3.7 },
        { year: 1980, value: 4.45 },
        { year: 1990, value: 5.3 },
        { year: 2000, value: 6.15 },
        { year: 2010, value: 6.95 },
        { year: 2020, value: 7.79 },
        { year: 2030, value: 8.5 },
        { year: 2040, value: 9.0 },
        { year: 2050, value: 9.4 },
        { year: 2060, value: 9.7 },
        { year: 2070, value: 9.8 },
        { year: 2071, value: 9.5 },
        { year: 2072, value: 9.2 },
        { year: 2075, value: 8.9 },
        { year: 2080, value: 8.6 },
        { year: 2090, value: 8.4 },
        { year: 2100, value: 8.3 },
        { year: 2120, value: 8.4 },
        { year: 2150, value: 8.7 },
        { year: 2180, value: 9.0 },
        { year: 2200, value: 9.236 }
    ],
    seaLevel: [
        { year: 1950, value: 0.06 },
        { year: 2000, value: 0.14 },
        { year: 2020, value: 0.20 },
        { year: 2030, value: 0.4 },
        { year: 2050, value: 0.9 },
        { year: 2070, value: 1.9 },
        { year: 2080, value: 3.9 },
        { year: 2090, value: 6.9 },
        { year: 2100, value: 10.9 },
        { year: 2120, value: 19.9 },
        { year: 2150, value: 31.9 },
        { year: 2180, value: 42.9 },
        { year: 2200, value: 50.0 }
    ],
    cropYield: [
        { year: 1950, value: 38 },
        { year: 2000, value: 75 },
        { year: 2020, value: 100 },
        { year: 2030, value: 108 },
        { year: 2050, value: 118 },
        { year: 2070, value: 122 },
        { year: 2075, value: 100 },
        { year: 2080, value: 75 },
        { year: 2090, value: 70 },
        { year: 2100, value: 72 },
        { year: 2120, value: 82 },
        { year: 2150, value: 92 },
        { year: 2180, value: 100 },
        { year: 2200, value: 105 }
    ],
    co2: [
        { year: 1950, value: 311 },
        { year: 2000, value: 370 },
        { year: 2020, value: 415 },
        { year: 2030, value: 445 },
        { year: 2050, value: 525 },
        { year: 2070, value: 650 },
        { year: 2075, value: 690 },
        { year: 2080, value: 700 },
        { year: 2090, value: 700 },
        { year: 2100, value: 690 },
        { year: 2120, value: 680 },
        { year: 2150, value: 665 },
        { year: 2180, value: 650 },
        { year: 2200, value: 640 }
    ],
    displaced: [
        { year: 1950, value: 0.05 },
        { year: 2000, value: 0.05 },
        { year: 2020, value: 0.08 },
        { year: 2030, value: 0.12 },
        { year: 2050, value: 0.3 },
        { year: 2070, value: 0.5 },
        { year: 2075, value: 1.2 },
        { year: 2080, value: 1.8 },
        { year: 2090, value: 1.7 },
        { year: 2100, value: 1.5 },
        { year: 2120, value: 1.2 },
        { year: 2150, value: 0.9 },
        { year: 2180, value: 0.7 },
        { year: 2200, value: 0.5 }
    ],
    biodiversity: [
        { year: 1950, value: 100 },
        { year: 1970, value: 94 },
        { year: 1990, value: 86 },
        { year: 2000, value: 80 },
        { year: 2010, value: 74 },
        { year: 2020, value: 68 },
        { year: 2030, value: 63 },
        { year: 2050, value: 54 },
        { year: 2070, value: 45 },
        { year: 2075, value: 32 },
        { year: 2080, value: 28 },
        { year: 2090, value: 26 },
        { year: 2100, value: 27 },
        { year: 2120, value: 30 },
        { year: 2150, value: 34 },
        { year: 2180, value: 39 },
        { year: 2200, value: 45 }
    ],
    radiation: [
        { year: 1950, value: 3.0 },
        { year: 1970, value: 3.0 },
        { year: 1990, value: 3.0 },
        { year: 2000, value: 3.0 },
        { year: 2010, value: 3.0 },
        { year: 2020, value: 3.0 },
        { year: 2030, value: 3.0 },
        { year: 2050, value: 3.0 },
        { year: 2065, value: 3.0 },
        { year: 2070, value: 3.0 },
        { year: 2071, value: 6.0 },
        { year: 2072, value: 8.5 },
        { year: 2075, value: 7.5 },
        { year: 2080, value: 5.7 },
        { year: 2090, value: 4.3 },
        { year: 2100, value: 3.6 },
        { year: 2120, value: 3.2 },
        { year: 2150, value: 3.0 },
        { year: 2180, value: 3.0 },
        { year: 2200, value: 3.0 }
    ],
    airQuality: [
        { year: 1950, value: 18 },
        { year: 1970, value: 23 },
        { year: 1990, value: 28 },
        { year: 2000, value: 30 },
        { year: 2010, value: 29 },
        { year: 2020, value: 25 },
        { year: 2030, value: 23 },
        { year: 2050, value: 21 },
        { year: 2065, value: 20 },
        { year: 2070, value: 20 },
        { year: 2071, value: 95 },
        { year: 2072, value: 140 },
        { year: 2075, value: 105 },
        { year: 2080, value: 62 },
        { year: 2090, value: 38 },
        { year: 2100, value: 27 },
        { year: 2120, value: 21 },
        { year: 2150, value: 18 },
        { year: 2180, value: 16 },
        { year: 2200, value: 15 }
    ],
    ecobalance: [
        { year: 1950, value: 86 },
        { year: 1970, value: 82 },
        { year: 1990, value: 74 },
        { year: 2000, value: 68 },
        { year: 2010, value: 62 },
        { year: 2020, value: 57 },
        { year: 2030, value: 51 },
        { year: 2050, value: 41 },
        { year: 2060, value: 35 },
        { year: 2070, value: 30 },
        { year: 2071, value: 20 },
        { year: 2072, value: 12 },
        { year: 2075, value: 8 },
        { year: 2080, value: 7 },
        { year: 2090, value: 9 },
        { year: 2100, value: 14 },
        { year: 2120, value: 23 },
        { year: 2150, value: 35 },
        { year: 2180, value: 47 },
        { year: 2200, value: 56 }
    ],
    iceSheet: [
        { year: 1950, value: 29.300 },
        { year: 1970, value: 29.300 },
        { year: 1990, value: 29.299 },
        { year: 2000, value: 29.298 },
        { year: 2010, value: 29.295 },
        { year: 2020, value: 29.289 },
        { year: 2030, value: 29.27 },
        { year: 2050, value: 29.2 },
        { year: 2070, value: 29.0 },
        { year: 2080, value: 28.4 },
        { year: 2090, value: 27.4 },
        { year: 2100, value: 25.8 },
        { year: 2120, value: 22.5 },
        { year: 2150, value: 18.2 },
        { year: 2180, value: 14.3 },
        { year: 2200, value: 11.7 }
    ],
    arableLand: [
        { year: 1950, value: 13.5 },
        { year: 1960, value: 13.6 },
        { year: 1970, value: 13.8 },
        { year: 1980, value: 13.9 },
        { year: 1990, value: 13.8 },
        { year: 2000, value: 13.8 },
        { year: 2010, value: 13.9 },
        { year: 2020, value: 14.0 },
        { year: 2030, value: 13.9 },
        { year: 2040, value: 13.7 },
        { year: 2050, value: 13.4 },
        { year: 2060, value: 13.0 },
        { year: 2065, value: 12.7 },
        { year: 2070, value: 12.4 },
        { year: 2071, value: 11.0 },
        { year: 2072, value: 10.0 },
        { year: 2073, value: 9.4 },
        { year: 2075, value: 8.5 },
        { year: 2080, value: 7.8 },
        { year: 2085, value: 7.5 },
        { year: 2090, value: 7.4 },
        { year: 2100, value: 7.5 },
        { year: 2110, value: 7.7 },
        { year: 2120, value: 7.9 },
        { year: 2130, value: 8.1 },
        { year: 2140, value: 8.3 },
        { year: 2150, value: 8.5 },
        { year: 2160, value: 8.7 },
        { year: 2170, value: 8.9 },
        { year: 2180, value: 9.1 },
        { year: 2190, value: 9.3 },
        { year: 2200, value: 9.5 }
    ],
    lifeExpectancy: [
        { year: 1950, value: 46 },
        { year: 1960, value: 50.9 },
        { year: 1970, value: 58.0 },
        { year: 1980, value: 62.7 },
        { year: 1990, value: 64.6 },
        { year: 2000, value: 66.4 },
        { year: 2010, value: 70.3 },
        { year: 2020, value: 72.2 },
        { year: 2030, value: 74 },
        { year: 2040, value: 76 },
        { year: 2050, value: 78 },
        { year: 2060, value: 80 },
        { year: 2065, value: 81 },
        { year: 2070, value: 82 },
        { year: 2071, value: 66 },
        { year: 2072, value: 53 },
        { year: 2073, value: 46 },
        { year: 2075, value: 40 },
        { year: 2080, value: 37 },
        { year: 2085, value: 36 },
        { year: 2090, value: 37 },
        { year: 2100, value: 40 },
        { year: 2110, value: 43 },
        { year: 2120, value: 46 },
        { year: 2130, value: 49 },
        { year: 2140, value: 52 },
        { year: 2150, value: 55 },
        { year: 2160, value: 58 },
        { year: 2170, value: 61 },
        { year: 2180, value: 64 },
        { year: 2190, value: 67 },
        { year: 2200, value: 70 }
    ],
    internetAvailability: [
        { year: 1950, value: 0 },
        { year: 1960, value: 0 },
        { year: 1970, value: 0 },
        { year: 1980, value: 0 },
        { year: 1990, value: 0.05 },
        { year: 2000, value: 6.7 },
        { year: 2010, value: 29 },
        { year: 2020, value: 59 },
        { year: 2030, value: 78 },
        { year: 2040, value: 88 },
        { year: 2050, value: 94 },
        { year: 2060, value: 97 },
        { year: 2065, value: 98 },
        { year: 2070, value: 99 },
        { year: 2071, value: 65 },
        { year: 2072, value: 42 },
        { year: 2073, value: 30 },
        { year: 2075, value: 20 },
        { year: 2080, value: 17 },
        { year: 2085, value: 18 },
        { year: 2090, value: 20 },
        { year: 2100, value: 25 },
        { year: 2110, value: 31 },
        { year: 2120, value: 38 },
        { year: 2130, value: 46 },
        { year: 2140, value: 54 },
        { year: 2150, value: 62 },
        { year: 2160, value: 69 },
        { year: 2170, value: 75 },
        { year: 2180, value: 81 },
        { year: 2190, value: 86 },
        { year: 2200, value: 90 }
    ]
};

// Backwards compatibility for any code still reading the old name map.
window.scenarioSeriesNames = Object.fromEntries(
    Object.entries(window.scenarioSeries).map(([key, meta]) => [key, meta.name])
);
