import { getActiveTab } from './utils.js';

// DOM elements
const highlightTextButton = document.getElementById('highlightTextButton');
const highlightTextSection = document.getElementById('highlightTextSection');
const selectedTextDisplay = document.getElementById('selectedTextDisplay');
const highlightColorInput = document.getElementById('highlightColorInput');
const applyHighlightButton = document.getElementById('applyHighlightButton');

let isHighlightModeEnabled = false;
let currentSelectedText = '';
let currentSelectedRange = null;

// Get current state
async function getHighlightMode() {
  const result = await chrome.storage.local.get(['highlightTextMode']);
  return result.highlightTextMode !== false; // Default to true
}

// Set state
async function setHighlightMode(enabled) {
  await chrome.storage.local.set({ highlightTextMode: enabled });
  return enabled;
}

// Update button text
async function updateButtonText() {
  if (!highlightTextButton) return;
  
  const enabled = await getHighlightMode();
  highlightTextButton.textContent = `Text Highlight Mode: ${enabled ? 'ON' : 'OFF'}`;
}

// Toggle highlight mode
async function toggleHighlightMode() {
  if (!highlightTextButton) return;
  
  const currentState = await getHighlightMode();
  const newState = !currentState;
  
  await setHighlightMode(newState);
  isHighlightModeEnabled = newState;
  await updateButtonText();
  
  // Notify all tabs
  try {
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('chrome-extension://')) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateHighlightTextMode',
          enabled: newState
        }).catch(() => {
          // Content script might not be loaded
        });
      }
    });
  } catch (error) {
    console.error('Error updating highlight mode:', error);
  }
}

// Poll for text selection from content script (stored in chrome.storage)
function checkForTextSelection() {
  chrome.storage.local.get(['currentTextSelection'], (result) => {
    const selection = result.currentTextSelection;
    
    if (selection && selection.text) {
      currentSelectedText = selection.text;
      
      // Show the selected text in the popup
      if (selectedTextDisplay) {
        const displayText = currentSelectedText.length > 100 
          ? currentSelectedText.substring(0, 100) + '...' 
          : currentSelectedText;
        selectedTextDisplay.textContent = `"${displayText}"`;
        selectedTextDisplay.style.display = 'block';
        selectedTextDisplay.style.color = '#000';
      }
      
      // Show apply button if text is selected
      if (applyHighlightButton) {
        applyHighlightButton.style.display = 'block';
        applyHighlightButton.disabled = false;
      }
    } else {
      // Clear display if no selection
      if (selectedTextDisplay) {
        selectedTextDisplay.textContent = '';
        selectedTextDisplay.style.display = 'none';
      }
      if (applyHighlightButton) {
        applyHighlightButton.style.display = 'none';
      }
      currentSelectedText = '';
    }
  });
}

// Check for selection every 500ms
setInterval(checkForTextSelection, 500);
checkForTextSelection(); // Initial check

// Apply highlight to selected text
async function applyHighlight() {
  if (!currentSelectedText || !applyHighlightButton) return;
  
  const tab = await getActiveTab();
  if (!tab?.id) {
    alert('No active tab found');
    return;
  }
  
  // Get highlight color (default yellow)
  const color = highlightColorInput ? highlightColorInput.value : '#FFEB3B';
  
  applyHighlightButton.disabled = true;
  applyHighlightButton.textContent = 'Applying...';
  
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'applyTextHighlight',
      text: currentSelectedText,
      color: color
    });
    
    // Clear selection display
    if (selectedTextDisplay) {
      selectedTextDisplay.textContent = 'Highlight applied! Select more text to highlight.';
      selectedTextDisplay.style.color = '#4CAF50';
    }
    
    applyHighlightButton.textContent = '✓ Applied!';
    setTimeout(() => {
      if (applyHighlightButton) {
        applyHighlightButton.textContent = 'Apply Highlight';
        applyHighlightButton.disabled = false;
      }
      if (selectedTextDisplay) {
        selectedTextDisplay.textContent = '';
        selectedTextDisplay.style.display = 'none';
      }
      currentSelectedText = '';
    }, 2000);
  } catch (error) {
    console.error('Error applying highlight:', error);
    alert('Failed to apply highlight. Make sure you have text selected on the page.');
    if (applyHighlightButton) {
      applyHighlightButton.textContent = 'Apply Highlight';
      applyHighlightButton.disabled = false;
    }
  }
}

// Initialize
if (highlightTextButton) {
  highlightTextButton.addEventListener('click', toggleHighlightMode);
  getHighlightMode().then(enabled => {
    isHighlightModeEnabled = enabled;
    updateButtonText();
  });
}

if (applyHighlightButton) {
  applyHighlightButton.addEventListener('click', applyHighlight);
  applyHighlightButton.style.display = 'none'; // Hidden by default
}

// Toggle section visibility
function toggleHighlightSection() {
  if (!highlightTextSection) return;
  
  const isHidden = highlightTextSection.style.display === 'none' || !highlightTextSection.style.display;
  highlightTextSection.style.display = isHidden ? 'block' : 'none';
}

if (highlightTextButton) {
  // Also toggle section when button is clicked
  const originalToggle = highlightTextButton.onclick;
  highlightTextButton.addEventListener('click', () => {
    toggleHighlightSection();
  });
}

// Initialize section state
if (highlightTextSection) {
  highlightTextSection.style.display = 'none';
}
