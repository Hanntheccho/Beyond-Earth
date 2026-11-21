// Fictional interpretation of the scenario's global indicators.
// Pre-modern values are especially approximate. The dip after the Great Mistake represents
// temporary nuclear-winter cooling, followed by recovery as ash settles.
// These are narrative estimates, not model output.
//
// ---------------------------------------------------------------------------
// Per-series metadata. The chart renderer reads everything about a series from
// here (label, unit, axis bounds, trend direction). HTML panels
// only need data-series.
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
    worldOutput: { name: 'Gross Domestic Product', unit: '%' }
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
        { year: 2074, label: 'Satellites Fall', y: 100, series: ['worldOutput'] },
        { year: 2075, label: 'Nuclear Ashfall', y: 310, series: ['temperature'] },
        { year: 2084, label: 'Siege of Washington', y: 310, series: ['worldOutput', 'population'] },
        { year: 2088, label: 'Hamburg Flood', y: 140, series: ['seaLevel', 'population'] },
        { year: 2089, label: 'INTEGR Founded', y: 200, series: ['ecobalance'], positive: true },
        { year: 2090, label: 'Antarctic Collapse', y: 210, series: ['iceVolume', 'seaLevel'] },
        { year: 2107, label: 'Swiss Plebiscite', y: 200, series: ['worldOutput'], positive: true },
        { year: 2134, label: 'Congo Crisis', series: ['population', 'worldOutput'] },
        { year: 2154, label: 'Great Betrayal', y: 160, series: ['worldOutput'] },
        { year: 2154, label: 'Caspian Flood', series: ['seaLevel'] },
        { year: 2159, label: 'Beijing Coup', series: ['worldOutput'] },
        { year: 2170, label: 'War of Unification', y: 120, series: ['worldOutput', 'population'] },
        { year: 2188, label: 'Arabian War', series: ['population', 'worldOutput'] },
        { year: 2194, label: 'Green Soil', y: 60, series: ['ecobalance'], positive: true },
        { year: 2198, label: "Coup of '98", y: 180, series: ['population'] },
        { year: 2199, label: 'Fu Zhong Dies', y: 40, series: ['worldOutput'] }
    ],
    eras: [
        { start: 2070, end: 2100, label: 'Dark Age', series: ['temperature', 'ecobalance', 'population', 'worldOutput'] },
        { start: 2080, end: 2160, label: 'Ice Sheet Collapse', series: ['seaLevel', 'iceVolume'] },
        { start: 2100, end: 2200, label: 'Reconstruction Era', series: ['worldOutput', 'ecobalance'], positive: true },
        { start: 2050, end: 2070, label: 'AoP', positive: true } // Age of Plenty
    ]
};

