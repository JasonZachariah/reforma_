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
    if (!window.reformaOriginalScrollIntoView) {
      window.reformaOriginalScrollIntoView = Element.prototype.scrollIntoView;
    }
    Element.prototype.scrollIntoView = function(...args) {
      const opts = args[0] || {};
      if (typeof opts === 'object') {
        opts.behavior = 'auto';
      }
      return window.reformaOriginalScrollIntoView.apply(this, args);
    };
    
    if (!window.reformaOriginalScrollTo) {
      window.reformaOriginalScrollTo = window.scrollTo;
    }
    window.scrollTo = function(...args) {
      const opts = args[0] || {};
      if (typeof opts === 'object' && opts.behavior) {
        opts.behavior = 'auto';
      }
      return window.reformaOriginalScrollTo.apply(this, args);
    };
    
    if (!window.reformaOriginalScroll) {
      window.reformaOriginalScroll = window.scroll;
    }
    window.scroll = function(...args) {
      const opts = args[0] || {};
      if (typeof opts === 'object' && opts.behavior) {
        opts.behavior = 'auto';
      }
      return window.reformaOriginalScroll.apply(this, args);
    };
    
    // Disable GSAP (GreenSock Animation Platform) animations
    if (window.gsap) {
      // Kill all existing GSAP animations
      try {
        window.gsap.globalTimeline.clear();
        window.gsap.killTweensOf('*');
        if (window.gsap.getAllTweens) {
          const allTweens = window.gsap.getAllTweens();
          allTweens.forEach(tween => tween.kill());
        }
      } catch (e) {
        console.log('Error killing GSAP animations:', e);
      }
      
      // Store original GSAP methods if not already stored
      if (!window.reformaOriginalGsap) {
        window.reformaOriginalGsap = {
          to: window.gsap.to,
          from: window.gsap.from,
          fromTo: window.gsap.fromTo,
          timeline: window.gsap.timeline,
          set: window.gsap.set,
          getTweensOf: window.gsap.getTweensOf,
          getAllTweens: window.gsap.getAllTweens
        };
      }
      
      // Override GSAP methods to prevent new animations
      window.gsap.to = function() {
        return { kill: () => {}, pause: () => {}, resume: () => {}, progress: () => 0 };
      };
      window.gsap.from = function() {
        return { kill: () => {}, pause: () => {}, resume: () => {}, progress: () => 0 };
      };
      window.gsap.fromTo = function() {
        return { kill: () => {}, pause: () => {}, resume: () => {}, progress: () => 0 };
      };
      window.gsap.timeline = function() {
        return {
          to: () => this,
          from: () => this,
          fromTo: () => this,
          kill: () => {},
          pause: () => {},
          resume: () => {},
          clear: () => {}
        };
      };
      window.gsap.set = function(targets, vars) {
        // Allow set() to work but without animation
        if (vars && typeof vars === 'object') {
          const elements = window.gsap.utils.toArray(targets);
          elements.forEach(el => {
            if (el && el.style) {
              Object.keys(vars).forEach(key => {
                if (key !== 'duration' && key !== 'delay' && key !== 'ease') {
                  el.style[key] = vars[key];
                }
              });
            }
          });
        }
        return { kill: () => {} };
      };
    }
    
    // Disable ScrollTrigger if it exists
    if (window.ScrollTrigger) {
      try {
        window.ScrollTrigger.getAll().forEach(trigger => trigger.kill());
        if (!window.reformaOriginalScrollTriggerCreate) {
          window.reformaOriginalScrollTriggerCreate = window.ScrollTrigger.create;
        }
        window.ScrollTrigger.create = function() {
          return { kill: () => {}, refresh: () => {}, enable: () => {}, disable: () => {} };
        };
      } catch (e) {
        console.log('Error disabling ScrollTrigger:', e);
      }
    }
    
    // Handle older GSAP versions (TweenMax, TweenLite)
    if (window.TweenMax) {
      try {
        window.TweenMax.killAll();
        if (!window.reformaOriginalTweenMax) {
          window.reformaOriginalTweenMax = {
            to: window.TweenMax.to,
            from: window.TweenMax.from,
            fromTo: window.TweenMax.fromTo
          };
        }
        window.TweenMax.to = function() { return { kill: () => {} }; };
        window.TweenMax.from = function() { return { kill: () => {} }; };
        window.TweenMax.fromTo = function() { return { kill: () => {} }; };
      } catch (e) {
        console.log('Error disabling TweenMax:', e);
      }
    }
    
    if (window.TweenLite) {
      try {
        window.TweenLite.killAll();
        if (!window.reformaOriginalTweenLite) {
          window.reformaOriginalTweenLite = {
            to: window.TweenLite.to,
            from: window.TweenLite.from,
            fromTo: window.TweenLite.fromTo
          };
        }
        window.TweenLite.to = function() { return { kill: () => {} }; };
        window.TweenLite.from = function() { return { kill: () => {} }; };
        window.TweenLite.fromTo = function() { return { kill: () => {} }; };
      } catch (e) {
        console.log('Error disabling TweenLite:', e);
      }
    }
    
  } else {
    // Re-enable animations
    if (styleEl) {
      styleEl.remove();
    }
    
    // Restore original scroll methods
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
