import { getActiveTab } from './utils.js';
import { clampNumber, setText } from './utils.js';
import { getSelectedTextStyle } from './state.js';

// DOM elements
const fontSizeSlider = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSizeValue');

// Store original styles before first modification
export function injectedStoreOriginalStyles() {
  if (window.reformaOriginalStyles) return; // Already stored
  
  const selectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li, div, td, th';
  const elements = document.querySelectorAll(selectors);
  const originalStyles = new Map();
  
  elements.forEach((el, index) => {
    const computed = window.getComputedStyle(el);
    originalStyles.set(index, {
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      padding: computed.padding,
      borderRadius: computed.borderRadius,
      boxDecorationBreak: computed.boxDecorationBreak,
      display: computed.display,
      filter: computed.filter,
      transition: computed.transition
    });
  });
  
  window.reformaOriginalStyles = originalStyles;
  window.reformaOriginalElements = Array.from(elements);
}

// Injected function to apply styles
export function injectedApplyStyles({ fontSizePx = 16, fontFamily = null, fontWeight = null, fontStyle = null }) {
  // Store original styles on first call
  if (!window.reformaOriginalStyles) {
    injectedStoreOriginalStyles();
  }
  
  const selectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li';
  const elements = document.querySelectorAll(selectors);

  const size = Number(fontSizePx) || 16;

  elements.forEach((el) => {
    el.style.transition = 'font-size 0.3s ease-out';
    el.style.fontSize = `${size}px`;
    if (fontFamily) el.style.fontFamily = String(fontFamily);
    if (fontWeight) el.style.fontWeight = String(fontWeight);
    if (fontStyle) el.style.fontStyle = String(fontStyle);
  });
}

export function updateSliderUI() {
  const fontSize = clampNumber(fontSizeSlider?.value, 10, 32, 16);

  setText(fontSizeValue, `${fontSize}px`);
}

export async function applyStyles() {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  const fontSize = clampNumber(fontSizeSlider?.value, 10, 32, 16);

  // Store original styles before first modification
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectedStoreOriginalStyles,
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectedApplyStyles,
    args: [{
      fontSizePx: fontSize,
      fontFamily: getSelectedTextStyle()?.fontFamily ?? null,
      fontWeight: getSelectedTextStyle()?.fontWeight ?? null,
      fontStyle: getSelectedTextStyle()?.fontStyle ?? null,
    }],
  });
}

// Initialize sliders
if (fontSizeSlider) {
  fontSizeSlider.addEventListener('input', () => {
    updateSliderUI();
    applyStyles();
  });
}

// Export for reset functionality
export function resetSliders() {
  if (fontSizeSlider) fontSizeSlider.value = '16';
  updateSliderUI();
}
