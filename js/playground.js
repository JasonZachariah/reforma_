(function () {
  'use strict';
  if (self.__reformaPlaygroundReady) return;
  self.__reformaPlaygroundReady = true;

  var enabled = false;
  var clickHandler = null;
  var areaCommentMode = false;
  var gapMode = false;
  var dragStart = null;
  var previewEl = null;
  var boundMove = null;
  var boundUp = null;
  var gapMoveHandler = null;
  var overlayDiv = null;

  var PRIMARY_50 = 'rgba(214, 67, 227, 0.5)';
  var CONTAINER_ID = 'reforma-playground-comments';
  var PREVIEW_ID = 'reforma-playground-preview';
  var HIGHLIGHT_LAYER_ID = 'reforma-playground-highlight';
  var OVERLAY_ID = 'reforma-playground-overlay';
  var GAP_BADGE_ID = 'reforma-playground-gap-badge';
  var STORAGE_KEY_PREFIX = 'reforma-playground-';
  var frozenStyles = null;
  var GAP_MARGIN_COLOR = 'rgba(255,165,0,0.4)';
  var GAP_PADDING_COLOR = 'rgba(32,201,151,0.35)';
  var GAP_GAP_COLOR = 'rgba(13,110,253,0.35)';

  var COMMENT_COLORS = [
    { id: 'purple', border: 'rgba(214,67,227,0.8)', bar: '#D643E3', label: 'Purple' },
    { id: 'red', border: 'rgba(220,53,69,0.85)', bar: '#DC3545', label: 'Red' },
    { id: 'orange', border: 'rgba(253,126,20,0.85)', bar: '#FD7E14', label: 'Orange' },
    { id: 'green', border: 'rgba(32,201,151,0.85)', bar: '#20C997', label: 'Green' },
    { id: 'blue', border: 'rgba(13,110,253,0.85)', bar: '#0D6EFD', label: 'Blue' },
    { id: 'slate', border: 'rgba(73,80,87,0.85)', bar: '#495057', label: 'Slate' }
  ];
  var DEFAULT_COLOR_ID = 'purple';

  function getStorageKey() {
    return STORAGE_KEY_PREFIX + (window.location.href || 'default');
  }

  function applyCommentColor(wrap, colorId) {
    var c = COMMENT_COLORS.find(function (x) { return x.id === colorId; }) || COMMENT_COLORS[0];
    wrap.style.borderColor = c.border;
    var bar = wrap.querySelector('.reforma-playground-color-bar');
    if (bar) bar.style.background = c.bar;
    wrap.setAttribute('data-color-id', colorId);
  }

  function buildCommentToolbar(wrap, isArea) {
    var bar = document.createElement('div');
    bar.className = 'reforma-playground-color-bar';
    bar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:4px;border-radius:8px 8px 0 0;background:' + (COMMENT_COLORS[0].bar) + ';';
    wrap.appendChild(bar);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-bottom:4px;min-height:24px;';
    row.className = 'reforma-playground-comment-toolbar';

    var swatches = document.createElement('div');
    swatches.style.cssText = 'display:flex;gap:3px;margin-right:auto;flex-wrap:wrap;';
    COMMENT_COLORS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', c.label);
      btn.title = c.label;
      btn.style.cssText = 'width:16px;height:16px;border-radius:50%;border:2px solid ' + c.border + ';background:' + c.bar + ';cursor:pointer;padding:0;';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        applyCommentColor(wrap, c.id);
      });
      swatches.appendChild(btn);
    });
    row.appendChild(swatches);

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.setAttribute('aria-label', 'Save comment');
    saveBtn.style.cssText = 'padding:2px 8px;font-size:11px;font-family:' + COMMENT_FONT + ';font-weight:500;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;color:#372828;';
    saveBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var textEl = wrap.querySelector('.reforma-playground-comment-text');
      var payload = {
        id: wrap.getAttribute('data-comment-id') || 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        colorId: wrap.getAttribute('data-color-id') || DEFAULT_COLOR_ID,
        text: textEl ? (textEl.innerText || '').trim() : '',
        left: parseFloat(wrap.style.left) || 0,
        top: parseFloat(wrap.style.top) || 0
      };
      if (isArea) {
        payload.width = parseFloat(wrap.style.width) || 0;
        payload.height = parseFloat(wrap.style.height) || 0;
      }
      wrap.setAttribute('data-comment-id', payload.id);
      var key = getStorageKey();
      chrome.storage.local.get(key, function (obj) {
        var list = (obj[key] && Array.isArray(obj[key].comments)) ? obj[key].comments.slice() : [];
        var idx = list.findIndex(function (item) { return item.id === payload.id; });
        if (idx >= 0) list[idx] = payload;
        else list.push(payload);
        var toSave = {};
        toSave[key] = { url: window.location.href, comments: list };
        chrome.storage.local.set(toSave, function () {
          saveBtn.textContent = 'Saved';
          saveBtn.style.color = '#20C997';
          setTimeout(function () {
            saveBtn.textContent = 'Save';
            saveBtn.style.color = '';
          }, 1500);
        });
      });
    });
    row.appendChild(saveBtn);

    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Remove comment');
    close.style.cssText = 'width:20px;height:20px;padding:0;border:none;background:transparent;color:#372828;cursor:pointer;font-size:18px;line-height:1;';
    close.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      wrap.remove();
    });
    row.appendChild(close);

    wrap.appendChild(row);
  }

  var COMMENT_FONT = "'Urbanist', sans-serif";

  function ensureUrbanistLoaded() {
    if (document.getElementById('reforma-playground-font-urbanist')) return;
    var link = document.createElement('link');
    link.id = 'reforma-playground-font-urbanist';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Urbanist:wght@500&display=swap';
    document.head.appendChild(link);
  }

  function getContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (!el) {
      ensureUrbanistLoaded();
      el = document.createElement('div');
      el.id = CONTAINER_ID;
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;';
      document.body.appendChild(el);
    }
    return el;
  }

  function getOverlayElement() {
    if (gapMode && overlayDiv) return overlayDiv;
    return document.getElementById(CONTAINER_ID);
  }

  function ensureGapModeLayers() {
    var container = getContainer();
    if (document.getElementById(HIGHLIGHT_LAYER_ID)) return;
    var hl = document.createElement('div');
    hl.id = HIGHLIGHT_LAYER_ID;
    hl.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;';
    container.appendChild(hl);
    overlayDiv = document.createElement('div');
    overlayDiv.id = OVERLAY_ID;
    overlayDiv.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:' + PRIMARY_50 + ';pointer-events:auto;';
    container.appendChild(overlayDiv);
    var badge = document.createElement('div');
    badge.id = GAP_BADGE_ID;
    badge.textContent = 'Gap mode';
    badge.style.cssText = 'position:fixed;bottom:12px;right:12px;padding:8px 12px;background:rgba(0,0,0,0.9);color:#fff;font-family:sans-serif;font-weight:600;font-size:13px;border-radius:6px;z-index:2147483647;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,0.4);';
    overlayDiv.appendChild(badge);
  }

  function ensureGapModeBadge() {
    if (document.getElementById(GAP_BADGE_ID)) return;
    var ov = document.getElementById(OVERLAY_ID);
    if (!ov) return;
    var badge = document.createElement('div');
    badge.id = GAP_BADGE_ID;
    badge.textContent = 'Gap mode';
    badge.style.cssText = 'position:fixed;bottom:12px;right:12px;padding:8px 12px;background:rgba(0,0,0,0.9);color:#fff;font-family:sans-serif;font-weight:600;font-size:13px;border-radius:6px;z-index:2147483647;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,0.4);';
    ov.appendChild(badge);
  }

  function removeGapModeBadge() {
    var badge = document.getElementById(GAP_BADGE_ID);
    if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
  }

  function getElementUnderPoint(x, y) {
    var container = document.getElementById(CONTAINER_ID);
    var overlay = document.getElementById(OVERLAY_ID);
    if (!container || !overlay) return null;
    overlay.style.pointerEvents = 'none';
    var list = document.elementsFromPoint(x, y);
    overlay.style.pointerEvents = 'auto';
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el !== container && !container.contains(el)) return el;
    }
    return null;
  }

  function getBoxModelDetails(el) {
    if (!el || !el.getBoundingClientRect) return '';
    var s = window.getComputedStyle(el);
    var m = { t: s.marginTop, r: s.marginRight, b: s.marginBottom, l: s.marginLeft };
    var p = { t: s.paddingTop, r: s.paddingRight, b: s.paddingBottom, l: s.paddingLeft };
    var lines = [];
    lines.push('margin: ' + m.t + ' ' + m.r + ' ' + m.b + ' ' + m.l);
    lines.push('padding: ' + p.t + ' ' + p.r + ' ' + p.b + ' ' + p.l);
    var parent = el.parentElement;
    if (parent) {
      var ps = window.getComputedStyle(parent);
      var d = ps.display;
      if (d === 'flex' || d === 'grid') {
        var gap = ps.gap;
        var cg = ps.columnGap;
        var rg = ps.rowGap;
        if (gap && gap !== 'normal') lines.push('parent gap: ' + gap);
        else if (cg || rg) lines.push('parent column-gap: ' + cg + '; row-gap: ' + rg);
      }
    }
    return lines.join('\n');
  }

  function updateGapHighlight(x, y) {
    var hl = document.getElementById(HIGHLIGHT_LAYER_ID);
    if (!hl) return;
    while (hl.firstChild) hl.removeChild(hl.firstChild);
    var el = getElementUnderPoint(x, y);
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var s = window.getComputedStyle(el);
    var mt = parseFloat(s.marginTop) || 0;
    var mr = parseFloat(s.marginRight) || 0;
    var mb = parseFloat(s.marginBottom) || 0;
    var ml = parseFloat(s.marginLeft) || 0;
    var pt = parseFloat(s.paddingTop) || 0;
    var pr = parseFloat(s.paddingRight) || 0;
    var pb = parseFloat(s.paddingBottom) || 0;
    var pl = parseFloat(s.paddingLeft) || 0;
    var marginBox = document.createElement('div');
    marginBox.style.cssText = 'position:fixed;left:' + (rect.left - ml) + 'px;top:' + (rect.top - mt) + 'px;width:' + (rect.width + ml + mr) + 'px;height:' + (rect.height + mt + mb) + 'px;background:' + GAP_MARGIN_COLOR + ';border:1px dashed rgba(255,165,0,0.8);pointer-events:none;box-sizing:border-box;';
    hl.appendChild(marginBox);
    var paddingBox = document.createElement('div');
    paddingBox.style.cssText = 'position:fixed;left:' + (rect.left + pl) + 'px;top:' + (rect.top + pt) + 'px;width:' + (rect.width - pl - pr) + 'px;height:' + (rect.height - pt - pb) + 'px;background:' + GAP_PADDING_COLOR + ';border:1px solid rgba(32,201,151,0.8);pointer-events:none;box-sizing:border-box;';
    hl.appendChild(paddingBox);
  }

  function freezePage() {
    if (frozenStyles) return;
    frozenStyles = {
      overflowHtml: document.documentElement.style.overflow,
      overflowBody: document.body.style.overflow,
      positionBody: document.body.style.position,
      leftBody: document.body.style.left,
      rightBody: document.body.style.right,
      topBody: document.body.style.top,
      bottomBody: document.body.style.bottom,
      widthBody: document.body.style.width,
      heightBody: document.body.style.height
    };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.top = '0';
    document.body.style.bottom = '0';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
  }

  function unfreezePage() {
    if (!frozenStyles) return;
    document.documentElement.style.overflow = frozenStyles.overflowHtml || '';
    document.body.style.overflow = frozenStyles.overflowBody || '';
    document.body.style.position = frozenStyles.positionBody || '';
    document.body.style.left = frozenStyles.leftBody || '';
    document.body.style.right = frozenStyles.rightBody || '';
    document.body.style.top = frozenStyles.topBody || '';
    document.body.style.bottom = frozenStyles.bottomBody || '';
    document.body.style.width = frozenStyles.widthBody || '';
    document.body.style.height = frozenStyles.heightBody || '';
    frozenStyles = null;
  }

  function createComment(x, y, gapDetails) {
    var container = getContainer();
    var def = COMMENT_COLORS[0];

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;min-width:200px;max-width:320px;background:rgba(255,255,255,0.98);color:#181211;padding:8px 10px 10px 10px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.2);border:2px solid ' + def.border + ';z-index:2147483646;font-family:' + COMMENT_FONT + ';font-weight:500;font-size:13px;pointer-events:auto;';
    wrap.className = 'reforma-playground-comment';
    wrap.setAttribute('data-color-id', DEFAULT_COLOR_ID);

    buildCommentToolbar(wrap, false);

    if (gapDetails) {
      var detailsBlock = document.createElement('div');
      detailsBlock.className = 'reforma-playground-gap-details';
      detailsBlock.style.cssText = 'font-size:11px;color:#495057;white-space:pre-wrap;word-break:break-word;margin-bottom:6px;padding:6px 8px;background:rgba(0,0,0,0.06);border-radius:4px;';
      detailsBlock.textContent = gapDetails;
      wrap.appendChild(detailsBlock);
    }

    var text = document.createElement('div');
    text.className = 'reforma-playground-comment-text';
    text.contentEditable = 'true';
    text.style.cssText = 'min-height:1.2em;outline:none;word-break:break-word;';
    text.setAttribute('data-placeholder', 'Comment...');
    text.textContent = '';

    wrap.appendChild(text);
    container.appendChild(wrap);

    text.focus();
  }

  function createAreaComment(left, top, width, height, gapDetails) {
    if (width < 8 || height < 8) return;
    var container = getContainer();
    var def = COMMENT_COLORS[0];

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:' + left + 'px;top:' + top + 'px;width:' + width + 'px;height:' + height + 'px;background:rgba(255,255,255,0.95);color:#181211;padding:8px 10px 10px 10px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.2);border:2px solid ' + def.border + ';z-index:2147483646;font-family:' + COMMENT_FONT + ';font-weight:500;font-size:13px;pointer-events:auto;box-sizing:border-box;overflow:auto;';
    wrap.className = 'reforma-playground-comment reforma-playground-area-comment';
    wrap.setAttribute('data-color-id', DEFAULT_COLOR_ID);

    buildCommentToolbar(wrap, true);

    if (gapDetails) {
      var detailsBlock = document.createElement('div');
      detailsBlock.className = 'reforma-playground-gap-details';
      detailsBlock.style.cssText = 'font-size:11px;color:#495057;white-space:pre-wrap;word-break:break-word;margin-bottom:6px;padding:6px 8px;background:rgba(0,0,0,0.06);border-radius:4px;';
      detailsBlock.textContent = gapDetails;
      wrap.appendChild(detailsBlock);
    }

    var text = document.createElement('div');
    text.className = 'reforma-playground-comment-text';
    text.contentEditable = 'true';
    text.style.cssText = 'min-height:2em;outline:none;word-break:break-word;';
    text.setAttribute('data-placeholder', 'Comment...');
    text.textContent = '';

    wrap.appendChild(text);
    container.appendChild(wrap);
    text.focus();
  }

  function onOverlayClick(e) {
    if (!enabled) return;
    if (e.target.closest && e.target.closest('.reforma-playground-comment')) return;
    if (gapMode && e.target.id !== OVERLAY_ID) return;
    if (!gapMode && e.target.id !== CONTAINER_ID) return;
    e.preventDefault();
    e.stopPropagation();
    var gapDetails = null;
    if (gapMode) {
      var el = getElementUnderPoint(e.clientX, e.clientY);
      if (el) gapDetails = getBoxModelDetails(el);
    }
    createComment(e.clientX, e.clientY, gapDetails);
  }

  function onOverlayMouseDown(e) {
    if (!enabled || !areaCommentMode) return;
    if (e.target.closest && e.target.closest('.reforma-playground-comment')) return;
    if (gapMode && e.target.id !== OVERLAY_ID) return;
    if (!gapMode && e.target.id !== CONTAINER_ID) return;
    e.preventDefault();
    e.stopPropagation();
    dragStart = { x: e.clientX, y: e.clientY };
    var prev = document.getElementById(PREVIEW_ID);
    if (prev) prev.remove();
    previewEl = document.createElement('div');
    previewEl.id = PREVIEW_ID;
    previewEl.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;width:0;height:0;background:' + PRIMARY_50 + ';border:2px dashed rgba(214,67,227,0.9);z-index:2147483647;pointer-events:none;';
    getContainer().appendChild(previewEl);
    boundMove = function (ev) {
      if (!dragStart || !previewEl) return;
      var l = Math.min(dragStart.x, ev.clientX);
      var t = Math.min(dragStart.y, ev.clientY);
      var w = Math.abs(ev.clientX - dragStart.x);
      var h = Math.abs(ev.clientY - dragStart.y);
      previewEl.style.left = l + 'px';
      previewEl.style.top = t + 'px';
      previewEl.style.width = w + 'px';
      previewEl.style.height = h + 'px';
    };
    boundUp = function (ev) {
      document.documentElement.removeEventListener('mousemove', boundMove, true);
      document.documentElement.removeEventListener('mouseup', boundUp, true);
      if (previewEl && previewEl.parentNode) {
        var left = parseInt(previewEl.style.left, 10);
        var top = parseInt(previewEl.style.top, 10);
        var width = parseInt(previewEl.style.width, 10);
        var height = parseInt(previewEl.style.height, 10);
        previewEl.remove();
        var gapDetails = null;
        if (gapMode) {
          var el = getElementUnderPoint(left + width / 2, top + height / 2);
          if (el) gapDetails = getBoxModelDetails(el);
        }
        createAreaComment(left, top, width, height, gapDetails);
      }
      previewEl = null;
      dragStart = null;
      boundMove = null;
      boundUp = null;
    };
    document.documentElement.addEventListener('mousemove', boundMove, true);
    document.documentElement.addEventListener('mouseup', boundUp, true);
  }

  function enable(opts) {
    if (enabled) return;
    opts = opts || {};
    areaCommentMode = opts.areaComment === true;
    gapMode = opts.gapMode === true;
    enabled = true;
    var container = getContainer();
    container.style.pointerEvents = 'auto';
    if (gapMode) {
      ensureGapModeLayers();
      ensureGapModeBadge();
      container.style.background = '';
      overlayDiv = document.getElementById(OVERLAY_ID);
      if (overlayDiv) overlayDiv.style.background = PRIMARY_50;
      gapMoveHandler = function (ev) { updateGapHighlight(ev.clientX, ev.clientY); };
      if (overlayDiv) overlayDiv.addEventListener('mousemove', gapMoveHandler, true);
    } else {
      container.style.background = PRIMARY_50;
    }
    if (areaCommentMode) {
      container.addEventListener('mousedown', onOverlayMouseDown, true);
      clickHandler = onOverlayMouseDown;
    } else {
      container.addEventListener('click', onOverlayClick, true);
      clickHandler = onOverlayClick;
    }
    freezePage();
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    removeGapModeBadge();
    var container = document.getElementById(CONTAINER_ID);
    if (container) {
      var ov = document.getElementById(OVERLAY_ID);
      if (ov && gapMoveHandler) ov.removeEventListener('mousemove', gapMoveHandler, true);
      gapMoveHandler = null;
      overlayDiv = null;
      container.style.background = '';
      container.style.pointerEvents = 'none';
      container.removeEventListener('click', onOverlayClick, true);
      container.removeEventListener('mousedown', onOverlayMouseDown, true);
      var prev = document.getElementById(PREVIEW_ID);
      if (prev) prev.remove();
      while (container.firstChild) container.removeChild(container.firstChild);
    }
    unfreezePage();
  }

  function toggle(opts) {
    opts = opts || {};
    areaCommentMode = opts.areaComment === true;
    gapMode = opts.gapMode === true;
    enabled = !enabled;
    if (enabled) {
      var container = getContainer();
      container.style.pointerEvents = 'auto';
      if (gapMode) {
        ensureGapModeLayers();
        ensureGapModeBadge();
        container.style.background = '';
        overlayDiv = document.getElementById(OVERLAY_ID);
        if (overlayDiv) overlayDiv.style.background = PRIMARY_50;
        gapMoveHandler = function (ev) { updateGapHighlight(ev.clientX, ev.clientY); };
        if (overlayDiv) overlayDiv.addEventListener('mousemove', gapMoveHandler, true);
      } else {
        container.style.background = PRIMARY_50;
      }
      if (areaCommentMode) {
        container.addEventListener('mousedown', onOverlayMouseDown, true);
        clickHandler = onOverlayMouseDown;
      } else {
        container.addEventListener('click', onOverlayClick, true);
        clickHandler = onOverlayClick;
      }
      freezePage();
    } else {
      removeGapModeBadge();
      var cont = document.getElementById(CONTAINER_ID);
      if (cont) {
        var ov = document.getElementById(OVERLAY_ID);
        if (ov && gapMoveHandler) ov.removeEventListener('mousemove', gapMoveHandler, true);
        gapMoveHandler = null;
        overlayDiv = null;
        cont.style.background = '';
        cont.style.pointerEvents = 'none';
        cont.removeEventListener('click', onOverlayClick, true);
        cont.removeEventListener('mousedown', onOverlayMouseDown, true);
        var p = document.getElementById(PREVIEW_ID);
        if (p) p.remove();
        while (cont.firstChild) cont.removeChild(cont.firstChild);
      }
      unfreezePage();
    }
    return enabled;
  }

  function saveAsPdf() {
    window.print();
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'reforma-enable-playground') {
      toggle({ areaComment: request.areaComment === true, gapMode: request.gapMode === true });
      sendResponse({ success: true, enabled: enabled });
      return true;
    }
    if (request.action === 'reforma-save-pdf') {
      saveAsPdf();
      sendResponse({ success: true });
      return true;
    }
    return false;
  });
})();
