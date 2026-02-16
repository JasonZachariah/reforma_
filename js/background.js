chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openPopup') {
    sendResponse({ success: true, message: 'User should click extension icon' });
    return false;
  }

  if (request.action === 'startScreenshotMode') {
    const tabId = request.tabId;
    if (!tabId) {
      sendResponse({ ok: false });
      return false;
    }
    // Inject script so it works even on pages opened before extension load
    chrome.scripting
      .executeScript({ target: { tabId }, files: ['js/screenshots.js'] })
      .then(function () {
        return chrome.tabs.sendMessage(tabId, { action: 'startScreenshotMode' });
      })
      .then(function () {
        sendResponse({ ok: true });
      })
      .catch(function (err) {
        sendResponse({
          ok: false,
          error: (err && err.message) || chrome.runtime.lastError?.message || 'Failed'
        });
      });
    return true;
  }

  if (request.action === 'saveScreenshot') {
    const dataUrl = request.dataUrl;
    const tabUrl = request.tabUrl || '';
    const tabTitle = request.tabTitle || '';
    if (!dataUrl) {
      sendResponse({ ok: false });
      return false;
    }
    const SCREENSHOTS_KEY = 'reforma_screenshots';
    const MAX_SCREENSHOTS = 20;
    const newId = 'ss-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    chrome.storage.local.get([SCREENSHOTS_KEY], function (result) {
      const list = result[SCREENSHOTS_KEY] || [];
      list.unshift({
        id: newId,
        dataUrl: dataUrl,
        date: Date.now(),
        tabUrl: tabUrl,
        tabTitle: tabTitle
      });
      const trimmed = list.slice(0, MAX_SCREENSHOTS);
      chrome.storage.local.set({ [SCREENSHOTS_KEY]: trimmed }, function () {
        chrome.tabs.create({
          url: chrome.runtime.getURL('screenshot-viewer.html?id=' + encodeURIComponent(newId))
        });
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (request.action === 'screenshotRect') {
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    const rect = request.rect;
    const devicePixelRatio = request.devicePixelRatio || 1;
    if (!tabId || !windowId || !rect) {
      sendResponse({ ok: false });
      return false;
    }
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ ok: false });
        return;
      }
      chrome.tabs.sendMessage(tabId, {
        action: 'cropAndSave',
        dataUrl,
        rect,
        devicePixelRatio
      }).then(() => {
        sendResponse({ ok: true });
      }).catch(() => {
        sendResponse({ ok: false });
      });
    });
    return true;
  }
  
  return false;
});
