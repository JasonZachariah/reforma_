import { getActiveTab } from './utils.js';

const btn = document.getElementById('highlightCommentFocusBtn');
if (btn) {
  btn.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'reforma-show-highlight-hint' });
      } catch (e) {
        // Tab may be restricted (chrome://, etc.) where content script does not run
      }
    }
  });
}
