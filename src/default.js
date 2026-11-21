/**
 * BYOND UNiTY HTML — Main Entry Point
 * Consolidates all interactive components and initialization.
 */

// 1. Core Services (Loading, Localization & Data)
// The loading screen goes first: the other modules tell it what to wait for.
import './js/loading-screen.js';
import './js/loc.js';
import './js/viewport-visibility.js';
import './js/data-calc.js';
import './js/scenario-data.js';

// 2. Visualization Components
import './js/globe.js';
import './js/treemap.js';
import './js/scenario-chart.js';
import './js/globe-sea-level.js';
import './js/globe-markers-link.js';

// 3. UI Components & Logic
import './js/data-grid.js';
import './js/relations.js';
import './js/pois.js';
import './js/audio.js';
import './js/panel-toggle.js';
import './js/theme-toggle.js';
import './js/options-menu.js';
import './js/display-options.js';
import './js/main-visibility.js';
import './js/data-view.js';
import './js/tooltips.js';
import './js/ticker.js';
import './js/scroll-reveal.js';

// Load and register the dataset feeds after its consumers have initialized.
import './js/feed-loader.js';

console.log('[BYOND UNiTY HTML] System initialized.');