window.scenarioChartData = {
    temperature: [
        { year: 2050, value: 16.4 },
        { year: 2060, value: 17.0 },
        { year: 2065, value: 17.3 },
        { year: 2070, value: 17.6 }, // The Great Mistake
        { year: 2071, value: 16.8 },
        { year: 2072, value: 16.1 },
        { year: 2073, value: 15.6 },
        { year: 2075, value: 15.2 }, // Nuclear Ashfall: ash cools the planet for years
        { year: 2080, value: 15.5 },
        { year: 2085, value: 15.6 },
        { year: 2090, value: 15.0 },
        { year: 2100, value: 16.1 },
        { year: 2110, value: 16.6 },
        { year: 2120, value: 16.8 },
        { year: 2130, value: 17.4 },
        { year: 2140, value: 17.5 },
        { year: 2150, value: 17.6 },
        { year: 2160, value: 17.7 },
        { year: 2170, value: 17.8 },
        { year: 2180, value: 17.9 },
        { year: 2190, value: 18.0 },
        { year: 2200, value: 18.1 }
    ],
    population: [
        { year: 2050, value: 9.4 },
        { year: 2060, value: 9.7 },
        { year: 2070, value: 9.8 }, // The Great Mistake
        { year: 2071, value: 9.5 },
        { year: 2072, value: 9.2 },
        { year: 2075, value: 8.7 },
        { year: 2080, value: 8.1 },
        { year: 2085, value: 7.7 }, // after the Siege of Washington
        { year: 2088, value: 7.5 }, // Hamburg Flood
        { year: 2095, value: 7.4 },
        { year: 2100, value: 7.5 },
        { year: 2120, value: 7.8 },
        { year: 2133, value: 8.02 },
        { year: 2136, value: 7.96 }, // Congo Crisis: the African Union collapses
        { year: 2140, value: 8.05 },
        { year: 2150, value: 8.3 },
        { year: 2170, value: 8.1 }, // War of Unification
        { year: 2180, value: 8.3 },
        { year: 2187, value: 8.26 },
        { year: 2190, value: 8.14 }, // Arabian War
        { year: 2198, value: 8.0 }, // Coup of '98
        { year: 2200, value: 8.1 }
    ],
    seaLevel: [
        { year: 2050, value: 0.9 },
        { year: 2070, value: 1.9 }, // The Great Mistake
        { year: 2080, value: 3.9 },
        { year: 2087, value: 4.6 },
        { year: 2088, value: 5.4 }, // Hamburg Flood
        { year: 2089, value: 5.6 },
        { year: 2090, value: 9.6 }, // Antarctic Collapse: the West Antarctic ice sheet gives way
        // From the collapse on, sea level follows the ice lost since then (in proportion
        // to the drop in iceVolume), so it slows and settles as the ice sheets do.
        { year: 2092, value: 11.2 },
        { year: 2095, value: 13.6 },
        { year: 2100, value: 20.6 },
        { year: 2105, value: 29.0 },
        { year: 2110, value: 33.0 },
        { year: 2120, value: 37.3 },
        { year: 2135, value: 40.5 },
        { year: 2150, value: 43.7 },
        { year: 2153, value: 44.1 },
        { year: 2154, value: 45.6 }, // Caspian Flood: the Great Betrayal is broken by the Caspian's sudden expansion
        { year: 2157, value: 45.7 },
        { year: 2170, value: 46.7 },
        { year: 2180, value: 47.8 },
        { year: 2190, value: 48.9 },
        { year: 2200, value: 50.0 }
    ],
    ecobalance: [
        { year: 2050, value: 41 },
        { year: 2060, value: 35 },
        { year: 2070, value: 30 }, // The Great Mistake
        { year: 2071, value: 20 },
        { year: 2072, value: 12 },
        { year: 2075, value: 8 },
        { year: 2080, value: 7 },
        { year: 2085, value: 8 },
        { year: 2089, value: 14 }, // INTEGR Founded
        { year: 2090, value: 12 },
        { year: 2100, value: 18 },
        { year: 2107, value: 13 },
        { year: 2120, value: 23 },
        { year: 2150, value: 35 },
        { year: 2180, value: 47 },
        { year: 2190, value: 52 },
        { year: 2194, value: 63 }, // Green Soil
        { year: 2198, value: 64 },
        { year: 2200, value: 65 }
    ],
    iceVolume: [
        { year: 2050, value: 29.2 },
        { year: 2070, value: 29.0 }, // The Great Mistake
        { year: 2080, value: 28.4 },
        { year: 2085, value: 28.0 },
        { year: 2089, value: 27.7 },
        { year: 2090, value: 23.8 }, // Antarctic Collapse: the West Antarctic ice sheet gives way
        { year: 2095, value: 22.6 },
        { year: 2100, value: 20.5 },
        { year: 2105, value: 18.0 },
        { year: 2110, value: 16.8 },
        { year: 2120, value: 15.5 },
        { year: 2150, value: 13.6 },
        { year: 2180, value: 12.4 },
        { year: 2200, value: 11.7 }
    ],
    worldOutput: [
        { year: 2050, value: 11.4 },
        { year: 2060, value: 8.2 },
        { year: 2069, value: 9.4 },
        { year: 2070, value: -35.0 }, // The Great Mistake
        { year: 2074, value: -42.0 }, // Satellites Fall
        { year: 2078, value: -24.0 },
        { year: 2084, value: -31.0 }, // Siege of Washington
        { year: 2088, value: -18.0 },
        { year: 2094, value: -6.0 },
        { year: 2100, value: 2.0 },
        { year: 2107, value: 3.4 }, // Swiss Plebiscite
        { year: 2120, value: 2.5 },
        { year: 2130, value: 3.0 },
        { year: 2133, value: 3.2 },
        { year: 2134, value: 1.1 }, // Congo Crisis: West Africa cut off from world trade
        { year: 2137, value: 3.1 },
        { year: 2140, value: 4.8 },
        { year: 2150, value: 2.2 },
        { year: 2154, value: 0.9 }, // Great Betrayal: Eurasia's failed invasion of Central Asia
        { year: 2157, value: 2.5 },
        { year: 2159, value: 1.6 }, // Beijing Coup
        { year: 2163, value: 3.6 },
        { year: 2170, value: 0.1 }, // War of Unification
        { year: 2180, value: 2.6 },
        { year: 2185, value: 2.1 },
        { year: 2188, value: 0.8 }, // Arabian War
        { year: 2190, value: 1.5 }, // Iran's 2190 Revolution
        { year: 2194, value: 2.9 },
        { year: 2198, value: 2.7 },
        { year: 2199, value: 2.1 }, // Fu Zhong dies; China's succession crisis
        { year: 2200, value: 3.9 }
    ]
};
