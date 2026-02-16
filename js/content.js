(function() {
  'use strict';

  const REFORMA_TOOLBAR_STORAGE_KEY = 'reforma_toolbar_visible';

  function showToolbar() {
    const bar = document.getElementById('reforma-page-toolbar');
    if (bar) {
      bar.classList.remove('hidden');
      if (document.body) document.body.classList.add('reforma-toolbar-visible');
      chrome.storage.local.set({ [REFORMA_TOOLBAR_STORAGE_KEY]: true });
    }
  }

  function hideToolbar() {
    const bar = document.getElementById('reforma-page-toolbar');
    if (bar) {
      bar.classList.add('hidden');
      if (document.body) document.body.classList.remove('reforma-toolbar-visible');
      chrome.storage.local.set({ [REFORMA_TOOLBAR_STORAGE_KEY]: false });
    }
  }

  function attachToolbarListeners(bar) {
    bar.querySelectorAll('[data-reforma-action="openPopup"]').forEach(function(btn) {
      btn.addEventListener('click', function() { chrome.runtime.sendMessage({ action: 'openPopup' }); });
    });
    const closeBtn = bar.querySelector('[data-reforma-action="close"]');
    if (closeBtn) closeBtn.addEventListener('click', hideToolbar);
  }

  function ensureToolbarInjected() {
    return new Promise(function(resolve) {
      if (!document.body) { resolve(); return; }
      if (document.getElementById('reforma-page-toolbar')) { resolve(); return; }

      const toolbarUrl = chrome.runtime.getURL('page-toolbar.html');
      fetch(toolbarUrl)
        .then(function(r) { return r.text(); })
        .then(function(html) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const link = doc.querySelector('#reforma-toolbar-stylesheet');
          const stylesLink = doc.querySelector('#reforma-toolbar-styles-css');
          const bar = doc.querySelector('#reforma-page-toolbar');
          if (link) {
            link.href = chrome.runtime.getURL('toolbar.css');
            (document.head || document.documentElement).appendChild(link.cloneNode(true));
          }
          if (stylesLink) {
            stylesLink.href = chrome.runtime.getURL('styles.css');
            (document.head || document.documentElement).appendChild(stylesLink.cloneNode(true));
          }
          if (!bar) { resolve(); return; }
          const barClone = bar.cloneNode(true);
          const logo = barClone.querySelector('#reforma-toolbar-logo');
          if (logo) {
            logo.src = chrome.runtime.getURL('jz_logo.png');
            logo.onerror = function() { logo.style.display = 'none'; };
          }
          document.body.insertBefore(barClone, document.body.firstChild);
          document.body.classList.add('reforma-toolbar-visible');
          attachToolbarListeners(barClone);
          resolve();
        })
        .catch(function() { resolve(); });
    });
  }

  function toggleToolbar() {
    ensureToolbarInjected().then(function() {
      const bar = document.getElementById('reforma-page-toolbar');
      if (!bar) return;
      if (bar.classList.contains('hidden')) showToolbar();
      else hideToolbar();
    });
  }

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'reforma-toggle-page-toolbar') {
      toggleToolbar();
      sendResponse({ success: true });
      return true;
    }
    return true;
  });

  function initToolbar() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToolbar);
        return;
      }
      setTimeout(initToolbar, 100);
      return;
    }
    ensureToolbarInjected().then(function() {
      chrome.storage.local.get([REFORMA_TOOLBAR_STORAGE_KEY], function(result) {
        if (result[REFORMA_TOOLBAR_STORAGE_KEY] === false) hideToolbar();
      });
      const bar = document.getElementById('reforma-page-toolbar');
      if (bar && bar.classList.contains('hidden')) showToolbar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToolbar);
  } else {
    initToolbar();
  }
})();
