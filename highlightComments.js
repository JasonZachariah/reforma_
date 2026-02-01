// Highlight & Comment: runs in main frame and iframes so selection works on all pages
(function() {
  'use strict';

  const STORAGE_KEY = 'reforma_highlights';
  const HIGHLIGHT_CLASS = 'reforma-highlight';
  const TOOLBAR_ID = 'reforma-highlight-toolbar';
  const PANEL_ID = 'reforma-highlight-panel';
  const TOOLTIP_ID = 'reforma-highlight-tooltip';

  function getPageKey() {
    try {
      return location.href || '';
    } catch (e) { return ''; }
  }

  function injectStyles() {
    if (!document.head) return;
    if (document.getElementById('reforma-highlight-styles')) return;
    const style = document.createElement('style');
    style.id = 'reforma-highlight-styles';
    style.textContent = [
      'mark.reforma-highlight{background-color:#fef08a!important;color:inherit!important;padding:0 1px!important;border-radius:2px!important}',
      'mark.reforma-highlight:hover{background-color:#fde047!important}',
      '#reforma-highlight-toolbar,#reforma-highlight-panel{position:fixed;z-index:2147483646;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,0.15);border-radius:8px;background:#fff}',
      '#reforma-highlight-toolbar{padding:4px 8px;display:flex;align-items:center;gap:6px}',
      '#reforma-highlight-toolbar button{padding:6px 12px;background:#D84315;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500}',
      '#reforma-highlight-toolbar button:hover{background:#BF360C}',
      '#reforma-highlight-panel{padding:12px;min-width:260px}',
      '#reforma-highlight-panel textarea{width:100%;min-height:60px;padding:8px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;resize:vertical;box-sizing:border-box}',
      '#reforma-highlight-panel .reforma-save-btn{width:100%;padding:8px 12px;background:#D84315;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500}',
      '#reforma-highlight-tooltip{position:fixed;z-index:2147483647;max-width:280px;padding:8px 12px;background:#1f2937;color:#fff;font-size:12px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:none}'
    ].join('');
    document.head.appendChild(style);
  }

  function findTextRange(searchText) {
    if (!searchText || !document.body) return null;
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function(n) {
          try {
            if (n.parentElement && n.parentElement.closest('.' + HIGHLIGHT_CLASS))
              return NodeFilter.FILTER_REJECT;
          } catch (e) { return NodeFilter.FILTER_REJECT; }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [];
      let fullText = '';
      while (walker.nextNode()) {
        const n = walker.currentNode;
        nodes.push({ node: n, start: fullText.length, text: n.textContent });
        fullText += n.textContent;
      }
      const idx = fullText.indexOf(searchText);
      if (idx === -1) return null;
      const endIdx = idx + searchText.length;
      let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
      for (const item of nodes) {
        const itemEnd = item.start + item.text.length;
        if (startNode === null && itemEnd > idx) {
          startNode = item.node;
          startOffset = idx - item.start;
        }
        if (endNode === null && itemEnd >= endIdx) {
          endNode = item.node;
          endOffset = endIdx - item.start;
          break;
        }
      }
      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        if (range.toString() === searchText) return range;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function wrapRangeInMark(range, id, comment) {
    try {
      const mark = document.createElement('mark');
      mark.className = HIGHLIGHT_CLASS;
      mark.setAttribute('data-reforma-comment-id', id);
      if (comment) mark.setAttribute('data-reforma-comment', comment);
      mark.setAttribute('title', comment || 'Highlight');
      try {
        range.surroundContents(mark);
      } catch (e) { return; }
      addHoverTooltip(mark);
    } catch (e) { /* ignore */ }
  }

  function addHoverTooltip(mark) {
    const comment = mark.getAttribute('data-reforma-comment');
    if (!comment) return;
    mark.addEventListener('mouseenter', function() {
      let tip = document.getElementById(TOOLTIP_ID);
      if (!tip) {
        tip = document.createElement('div');
        tip.id = TOOLTIP_ID;
        document.body.appendChild(tip);
      }
      tip.textContent = comment;
      try {
        const rect = mark.getBoundingClientRect();
        tip.style.left = Math.max(8, Math.min(rect.left, (window.innerWidth || 400) - 296)) + 'px';
        tip.style.top = (rect.top - 8) + 'px';
        tip.style.transform = 'translateY(-100%)';
      } catch (e) { /* ignore */ }
    });
    mark.addEventListener('mouseleave', function() {
      const tip = document.getElementById(TOOLTIP_ID);
      if (tip) tip.remove();
    });
  }

  function loadHighlights() {
    try {
      chrome.storage.local.get([STORAGE_KEY], function(result) {
        try {
          const all = result[STORAGE_KEY] || {};
          const list = all[getPageKey()] || [];
          list.forEach(function(item) {
            try {
              if (!item || !item.text || document.querySelector('[data-reforma-comment-id="' + item.id + '"]')) return;
              const range = findTextRange(item.text);
              if (range) wrapRangeInMark(range, item.id, item.comment || '');
            } catch (e) { /* skip */ }
          });
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }

  function showToolbar(rect, selection) {
    if (!document.body) return;
    hideToolbar();
    hidePanel();
    try {
      const toolbar = document.createElement('div');
      toolbar.id = TOOLBAR_ID;
      const left = Math.max(10, Math.min(rect.left, (window.innerWidth || 400) - 200));
      const top = Math.max(10, (rect.top || 0) - 48);
      toolbar.style.left = left + 'px';
      toolbar.style.top = top + 'px';
      toolbar.style.position = 'fixed';

      const btn = document.createElement('button');
      btn.textContent = 'Highlight & Comment';
      btn.type = 'button';
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const r = selection.rangeCount ? selection.getRangeAt(0) : null;
        if (r && !r.collapsed) showPanel(r);
      });
      toolbar.appendChild(btn);
      document.body.appendChild(toolbar);
    } catch (e) { /* ignore */ }
  }

  function showPanel(range) {
    hidePanel();
    hideToolbar();
    if (!document.body) return;
    try {
      const panel = document.createElement('div');
      panel.id = PANEL_ID;
      const rect = range.getBoundingClientRect();
      panel.style.left = Math.max(10, Math.min(rect.left, (window.innerWidth || 400) - 280)) + 'px';
      panel.style.top = (rect.bottom + 8) + 'px';
      panel.style.position = 'fixed';

      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Add a comment (optional)';
      textarea.rows = 2;
      panel.appendChild(textarea);

      const saveBtn = document.createElement('button');
      saveBtn.className = 'reforma-save-btn';
      saveBtn.textContent = 'Save Comments';
      saveBtn.addEventListener('click', function() {
        const comment = textarea.value.trim();
        saveHighlight(range, comment);
        hidePanel();
        hideToolbar();
        try { if (window.getSelection) window.getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
      });
      panel.appendChild(saveBtn);
      document.body.appendChild(panel);
      textarea.focus();
    } catch (e) { /* ignore */ }
  }

  function saveHighlight(range, comment) {
    try {
      const text = range.toString();
      if (!text || text.length > 10000) return;
      const id = 'reforma-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      wrapRangeInMark(range.cloneRange(), id, comment);
      const key = getPageKey();
      chrome.storage.local.get([STORAGE_KEY], function(result) {
        try {
          const all = result[STORAGE_KEY] || {};
          const list = all[key] || [];
          list.push({ id: id, text: text, comment: comment });
          all[key] = list;
          chrome.storage.local.set({ [STORAGE_KEY]: all });
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }

  function hideToolbar() {
    try {
      const el = document.getElementById(TOOLBAR_ID);
      if (el) el.remove();
    } catch (e) { /* ignore */ }
  }

  function hidePanel() {
    try {
      const el = document.getElementById(PANEL_ID);
      if (el) el.remove();
    } catch (e) { /* ignore */ }
  }

  function tryShowToolbar() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || document.getElementById(TOOLBAR_ID) || document.getElementById(PANEL_ID)) return;
      if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!range || range.collapsed) return;
      const rect = range.getBoundingClientRect();
      if (rect.width <= 0 && rect.height <= 0) return;
      showToolbar(rect, sel);
    } catch (e) { /* ignore */ }
  }

  var selectionChangeTimer = null;
  document.addEventListener('mouseup', function() { setTimeout(tryShowToolbar, 50); });
  document.addEventListener('selectionchange', function() {
    if (selectionChangeTimer) clearTimeout(selectionChangeTimer);
    selectionChangeTimer = setTimeout(tryShowToolbar, 100);
  });

  document.addEventListener('mousedown', function(e) {
    try {
      if (!e.target.closest('#' + TOOLBAR_ID) && !e.target.closest('#' + PANEL_ID)) {
        hidePanel();
        hideToolbar();
      }
    } catch (e) { /* ignore */ }
  });

  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action === 'reforma-show-highlight-hint') {
      try {
        var id = 'reforma-highlight-hint';
        var existing = document.getElementById(id);
        if (existing) existing.remove();
        var el = document.createElement('div');
        el.id = id;
        el.textContent = 'Select text to highlight and add a comment.';
        el.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:2147483646;padding:10px 14px;background:#D84315;color:white;font-size:13px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.2);font-family:sans-serif;';
        document.body.appendChild(el);
        setTimeout(function() { el.remove(); }, 3000);
        sendResponse({ ok: true });
      } catch (e) { sendResponse({ ok: false }); }
    }
    return true;
  });

  function init() {
    try {
      if (!document.body) {
        setTimeout(init, 100);
        return;
      }
      injectStyles();
      loadHighlights();
      setTimeout(function() {
        try {
          document.querySelectorAll('mark.' + HIGHLIGHT_CLASS).forEach(function(mark) {
            if (mark.getAttribute('data-reforma-comment')) addHoverTooltip(mark);
          });
        } catch (e) { /* ignore */ }
      }, 500);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 500);
})();
