import { getActiveTab } from './utils.js';
import { setSelectedTextStyle } from './state.js';
import { clampNumber } from './utils.js';
import { clearEl } from './utils.js';
import { applyStyles } from './sliders.js';

// DOM elements
const textStylesContainer = document.getElementById('textStylesContainer');
const textStylesSection = document.getElementById('textStylesSection');
const fontSizeSlider = document.getElementById('fontSize');

// Injected function to detect text styles
export function injectedDetectTextStyles() {
  const selectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li';
  const elements = Array.from(document.querySelectorAll(selectors));

  const counts = new Map();
  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    const rawFamily = (cs.fontFamily || '').split(',')[0]?.trim() || 'Unknown';
    const fontFamily = rawFamily.replace(/^["']|["']$/g, '');
    const fontSize = cs.fontSize || '';
    const fontWeight = cs.fontWeight || '';
    const fontStyle = cs.fontStyle || '';

    const key = `${fontFamily}__${fontSize}__${fontWeight}__${fontStyle}`;
    const prev = counts.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      counts.set(key, { fontFamily, fontSize, fontWeight, fontStyle, count: 1 });
    }
  }

  const styles = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return { totalTextNodes: elements.length, styles };
}

function renderTextStyleButtons(styles) {
  if (!textStylesSection) return;
  if (!textStylesContainer) return;

  clearEl(textStylesContainer);

  if (!styles || styles.length === 0) {
    textStylesSection.style.display = 'none';
    return;
  }

  textStylesSection.style.display = '';

  styles.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'px-2 py-1 rounded border border-black/10 bg-white text-black text-xs hover:opacity-90 transition-opacity';

    const label = `${s.fontFamily} • ${s.fontSize} • ${s.fontWeight}${s.fontStyle && s.fontStyle !== 'normal' ? ` • ${s.fontStyle}` : ''}`;
    btn.textContent = label;

    btn.addEventListener('click', async () => {
      setSelectedTextStyle({
        fontFamily: s.fontFamily,
        fontWeight: s.fontWeight,
        fontStyle: s.fontStyle,
      });

      // Sync font size slider to detected size when possible
      const px = Number(String(s.fontSize).replace('px', ''));
      if (Number.isFinite(px) && fontSizeSlider) {
        const clamped = clampNumber(px, 10, 32, 16);
        fontSizeSlider.value = String(clamped);
        fontSizeSlider.dispatchEvent(new Event('input'));
      }
    });

    textStylesContainer.appendChild(btn);
  });
}

export async function detectAndRenderTextStyles() {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedDetectTextStyles,
    });
    renderTextStyleButtons(result?.styles || []);
  } catch (e) {
    if (textStylesSection) textStylesSection.style.display = 'none';
  }
}
