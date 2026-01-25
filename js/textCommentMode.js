// Text Comment Mode toggle
const textCommentModeButton = document.getElementById('textCommentModeButton');

// Get current state
async function getTextCommentMode() {
  const result = await chrome.storage.local.get(['textCommentMode']);
  return result.textCommentMode !== false; // Default to true
}

// Set state
async function setTextCommentMode(enabled) {
  await chrome.storage.local.set({ textCommentMode: enabled });
  return enabled;
}

// Update button text
async function updateButtonText() {
  if (!textCommentModeButton) return;
  
  const enabled = await getTextCommentMode();
  textCommentModeButton.textContent = `Text Comment Mode: ${enabled ? 'ON' : 'OFF'}`;
}

// Toggle text comment mode
async function toggleTextCommentMode() {
  if (!textCommentModeButton) return;
  
  const currentState = await getTextCommentMode();
  const newState = !currentState;
  
  await setTextCommentMode(newState);
  await updateButtonText();
  
  // Notify all tabs
  try {
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('chrome-extension://')) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateTextCommentMode',
          enabled: newState
        }).catch(() => {
          // Content script might not be loaded
        });
      }
    });
  } catch (error) {
    console.error('Error updating text comment mode:', error);
  }
}

// Initialize
if (textCommentModeButton) {
  textCommentModeButton.addEventListener('click', toggleTextCommentMode);
  updateButtonText();
}
