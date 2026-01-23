import { getImagesEnabled, getImagesBlurred, getAnimationsDisabled, getSelectedTextStyle } from './state.js';
import { fontSizeSlider, highlightSlider } from './sliders.js';
import { clampNumber } from './utils.js';
import { injectedSetImagesEnabled, injectedBlurImages } from './images.js';
import { injectedToggleAnimations } from './animations.js';
import { injectedApplyColorBlindMode } from './colorBlind.js';
import { injectedApplyStyles } from './sliders.js';
import { injectedToggleTextOnly } from './textOnly.js';

// DOM elements
const syncAllTabsButton = document.getElementById('syncAllTabsButton');

// Initialize sync state object
if (!window.reformaSyncState) {
  window.reformaSyncState = {
    colorBlindMode: null,
    textOnlyMode: false,
    textOnlyIncludeImages: false
  };
}

async function syncToAllTabs() {
  if (!syncAllTabsButton) return;
  
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    if (!tabs || tabs.length === 0) {
      console.log('No tabs found');
      return;
    }
    
    // Get current settings
    const fontSize = clampNumber(fontSizeSlider?.value, 10, 32, 16);
    const highlight = clampNumber(highlightSlider?.value, 0, 100, 0);
    const imagesEnabled = getImagesEnabled();
    const imagesBlurred = getImagesBlurred();
    const animationsDisabled = getAnimationsDisabled();
    const selectedTextStyle = getSelectedTextStyle();
    const colorBlindMode = window.reformaSyncState?.colorBlindMode;
    const textOnlyMode = window.reformaSyncState?.textOnlyMode;
    const textOnlyIncludeImages = window.reformaSyncState?.textOnlyIncludeImages || false;
    
    // Apply to all tabs
    const promises = tabs.map(async (tab) => {
      if (!tab.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
        return; // Skip chrome internal pages
      }
      
      try {
        // Apply text styles (font size, highlight, font family/weight/style)
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectedApplyStyles,
          args: [{
            fontSizePx: fontSize,
            highlightPct: highlight,
            fontFamily: selectedTextStyle?.fontFamily ?? null,
            fontWeight: selectedTextStyle?.fontWeight ?? null,
            fontStyle: selectedTextStyle?.fontStyle ?? null,
          }],
        });
        
        // Apply image settings
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectedSetImagesEnabled,
          args: [imagesEnabled],
        });
        
        if (imagesBlurred) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: injectedBlurImages,
            args: [true],
          });
        }
        
        // Apply animations
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectedToggleAnimations,
          args: [animationsDisabled],
        });
        
        // Apply color blind mode if set
        if (colorBlindMode) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: injectedApplyColorBlindMode,
            args: [colorBlindMode],
          });
        }
        
        // Apply text-only mode if enabled
        if (textOnlyMode) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: injectedToggleTextOnly,
            args: [true, textOnlyIncludeImages],
          });
        }
        
      } catch (e) {
        // Some tabs may not allow scripting (chrome:// pages, etc.)
        console.log(`Could not sync to tab ${tab.id}:`, e.message);
      }
    });
    
    await Promise.all(promises);
    
    // Show feedback
    const originalText = syncAllTabsButton.textContent;
    syncAllTabsButton.textContent = '✓ Synced!';
    syncAllTabsButton.disabled = true;
    
    setTimeout(() => {
      syncAllTabsButton.textContent = originalText;
      syncAllTabsButton.disabled = false;
    }, 2000);
    
  } catch (e) {
    console.error('Error syncing to all tabs:', e);
    syncAllTabsButton.textContent = 'Error - Try Again';
    setTimeout(() => {
      syncAllTabsButton.textContent = 'Sync to All Tabs';
    }, 2000);
  }
}

// Initialize event listener
if (syncAllTabsButton) {
  syncAllTabsButton.addEventListener('click', syncToAllTabs);
}
