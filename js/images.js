import { getActiveTab } from './utils.js';
import { getImagesEnabled, setImagesEnabled, getImagesBlurred, setImagesBlurred } from './state.js';
import { updateUI } from './ui.js';

// DOM elements
const toggleImagesButton = document.getElementById('toggleImagesButton');
const blurImagesButton = document.getElementById('blurImagesButton');

// Store original image styles
export function injectedStoreOriginalImageStyles() {
  if (window.reformaOriginalImageStyles) return; // Already stored
  
  const imgs = document.querySelectorAll('img, picture, svg, video');
  const originalStyles = new Map();
  
  imgs.forEach((el, index) => {
    const computed = window.getComputedStyle(el);
    originalStyles.set(index, {
      display: computed.display,
      filter: computed.filter,
      transition: computed.transition
    });
  });
  
  window.reformaOriginalImageStyles = originalStyles;
  window.reformaOriginalImageElements = Array.from(imgs);
}

// Injected functions
export function injectedSetImagesEnabled(enabled = true) {
  // Store original styles on first call
  if (!window.reformaOriginalImageStyles) {
    injectedStoreOriginalImageStyles();
  }
  
  const imgs = document.querySelectorAll('img, picture, svg, video');
  imgs.forEach((el) => {
    el.style.display = enabled ? '' : 'none';
  });
}

export function injectedBlurImages(blurred = false) {
  // Store original styles on first call
  if (!window.reformaOriginalImageStyles) {
    injectedStoreOriginalImageStyles();
  }
  
  const imgs = document.querySelectorAll('img, picture img, video');
  const svgs = document.querySelectorAll('svg');
  
  // Blur major images (not icons or small images)
  imgs.forEach((el) => {
    // Check if image is large enough to be considered "major"
    const width = el.naturalWidth || el.width || el.offsetWidth || 0;
    const height = el.naturalHeight || el.height || el.offsetHeight || 0;
    const computedStyle = window.getComputedStyle(el);
    const displayWidth = parseFloat(computedStyle.width) || width;
    const displayHeight = parseFloat(computedStyle.height) || height;
    
    // Consider it a major image if it's at least 100px in either dimension
    const isMajorImage = (width >= 100 || height >= 100 || displayWidth >= 100 || displayHeight >= 100);
    
    // Also check if it's likely an icon (very small or has icon-related classes/ids)
    const className = (el.className || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const isIcon = className.includes('icon') || id.includes('icon') || 
                   className.includes('logo') && (width < 200 && height < 200) ||
                   (width < 80 && height < 80);
    
    if (isMajorImage && !isIcon) {
      if (blurred) {
        el.style.filter = 'blur(10px)';
        el.style.transition = 'filter 0.3s ease';
      } else {
        el.style.filter = '';
        el.style.transition = '';
      }
    }
  });
  
  // Blur videos (always consider them major)
  document.querySelectorAll('video').forEach((el) => {
    if (blurred) {
      el.style.filter = 'blur(10px)';
      el.style.transition = 'filter 0.3s ease';
    } else {
      el.style.filter = '';
      el.style.transition = '';
    }
  });
  
  // Don't blur SVGs (they're often icons/logos)
}

export async function toggleImages() {
  setImagesEnabled(!getImagesEnabled());
  updateUI();

  const tab = await getActiveTab();
  if (!tab?.id) return;

  // Store original styles before first modification
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectedStoreOriginalImageStyles,
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectedSetImagesEnabled,
    args: [getImagesEnabled()],
  });
}

export async function toggleBlurImages() {
  setImagesBlurred(!getImagesBlurred());
  updateUI();

  const tab = await getActiveTab();
  if (!tab?.id) return;

  // Store original styles before first modification
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectedStoreOriginalImageStyles,
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectedBlurImages,
    args: [getImagesBlurred()],
  });
}

// Initialize event listeners
if (toggleImagesButton) toggleImagesButton.addEventListener('click', toggleImages);
if (blurImagesButton) blurImagesButton.addEventListener('click', toggleBlurImages);
