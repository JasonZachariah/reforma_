import { getActiveTab } from './utils.js';

// DOM elements
const toggleFloatingButton = document.getElementById('toggleFloatingButton');

// Get current state from storage
async function getFloatingButtonState() {
  const result = await chrome.storage.local.get(['floatingButtonVisible']);
  return result.floatingButtonVisible !== false; // Default to true
}

// Set floating button state
async function setFloatingButtonState(visible) {
  await chrome.storage.local.set({ floatingButtonVisible: visible });
  return visible;
}

// Update button text
async function updateButtonText() {
  if (!toggleFloatingButton) return;
  
  const visible = await getFloatingButtonState();
  toggleFloatingButton.textContent = visible 
    ? 'Floating Button: ON' 
    : 'Floating Button: OFF';
}

// Toggle floating button visibility
async function handleToggleFloatingButton() {
  if (!toggleFloatingButton) return;
  
  const currentState = await getFloatingButtonState();
  const newState = !currentState;
  
  await setFloatingButtonState(newState);
  await updateButtonText();
  
  // Send message to background script to toggle in all tabs
  try {
    chrome.runtime.sendMessage({
      action: 'toggleFloatingButton',
      visible: newState
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
      }
    });
    
    // Also update current tab
    const tab = await getActiveTab();
    if (tab?.id) {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleFloatingButton',
          visible: newState
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script might not be loaded yet, that's okay
            console.log('Tab message error (expected if content script not loaded):', chrome.runtime.lastError.message);
          }
        });
      } catch (e) {
        console.log('Could not send message to tab:', e);
      }
    }
  } catch (error) {
    console.error('Error toggling floating button:', error);
  }
}

// Initialize
if (toggleFloatingButton) {
  toggleFloatingButton.addEventListener('click', handleToggleFloatingButton);
  updateButtonText();
}
