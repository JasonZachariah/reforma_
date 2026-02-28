// Reforma popup – playground toggle only.

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

const enablePlaygroundBtn = document.getElementById('enablePlaygroundBtn');

function setPlaygroundButtonState(active) {
  if (!enablePlaygroundBtn) return;
  enablePlaygroundBtn.textContent = active ? 'Disable Playground' : 'Enable Playground';
  if (active) enablePlaygroundBtn.classList.add('button-active');
  else enablePlaygroundBtn.classList.remove('button-active');
}

async function refreshPlaygroundButtonState() {
  if (!enablePlaygroundBtn) return;
  const tab = await getActiveTab();
  if (!tab?.id) return;
  const url = String(tab.url || '');
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
    setPlaygroundButtonState(false);
    return;
  }
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { action: 'reforma-get-playground-state' });
    setPlaygroundButtonState(r && r.enabled);
  } catch (e) {
    setPlaygroundButtonState(false);
  }
}
refreshPlaygroundButtonState();

if (enablePlaygroundBtn) {
  enablePlaygroundBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const tab = await getActiveTab();
    if (!tab?.id) return;
    const url = String(tab.url || '');
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) return;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['js/playground.js'] });
    } catch (injErr) {
      enablePlaygroundBtn.textContent = 'Reload page & try again';
      return;
    }
    await new Promise((res) => setTimeout(res, 250));
    try {
      const r = await chrome.tabs.sendMessage(tab.id, {
        action: 'reforma-enable-playground',
        areaComment: false,
          gapMode: true,
        playgroundFont: 'urbanist'
      });
      setPlaygroundButtonState(r && r.enabled);
    } catch (msgErr) {
      enablePlaygroundBtn.textContent = 'Reload page & try again';
      setPlaygroundButtonState(false);
    }
  });
}
