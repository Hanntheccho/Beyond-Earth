// Fictional interpretation of the scenario's global indicators.
// Pre-modern values are especially approximate. The dip after 2070 represents
// temporary nuclear-winter cooling, followed by recovery as ash settles.
// These are narrative estimates, not model output.
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
    ecobalance: { name: 'Global Ecobalance', unit: 'index', min: 0, max: 100 },
    temperature: { name: 'Surface Temperature', unit: '°C', trend: 'negative' },
    population: { name: 'World Population', unit: 'billion', min: 0 },
    seaLevel: { name: 'Mean Sea Level', unit: 'meters', trend: 'negative', min: 0 },
    iceVolume: { name: 'Total Ice Volume', unit: 'Mkm³', min: 0 },
    worldGDP: { name: 'Gross Domestic Product', unit: '%' }
};

// ---------------------------------------------------------------------------
// Add `series: ['seaLevel', 'iceVolume']` to an event or era to limit it to some charts.
// Events also take an optional `y` (chart pixels): positive moves the tag down,
// negative moves it up; 0 or omitted keeps it just above the plot.
// Add positive: true to an event or era to draw it in green instead of red.
// ---------------------------------------------------------------------------
window.scenarioConfig = {
    baselineYear: 2070, // the summary grid shows % change since this year
    events: [
        { year: 2070, label: 'The Great Mistake' },
        { year: 2000, label: '2000 Miracle', y: 180, series: ['worldGDP'], positive: true },
        { year: 2033, label: 'Nuclear Fusion', y: 140, series: ['worldGDP'], positive: true },
        { year: 2074, label: 'Satellites Fall', y: 100, series: ['worldGDP'] },
        { year: 2075, label: 'Nuclear Ashfall', y: 260, series: ['temperature'] },
        { year: 2084, label: 'Siege of Washington', y: 310, series: ['worldGDP', 'population'] },
        { year: 2088, label: 'Hamburg Flood', y: 140, series: ['seaLevel', 'population'] },
        { year: 2089, label: 'INTEGR Founded', y: 100, series: ['ecobalance'], positive: true },
        { year: 2090, label: 'Antarctic Collapse', y: 210, series: ['iceVolume', 'seaLevel'] },
        { year: 2107, label: 'Swiss Plebiscite', y: 160, series: ['worldGDP'], positive: true },
        { year: 2170, label: 'War of Unification', y: 180, series: ['worldGDP', 'population'] },
        { year: 2194, label: 'Green Soil', y: 60, series: ['ecobalance'], positive: true },
        { year: 2198, label: "Coup of '98", y: 140, series: ['population'] }
    ],
    eras: [
        { start: 2070, end: 2100, label: 'Dark Age', series: ['temperature', 'ecobalance', 'population', 'worldGDP'] },
        { start: 2080, end: 2160, label: 'Ice Sheet Collapse', series: ['seaLevel', 'iceVolume'] },
        { start: 2100, end: 2200, label: 'Reconstruction Era', series: ['worldGDP', 'ecobalance'], positive: true },
        { start: 2000, end: 2070, label: 'Age of Plenty', series: ['worldGDP'], positive: true }
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
        { year: 2085, value: 15.6 },
        { year: 2090, value: 15.0 },
        { year: 2100, value: 16.1 },
        { year: 2110, value: 16.6 },
        { year: 2120, value: 16.8 },
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
        { year: 2075, value: 8.7 },
        { year: 2080, value: 8.1 },
        { year: 2085, value: 7.7 },
        { year: 2088, value: 7.5 },
        { year: 2095, value: 7.4 },
        { year: 2100, value: 7.5 },
        { year: 2120, value: 7.8 },
        { year: 2150, value: 8.3 },
        { year: 2170, value: 8.1 },
        { year: 2180, value: 8.3 },
        { year: 2198, value: 8.0 },
        { year: 2200, value: 8.1 }
    ],
    seaLevel: [
        { year: 1950, value: 0.06 },
        { year: 2000, value: 0.14 },
        { year: 2020, value: 0.20 },
        { year: 2030, value: 0.4 },
        { year: 2050, value: 0.9 },
        { year: 2070, value: 1.9 },
        { year: 2080, value: 3.9 },
        { year: 2087, value: 4.6 },
        { year: 2088, value: 5.4 },
        { year: 2089, value: 5.6 },
        { year: 2090, value: 6.9 },
        { year: 2092, value: 9.0 },
        { year: 2095, value: 10.2 },
        { year: 2100, value: 10.9 },
        { year: 2110, value: 13.4 },
        { year: 2120, value: 19.9 },
        { year: 2150, value: 31.9 },
        { year: 2180, value: 42.9 },
        { year: 2200, value: 50.0 }
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
        { year: 2085, value: 8 },
        { year: 2089, value: 14 },
        { year: 2090, value: 12 },
        { year: 2100, value: 18 },
        { year: 2107, value: 13 },
        { year: 2120, value: 23 },
        { year: 2150, value: 35 },
        { year: 2180, value: 47 },
        { year: 2190, value: 52 },
        { year: 2194, value: 63 },
        { year: 2198, value: 64 },
        { year: 2200, value: 65 }
    ],
    iceVolume: [
        { year: 1950, value: 29.30 },
        { year: 1970, value: 29.30 },
        { year: 1990, value: 29.29 },
        { year: 2000, value: 29.29 },
        { year: 2010, value: 29.29 },
        { year: 2020, value: 29.28 },
        { year: 2030, value: 29.27 },
        { year: 2050, value: 29.2 },
        { year: 2070, value: 29.0 },
        { year: 2080, value: 28.4 },
        { year: 2085, value: 28.0 },
        { year: 2090, value: 26.4 },
        { year: 2095, value: 23.8 },
        { year: 2100, value: 20.5 },
        { year: 2105, value: 18.0 },
        { year: 2110, value: 16.8 },
        { year: 2120, value: 15.5 },
        { year: 2150, value: 13.6 },
        { year: 2180, value: 12.4 },
        { year: 2200, value: 11.7 }
    ],
    worldGDP: [
        { year: 1950, value: 3.8 },
        { year: 1970, value: 4.0 },
        { year: 1990, value: 2.8 },
        { year: 1995, value: 3.2 },
        { year: 2000, value: 5.6 },
        { year: 2010, value: 3.8 },
        { year: 2020, value: 5.2 },
        { year: 2033, value: 10.2 },
        { year: 2050, value: 11.4 },
        { year: 2060, value: 8.2 },
        { year: 2069, value: 9.4 },
        { year: 2070, value: -35.0 },
        { year: 2074, value: -42.0 },
        { year: 2078, value: -24.0 },
        { year: 2084, value: -31.0 },
        { year: 2088, value: -18.0 },
        { year: 2094, value: -6.0 },
        { year: 2100, value: 2.0 },
        { year: 2107, value: 3.4 },
        { year: 2120, value: 2.5 },
        { year: 2130, value: 3.0 },
        { year: 2140, value: 4.8 },
        { year: 2150, value: 2.2 },
        { year: 2160, value: 3.6 },
        { year: 2170, value: 0.1 },
        { year: 2180, value: 2.6 },
        { year: 2185, value: 2.1 },
        { year: 2200, value: 3.9 }
    ]
};

// Backwards compatibility for any code still reading the old name map.
window.scenarioSeriesNames = Object.fromEntries(
    Object.entries(window.scenarioSeries).map(([key, meta]) => [key, meta.name])
);
