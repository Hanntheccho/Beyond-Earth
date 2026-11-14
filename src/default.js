/**
 * BYOND UNiTY HTML — Main Entry Point
 * Consolidates all interactive components and initialization.
 */

// 1. Core Services (Localization & Data)
import './js/loc.js';
import './js/viewport-visibility.js';
import './js/data-calc.js';
import './js/scenario-data.js';

// 2. Visualization Components
import './js/globe.js';
import './js/affy-graph.js';
import './js/treemap.js';
import './js/scenario-chart.js';
import './js/globe-sea-level.js';
import './js/globe-markers-link.js';

// 3. UI Components & Logic
import './js/data-grid.js';
import './js/data-tabs.js';
import './js/pois.js';
import './js/audio.js';
import './js/panel-toggle.js';
import './js/main-visibility.js';
import './js/tooltips.js';
import './js/cursor-glow.js';
import './js/legacy.js';
import './js/market-text.js';
import './js/scroll-reveal.js';
import './js/deep-links.js';

console.log('[BYOND UNiTY HTML] System initialized.');
