// Main popup initialization
import { updateUI } from './js/ui.js';
import { detectAndRenderTextStyles } from './js/textStyles.js';
import { checkWcag } from './js/wcag.js';

// Import modules to initialize their event listeners
import './js/images.js';
import './js/animations.js';
import './js/colorBlind.js';
import './js/wcag.js';
import './js/reset.js';
import './js/sliders.js';
import './js/textOnly.js';
import './js/syncAllTabs.js';
import './js/floatingButton.js';

// Initialize on load
updateUI();
detectAndRenderTextStyles();
checkWcag(); // Auto-check WCAG on popup open
