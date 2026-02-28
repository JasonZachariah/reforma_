/**
 * Reforma Playground – overlay for adding comments and inspecting CSS box model (Gap mode).
 * Injected into pages when Enable Playground is toggled from the extension popup.
 */
(function () {
  'use strict';
  if (self.__reformaPlaygroundReady) return;
  self.__reformaPlaygroundReady = true;

  var enabled = false;
  var gapMode = false;
  var gapMoveHandler = null;
  var overlayDiv = null;
  var currentGapComment = null;

  /* DOM IDs and storage */
  var CONTAINER_ID = 'reforma-playground-comments';
  var PREVIEW_ID = 'reforma-playground-preview';
  var HIGHLIGHT_LAYER_ID = 'reforma-playground-highlight';
  var OVERLAY_ID = 'reforma-playground-overlay';
  var GAP_BADGE_ID = 'reforma-playground-gap-badge';
  var CHANGES_DRAWER_ID = 'reforma-playground-changes-drawer';
  var TAB_BORDER_ID = 'reforma-playground-tab-border';
  var STORAGE_KEY_PREFIX = 'reforma-playground-';
  var frozenStyles = null;
  var originalFonts = new Map();
  var originalStyles = new Map();
  /* 45° stripe patterns for gap mode (strip width 5px) */
  var GAP_MARGIN_STRIPE = 'repeating-linear-gradient(45deg, rgba(68,0,255,0.22) 0, rgba(68,0,255,0.22) 5px, transparent 5px, transparent 10px)';
  var GAP_PADDING_STRIPE = 'repeating-linear-gradient(45deg, rgba(201,176,32,0.2) 0, rgba(201,176,32,0.2) 5px, transparent 5px, transparent 10px)';
  var GAP_GAP_STRIPE = 'repeating-linear-gradient(45deg, rgba(213,13,253,0.2) 0, rgba(213,13,253,0.2) 5px, transparent 5px, transparent 10px)';

  var COMMENT_COLORS = [
    { id: 'purple', border: 'rgba(214,67,227,0.8)', bar: '#D643E3', label: 'Purple' },
    { id: 'red', border: 'rgba(220,53,69,0.85)', bar: '#DC3545', label: 'Red' },
    { id: 'orange', border: 'rgba(253,126,20,0.85)', bar: '#FD7E14', label: 'Orange' },
    { id: 'green', border: 'rgba(32,201,151,0.85)', bar: '#20C997', label: 'Green' },
    { id: 'blue', border: 'rgba(13,110,253,0.85)', bar: '#0D6EFD', label: 'Blue' },
    { id: 'slate', border: 'rgba(73,80,87,0.85)', bar: '#495057', label: 'Slate' }
  ];
  var DEFAULT_COLOR_ID = 'purple';

  /** Returns chrome.storage key for comments on the current page URL. */
  function getStorageKey() {
    return STORAGE_KEY_PREFIX + (window.location.href || 'default');
  }

  /** Applies a comment color (border + bar) to a comment wrap element. */
  function applyCommentColor(wrap, colorId) {
    var c = COMMENT_COLORS.find(function (x) { return x.id === colorId; }) || COMMENT_COLORS[0];
    wrap.style.borderColor = c.border;
    var bar = wrap.querySelector('.reforma-playground-color-bar');
    if (bar) bar.style.background = c.bar;
    wrap.setAttribute('data-color-id', colorId);
  }

  var GAP_INPUT = 'padding:6px 8px;font-size:11px;font-family:\'Urbanist\',sans-serif;font-weight:600;border:1px solid #D643E3;border-radius:6px;background:#FFE5F2;color:#372828;';
  var GAP_LABEL = 'font-size:10px;font-weight:700;color:#181211;font-family:\'Urbanist\',sans-serif;margin-bottom:2px;';
  var GAP_HEADER = 'font-family:\'Shantell Sans\',cursive;font-weight:600;color:#D643E3;';

  /** Builds the toolbar for a comment. Gap mode: header + separator + 4-column controls (Text Styles, Weight, Size, Color). */
  function buildCommentToolbar(wrap) {
    var bar = document.createElement('div');
    bar.className = 'reforma-playground-color-bar';
    bar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:4px;border-radius:8px 8px 0 0;background:' + (COMMENT_COLORS[0].bar) + ';';
    wrap.appendChild(bar);

    var targetEl = wrap.getAttribute('data-target-element-id') ? document.querySelector('[data-reforma-target-id="' + wrap.getAttribute('data-target-element-id') + '"]') : null;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-bottom:4px;min-height:24px;flex-wrap:wrap;max-width:100%;';
    row.className = 'reforma-playground-comment-toolbar';

    var swatches = document.createElement('div');
    swatches.style.cssText = 'display:flex;gap:3px;margin-right:auto;flex-wrap:wrap;';
    if (!gapMode || !targetEl) {
      var menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.textContent = '⋮';
      menuBtn.setAttribute('aria-label', 'Comment options');
      menuBtn.style.cssText = 'padding:4px 8px;font-size:14px;font-weight:600;border:1px solid #CDC8C6;border-radius:6px;background:#F9F6F6;cursor:pointer;color:#372828;margin-left:auto;';
      var popup = document.createElement('div');
      popup.style.cssText = 'display:none;position:absolute;top:100%;right:0;margin-top:4px;background:#fff;border:1px solid #E6E3E3;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:10px;min-width:140px;z-index:2147483649;';
      var popupSwatches = document.createElement('div');
      popupSwatches.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;';
      COMMENT_COLORS.forEach(function (c) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', c.label);
        btn.title = c.label;
        btn.style.cssText = 'width:20px;height:20px;border-radius:50%;border:2px solid ' + c.border + ';background:' + c.bar + ';cursor:pointer;padding:0;';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          applyCommentColor(wrap, c.id);
        });
        popupSwatches.appendChild(btn);
      });
      popup.appendChild(popupSwatches);
      var popupSave = document.createElement('button');
      popupSave.type = 'button';
      popupSave.textContent = 'Save';
      popupSave.style.cssText = 'display:block;width:100%;padding:6px 10px;font-size:11px;font-family:' + COMMENT_FONT + ';font-weight:500;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer;color:#372828;margin-bottom:6px;text-align:center;';
      popupSave.addEventListener('click', function (e) {
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
        wrap.setAttribute('data-comment-id', payload.id);
        var key = getStorageKey();
        chrome.storage.local.get(key, function (obj) {
          var list = (obj[key] && Array.isArray(obj[key].comments)) ? obj[key].comments.slice() : [];
          var idx = list.findIndex(function (item) { return item.id === payload.id; });
          if (idx >= 0) list[idx] = payload;
          else list.push(payload);
          chrome.storage.local.set({ [key]: { url: window.location.href, comments: list } }, function () {
            popupSave.textContent = 'Saved';
            popupSave.style.color = '#20C997';
            setTimeout(function () { popupSave.textContent = 'Save'; popupSave.style.color = ''; }, 1500);
          });
        });
        popup.style.display = 'none';
      });
      popup.appendChild(popupSave);
      var popupClose = document.createElement('button');
      popupClose.type = 'button';
      popupClose.textContent = 'Remove';
      popupClose.style.cssText = 'display:block;width:100%;padding:6px 10px;font-size:11px;font-family:' + COMMENT_FONT + ';font-weight:500;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer;color:#372828;text-align:center;';
      popupClose.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); popup.style.display = 'none'; wrap.remove(); });
      popup.appendChild(popupClose);
      var menuWrap = document.createElement('div');
      menuWrap.style.cssText = 'position:relative;';
      menuWrap.appendChild(menuBtn);
      menuWrap.appendChild(popup);
      function closePopupOnOutsideClick(ev) {
        if (!menuWrap.contains(ev.target)) {
          popup.style.display = 'none';
          document.removeEventListener('click', closePopupOnOutsideClick, true);
        }
      }
      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (popup.style.display === 'none' || !popup.style.display) {
          popup.style.display = 'block';
          setTimeout(function () { document.addEventListener('click', closePopupOnOutsideClick, true); }, 0);
        } else {
          popup.style.display = 'none';
          document.removeEventListener('click', closePopupOnOutsideClick, true);
        }
      });
      row.appendChild(menuWrap);
    } else {
      var computedStyle = window.getComputedStyle(targetEl);
      if (!originalStyles.has(targetEl)) {
        originalStyles.set(targetEl, {
          fontFamily: computedStyle.fontFamily || '',
          color: computedStyle.color || '',
          fontSize: computedStyle.fontSize || '',
          lineHeight: computedStyle.lineHeight || '',
          letterSpacing: computedStyle.letterSpacing || '',
          fontWeight: computedStyle.fontWeight || ''
        });
      }
      var currentFontKey = null;
      var currentColor = computedStyle.color || '';
      var currentFontSize = computedStyle.fontSize || '16px';
      var currentLineHeight = computedStyle.lineHeight || '';
      var currentLetterSpacing = computedStyle.letterSpacing || '';
      var currentFontWeight = computedStyle.fontWeight || '';
      var tagLabel = '<' + (targetEl.tagName || '').toLowerCase() + '>';

      var layoutPanel = null;
      var textTabBtn = null;
      var layoutTabBtn = null;
      function setPanelMode(mode) {
        var isText = mode !== 'layout';
        if (textTabBtn && layoutTabBtn) {
          textTabBtn.style.background = isText ? '#D643E3' : 'transparent';
          textTabBtn.style.color = isText ? '#FFFFFF' : '#D643E3';
          layoutTabBtn.style.background = isText ? 'transparent' : '#D643E3';
          layoutTabBtn.style.color = isText ? '#D643E3' : '#FFFFFF';
        }
        var gridEl = wrap.querySelector('.reforma-panel-text-grid');
        var textEl = wrap.querySelector('.reforma-playground-comment-text');
        if (gridEl) gridEl.style.display = isText ? 'grid' : 'none';
        if (textEl) textEl.style.display = isText ? '' : 'none';
        if (layoutPanel) layoutPanel.style.display = isText ? 'none' : 'flex';
      }

      var headerRow = document.createElement('div');
      headerRow.style.cssText = 'display:flex;padding:2px 0;justify-content:space-between;align-items:center;align-self:stretch;margin-bottom:4px;flex-wrap:nowrap;gap:8px;';
      var tagSpan = document.createElement('span');
      tagSpan.style.cssText = 'font-size:14px;white-space:nowrap;' + GAP_HEADER;
      tagSpan.textContent = tagLabel;
      var headerRight = document.createElement('div');
      headerRight.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:nowrap;';

      var tabWrap = document.createElement('div');
      tabWrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-right:4px;';
      textTabBtn = document.createElement('button');
      textTabBtn.type = 'button';
      textTabBtn.textContent = 'Text';
      textTabBtn.style.cssText = 'padding:2px 6px;border-radius:999px;border:none;background:#D643E3;color:#FFFFFF;font-size:10px;cursor:pointer;';
      layoutTabBtn = document.createElement('button');
      layoutTabBtn.type = 'button';
      layoutTabBtn.textContent = 'Layout';
      layoutTabBtn.style.cssText = 'padding:2px 6px;border-radius:999px;border:none;background:transparent;color:#D643E3;font-size:10px;cursor:pointer;';
      textTabBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setPanelMode('text');
      });
      layoutTabBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setPanelMode('layout');
      });
      tabWrap.appendChild(textTabBtn);
      tabWrap.appendChild(layoutTabBtn);
      headerRight.appendChild(tabWrap);

      var syncBtn = document.createElement('button');
      syncBtn.type = 'button';
      syncBtn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap;' + GAP_HEADER + 'padding:4px 0;border:none;background:transparent;cursor:pointer;color:#D643E3;';
      syncBtn.setAttribute('aria-label', 'Sync style');
      var syncIcon = document.createElement('img');
      syncIcon.src = chrome.runtime.getURL('icons/sync.svg');
      syncIcon.alt = '';
      syncIcon.style.cssText = 'width:12px;height:14px;display:inline-block;';
      var syncLabel = document.createElement('span');
      syncLabel.textContent = 'Sync Style';
      syncBtn.appendChild(syncIcon);
      syncBtn.appendChild(syncLabel);

      var saveFormatBtn = document.createElement('button');
      saveFormatBtn.type = 'button';
      saveFormatBtn.style.cssText = 'display:flex;height:36px;padding:8px 16px;align-items:center;gap:8px;font-size:11px;font-family:\'Shantell Sans\',cursive;font-weight:600;color:var(--primary-700,#9E198C);border-radius:4px;background:var(--primary-300,#FEDAF5);border:none;box-shadow:none;cursor:pointer;white-space:nowrap;';
      saveFormatBtn.setAttribute('aria-label', 'Save format');
      var saveFormatIcon = document.createElement('img');
      saveFormatIcon.src = chrome.runtime.getURL('icons/download.svg');
      saveFormatIcon.alt = '';
      saveFormatIcon.style.cssText = 'width:16px;height:18px;display:inline-block;';
      var saveFormatLabel = document.createElement('span');
      saveFormatLabel.textContent = 'Save Format';
      saveFormatBtn.appendChild(saveFormatIcon);
      saveFormatBtn.appendChild(saveFormatLabel);

      saveFormatBtn.addEventListener('click', function (e) {
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
        wrap.setAttribute('data-comment-id', payload.id);
        var key = getStorageKey();
        chrome.storage.local.get(key, function (obj) {
          var list = (obj[key] && Array.isArray(obj[key].comments)) ? obj[key].comments.slice() : [];
          var idx = list.findIndex(function (item) { return item.id === payload.id; });
          if (idx >= 0) list[idx] = payload;
          else list.push(payload);
          chrome.storage.local.set({ [key]: { url: window.location.href, comments: list } }, function () {
            saveFormatLabel.textContent = 'Saved';
            setTimeout(function () { saveFormatLabel.textContent = 'Save Format'; }, 1500);
          });
        });
      });
      headerRight.appendChild(syncBtn);
      headerRight.appendChild(saveFormatBtn);
      var closeCommentBtn = document.createElement('button');
      closeCommentBtn.type = 'button';
      closeCommentBtn.textContent = '×';
      closeCommentBtn.setAttribute('aria-label', 'Remove comment');
      closeCommentBtn.style.cssText = 'width:24px;height:24px;padding:0;border:none;background:transparent;color:#372828;cursor:pointer;font-size:18px;line-height:1;';
      closeCommentBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); wrap.remove(); });
      headerRight.appendChild(closeCommentBtn);
      headerRow.appendChild(tagSpan);
      headerRow.appendChild(headerRight);
      wrap.appendChild(headerRow);

      var grid = document.createElement('div');
      grid.className = 'reforma-panel-text-grid';
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px 2px;margin-bottom:6px;align-items:center;';

      function addCol(lbl, el) {
        var col = document.createElement('div');
        col.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;justify-content:center;';
        var labelEl = document.createElement('div');
        labelEl.style.cssText = GAP_LABEL + 'text-align:left;';
        labelEl.textContent = lbl;
        col.appendChild(labelEl);
        col.appendChild(el);
        grid.appendChild(col);
      }

      var fontSelect = document.createElement('select');
      fontSelect.style.cssText = 'width:100%;min-width:0;' + GAP_INPUT + 'cursor:pointer;border-radius:4px;border:1.2px solid var(--primary-300,#FEDAF5);background:var(--primary-100,#FFEBFE);';
      fontSelect.innerHTML = '<option value="">Font...</option><option value="urbanist">Urbanist</option><option value="shantell">Shantell S.</option><option value="inter">Inter</option><option value="roboto">Roboto</option><option value="system">System</option>';
      fontSelect.addEventListener('change', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var fontKey = fontSelect.value;
        if (!fontKey) return;
        currentFontKey = fontKey;
        var fontFamily = resolvePlaygroundFont(fontKey);
        if (targetEl) {
          if (!originalStyles.has(targetEl)) {
            var cs = window.getComputedStyle(targetEl);
            originalStyles.set(targetEl, { fontFamily: cs.fontFamily || '', color: cs.color || '', fontSize: cs.fontSize || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
          }
          targetEl.style.transition = 'font-family 0.25s ease, color 0.25s ease, font-weight 0.25s ease, font-size 0.25s ease';
          targetEl.style.fontFamily = fontFamily;
          ensureFontsLoaded();
        }
      });
      addCol('Text Styles', fontSelect);

      var colorCircle = document.createElement('button');
      colorCircle.type = 'button';
      colorCircle.className = 'reforma-playground-color-circle';
      colorCircle.setAttribute('title', 'Text color');
      colorCircle.setAttribute('aria-label', 'Choose text color');
      var colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'reforma-playground-color-picker-in-circle';
      colorInput.value = rgbToHex(currentColor);
      colorInput.setAttribute('tabindex', '-1');
      function syncCircleToPicker() { colorCircle.style.background = colorInput.value; }
      colorCircle.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:36px;height:36px;min-width:36px;min-height:36px;max-width:36px;max-height:36px;padding:0;margin:0;border-radius:4px;border:1.2px solid var(--primary-300,#FEDAF5);background:var(--primary-100,#FFEBFE);cursor:pointer;overflow:hidden;';
      function applyColorFromInput(val) {
        if (!targetEl) return;
        if (!originalStyles.has(targetEl)) {
          var cs = window.getComputedStyle(targetEl);
          originalStyles.set(targetEl, { fontFamily: cs.fontFamily || '', color: cs.color || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
        }
        targetEl.style.transition = 'font-family 0.25s ease, color 0.25s ease, font-weight 0.25s ease, font-size 0.25s ease';
        targetEl.style.color = val;
        currentColor = val;
        syncCircleToPicker();
      }
      colorInput.addEventListener('input', function () { syncCircleToPicker(); applyColorFromInput(colorInput.value); });
      colorInput.addEventListener('change', function () { syncCircleToPicker(); applyColorFromInput(colorInput.value); });
      colorCircle.appendChild(colorInput);
      var colorCol = document.createElement('div');
      colorCol.style.cssText = 'display:flex;align-items:center;justify-content:center;';
      colorCol.appendChild(colorCircle);
      addCol('Color', colorCol);

      var weightSelect = document.createElement('select');
      weightSelect.style.cssText = 'width:100%;min-width:0;' + GAP_INPUT + 'cursor:pointer;border-radius:4px;border:1.2px solid var(--primary-300,#FEDAF5);background:var(--primary-100,#FFEBFE);';
      weightSelect.innerHTML = '<option value="">Weight</option><option value="300">300</option><option value="400">400</option><option value="500">500</option><option value="600">600</option><option value="700">700</option><option value="800">800</option><option value="900">900</option>';
      weightSelect.value = currentFontWeight;
      var weightsList = ['300', '400', '500', '600', '700', '800', '900'];
      weightSelect.addEventListener('change', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var weight = e.target.value;
        if (!weight) return;
        if (targetEl) {
          if (!originalStyles.has(targetEl)) {
            var cs = window.getComputedStyle(targetEl);
            originalStyles.set(targetEl, {
              fontFamily: cs.fontFamily || '',
              color: cs.color || '',
              lineHeight: cs.lineHeight || '',
              letterSpacing: cs.letterSpacing || '',
              fontWeight: cs.fontWeight || ''
            });
          }
          targetEl.style.transition = 'font-family 0.25s ease, color 0.25s ease, font-weight 0.25s ease, font-size 0.25s ease';
          targetEl.style.fontWeight = weight;
          currentFontWeight = weight;
        }
      });
      var weightWrap = document.createElement('div');
      weightWrap.style.cssText = 'display:flex;align-items:center;gap:2px;';
      var weightDown = document.createElement('button');
      weightDown.type = 'button';
      weightDown.textContent = '−';
      weightDown.style.cssText = 'width:20px;height:28px;padding:0;border:none;background:transparent;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;' + GAP_HEADER;
      var weightUp = document.createElement('button');
      weightUp.type = 'button';
      weightUp.textContent = '+';
      weightUp.style.cssText = 'width:20px;height:28px;padding:0;border:none;background:transparent;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;' + GAP_HEADER;
      function stepWeight(delta) {
        var current = weightSelect.value || currentFontWeight || '';
        var idx = weightsList.indexOf(current);
        if (idx === -1) idx = 3; // default to 600
        var next = weightsList[Math.max(0, Math.min(weightsList.length - 1, idx + delta))];
        weightSelect.value = next;
        var evt = new Event('change', { bubbles: false });
        weightSelect.dispatchEvent(evt);
      }
      weightDown.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); stepWeight(-1); });
      weightUp.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); stepWeight(1); });
      weightWrap.appendChild(weightDown);
      weightWrap.appendChild(weightSelect);
      weightWrap.appendChild(weightUp);
      addCol('Weight', weightWrap);

      var sizeWrap = document.createElement('div');
      sizeWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:2px;border-radius:4px;border:1.2px solid var(--primary-300,#FEDAF5);background:var(--primary-100,#FFEBFE);padding:2px 4px;';
      var sizeDown = document.createElement('button');
      sizeDown.type = 'button';
      sizeDown.textContent = '−';
      sizeDown.style.cssText = 'width:20px;height:28px;padding:0;border:none;background:transparent;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;' + GAP_HEADER;
      var sizeVal = document.createElement('span');
      sizeVal.style.cssText = 'min-width:40px;text-align:center;font-size:11px;font-family:\'Urbanist\',sans-serif;font-weight:600;color:#372828;letter-spacing:-0.2px;';
      var px = parseInt(currentFontSize, 10) || 16;
      sizeVal.textContent = px + ' px';
      var sizeUp = document.createElement('button');
      sizeUp.type = 'button';
      sizeUp.textContent = '+';
      sizeUp.style.cssText = 'width:20px;height:28px;padding:0;border:none;background:transparent;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;' + GAP_HEADER;
      function updateSize(delta) {
        px = Math.max(8, Math.min(96, (parseInt(currentFontSize, 10) || 16) + delta));
        currentFontSize = px + 'px';
        sizeVal.textContent = px + ' px';
        if (targetEl) {
          if (!originalStyles.has(targetEl)) {
            var cs = window.getComputedStyle(targetEl);
            originalStyles.set(targetEl, { fontFamily: cs.fontFamily || '', color: cs.color || '', fontSize: cs.fontSize || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
          }
          targetEl.style.transition = 'font-family 0.25s ease, color 0.25s ease, font-weight 0.25s ease, font-size 0.25s ease';
          targetEl.style.fontSize = currentFontSize;
        }
      }
      sizeDown.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); updateSize(-1); });
      sizeUp.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); updateSize(1); });
      sizeWrap.appendChild(sizeDown);
      sizeWrap.appendChild(sizeVal);
      sizeWrap.appendChild(sizeUp);
      addCol('Size', sizeWrap);

      wrap.appendChild(grid);

      layoutPanel = document.createElement('div');
      layoutPanel.className = 'reforma-playground-layout-panel';
      layoutPanel.style.cssText = 'display:none;flex-direction:column;gap:6px;margin-top:2px;font-size:11px;font-family:' + COMMENT_FONT + ';';
      var inputBoxStyle = 'width:28px;padding:2px 4px;border-radius:4px;border:1.2px solid var(--primary-300,#FEDAF5);background:var(--primary-100,#FFEBFE);font-family:' + COMMENT_FONT + ';font-size:10px;font-weight:600;text-align:center;box-sizing:border-box;';
      function makeInputWithPx(inp) {
        var cell = document.createElement('div');
        cell.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:2px;';
        cell.appendChild(inp);
        var pxSpan = document.createElement('span');
        pxSpan.textContent = 'px';
        pxSpan.style.cssText = 'font-size:9px;color:#504645;';
        cell.appendChild(pxSpan);
        return cell;
      }
      function makeFourSidedBox(label, prop, el, gridOnly) {
        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:auto auto auto;gap:2px;align-items:center;justify-items:center;';
        var topIn = document.createElement('input');
        topIn.type = 'text';
        topIn.inputMode = 'numeric';
        topIn.placeholder = '0';
        topIn.style.cssText = inputBoxStyle;
        topIn.setAttribute('data-side', 'top');
        var rightIn = document.createElement('input');
        rightIn.type = 'text';
        rightIn.inputMode = 'numeric';
        rightIn.placeholder = '0';
        rightIn.style.cssText = inputBoxStyle;
        rightIn.setAttribute('data-side', 'right');
        var bottomIn = document.createElement('input');
        bottomIn.type = 'text';
        bottomIn.inputMode = 'numeric';
        bottomIn.placeholder = '0';
        bottomIn.style.cssText = inputBoxStyle;
        bottomIn.setAttribute('data-side', 'bottom');
        var leftIn = document.createElement('input');
        leftIn.type = 'text';
        leftIn.inputMode = 'numeric';
        leftIn.placeholder = '0';
        leftIn.style.cssText = inputBoxStyle;
        leftIn.setAttribute('data-side', 'left');
        var empty = document.createElement('span');
        empty.style.cssText = 'width:40px;height:20px;';
        grid.appendChild(empty);
        grid.appendChild(makeInputWithPx(topIn));
        grid.appendChild(empty.cloneNode(true));
        grid.appendChild(makeInputWithPx(leftIn));
        grid.appendChild(empty.cloneNode(true));
        grid.appendChild(makeInputWithPx(rightIn));
        grid.appendChild(empty.cloneNode(true));
        grid.appendChild(makeInputWithPx(bottomIn));
        grid.appendChild(empty.cloneNode(true));
        var sides = { top: topIn, right: rightIn, bottom: bottomIn, left: leftIn };
        var styleKeys = { padding: { top: 'paddingTop', right: 'paddingRight', bottom: 'paddingBottom', left: 'paddingLeft' }, margin: { top: 'marginTop', right: 'marginRight', bottom: 'marginBottom', left: 'marginLeft' } }[prop];
        var transProp = prop === 'padding' ? 'padding' : 'margin';
        function parsePx(val) {
          if (!val) return '';
          var m = String(val).match(/^(-?[\d.]+)/);
          return m ? m[1] : '';
        }
        function populateFromEl() {
          if (!el || !el.isConnected) return;
          var cs = window.getComputedStyle(el);
          ['top', 'right', 'bottom', 'left'].forEach(function (side) {
            var val = (cs[styleKeys[side]] || '').trim();
            sides[side].value = parsePx(val);
          });
        }
        function applyFourSided() {
          if (!el || !el.isConnected) return;
          el.style.transition = transProp + ' 0.25s ease';
          ['top', 'right', 'bottom', 'left'].forEach(function (side) {
            var num = (sides[side].value || '').trim();
            el.style[styleKeys[side]] = num === '' ? '' : num + 'px';
          });
        }
        populateFromEl();
        [topIn, rightIn, bottomIn, leftIn].forEach(function (inp) {
          inp.addEventListener('input', applyFourSided);
          inp.addEventListener('change', applyFourSided);
          inp.addEventListener('keyup', applyFourSided);
        });
        if (gridOnly) return grid;
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';
        var lbl = document.createElement('div');
        lbl.style.cssText = 'font-weight:600;color:#181211;font-size:10px;margin-bottom:2px;';
        lbl.textContent = label;
        wrap.appendChild(lbl);
        wrap.appendChild(grid);
        return wrap;
      }
      var marginBox = makeFourSidedBox('Margin', 'margin', targetEl, false);
      var paddingBox = makeFourSidedBox('Padding', 'padding', targetEl, false);
      var layoutRow = document.createElement('div');
      layoutRow.style.cssText = 'display:flex;align-items:flex-start;gap:12px;';
      layoutRow.appendChild(marginBox);
      layoutRow.appendChild(paddingBox);
      layoutPanel.appendChild(layoutRow);
      var flexSelect = document.createElement('select');
      flexSelect.style.cssText = 'flex:1;padding:4px 6px;border-radius:4px;border:1px solid #E6E3E3;font-family:' + COMMENT_FONT + ';font-size:11px;';
      flexSelect.innerHTML = '<option value=\"\">None</option><option value=\"row\">Flex row</option><option value=\"column\">Flex column</option><option value=\"row-center\">Row center</option><option value=\"column-center\">Column center</option>';
      flexSelect.addEventListener('change', function () {
        if (!targetEl) return;
        var v = flexSelect.value;
        targetEl.style.transition = 'flex-direction 0.25s ease, justify-content 0.25s ease, align-items 0.25s ease';
        if (!v) {
          targetEl.style.display = '';
          targetEl.style.justifyContent = '';
          targetEl.style.alignItems = '';
          targetEl.style.flexDirection = '';
          return;
        }
        targetEl.style.display = 'flex';
        if (v === 'row') {
          targetEl.style.flexDirection = 'row';
          targetEl.style.justifyContent = 'flex-start';
          targetEl.style.alignItems = 'stretch';
        } else if (v === 'column') {
          targetEl.style.flexDirection = 'column';
          targetEl.style.justifyContent = 'flex-start';
          targetEl.style.alignItems = 'stretch';
        } else if (v === 'row-center') {
          targetEl.style.flexDirection = 'row';
          targetEl.style.justifyContent = 'center';
          targetEl.style.alignItems = 'center';
        } else if (v === 'column-center') {
          targetEl.style.flexDirection = 'column';
          targetEl.style.justifyContent = 'center';
          targetEl.style.alignItems = 'center';
        }
      });
      var flexRow = document.createElement('div');
      flexRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:4px;';
      var flexLbl = document.createElement('span');
      flexLbl.style.cssText = 'font-weight:600;color:#181211;font-size:10px;';
      flexLbl.textContent = 'Flex';
      flexSelect.style.flex = '1';
      flexRow.appendChild(flexLbl);
      flexRow.appendChild(flexSelect);
      layoutPanel.appendChild(flexRow);
      wrap.appendChild(layoutPanel);

      setPanelMode('text');

      syncBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!targetEl) return;
        var syncFontFamily = currentFontKey ? resolvePlaygroundFont(currentFontKey) : (targetEl.style.fontFamily || computedStyle.fontFamily || '');
        var syncColor = colorInput.value || targetEl.style.color || computedStyle.color || '';
        var syncFontWeight = weightSelect.value || targetEl.style.fontWeight || computedStyle.fontWeight || '';
        var syncFontSize = currentFontSize || targetEl.style.fontSize || computedStyle.fontSize || '';
        var tagName = targetEl.tagName.toLowerCase();
        var targetClassSet = (targetEl.className || '').toString().trim().split(/\s+/).filter(function (c) { return c.length > 0; });
        var selectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li, div, td, th, label, button, input, textarea, select';
        var allCandidates = [];
        if (tagName && ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'li', 'div', 'td', 'th', 'label', 'button'].indexOf(tagName) >= 0) {
          allCandidates = Array.from(document.querySelectorAll(tagName));
        } else {
          allCandidates = Array.from(document.querySelectorAll(selectors));
        }
        var elementsToChange = allCandidates.filter(function (el) {
          if (el.tagName.toLowerCase() !== tagName) return false;
          var elClasses = (el.className || '').toString().trim().split(/\s+/).filter(function (c) { return c.length > 0; });
          if (targetClassSet.length === 0 && elClasses.length === 0) return true;
          var shared = elClasses.some(function (c) { return targetClassSet.indexOf(c) >= 0; });
          return shared;
        });
        elementsToChange.forEach(function (el) {
          if (!originalStyles.has(el)) {
            var cs = window.getComputedStyle(el);
            originalStyles.set(el, {
              fontFamily: cs.fontFamily || '',
              color: cs.color || '',
              fontSize: cs.fontSize || '',
              lineHeight: cs.lineHeight || '',
              letterSpacing: cs.letterSpacing || '',
              fontWeight: cs.fontWeight || ''
            });
          }
          el.style.transition = 'font-family 0.25s ease, color 0.25s ease, font-weight 0.25s ease, font-size 0.25s ease';
          if (syncFontFamily) el.style.fontFamily = syncFontFamily;
          if (syncColor) el.style.color = syncColor;
          if (syncFontWeight) el.style.fontWeight = syncFontWeight;
          if (syncFontSize) el.style.fontSize = syncFontSize;
        });
        ensureFontsLoaded();
        syncLabel.textContent = 'Synced';
        syncBtn.style.color = '#20C997';
        setTimeout(function () {
          syncLabel.textContent = 'Sync Style';
          syncBtn.style.color = '#D643E3';
        }, 1500);
      });
    }

    if (!gapMode || !targetEl) {
      wrap.appendChild(row);
    }
  }

  var COMMENT_FONT = "'Urbanist', sans-serif";

  /** Maps a font key (urbanist, shantell, inter, etc.) to a CSS font-family string. */
  function resolvePlaygroundFont(key) {
    switch (key) {
      case 'shantell': return "'Shantell Sans', cursive";
      case 'inter': return "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      case 'roboto': return "'Roboto', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      case 'system': return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      case 'urbanist':
      default:
        return "'Urbanist', sans-serif";
    }
  }

  /** Converts an rgb/rgba color string to hex. */
  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return '#000000';
    if (rgb.startsWith('#')) return rgb;
    var m = rgb.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (m) {
      return '#' + [1, 2, 3].map(function (i) {
        var hex = parseInt(m[i], 10).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
    }
    return '#000000';
  }

  /** Injects playground UI styles (color circle, etc.) into the page – runs in injected context. */
  function ensurePlaygroundStyles() {
    if (document.getElementById('reforma-playground-styles')) return;
    var style = document.createElement('style');
    style.id = 'reforma-playground-styles';
    style.textContent = '.reforma-playground-color-circle{position:relative;display:block;box-sizing:border-box;flex-shrink:0;width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;max-width:24px!important;max-height:24px!important;padding:0!important;margin:0!important;border:2px solid #CDC8C6!important;border-radius:100px!important;cursor:pointer;overflow:hidden;}.reforma-playground-color-circle .reforma-playground-color-picker-in-circle{position:absolute!important;top:50%!important;left:50%!important;width:200%!important;height:200%!important;min-width:48px!important;min-height:48px!important;padding:0!important;margin:0!important;border:none!important;border-radius:100px!important;cursor:pointer!important;opacity:0!important;-webkit-appearance:none!important;appearance:none!important;background:transparent!important;transform:translate(-50%,-50%)!important;}.reforma-playground-color-circle .reforma-playground-color-picker-in-circle::-webkit-color-swatch-wrapper,.reforma-playground-color-circle .reforma-playground-color-picker-in-circle::-webkit-color-swatch{padding:0!important;border:none!important;opacity:0!important;background:transparent!important;}.reforma-playground-color-circle .reforma-playground-color-picker-in-circle::-moz-color-swatch{border:none!important;opacity:0!important;background:transparent!important;}';
    document.head.appendChild(style);
  }

  /** Ensures Google Fonts stylesheet (Urbanist, Inter, Roboto, Shantell) is loaded. */
  function ensureFontsLoaded() {
    if (document.getElementById('reforma-playground-fonts')) return;
    var link = document.createElement('link');
    link.id = 'reforma-playground-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Shantell+Sans:wght@400;700&family=Urbanist:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  /** Ensures Urbanist (and other playground fonts) are loaded. */
  function ensureUrbanistLoaded() {
    ensureFontsLoaded();
  }

  /** Gets or creates the main overlay container for comments. */
  function getContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (!el) {
      ensurePlaygroundStyles();
      ensureUrbanistLoaded();
      el = document.createElement('div');
      el.id = CONTAINER_ID;
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;';
      document.body.appendChild(el);
    }
    return el;
  }

  /** Creates overlay and highlight layer elements needed for Gap mode. */
  function ensureGapModeLayers() {
    var container = getContainer();
    if (!overlayDiv || !document.getElementById(OVERLAY_ID)) {
      overlayDiv = document.createElement('div');
      overlayDiv.id = OVERLAY_ID;
      overlayDiv.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:auto;';
      container.appendChild(overlayDiv);
    }
    var hl = document.getElementById(HIGHLIGHT_LAYER_ID);
    if (!hl) {
      hl = document.createElement('div');
      hl.id = HIGHLIGHT_LAYER_ID;
      hl.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
      container.appendChild(hl);
    }
  }

  /** Creates the pill UI (Gap mode only) at bottom-right if missing. */
  function ensureGapModeBadge() {
    var container = getContainer();
    var pill = document.getElementById(GAP_BADGE_ID);
    if (!pill) {
      pill = document.createElement('div');
      pill.id = GAP_BADGE_ID;
      pill.style.cssText = 'position:fixed;bottom:12px;right:12px;display:inline-flex;border-radius:999px;background:rgba(0,0,0,0.9);padding:3px;gap:0;z-index:2147483647;pointer-events:auto;box-shadow:0 2px 10px rgba(0,0,0,0.4);font-family:' + COMMENT_FONT + ';';
      var gapBtn = document.createElement('button');
      gapBtn.type = 'button';
      gapBtn.textContent = 'Gap mode';
      gapBtn.style.cssText = 'padding:6px 14px;font-size:12px;font-weight:600;border:none;border-radius:999px;cursor:default;background:#D643E3;color:#fff;';
      var changesBtn = document.createElement('button');
      changesBtn.type = 'button';
      changesBtn.textContent = 'Changes';
      changesBtn.style.cssText = 'padding:6px 12px;font-size:12px;font-weight:600;border:none;border-radius:999px;cursor:pointer;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9);';
      changesBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleChangesDrawer();
      });
      var closePlaygroundBtn = document.createElement('button');
      closePlaygroundBtn.type = 'button';
      closePlaygroundBtn.textContent = '×';
      closePlaygroundBtn.setAttribute('aria-label', 'Exit playground');
      closePlaygroundBtn.style.cssText = 'width:28px;height:28px;min-width:28px;padding:0;margin-left:4px;border:none;border-radius:50%;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9);cursor:pointer;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
      closePlaygroundBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });
      pill.appendChild(gapBtn);
      pill.appendChild(changesBtn);
      pill.appendChild(closePlaygroundBtn);
      gapBtn.className = 'reforma-pill-gap';
      container.appendChild(pill);
    }
    updatePillActiveState();
  }

  /** Updates the Comments vs Gap mode pill to show which mode is active. */
  function updatePillActiveState() {
    var pill = document.getElementById(GAP_BADGE_ID);
    if (!pill) return;
    var gapBtn = pill.querySelector('.reforma-pill-gap');
    if (gapBtn) gapBtn.style.cssText = 'padding:6px 14px;font-size:12px;font-weight:600;border:none;border-radius:999px;cursor:default;background:#D643E3;color:#fff;';
  }

  /** Removes the Comments/Gap mode pill from the DOM. */
  function removeGapModeBadge() {
    var badge = document.getElementById(GAP_BADGE_ID);
    if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
  }

  /** Returns formatted string of all changes for copy. */
  function getAllChangesFormatted() {
    var lines = [];
    lines.push('Reforma – Changes applied');
    lines.push('URL: ' + (window.location.href || ''));
    lines.push('');
    originalStyles.forEach(function (orig, el) {
      if (!el || !el.isConnected) return;
      var changes = getGapModeChanges(el);
      if (changes.length === 0) return;
      var tag = (el.tagName || '').toLowerCase();
      var classes = (el.className || '').toString().trim();
      var selector = tag + (classes ? '.' + classes.split(/\s+/).join('.') : '');
      lines.push('<' + tag + (classes ? ' class="' + classes + '"' : '') + '>');
      changes.forEach(function (r) {
        lines.push('  ' + r.label + ': ' + (r.before || '(default)') + ' → ' + (r.after || '(default)'));
      });
      lines.push('');
    });
    return lines.length > 3 ? lines.join('\n') : 'No changes yet.';
  }

  /** Populates the changes drawer with current changes. */
  function populateChangesDrawer() {
    var drawer = document.getElementById(CHANGES_DRAWER_ID);
    if (!drawer) return;
    var list = drawer.querySelector('.reforma-changes-list');
    if (!list) return;
    list.innerHTML = '';
    var hasChanges = false;
    originalStyles.forEach(function (orig, el) {
      if (!el || !el.isConnected) return;
      var changes = getGapModeChanges(el);
      if (changes.length === 0) return;
      hasChanges = true;
      var tag = (el.tagName || '').toLowerCase();
      var classes = (el.className || '').toString().trim();
      var section = document.createElement('div');
      section.style.cssText = 'margin-bottom:12px;padding:8px;background:rgba(0,0,0,0.04);border-radius:6px;font-size:11px;';
      var header = document.createElement('div');
      header.style.cssText = 'font-weight:600;color:#181211;margin-bottom:6px;';
      header.textContent = '<' + tag + (classes ? ' class="' + classes + '"' : '') + '>';
      section.appendChild(header);
      changes.forEach(function (r) {
        var row = document.createElement('div');
        row.style.cssText = 'padding:4px 0;color:#181211;';
        row.innerHTML = '<strong>' + escapeHtml(r.label) + ':</strong> <span style="color:#6c757d;">' + escapeHtml(r.before || '(default)') + '</span> → <span style="color:#20C997;">' + escapeHtml(r.after || '(default)') + '</span>';
        section.appendChild(row);
      });
      list.appendChild(section);
    });
    if (!hasChanges) {
      var empty = document.createElement('p');
      empty.style.cssText = 'font-size:12px;color:#6c757d;margin:0;';
      empty.textContent = 'No changes yet. Edit an element to see changes.';
      list.appendChild(empty);
    }
  }

  /** Toggles the changes drawer visibility. */
  function toggleChangesDrawer() {
    var drawer = document.getElementById(CHANGES_DRAWER_ID);
    if (!drawer) return;
    var isOpen = drawer.getAttribute('data-open') === 'true';
    drawer.setAttribute('data-open', isOpen ? 'false' : 'true');
    drawer.style.transform = isOpen ? 'translateX(100%)' : 'translateX(0)';
  }

  /** Creates the changes side drawer and adds toggle to pill. */
  function ensureChangesDrawer() {
    if (document.getElementById(CHANGES_DRAWER_ID)) return;
    var drawer = document.createElement('div');
    drawer.id = CHANGES_DRAWER_ID;
    drawer.setAttribute('data-open', 'false');
    drawer.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:280px;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,0.15);z-index:2147483648;display:flex;flex-direction:column;font-family:' + COMMENT_FONT + ';transform:translateX(100%);transition:transform 0.25s ease;';
    drawer.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #E6E3E3;"><span style="font-weight:600;font-size:14px;color:#181211;">Changes</span><button type="button" class="reforma-drawer-close" style="width:28px;height:28px;padding:0;border:none;border-radius:50%;background:rgba(0,0,0,0.08);cursor:pointer;font-size:18px;line-height:1;">×</button></div><button type="button" class="reforma-drawer-copy" style="margin:12px 16px;padding:10px 16px;font-size:12px;font-weight:600;font-family:' + COMMENT_FONT + ';border:1px solid #D643E3;border-radius:6px;background:#FFE5F2;color:#9E198C;cursor:pointer;">Save changes</button>';
    document.body.appendChild(drawer);
    drawer.querySelector('.reforma-drawer-close').addEventListener('click', toggleChangesDrawer);
    drawer.querySelector('.reforma-drawer-copy').addEventListener('click', function () {
      var text = getAllChangesFormatted();
      navigator.clipboard.writeText(text).then(function () {
        var btn = drawer.querySelector('.reforma-drawer-copy');
        btn.textContent = 'Saved!';
        btn.style.background = '#20C997';
        btn.style.color = '#fff';
        btn.style.borderColor = '#20C997';
        setTimeout(function () {
          btn.textContent = 'Save changes';
          btn.style.background = '#FFE5F2';
          btn.style.color = '#9E198C';
          btn.style.borderColor = '#D643E3';
        }, 1500);
      });
    });
  }

  /** Removes the changes drawer. */
  function removeChangesDrawer() {
    var drawer = document.getElementById(CHANGES_DRAWER_ID);
    if (drawer && drawer.parentNode) drawer.parentNode.removeChild(drawer);
  }

  /** Switches between Comments mode (on=false) and Gap mode (on=true). */
  function setGapModeActive(on) {
    if (!enabled) return;
    if (gapMode === on) return;
    gapMode = on;
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    updatePillActiveState();
    if (gapMode) {
      ensureGapModeLayers();
      container.style.background = '';
      container.style.border = '';
      overlayDiv = document.getElementById(OVERLAY_ID);
      if (overlayDiv) {
        overlayDiv.style.background = 'transparent';
        overlayDiv.style.border = '2px solid #D643E3';
        overlayDiv.style.boxSizing = 'border-box';
        gapMoveHandler = function (ev) { updateGapHighlight(ev.clientX, ev.clientY); };
        overlayDiv.addEventListener('mousemove', gapMoveHandler, true);
      }
    } else {
      var hl = document.getElementById(HIGHLIGHT_LAYER_ID);
      if (hl) while (hl.firstChild) hl.removeChild(hl.firstChild);
      var ov = document.getElementById(OVERLAY_ID);
      if (ov && gapMoveHandler) ov.removeEventListener('mousemove', gapMoveHandler, true);
      gapMoveHandler = null;
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
      overlayDiv = null;
      container.style.background = 'transparent';
      container.style.border = '2px solid #D643E3';
      container.style.boxSizing = 'border-box';
    }
  }

  /** Returns the topmost page element at (x,y), excluding playground UI. */
  function getElementUnderPoint(x, y) {
    var container = document.getElementById(CONTAINER_ID);
    var overlay = document.getElementById(OVERLAY_ID);
    if (!container || !overlay) return null;
    overlay.style.pointerEvents = 'none';
    var pill = document.getElementById(GAP_BADGE_ID);
    if (pill) pill.style.pointerEvents = 'none';
    var list = document.elementsFromPoint(x, y);
    overlay.style.pointerEvents = 'auto';
    if (pill) pill.style.pointerEvents = 'auto';
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el !== container && !container.contains(el)) return el;
    }
    return null;
  }

  /** Returns a formatted string of element box model info (tag, font, margin, padding, parent gap). */
  function getBoxModelDetails(el) {
    if (!el || !el.getBoundingClientRect) return '';
    var s = window.getComputedStyle(el);
    var lines = [];
    var tag = el.tagName || '';
    var prettyTag = tag ? tag.toLowerCase() : '';
    lines.push('element: <' + prettyTag + '>');
    var ff = s.fontFamily || '';
    var fw = s.fontWeight || '';
    var fst = s.fontStyle || '';
    var fsz = s.fontSize || '';
    lines.push('font: ' + ff + ' ' + fw + ' ' + fst + ' ' + fsz);
    var m = { t: s.marginTop, r: s.marginRight, b: s.marginBottom, l: s.marginLeft };
    var p = { t: s.paddingTop, r: s.paddingRight, b: s.paddingBottom, l: s.paddingLeft };
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

  /** Draws margin/padding boxes and tooltip at (x,y) for the element under the cursor in Gap mode. */
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
    marginBox.style.cssText = 'position:fixed;left:' + (rect.left - ml) + 'px;top:' + (rect.top - mt) + 'px;width:' + (rect.width + ml + mr) + 'px;height:' + (rect.height + mt + mb) + 'px;background:' + GAP_MARGIN_STRIPE + ';border:1px dashed rgba(255,165,0,0.8);pointer-events:none;box-sizing:border-box;';
    hl.appendChild(marginBox);
    var paddingBox = document.createElement('div');
    paddingBox.style.cssText = 'position:fixed;left:' + (rect.left + pl) + 'px;top:' + (rect.top + pt) + 'px;width:' + (rect.width - pl - pr) + 'px;height:' + (rect.height - pt - pb) + 'px;background:' + GAP_PADDING_STRIPE + ';border:1px solid rgba(32,201,151,0.8);pointer-events:none;box-sizing:border-box;';
    hl.appendChild(paddingBox);
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    var ff = s.fontFamily || '';
    var fw = s.fontWeight || '';
    var fsz = s.fontSize || '';
    var tooltip = document.createElement('div');
    tooltip.style.cssText = 'position:fixed;left:' + (x + 12) + 'px;top:' + (y - 8) + 'px;padding:6px 10px;background:rgba(0,0,0,0.9);color:#fff;font-family:' + COMMENT_FONT + ';font-weight:500;font-size:11px;border-radius:4px;z-index:2147483648;pointer-events:none;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);transform:translateY(-100%);';
    tooltip.textContent = '<' + tag + '> ' + ff.split(',')[0].replace(/['"]/g, '') + ' ' + fw + ' ' + fsz;
    hl.appendChild(tooltip);
  }

  /** Adds the animated border overlay around the page when playground is enabled. */
  function ensureTabBorder() {
    if (document.getElementById(TAB_BORDER_ID)) return;
    var styleId = 'reforma-playground-tab-border-style';
    if (!document.getElementById(styleId)) {
      var style = document.createElement('style');
      style.id = styleId;
      style.textContent = '@keyframes reforma-tab-border-pulse{0%,100%{box-shadow:inset 0 0 0 3px rgba(214,67,227,0.6)}50%{box-shadow:inset 0 0 0 3px rgba(214,67,227,0.95)}}#' + TAB_BORDER_ID + '{animation:reforma-tab-border-pulse 1.5s ease-in-out infinite}';
      document.head.appendChild(style);
    }
    var el = document.createElement('div');
    el.id = TAB_BORDER_ID;
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2147483645;box-sizing:border-box;';
    document.body.appendChild(el);
  }

  /** Removes the animated tab border overlay and its styles. */
  function removeTabBorder() {
    var el = document.getElementById(TAB_BORDER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var style = document.getElementById('reforma-playground-tab-border-style');
    if (style && style.parentNode) style.parentNode.removeChild(style);
  }

  /** Stores current body/html styles and freezes scroll (overflow hidden, position fixed). */
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

  /** Restores body/html styles from freezePage and clears frozen state. */
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

  /** Builds change rows (before → after) for a gap-mode target element. */
  function getGapModeChanges(targetEl) {
    if (!targetEl) return [];
    var orig = originalStyles.get(targetEl) || {};
    var cs = window.getComputedStyle(targetEl);
    var curr = {
      fontFamily: targetEl.style.fontFamily || cs.fontFamily || '',
      color: targetEl.style.color || cs.color || '',
      fontWeight: targetEl.style.fontWeight || cs.fontWeight || '',
      fontSize: targetEl.style.fontSize || cs.fontSize || '',
      lineHeight: targetEl.style.lineHeight || cs.lineHeight || '',
      letterSpacing: targetEl.style.letterSpacing || cs.letterSpacing || ''
    };
    var rows = [];
    var labels = { fontFamily: 'Font', color: 'Color', fontWeight: 'Weight', fontSize: 'Size', lineHeight: 'Line height', letterSpacing: 'Letter spacing' };
    ['fontFamily', 'color', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing'].forEach(function (key) {
      var b = (orig[key] || '').toString().trim();
      var a = (curr[key] || '').toString().trim();
      if (b !== a) rows.push({ label: labels[key], before: b || '(default)', after: a || '(default)' });
    });
    return rows;
  }

  /** Shows a modal with all gap mode changes for the comment's target element. */
  function showChangesModal(wrap) {
    var targetId = wrap.getAttribute('data-target-element-id');
    var targetEl = targetId ? document.querySelector('[data-reforma-target-id="' + targetId + '"]') : null;
    var changes = getGapModeChanges(targetEl);
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483648;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;pointer-events:auto;font-family:' + COMMENT_FONT + ';';
    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:8px;padding:20px;max-width:400px;width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.2);max-height:80vh;overflow-y:auto;';
    box.innerHTML = '<div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#181211;">Gap mode changes</div>';
    if (changes.length === 0) {
      var empty = document.createElement('p');
      empty.style.cssText = 'font-size:12px;color:#495057;margin:0;';
      empty.textContent = 'No changes have been applied yet.';
      box.appendChild(empty);
    } else {
      var list = document.createElement('div');
      list.style.cssText = 'font-size:12px;color:#181211;';
      changes.forEach(function (r) {
        var row = document.createElement('div');
        row.style.cssText = 'margin-bottom:8px;padding:6px 8px;background:rgba(0,0,0,0.05);border-radius:4px;';
        row.innerHTML = '<strong>' + r.label + ':</strong><br><span style="color:#6c757d;">' + escapeHtml(r.before) + '</span> → <span style="color:#20C997;">' + escapeHtml(r.after) + '</span>';
        list.appendChild(row);
      });
      box.appendChild(list);
    }
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'margin-top:16px;padding:8px 16px;font-size:12px;font-family:' + COMMENT_FONT + ';font-weight:600;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer;color:#372828;';
    closeBtn.addEventListener('click', function () { modal.remove(); });
    box.appendChild(closeBtn);
    modal.appendChild(box);
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /** Creates a new comment at (x,y), with optional gapDetails and targetElement link (Gap mode). */
  function createComment(x, y, gapDetails, targetElement, anchorSide) {
    var container = getContainer();
    var def = COMMENT_COLORS[0];
    anchorSide = anchorSide || 'left';

    // In Gap mode, only allow a single active comment – remove the previous one if it exists.
    if (gapMode && currentGapComment && currentGapComment.parentNode) {
      currentGapComment.parentNode.removeChild(currentGapComment);
      currentGapComment = null;
    }

    var wrap = document.createElement('div');
    var baseStyle = 'position:fixed;left:' + x + 'px;top:' + y + 'px;min-width:200px;max-width:320px;background:rgba(255,255,255,0.98);color:#181211;padding:8px 10px 10px 10px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.2);border:none;z-index:2147483646;font-family:' + COMMENT_FONT + ';font-weight:500;font-size:13px;pointer-events:auto;overflow:hidden;box-sizing:border-box;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);transform-origin:top left;opacity:0;transform:translateY(6px) scale(0.96);transition:opacity 160ms ease-out,transform 160ms cubic-bezier(0.16,1,0.3,1);';
    // Gap mode comment gets special speech-bubble style with the small corner closest to the cursor, always on the top edge.
    if (gapMode) {
      var radius = anchorSide === 'right'
        ? '12px 2px 12px 12px'   // small top-right when anchored to the right of the cursor
        : '2px 12px 12px 12px';  // small top-left when anchored to the left of the cursor
      baseStyle += 'border-radius:' + radius + ';background:var(--neutral-100,#F9F6F6);display:inline-flex;padding:6px;flex-direction:column;justify-content:center;align-items:flex-start;gap:6px;';
    }
    wrap.style.cssText = baseStyle;
    wrap.className = 'reforma-playground-comment';
    wrap.setAttribute('data-color-id', DEFAULT_COLOR_ID);
    if (targetElement) {
      var targetId = 'reforma-target-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      targetElement.setAttribute('data-reforma-target-id', targetId);
      wrap.setAttribute('data-target-element-id', targetId);
    }

    buildCommentToolbar(wrap);

    var text = document.createElement('div');
    text.className = 'reforma-playground-comment-text';
    text.contentEditable = 'true';
    text.style.cssText = 'min-height:1.2em;outline:none;word-break:break-word;font-family:' + COMMENT_FONT + ';';
    text.setAttribute('data-placeholder', 'Comment...');
    text.textContent = '';

    var textPanel = wrap.querySelector('.reforma-panel-text-grid');
    if (textPanel && textPanel.parentNode === wrap) {
      wrap.insertBefore(text, textPanel.nextSibling);
    } else {
      wrap.appendChild(text);
    }
    container.appendChild(wrap);

    if (gapMode) {
      currentGapComment = wrap;
    }

    var clickX = x;
    var clickY = y;

    // Position correction (keep on-screen) + animate comment in from the cursor.
    requestAnimationFrame(function () {
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      if (viewportWidth && viewportHeight) {
        var rect = wrap.getBoundingClientRect();
        var margin = 12;
        var desiredLeft = anchorSide === 'right' ? (clickX - rect.width) : clickX;
        var desiredTop = clickY;

        if (desiredLeft + rect.width > viewportWidth - margin) {
          desiredLeft = viewportWidth - rect.width - margin;
        }
        if (desiredLeft < margin) {
          desiredLeft = margin;
        }
        if (desiredTop + rect.height > viewportHeight - margin) {
          desiredTop = viewportHeight - rect.height - margin;
        }
        if (desiredTop < margin) {
          desiredTop = margin;
        }

        wrap.style.left = desiredLeft + 'px';
        wrap.style.top = desiredTop + 'px';

        // Second-pass clamp in case the first adjustment still left any side off-screen.
        var finalRect = wrap.getBoundingClientRect();
        var dx = 0;
        var dy = 0;
        if (finalRect.left < margin) dx = margin - finalRect.left;
        if (finalRect.right > viewportWidth - margin) dx = (viewportWidth - margin) - finalRect.right;
        if (finalRect.top < margin) dy = margin - finalRect.top;
        if (finalRect.bottom > viewportHeight - margin) dy = (viewportHeight - margin) - finalRect.bottom;
        if (dx || dy) {
          var finalLeft = (parseFloat(wrap.style.left) || 0) + dx;
          var finalTop = (parseFloat(wrap.style.top) || 0) + dy;
          wrap.style.left = finalLeft + 'px';
          wrap.style.top = finalTop + 'px';
        }
      }
      wrap.style.opacity = '1';
      wrap.style.transform = 'translateY(0) scale(1)';
    });

    text.focus();
  }

  /** Handles clicks on the overlay; creates a comment at the click position. */
  function onOverlayClick(e) {
    if (!enabled) return;
    if (e.target.closest && e.target.closest('.reforma-playground-comment')) return;
    if (gapMode && e.target.id !== OVERLAY_ID) return;
    e.preventDefault();
    e.stopPropagation();
    var gapDetails = null;
    var targetEl = null;
    if (gapMode) {
      targetEl = getElementUnderPoint(e.clientX, e.clientY);
      if (targetEl) gapDetails = getBoxModelDetails(targetEl);
    }
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var anchorSide = (viewportWidth && e.clientX > viewportWidth / 2) ? 'right' : 'left';
    createComment(e.clientX, e.clientY, gapDetails, targetEl, anchorSide);
  }

  /** Enables or disables the playground. opts.gapMode: start in Gap mode. Returns new enabled state. */
  function toggle(opts) {
    opts = opts || {};
    // Comment mode has been removed – always operate in Gap mode.
    gapMode = true;
    enabled = !enabled;
    if (enabled) {
      var container = getContainer();
      container.style.pointerEvents = 'auto';
      ensureGapModeBadge();
      ensureChangesDrawer();
      ensureGapModeLayers();
      container.style.background = '';
      container.style.border = '';
      overlayDiv = document.getElementById(OVERLAY_ID);
      if (overlayDiv) {
        overlayDiv.style.background = 'transparent';
        overlayDiv.style.border = '2px solid #D643E3';
        overlayDiv.style.boxSizing = 'border-box';
      }
      gapMoveHandler = function (ev) { updateGapHighlight(ev.clientX, ev.clientY); };
      if (overlayDiv) overlayDiv.addEventListener('mousemove', gapMoveHandler, true);
      container.addEventListener('click', onOverlayClick, true);
    } else {
      removeGapModeBadge();
      removeChangesDrawer();
      originalStyles.forEach(function (originalStyle, el) {
        if (el && el.parentNode) {
          if (originalStyle.fontFamily) el.style.fontFamily = originalStyle.fontFamily;
          else el.style.fontFamily = '';
          if (originalStyle.color) el.style.color = originalStyle.color;
          else el.style.color = '';
          if (originalStyle.fontSize) el.style.fontSize = originalStyle.fontSize;
          else el.style.fontSize = '';
          if (originalStyle.lineHeight) el.style.lineHeight = originalStyle.lineHeight;
          else el.style.lineHeight = '';
          if (originalStyle.letterSpacing) el.style.letterSpacing = originalStyle.letterSpacing;
          else el.style.letterSpacing = '';
          if (originalStyle.fontWeight) el.style.fontWeight = originalStyle.fontWeight;
          else el.style.fontWeight = '';
        }
      });
      originalStyles.clear();
      originalFonts.clear();
      currentGapComment = null;
      var cont = document.getElementById(CONTAINER_ID);
      if (cont) {
        var ov = document.getElementById(OVERLAY_ID);
        if (ov && gapMoveHandler) ov.removeEventListener('mousemove', gapMoveHandler, true);
        gapMoveHandler = null;
        overlayDiv = null;
        cont.style.background = '';
        cont.style.border = '';
        cont.style.boxSizing = '';
        cont.style.pointerEvents = 'none';
        cont.removeEventListener('click', onOverlayClick, true);
        var p = document.getElementById(PREVIEW_ID);
        if (p) p.remove();
        while (cont.firstChild) cont.removeChild(cont.firstChild);
      }
      removeTabBorder();
      unfreezePage();
    }
    return enabled;
  }

  /** Handles messages from popup: reforma-enable-playground, reforma-get-playground-state. */
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'reforma-enable-playground') {
      // Playground comments and all UI always use Urbanist (ignore popup font selector for UI).
      COMMENT_FONT = "'Urbanist', sans-serif";
      ensureUrbanistLoaded();
      toggle({ gapMode: request.gapMode === true });
      sendResponse({ success: true, enabled: enabled });
      return true;
    }
    if (request.action === 'reforma-get-playground-state') {
      sendResponse({ enabled: enabled });
      return true;
    }
    return false;
  });
})();
