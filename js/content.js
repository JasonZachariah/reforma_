(function () {
  'use strict';

  const STORAGE_VISIBLE = 'reforma_toolbar_visible';
  const STORAGE_MINIMIZED = 'reforma_toolbar_minimized';

  function getHost() {
    return document.getElementById('reforma-mini-toolbar-host');
  }

  function getBar() {
    var host = getHost();
    return host && host.shadowRoot ? host.shadowRoot.getElementById('reforma-mini-toolbar') : null;
  }

  function showToolbar() {
    var bar = getBar();
    if (bar) {
      bar.classList.remove('hidden');
      if (document.body) document.body.classList.remove('reforma-mini-toolbar-hidden');
      chrome.storage.local.set({ [STORAGE_VISIBLE]: true });
    }
  }

  function hideToolbar() {
    var bar = getBar();
    if (bar) {
      bar.classList.add('hidden');
      if (document.body) document.body.classList.add('reforma-mini-toolbar-hidden');
      chrome.storage.local.set({ [STORAGE_VISIBLE]: false });
    }
  }

  function setMinimized(minimized) {
    var bar = getBar();
    if (bar) {
      if (minimized) bar.classList.add('minimized');
      else bar.classList.remove('minimized');
      chrome.storage.local.set({ [STORAGE_MINIMIZED]: !!minimized });
    }
  }

  function toggleMinimized() {
    var bar = getBar();
    if (!bar) return;
    var minimized = bar.classList.toggle('minimized');
    chrome.storage.local.set({ [STORAGE_MINIMIZED]: minimized });
  }

  function openPopup() {
    chrome.runtime.sendMessage({ action: 'openPopup' });
  }

  function attachListeners(bar) {
    bar.querySelectorAll('[data-reforma-action="openPopup"]').forEach(function (btn) {
      btn.addEventListener('click', openPopup);
    });
    var minBtn = bar.querySelector('[data-reforma-action="minimize"]');
    if (minBtn) minBtn.addEventListener('click', toggleMinimized);
    var expandBtn = bar.querySelector('[data-reforma-action="expand"]');
    if (expandBtn) expandBtn.addEventListener('click', toggleMinimized);
  }

  function setLogoSrc(el) {
    if (!el || el.tagName !== 'IMG') return;
    el.src = chrome.runtime.getURL('jz_logo.png');
    el.onerror = function () { el.style.display = 'none'; };
  }

  function loadToolbarFromHtml() {
    return fetch(chrome.runtime.getURL('mini-toolbar.html'))
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var bar = doc.getElementById('reforma-mini-toolbar');
        if (!bar) return null;
        bar.querySelectorAll('[data-reforma-logo]').forEach(setLogoSrc);
        return bar;
      })
      .catch(function () { return null; });
  }

  function ensureInjected() {
    return new Promise(function (resolve) {
      if (!document.body) {
        resolve();
        return;
      }
      if (getHost()) {
        resolve();
        return;
      }

      var host = document.createElement('div');
      host.id = 'reforma-mini-toolbar-host';
      var shadow = host.attachShadow({ mode: 'open' });

      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('mini-toolbar.css');
      shadow.appendChild(link);

      loadToolbarFromHtml().then(function (bar) {
        if (!bar) {
          resolve();
          return;
        }
        bar.classList.add('hidden');
        if (document.body) document.body.classList.add('reforma-mini-toolbar-hidden');
        shadow.appendChild(bar);
        document.body.appendChild(host);
        attachListeners(bar);

        chrome.storage.local.get([STORAGE_VISIBLE, STORAGE_MINIMIZED], function (r) {
          if (r[STORAGE_VISIBLE] === true) showToolbar();
          if (r[STORAGE_MINIMIZED] === true) setMinimized(true);
        });
        resolve();
      });
    });
  }

  function toggleToolbar() {
    ensureInjected().then(function () {
      var bar = getBar();
      if (!bar) return;
      if (bar.classList.contains('hidden')) showToolbar();
      else hideToolbar();
    });
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'reforma-toggle-page-toolbar') {
      toggleToolbar();
      sendResponse({ success: true });
      return true;
    }
    return false;
  });

  function init() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        return;
      }
      setTimeout(init, 100);
      return;
    }
    ensureInjected();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
