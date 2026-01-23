import { getActiveTab } from './utils.js';

// DOM elements
const deuteranopiaButton = document.getElementById('deuteranopiaButton');
const tritanopiaButton = document.getElementById('tritanopiaButton');
const protanopiaButton = document.getElementById('protanopiaButton');
const monochromacyButton = document.getElementById('monochromacyButton');

// Injected function
export function injectedApplyColorBlindMode(type) {
  function getRgbFromColor(colorStr) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
      return null;
    }
    const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
    }
    const hexMatch = colorStr.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
    if (hexMatch) {
      return [
        parseInt(hexMatch[1], 16),
        parseInt(hexMatch[2], 16),
        parseInt(hexMatch[3], 16)
      ];
    }
    return null;
  }
  
  function rgbToLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  
  const existingStyle = document.getElementById('reforma-color-blind');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  if (!type || type === 'none') {
    return;
  }
  
  let svgFilter = document.getElementById('reforma-cb-filter');
  if (!svgFilter) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.pointerEvents = 'none'; // Don't block interactions
    svg.style.zIndex = '-1'; // Place behind content
    svg.id = 'reforma-cb-svg';
    svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    svgFilter.id = 'reforma-cb-filter';
    svg.appendChild(svgFilter);
    document.body.appendChild(svg);
  }
  
  const existingMatrix = svgFilter.querySelector('feColorMatrix');
  if (existingMatrix) {
    existingMatrix.remove();
  }
  
  const matrices = {
    deuteranopia: [0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0],
    protanopia: [0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0],
    tritanopia: [0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0],
    monochromacy: [0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 1, 0]
  };
  
  const matrix = matrices[type];
  if (!matrix) return;
  
  const colorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
  colorMatrix.setAttribute('type', 'matrix');
  colorMatrix.setAttribute('values', matrix.join(' '));
  svgFilter.appendChild(colorMatrix);
  
  const style = document.createElement('style');
  style.id = 'reforma-color-blind';
  style.textContent = `
    html {
      filter: url(#reforma-cb-filter);
      /* Ensure filter doesn't interfere with interactions */
      isolation: isolate;
      will-change: filter;
    }
  `;
  
  document.head.appendChild(style);
  
  if (type === 'monochromacy') {
    const textSelectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li, div, td, th, button, input, label';
    const elements = document.querySelectorAll(textSelectors);
    
    elements.forEach((el) => {
      const computedStyle = window.getComputedStyle(el);
      const bgColor = computedStyle.backgroundColor;
      const textColor = computedStyle.color;
      
      const bgRgb = getRgbFromColor(bgColor);
      const textRgb = getRgbFromColor(textColor);
      
      if (bgRgb && textRgb) {
        const bgLum = rgbToLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
        const textLum = rgbToLuminance(textRgb[0], textRgb[1], textRgb[2]);
        
        if (Math.abs(bgLum - textLum) < 0.3) {
          if (bgLum > 0.5) {
            el.style.color = '#000000';
          } else {
            el.style.color = '#ffffff';
          }
        }
      }
    });
  }
}

export async function applyColorBlindMode(type) {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedApplyColorBlindMode,
      args: [type],
    });
    
    // Store current mode for syncing
    if (!window.reformaSyncState) {
      window.reformaSyncState = {};
    }
    window.reformaSyncState.colorBlindMode = type;
  } catch (e) {
    console.error('Error applying color blind mode:', e);
  }
}

// Initialize event listeners
if (deuteranopiaButton) deuteranopiaButton.addEventListener('click', () => applyColorBlindMode('deuteranopia'));
if (tritanopiaButton) tritanopiaButton.addEventListener('click', () => applyColorBlindMode('tritanopia'));
if (protanopiaButton) protanopiaButton.addEventListener('click', () => applyColorBlindMode('protanopia'));
if (monochromacyButton) monochromacyButton.addEventListener('click', () => applyColorBlindMode('monochromacy'));
