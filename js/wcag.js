import { getActiveTab } from './utils.js';

// DOM elements
const checkWcagButton = document.getElementById('checkWcagButton');
const makeAaButton = document.getElementById('makeAaButton');
const makeAaaButton = document.getElementById('makeAaaButton');
const wcagResults = document.getElementById('wcagResults');

// WCAG contrast utilities (injected functions need these)
function rgbToLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

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

function getBackgroundColor(el) {
  let current = el;
  while (current && current !== document.body) {
    const bg = window.getComputedStyle(current).backgroundColor;
    const rgb = getRgbFromColor(bg);
    if (rgb && (rgb[0] !== 0 || rgb[1] !== 0 || rgb[2] !== 0 || bg.includes('255'))) {
      const alphaMatch = bg.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
      const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 1;
      if (alpha > 0.1) {
        return rgb;
      }
    }
    current = current.parentElement;
  }
  return [255, 255, 255];
}

function getContrastRatio(color1, color2) {
  const lum1 = rgbToLuminance(color1[0], color1[1], color1[2]);
  const lum2 = rgbToLuminance(color2[0], color2[1], color2[2]);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isLargeText(fontSize, fontWeight) {
  const size = parseFloat(fontSize) || 16;
  const weight = parseInt(fontWeight) || 400;
  return size >= 18 || (size >= 14 && weight >= 700);
}

function findContrastingColor(bgRgb, targetRatio, isLarge = false) {
  const minRatio = isLarge ? (targetRatio === 4.5 ? 3 : 4.5) : targetRatio;
  
  const blackRatio = getContrastRatio([0, 0, 0], bgRgb);
  if (blackRatio >= minRatio) {
    return [0, 0, 0];
  }
  
  const whiteRatio = getContrastRatio([255, 255, 255], bgRgb);
  if (whiteRatio >= minRatio) {
    return [255, 255, 255];
  }
  
  let low = 0;
  let high = 255;
  let best = [0, 0, 0];
  let bestRatio = 0;
  
  for (let i = 0; i < 20; i++) {
    const mid = Math.floor((low + high) / 2);
    const testColor = [mid, mid, mid];
    const ratio = getContrastRatio(testColor, bgRgb);
    
    if (ratio >= minRatio && ratio > bestRatio) {
      best = testColor;
      bestRatio = ratio;
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  
  if (bestRatio >= minRatio) {
    return best;
  }
  
  for (let val = 255; val >= 200; val -= 5) {
    const testColor = [val, val, val];
    const ratio = getContrastRatio(testColor, bgRgb);
    if (ratio >= minRatio) {
      return testColor;
    }
  }
  
  return bestRatio > 0 ? best : [0, 0, 0];
}

// Injected functions
export function injectedCheckWcag() {
  const selectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li, div, td, th';
  const elements = Array.from(document.querySelectorAll(selectors)).filter(el => {
    const text = el.textContent?.trim();
    return text && text.length > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  });
  
  const issues = [];
  let aaPassing = 0;
  let aaaPassing = 0;
  let total = 0;
  
  for (const el of elements) {
    const style = window.getComputedStyle(el);
    const fontSize = style.fontSize;
    const fontWeight = style.fontWeight;
    const color = style.color;
    const bgRgb = getBackgroundColor(el);
    const textRgb = getRgbFromColor(color);
    
    if (!textRgb || !bgRgb) continue;
    
    total++;
    const ratio = getContrastRatio(textRgb, bgRgb);
    const large = isLargeText(fontSize, fontWeight);
    
    const aaRequired = large ? 3 : 4.5;
    const aaaRequired = large ? 4.5 : 7;
    
    const passesAa = ratio >= aaRequired;
    const passesAaa = ratio >= aaaRequired;
    
    if (passesAa) aaPassing++;
    if (passesAaa) aaaPassing++;
    
    if (!passesAa) {
      issues.push({
        element: el.tagName.toLowerCase(),
        ratio: ratio.toFixed(2),
        required: aaRequired.toFixed(1),
        large,
        text: el.textContent?.substring(0, 30) || ''
      });
    }
  }
  
  const aaPercent = total > 0 ? ((aaPassing / total) * 100) : 0;
  const aaaPercent = total > 0 ? ((aaaPassing / total) * 100) : 0;
  
  const aaPass = total > 0 && aaPassing === total;
  const aaaPass = total > 0 && aaaPassing === total;
  
  let currentLevel = 'None';
  if (aaaPass) {
    currentLevel = 'AAA';
  } else if (aaPass) {
    currentLevel = 'AA';
  }
  
  return {
    total,
    aaPassing,
    aaaPassing,
    aaPercent: aaPercent.toFixed(1),
    aaaPercent: aaaPercent.toFixed(1),
    aaPass,
    aaaPass,
    currentLevel,
    issues: issues.slice(0, 10)
  };
}

export function injectedMakeWcagCompliant(level = 'AA') {
  // Store original styles before first modification
  if (!window.reformaOriginalStyles) {
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
  
  const selectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li, div, td, th';
  const elements = Array.from(document.querySelectorAll(selectors)).filter(el => {
    const text = el.textContent?.trim();
    return text && text.length > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  });
  
  const targetRatio = level === 'AAA' ? 7 : 4.5;
  let adjusted = 0;
  
  for (const el of elements) {
    const style = window.getComputedStyle(el);
    const fontSize = style.fontSize;
    const fontWeight = style.fontWeight;
    const color = style.color;
    const bgRgb = getBackgroundColor(el);
    const textRgb = getRgbFromColor(color);
    
    if (!textRgb || !bgRgb) continue;
    
    const large = isLargeText(fontSize, fontWeight);
    const required = large ? (level === 'AAA' ? 4.5 : 3) : targetRatio;
    const currentRatio = getContrastRatio(textRgb, bgRgb);
    
    if (currentRatio < required) {
      const newColor = findContrastingColor(bgRgb, required, large);
      el.style.color = `rgb(${newColor[0]}, ${newColor[1]}, ${newColor[2]})`;
      adjusted++;
    }
  }
  
  return { adjusted, total: elements.length };
}

export async function checkWcag() {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedCheckWcag,
    });
    
    if (wcagResults && result) {
      const { total, aaPassing, aaaPassing, aaPercent, aaaPercent, aaPass, aaaPass, currentLevel, issues } = result;
      
      const aaStatus = aaPass ? 
        '<span class="text-green-600 font-bold">✓ PASS</span>' : 
        `<span class="text-red-600 font-bold">✗ FAIL</span>`;
      const aaaStatus = aaaPass ? 
        '<span class="text-green-600 font-bold">✓ PASS</span>' : 
        `<span class="text-red-600 font-bold">✗ FAIL</span>`;
      
      const levelBadge = currentLevel === 'AAA' ? 
        '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-bold">AAA</span>' :
        currentLevel === 'AA' ?
        '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">AA</span>' :
        '<span class="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-bold">None</span>';
      
      wcagResults.innerHTML = `
        <div class="mb-2">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-medium">Current Level:</span>
            ${levelBadge}
          </div>
          <div class="text-xs space-y-0.5">
            <div><strong>AA:</strong> ${aaStatus} (${aaPassing}/${total} - ${aaPercent}%)</div>
            <div><strong>AAA:</strong> ${aaaStatus} (${aaaPassing}/${total} - ${aaaPercent}%)</div>
          </div>
        </div>
        ${issues.length > 0 ? 
          `<div class="text-xs text-red-600 mt-1">⚠ ${issues.length} element${issues.length !== 1 ? 's' : ''} failing AA contrast</div>` : 
          '<div class="text-xs text-green-600 mt-1">✓ All elements pass WCAG AA</div>'
        }
      `;
    }
  } catch (e) {
    if (wcagResults) {
      wcagResults.innerHTML = '<div class="text-xs text-red-600">Error checking WCAG. Page may block scripting.</div>';
    }
  }
}

export async function makeWcagCompliant(level) {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedMakeWcagCompliant,
      args: [level],
    });
    
    if (result) {
      if (wcagResults) {
        wcagResults.innerHTML = `<div class="text-green-600">Adjusted ${result.adjusted} of ${result.total} elements to meet WCAG ${level}</div>`;
      }
      setTimeout(checkWcag, 100);
    }
  } catch (e) {
    if (wcagResults) {
      wcagResults.textContent = 'Error applying WCAG compliance.';
    }
  }
}

// Initialize event listeners
if (checkWcagButton) checkWcagButton.addEventListener('click', checkWcag);
if (makeAaButton) makeAaButton.addEventListener('click', () => makeWcagCompliant('AA'));
if (makeAaaButton) makeAaaButton.addEventListener('click', () => makeWcagCompliant('AAA'));
