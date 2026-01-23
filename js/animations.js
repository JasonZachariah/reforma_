import { getActiveTab } from './utils.js';
import { getAnimationsDisabled, setAnimationsDisabled } from './state.js';
import { updateUI } from './ui.js';

// DOM elements
const toggleAnimationsButton = document.getElementById('toggleAnimationsButton');

// Injected function
export function injectedToggleAnimations(disabled = false) {
  const styleId = 'reforma-disable-animations';
  let styleEl = document.getElementById(styleId);
  
  if (disabled) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          scroll-behavior: auto !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
    
    // Disable JavaScript-based scroll animations
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(...args) {
      const opts = args[0] || {};
      if (typeof opts === 'object') {
        opts.behavior = 'auto';
      }
      return originalScrollIntoView.apply(this, args);
    };
    
    const originalScrollTo = window.scrollTo;
    window.scrollTo = function(...args) {
      const opts = args[0] || {};
      if (typeof opts === 'object' && opts.behavior) {
        opts.behavior = 'auto';
      }
      return originalScrollTo.apply(this, args);
    };
    
    const originalScroll = window.scroll;
    window.scroll = function(...args) {
      const opts = args[0] || {};
      if (typeof opts === 'object' && opts.behavior) {
        opts.behavior = 'auto';
      }
      return originalScroll.apply(this, args);
    };
  } else {
    if (styleEl) {
      styleEl.remove();
    }
  }
}

export async function toggleAnimations() {
  setAnimationsDisabled(!getAnimationsDisabled());
  updateUI();

  const tab = await getActiveTab();
  if (!tab?.id) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectedToggleAnimations,
    args: [getAnimationsDisabled()],
  });
}

// Initialize event listener
if (toggleAnimationsButton) toggleAnimationsButton.addEventListener('click', toggleAnimations);
