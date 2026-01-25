import { getActiveTab } from './utils.js';
import { resetState } from './state.js';
import { resetSliders } from './sliders.js';
import { updateUI } from './ui.js';
import { checkWcag } from './wcag.js';
import { detectAndRenderTextStyles } from './textStyles.js';

// DOM elements
const resetButton = document.getElementById('resetButton');

// Injected function to restore original styles
export function injectedResetAll() {
  // Restore original text element styles
  if (window.reformaOriginalStyles && window.reformaOriginalElements) {
    window.reformaOriginalElements.forEach((el, index) => {
      const original = window.reformaOriginalStyles.get(index);
      if (original && el) {
        el.style.fontSize = original.fontSize;
        el.style.fontFamily = original.fontFamily;
        el.style.fontWeight = original.fontWeight;
        el.style.fontStyle = original.fontStyle;
        el.style.backgroundColor = original.backgroundColor;
        el.style.color = original.color;
        el.style.padding = original.padding;
        el.style.borderRadius = original.borderRadius;
        el.style.boxDecorationBreak = original.boxDecorationBreak;
        el.style.transition = original.transition;
      }
    });
  } else {
    // Fallback: clear styles if originals weren't stored
    const textSelectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li, div, td, th';
    const textElements = document.querySelectorAll(textSelectors);
    textElements.forEach((el) => {
      el.style.fontSize = '';
      el.style.fontFamily = '';
      el.style.fontWeight = '';
      el.style.fontStyle = '';
      el.style.backgroundColor = '';
      el.style.boxDecorationBreak = '';
      el.style.padding = '';
      el.style.borderRadius = '';
      el.style.color = '';
      el.style.transition = '';
    });
  }
  
  // Restore original image styles
  if (window.reformaOriginalImageStyles && window.reformaOriginalImageElements) {
    window.reformaOriginalImageElements.forEach((el, index) => {
      const original = window.reformaOriginalImageStyles.get(index);
      if (original && el) {
        el.style.display = original.display;
        el.style.filter = original.filter;
        el.style.transition = original.transition;
      }
    });
  } else {
    // Fallback: clear image styles if originals weren't stored
    const imgs = document.querySelectorAll('img, picture, svg, video');
    imgs.forEach((el) => {
      el.style.display = '';
      el.style.filter = '';
      el.style.transition = '';
    });
  }
  
  // Remove animation disable style
  const animationStyle = document.getElementById('reforma-disable-animations');
  if (animationStyle) {
    animationStyle.remove();
  }
  
  // Restore GSAP animations
  if (window.reformaOriginalScrollIntoView) {
    Element.prototype.scrollIntoView = window.reformaOriginalScrollIntoView;
    delete window.reformaOriginalScrollIntoView;
  }
  
  if (window.reformaOriginalScrollTo) {
    window.scrollTo = window.reformaOriginalScrollTo;
    delete window.reformaOriginalScrollTo;
  }
  
  if (window.reformaOriginalScroll) {
    window.scroll = window.reformaOriginalScroll;
    delete window.reformaOriginalScroll;
  }
  
  // Restore GSAP
  if (window.gsap && window.reformaOriginalGsap) {
    window.gsap.to = window.reformaOriginalGsap.to;
    window.gsap.from = window.reformaOriginalGsap.from;
    window.gsap.fromTo = window.reformaOriginalGsap.fromTo;
    window.gsap.timeline = window.reformaOriginalGsap.timeline;
    window.gsap.set = window.reformaOriginalGsap.set;
    delete window.reformaOriginalGsap;
  }
  
  // Restore ScrollTrigger
  if (window.ScrollTrigger && window.reformaOriginalScrollTriggerCreate) {
    window.ScrollTrigger.create = window.reformaOriginalScrollTriggerCreate;
    delete window.reformaOriginalScrollTriggerCreate;
  }
  
  // Restore TweenMax
  if (window.TweenMax && window.reformaOriginalTweenMax) {
    window.TweenMax.to = window.reformaOriginalTweenMax.to;
    window.TweenMax.from = window.reformaOriginalTweenMax.from;
    window.TweenMax.fromTo = window.reformaOriginalTweenMax.fromTo;
    delete window.reformaOriginalTweenMax;
  }
  
  // Restore TweenLite
  if (window.TweenLite && window.reformaOriginalTweenLite) {
    window.TweenLite.to = window.reformaOriginalTweenLite.to;
    window.TweenLite.from = window.reformaOriginalTweenLite.from;
    window.TweenLite.fromTo = window.reformaOriginalTweenLite.fromTo;
    delete window.reformaOriginalTweenLite;
  }
  
  // Remove color blind filter
  const colorBlindStyle = document.getElementById('reforma-color-blind');
  if (colorBlindStyle) {
    colorBlindStyle.remove();
  }
  
  // Remove SVG filter
  const svgFilter = document.getElementById('reforma-cb-svg');
  if (svgFilter) {
    svgFilter.remove();
  }
  
  // Clear stored original styles so they can be re-captured
  window.reformaOriginalStyles = null;
  window.reformaOriginalElements = null;
  window.reformaOriginalImageStyles = null;
  window.reformaOriginalImageElements = null;
}

export async function resetAll() {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedResetAll,
    });
    
    resetState();
    resetSliders();
    updateUI();
    
    setTimeout(() => {
      checkWcag();
      detectAndRenderTextStyles();
    }, 100);
  } catch (e) {
    console.error('Error resetting:', e);
  }
}

// Initialize event listener
if (resetButton) resetButton.addEventListener('click', resetAll);
