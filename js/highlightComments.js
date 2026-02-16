(function() {
  'use strict';

  const STORAGE_KEY = 'reforma_highlights';
  const HIGHLIGHT_CLASS = 'reforma-highlight';
  const TOOLBAR_ID = 'reforma-highlight-toolbar';
  const PANEL_ID = 'reforma-highlight-panel';
  const TOOLTIP_ID = 'reforma-highlight-tooltip';

  function normalizePageUrl(url) {
    try {
      if (!url) return '';
      var a = new URL(url);
      return a.origin + a.pathname + a.search;
    } catch (e) { return url || ''; }
  }

  function getPageKey() {
    try {
      return normalizePageUrl(location.href || '');
    } catch (e) { return ''; }
  }

  function injectStyles() {
    if (!document.head) return;
    if (document.getElementById('reforma-highlight-styles')) return;
    const style = document.createElement('style');
    style.id = 'reforma-highlight-styles';
    style.textContent = [
      'mark.reforma-highlight{background-color:#FFE5F2!important;color:inherit!important;padding:2px 18px 2px 1px!important;border-radius:2px!important;position:relative!important;display:inline!important}',
      'mark.reforma-highlight[data-reforma-comment-number]::after{content:"#" attr(data-reforma-comment-number);font-size:9px;font-weight:700;color:#9E198C;background:#FEDAF5;padding:1px 3px;border-radius:2px;margin-left:3px;vertical-align:super;line-height:1.2;display:inline-block}',
      'mark.reforma-highlight:hover{background-color:#FEDAF5!important}',
      '.reforma-highlight-delete{position:absolute!important;top:-6px!important;right:2px!important;width:16px!important;height:16px!important;background:#9E198C!important;color:#fff!important;border:none!important;border-radius:50%!important;cursor:pointer!important;font-size:14px!important;font-weight:bold!important;line-height:1!important;display:flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 2px 4px rgba(0,0,0,0.2)!important;z-index:2147483648!important;padding:0!important;margin:0!important;flex-shrink:0!important}',
      '.reforma-highlight-delete:hover{background:#A911A9!important;transform:scale(1.1)!important}',
      '#reforma-highlight-toolbar,#reforma-highlight-panel{position:fixed;z-index:2147483646;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,0.15);border-radius:8px;background:#fff}',
      '#reforma-highlight-toolbar{padding:4px 8px;display:flex;align-items:center;gap:6px}',
      '#reforma-highlight-toolbar button{padding:6px 12px;background:#D643E3;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500}',
      '#reforma-highlight-toolbar button:hover{background:#9E198C}',
      '#reforma-highlight-panel{padding:12px;min-width:260px}',
      '#reforma-highlight-panel textarea{width:100%;min-height:60px;padding:8px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;resize:vertical;box-sizing:border-box}',
      '#reforma-highlight-panel .reforma-save-btn{width:100%;padding:8px 12px;background:#D643E3;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500}',
      '#reforma-highlight-tooltip{position:fixed;z-index:2147483647;max-width:280px;padding:8px 12px;background:#372828;color:#F9F6F6;font-size:12px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:none}'
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

  function deleteHighlight(mark, id) {
    try {
      const key = getPageKey();
      chrome.storage.local.get([STORAGE_KEY], function(result) {
        try {
          const all = result[STORAGE_KEY] || {};
          const list = all[key] || [];
          const filtered = list.filter(function(item) {
            return item.id !== id;
          });
          all[key] = filtered;
          chrome.storage.local.set({ [STORAGE_KEY]: all });
        } catch (e) { /* ignore */ }
      });
      
      // Remove the highlight from DOM
      try {
        const parent = mark.parentNode;
        if (parent) {
          // Get text content excluding the delete button
          const textContent = [];
          for (let i = 0; i < mark.childNodes.length; i++) {
            const child = mark.childNodes[i];
            if (child.nodeType === Node.TEXT_NODE) {
              textContent.push(child.textContent);
            } else if (child.nodeType === Node.ELEMENT_NODE && child.className !== 'reforma-highlight-delete') {
              // For element nodes (like the comment number badge), get their text
              textContent.push(child.textContent);
            }
          }
          const text = textContent.join('');
          
          // Replace mark with text node
          const textNode = document.createTextNode(text);
          parent.replaceChild(textNode, mark);
        }
      } catch (e) { 
        // Fallback: just remove the mark
        try {
          if (mark.parentNode) {
            mark.parentNode.removeChild(mark);
          }
        } catch (e2) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  function wrapRangeInMark(range, id, comment, commentNumber) {
    try {
      const mark = document.createElement('mark');
      mark.className = HIGHLIGHT_CLASS;
      mark.setAttribute('data-reforma-comment-id', id);
      mark.setAttribute('data-reforma-comment-number', commentNumber || '');
      if (comment) mark.setAttribute('data-reforma-comment', comment);
      const displayText = commentNumber ? `Comment #${commentNumber}${comment ? ': ' + comment : ''}` : (comment || 'Highlight');
      mark.setAttribute('title', displayText);
      
      // Add delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'reforma-highlight-delete';
      deleteBtn.textContent = '×';
      deleteBtn.setAttribute('aria-label', 'Delete highlight');
      deleteBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        deleteHighlight(mark, id);
      });
      
      try {
        range.surroundContents(mark);
        // Append delete button as child of mark
        mark.appendChild(deleteBtn);
      } catch (e) { return; }
      addHoverTooltip(mark, commentNumber);
    } catch (e) { /* ignore */ }
  }

  function addHoverTooltip(mark, commentNumber) {
    const comment = mark.getAttribute('data-reforma-comment');
    const number = commentNumber || mark.getAttribute('data-reforma-comment-number');
    if (!comment && !number) return;
    
    mark.addEventListener('mouseenter', function() {
      let tip = document.getElementById(TOOLTIP_ID);
      if (!tip) {
        tip = document.createElement('div');
        tip.id = TOOLTIP_ID;
        document.body.appendChild(tip);
      }
      const displayText = number ? `Comment #${number}${comment ? ': ' + comment : ''}` : comment;
      tip.textContent = displayText;
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

  function getNextCommentNumber(callback) {
    try {
      chrome.storage.local.get([STORAGE_KEY], function(result) {
        try {
          const all = result[STORAGE_KEY] || {};
          const list = all[getPageKey()] || [];
          let maxNumber = 0;
          list.forEach(function(item) {
            if (item && item.commentNumber && item.commentNumber > maxNumber) {
              maxNumber = item.commentNumber;
            }
          });
          callback(maxNumber + 1);
        } catch (e) { callback(1); }
      });
    } catch (e) { callback(1); }
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
              if (range) {
                const commentNumber = item.commentNumber || '';
                wrapRangeInMark(range, item.id, item.comment || '', commentNumber);
              }
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
      // Capture range now; clicking the button will clear the selection, so we must not read it on click
      const range = selection.rangeCount ? selection.getRangeAt(0) : null;
      if (!range || range.collapsed) return;

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
        showPanel(range.cloneRange());
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
      getNextCommentNumber(function(nextNumber) {
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        const rect = range.getBoundingClientRect();
        panel.style.left = Math.max(10, Math.min(rect.left, (window.innerWidth || 400) - 280)) + 'px';
        panel.style.top = (rect.bottom + 8) + 'px';
        panel.style.position = 'fixed';

        const label = document.createElement('div');
        label.textContent = 'Comment #' + nextNumber;
        label.style.cssText = 'font-weight:600;margin-bottom:8px;color:#372828;font-size:14px;';
        panel.appendChild(label);

        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Add a comment (optional)';
        textarea.rows = 2;
        panel.appendChild(textarea);

        const saveBtn = document.createElement('button');
        saveBtn.className = 'reforma-save-btn';
        saveBtn.textContent = 'Save Comment';
        saveBtn.addEventListener('click', function() {
          const comment = textarea.value.trim();
          saveHighlight(range, comment, nextNumber);
          hidePanel();
          hideToolbar();
          try { if (window.getSelection) window.getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
        });
        panel.appendChild(saveBtn);
        document.body.appendChild(panel);
        textarea.focus();
      });
    } catch (e) { /* ignore */ }
  }

  function saveHighlight(range, comment, commentNumber) {
    try {
      const text = range.toString();
      if (!text || text.length > 10000) return;
      const id = 'reforma-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      wrapRangeInMark(range.cloneRange(), id, comment, commentNumber);
      const key = getPageKey();
      chrome.storage.local.get([STORAGE_KEY], function(result) {
        try {
          const all = result[STORAGE_KEY] || {};
          const list = all[key] || [];
          list.push({ id: id, text: text, comment: comment, commentNumber: commentNumber });
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

  function clearAllHighlightsFromDOM() {
    try {
      document.querySelectorAll('mark.' + HIGHLIGHT_CLASS).forEach(function(mark) {
        try {
          const parent = mark.parentNode;
          if (!parent) return;
          const textContent = [];
          for (let i = 0; i < mark.childNodes.length; i++) {
            const child = mark.childNodes[i];
            if (child.nodeType === Node.TEXT_NODE) {
              textContent.push(child.textContent);
            } else if (child.nodeType === Node.ELEMENT_NODE && child.className !== 'reforma-highlight-delete') {
              textContent.push(child.textContent);
            }
          }
          const textNode = document.createTextNode(textContent.join(''));
          parent.replaceChild(textNode, mark);
        } catch (e) { /* skip */ }
      });
    } catch (e) { /* ignore */ }
  }

  function doReloadHighlights() {
    clearAllHighlightsFromDOM();
    loadHighlights();
  }

  try {
    window.addEventListener('reforma-reload-highlights', doReloadHighlights);
  } catch (e) { /* ignore */ }

  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action === 'reforma-show-highlight-hint') {
      try {
        var id = 'reforma-highlight-hint';
        var existing = document.getElementById(id);
        if (existing) existing.remove();
        var el = document.createElement('div');
        el.id = id;
        el.textContent = 'Select text to highlight and add a comment.';
        el.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:2147483646;padding:10px 14px;background:#D643E3;color:white;font-size:13px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.2);font-family:sans-serif;';
        document.body.appendChild(el);
        setTimeout(function() { el.remove(); }, 3000);
        sendResponse({ ok: true });
      } catch (e) { sendResponse({ ok: false }); }
    } else if (msg.action === 'reforma-reload-highlights') {
      try {
        doReloadHighlights();
        sendResponse({ ok: true });
      } catch (e) { sendResponse({ ok: false }); }
    } else if (msg.action === 'reforma-show-page-toast') {
      try {
        var toastId = 'reforma-highlight-toast';
        var existing = document.getElementById(toastId);
        if (existing) existing.remove();
        var el = document.createElement('div');
        el.id = toastId;
        el.textContent = msg.text || 'Done.';
        el.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:2147483646;padding:10px 14px;background:#D643E3;color:white;font-size:13px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.2);font-family:sans-serif;';
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
            const comment = mark.getAttribute('data-reforma-comment');
            const number = mark.getAttribute('data-reforma-comment-number');
            if (comment || number) {
              addHoverTooltip(mark, number);
            }
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
