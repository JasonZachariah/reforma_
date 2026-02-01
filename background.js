// Background service worker for Reforma extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openPopup') {
    sendResponse({ success: true, message: 'User should click extension icon' });
    return false;
  }
  
  if (request.action === 'toggleFloatingButton') {
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('chrome-extension://')) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'toggleFloatingButton',
            visible: request.visible
          }).catch(() => {
            // Tab might not have content script loaded, ignore
          });
        }
      });
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
  
  return false;
});
