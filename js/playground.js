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
  var gapWheelHandler = null;
  var overlayDiv = null;
  var currentGapComment = null;
  var currentGapTarget = null;
  var currentGapOutline = null;
  var currentClassHighlightOutlines = [];
  var currentClassHighlightElements = [];
  var currentGapBatchElements = null;
  var currentGapBatchLabel = null;

  /* DOM IDs and storage */
  var CONTAINER_ID = 'reforma-playground-comments';
  var PREVIEW_ID = 'reforma-playground-preview';
  var HIGHLIGHT_LAYER_ID = 'reforma-playground-highlight';
  var OVERLAY_ID = 'reforma-playground-overlay';
  var GAP_BADGE_ID = 'reforma-playground-gap-badge';
  var CHANGES_DRAWER_ID = 'reforma-playground-changes-drawer';
  var TAB_BORDER_ID = 'reforma-playground-tab-border';
  var CHANGES_TOGGLE_ID = 'reforma-changes-visibility-toggle';
  var changesVisible = true;
  var hiddenChangesCache = new Map();
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

  /** Vercel/Geist-style icons (Lucide). Stroke-based 24x24, no fill. */
  function createMaterialIcon(name, size, color) {
    var ns = 'http://www.w3.org/2000/svg';
    var iconNodes = {
      sync: [['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }], ['path', { d: 'M21 3v5h-5' }], ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }], ['path', { d: 'M8 16H3v5' }]],
      download: [['path', { d: 'M12 15V3' }], ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }], ['path', { d: 'm7 10 5 5 5-5' }]],
      close: [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]],
      text: [['path', { d: 'M12 4v16' }], ['path', { d: 'M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2' }], ['path', { d: 'M9 20h6' }]],
      palette: [['path', { d: 'M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z' }], ['circle', { cx: '13.5', cy: '6.5', r: '.5', fill: 'currentColor' }], ['circle', { cx: '17.5', cy: '10.5', r: '.5', fill: 'currentColor' }], ['circle', { cx: '6.5', cy: '12.5', r: '.5', fill: 'currentColor' }], ['circle', { cx: '8.5', cy: '7.5', r: '.5', fill: 'currentColor' }]],
      weight: [['path', { d: 'M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8' }]],
      size: [['path', { d: 'M6 12h12' }], ['path', { d: 'M6 20V4' }], ['path', { d: 'M18 20V4' }]],
      line_height: [['rect', { width: '10', height: '6', x: '7', y: '9', rx: '2' }], ['path', { d: 'M22 20H2' }], ['path', { d: 'M22 4H2' }]],
      letter_spacing: [['path', { d: 'M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1' }]],
      layout: [['rect', { width: '7', height: '7', x: '3', y: '3', rx: '1' }], ['rect', { width: '7', height: '7', x: '14', y: '3', rx: '1' }], ['rect', { width: '7', height: '7', x: '14', y: '14', rx: '1' }], ['rect', { width: '7', height: '7', x: '3', y: '14', rx: '1' }]],
      margin: [['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }]],
      padding: [['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }]],
      position: [['path', { d: 'M12 2v20' }], ['path', { d: 'm15 19-3 3-3-3' }], ['path', { d: 'm19 9 3 3-3 3' }], ['path', { d: 'M2 12h20' }], ['path', { d: 'm5 9-3 3 3 3' }], ['path', { d: 'm9 5 3-3 3 3' }]],
      ai: [['path', { d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' }], ['path', { d: 'M20 2v4' }], ['path', { d: 'M22 4h-4' }], ['circle', { cx: '4', cy: '20', r: '2' }]],
      effects: [['path', { d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' }]],
      filter: [['path', { d: 'M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z' }]],
      filter_vintage: [['path', { d: 'M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z' }]],
      shadow: [['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }]],
      opacity: [['circle', { cx: '12', cy: '12', r: '10' }]],
      blur: [['path', { d: 'M10.1 2.182a10 10 0 0 1 3.8 0' }], ['path', { d: 'M13.9 21.818a10 10 0 0 1-3.8 0' }], ['path', { d: 'M17.609 3.721a10 10 0 0 1 2.69 2.7' }], ['path', { d: 'M2.182 13.9a10 10 0 0 1 0-3.8' }], ['path', { d: 'M20.279 17.609a10 10 0 0 1-2.7 2.69' }], ['path', { d: 'M21.818 10.1a10 10 0 0 1 0 3.8' }], ['path', { d: 'M3.721 6.391a10 10 0 0 1 2.7-2.69' }], ['path', { d: 'M6.391 20.279a10 10 0 0 1-2.69-2.7' }]],
      radius: [['path', { d: 'M20.34 17.52a10 10 0 1 0-2.82 2.82' }], ['circle', { cx: '19', cy: '19', r: '2' }], ['path', { d: 'm13.41 13.41 4.18 4.18' }], ['circle', { cx: '12', cy: '12', r: '2' }]],
      flex_none: [['path', { d: 'M5 11h14v2H5v-2z' }]],
      flex_row: [['rect', { width: '6', height: '10', x: '4', y: '7' }], ['rect', { width: '6', height: '10', x: '14', y: '7' }]],
      flex_col: [['rect', { width: '10', height: '6', x: '7', y: '4' }], ['rect', { width: '10', height: '6', x: '7', y: '14' }]],
      flex_row_center: [['rect', { width: '5', height: '10', x: '5', y: '7' }], ['rect', { width: '5', height: '3', x: '14', y: '10' }]],
      flex_col_center: [['rect', { width: '10', height: '5', x: '7', y: '5' }], ['rect', { width: '3', height: '5', x: '10', y: '14' }]],
      format_italic: [['line', { x1: '19', x2: '10', y1: '4', y2: '4' }], ['line', { x1: '14', x2: '5', y1: '20', y2: '20' }], ['line', { x1: '15', x2: '9', y1: '4', y2: '20' }]],
      format_paint: [['path', { d: 'M11 7 6 2' }], ['path', { d: 'M18.992 12H2.041' }], ['path', { d: 'M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595' }], ['path', { d: 'm8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33' }]],
      code: [['path', { d: 'M16 18l6-6-6-6' }], ['path', { d: 'M8 6l-6 6 6 6' }]],
      align_left: [['path', { d: 'M4 6h16' }], ['path', { d: 'M4 12h10' }], ['path', { d: 'M4 18h14' }]],
      align_center: [['path', { d: 'M4 6h16' }], ['path', { d: 'M7 12h10' }], ['path', { d: 'M4 18h16' }]],
      align_right: [['path', { d: 'M4 6h16' }], ['path', { d: 'M10 12h10' }], ['path', { d: 'M6 18h14' }]],
      format_align_justify: [['path', { d: 'M4 6h16' }], ['path', { d: 'M4 12h16' }], ['path', { d: 'M4 18h16' }]],
      copy: [['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' }], ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }]],
      visibility: [['path', { d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0' }], ['circle', { cx: '12', cy: '12', r: '3' }]],
      visibility_off: [['path', { d: 'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49' }], ['path', { d: 'M14.084 14.158a3 3 0 0 1-4.242-4.242' }], ['path', { d: 'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143' }], ['path', { d: 'm2 2 20 20' }]],
      undo: [['path', { d: 'M3 10h10a5 5 0 0 1 5 5v2' }], ['path', { d: 'M3 10 8 5l-5 5 5 5' }]],
      scrubber: [['path', { d: 'M18 8l4 4-4 4' }], ['path', { d: 'M6 8L2 12l4 4' }]]
    };
    var nodes = iconNodes[name] || iconNodes.close;
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size || 18));
    svg.setAttribute('height', String(size || 18));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.display = 'block';
    svg.style.flexShrink = '0';
    svg.style.color = color || 'currentColor';
    for (var i = 0; i < nodes.length; i++) {
      var part = nodes[i];
      var tag = part[0];
      var attrs = part[1];
      var el = document.createElementNS(ns, tag);
      for (var k in attrs) { if (k !== 'key' && attrs.hasOwnProperty(k)) el.setAttribute(k, String(attrs[k])); }
      svg.appendChild(el);
    }
    return svg;
  }

      var GAP_INPUT = 'padding:6px 8px;font-size:11px;font-family:\'Google Sans\',sans-serif;font-weight:600;border:1px solid var(--neutral-200,#E6E3E3);border-radius:6px;background:var(--neutral-100,#F9F6F6);color:var(--neutral-800,#372828);';
  // Smaller field labels (Font, Size, Line height, etc.)
  var GAP_LABEL = 'font-size:13px;font-weight:500;color:var(--neutral-700,#504645);font-family:\'Google Sans\',sans-serif;margin-bottom:2px;';
  // Section/card titles like "Typography", "Preview", "Layout", etc.
  var GAP_SECTION_TITLE = 'font-size:13px;font-weight:800;color:#181211;font-family:\'Google Sans\',sans-serif;letter-spacing:-0.1px;';
  var GAP_HEADER = 'font-family:\'Google Sans\',sans-serif;font-weight:800;color:var(--neutral-800,#372828);';

  /** Builds the toolbar for a comment. Gap mode: header + separator + 4-column controls (Text Styles, Weight, Size, Color). */
  function buildCommentToolbar(wrap) {
    if (!gapMode) {
      var bar = document.createElement('div');
      bar.className = 'reforma-playground-color-bar';
      bar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:4px;border-radius:8px 8px 0 0;background:' + (COMMENT_COLORS[0].bar) + ';';
      wrap.appendChild(bar);
    }

    var targetEl = wrap.getAttribute('data-target-element-id') ? document.querySelector('[data-reforma-target-id="' + wrap.getAttribute('data-target-element-id') + '"]') : null;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-bottom:4px;min-height:24px;flex-wrap:wrap;max-width:100%;';
    row.className = 'reforma-playground-comment-toolbar';

    var swatches = document.createElement('div');
    swatches.style.cssText = 'display:flex;gap:3px;margin-right:auto;flex-wrap:wrap;';
    if (gapMode && !targetEl) {
      // Empty state with Edit | Classes | History tabs
      var tabBar = document.createElement('div');
      tabBar.style.cssText = 'display:flex;gap:0;border-bottom:1px solid var(--neutral-200,#E6E3E3);margin-bottom:12px;';
      var editTab = document.createElement('button');
      editTab.type = 'button';
      editTab.textContent = 'Edit';
      editTab.style.cssText = 'flex:1;padding:10px 12px;font-size:13px;font-weight:600;font-family:' + COMMENT_FONT + ';border:none;background:transparent;color:#181211;cursor:pointer;border-bottom:2px solid #181211;';
      var classesTab = document.createElement('button');
      classesTab.type = 'button';
      classesTab.textContent = 'Classes';
      classesTab.style.cssText = 'flex:1;padding:10px 12px;font-size:13px;font-weight:600;font-family:' + COMMENT_FONT + ';border:none;background:transparent;color:var(--neutral-600,#675C58);cursor:pointer;border-bottom:2px solid transparent;';
      var changesTab = document.createElement('button');
      changesTab.type = 'button';
      changesTab.textContent = 'History';
      changesTab.style.cssText = 'flex:1;padding:10px 12px;font-size:13px;font-weight:600;font-family:' + COMMENT_FONT + ';border:none;background:transparent;color:var(--neutral-600,#675C58);cursor:pointer;border-bottom:2px solid transparent;';
      tabBar.appendChild(editTab);
      tabBar.appendChild(classesTab);
      tabBar.appendChild(changesTab);

      var emptyWrap = document.createElement('div');
      emptyWrap.className = 'reforma-tab-content';
      emptyWrap.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;text-align:center;gap:16px;min-height:120px;';
      var emptyMsg = document.createElement('p');
      emptyMsg.style.cssText = 'font-size:14px;color:var(--neutral-700,#504645);font-family:' + COMMENT_FONT + ';line-height:1.5;margin:0;';
      emptyMsg.textContent = 'Click any element on the page to style it.';
      var endSessionBtn = document.createElement('button');
      endSessionBtn.type = 'button';
      endSessionBtn.textContent = '×';
      endSessionBtn.setAttribute('aria-label', 'End session');
      endSessionBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;font-size:24px;line-height:1;font-weight:400;font-family:' + COMMENT_FONT + ';border:none;border-radius:50%;background:rgba(158,25,140,0.2);color:#9E198C;cursor:pointer;';
      endSessionBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });
      emptyWrap.appendChild(emptyMsg);
      emptyWrap.appendChild(endSessionBtn);

      var classesPanelWrap = document.createElement('div');
      classesPanelWrap.className = 'reforma-tab-content';
      classesPanelWrap.style.cssText = 'flex:1;display:none;flex-direction:column;min-height:0;overflow-y:auto;';
      (function buildClassesPanel() {
        classesPanelWrap.innerHTML = '';
        var enriched = getTopSelectorsEnriched(10);
        var items = enriched.items;
        var sectionTitles = { text: 'Text', 'image/video': 'Image/Video', icons: 'Icons' };
        var sectionOrder = ['text', 'image/video', 'icons'];
        var sectionTitleStyle = 'font-size:11px;font-weight:600;color:var(--neutral-600,#675C58);font-family:' + COMMENT_FONT + ';margin:12px 0 6px;padding:0 4px;';
        var cardWrapStyle = 'display:flex;flex-direction:column;gap:8px;';
        var cardStyle = 'display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:10px 12px;border:1px solid var(--neutral-200,#E6E3E3);border-radius:10px;background:var(--neutral-100,#F9F6F6);text-align:left;cursor:pointer;font-family:' + COMMENT_FONT + ';transition:border-color 0.2s, box-shadow 0.2s;';
        var emptyStyle = 'font-size:12px;color:var(--neutral-600,#675C58);font-family:' + COMMENT_FONT + ';';
        var pillStyle = 'padding:4px 8px;font-size:10px;font-weight:600;font-family:' + COMMENT_FONT + ';border:1px solid var(--neutral-200,#E6E3E3);border-radius:999px;background:var(--neutral-100,#F9F6F6);color:var(--neutral-700,#504645);cursor:pointer;transition:background 0.2s,border-color 0.2s,color 0.2s;';
        var pillActiveStyle = 'background:var(--neutral-900,#181211);border-color:var(--neutral-900,#181211);color:#fff;';
        var pillRowStyle = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;';
        var searchWrap = document.createElement('div');
        searchWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:8px;flex-shrink:0;';
        var searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search classes & tags';
        searchInput.style.cssText = 'width:100%;padding:8px 10px;font-size:12px;font-family:' + COMMENT_FONT + ';border:1px solid var(--neutral-200,#E6E3E3);border-radius:8px;background:#fff;color:#181211;box-sizing:border-box;';
        function addPillRow(label, options, key, selected, setSelected, updateAllInWrap) {
          var row = document.createElement('div');
          row.style.cssText = pillRowStyle;
          var lbl = document.createElement('span');
          lbl.style.cssText = 'font-size:10px;font-weight:700;color:var(--neutral-600,#675C58);margin-right:4px;flex-shrink:0;';
          lbl.textContent = label + ':';
          row.appendChild(lbl);
          options.forEach(function (opt) {
            var pill = document.createElement('button');
            pill.type = 'button';
            pill.textContent = opt.label;
            pill.style.cssText = pillStyle + (selected === opt.id ? ';' + pillActiveStyle : '');
            pill.setAttribute('data-' + key, opt.id);
            pill.addEventListener('click', function () {
              setSelected(opt.id);
              var toUpdate = updateAllInWrap ? searchWrap.querySelectorAll('[data-' + key + ']') : row.querySelectorAll('button');
              toUpdate.forEach(function (b) {
                b.style.cssText = pillStyle + (b.getAttribute('data-' + key) === opt.id ? ';' + pillActiveStyle : '');
              });
              renderList();
            });
            row.appendChild(pill);
          });
          searchWrap.appendChild(row);
        }
        var selectedType = '', selectedUsage = '', selectedTag = '';
        addPillRow('Type', [{ id: '', label: 'All' }, { id: 'text', label: 'Text' }, { id: 'image/video', label: 'Image/Video' }, { id: 'icons', label: 'Icons' }], 'type', selectedType, function (v) { selectedType = v; });
        addPillRow('Usage', [{ id: '', label: 'All' }, { id: 'container', label: 'Container' }, { id: 'button', label: 'Button' }, { id: 'header', label: 'Header' }, { id: 'link', label: 'Link' }, { id: 'nav', label: 'Nav' }, { id: 'footer', label: 'Footer' }, { id: 'image', label: 'Image' }, { id: 'icon', label: 'Icon' }, { id: 'other', label: 'Other' }], 'usage', selectedUsage, function (v) { selectedUsage = v; });
        var tagOpts = [{ id: '', label: 'All' }].concat(enriched.tags.map(function (t) { return { id: t, label: '<' + t + '>' }; }));
        addPillRow('Tag', tagOpts.slice(0, 12), 'tag', selectedTag, function (v) { selectedTag = v; }, true);
        if (tagOpts.length > 12) {
          var moreRow = document.createElement('div');
          moreRow.style.cssText = pillRowStyle + 'margin-left:0;';
          tagOpts.slice(12).forEach(function (opt) {
            var pill = document.createElement('button');
            pill.type = 'button';
            pill.textContent = opt.label;
            pill.style.cssText = pillStyle + (selectedTag === opt.id ? ';' + pillActiveStyle : '');
            pill.setAttribute('data-tag', opt.id);
            pill.addEventListener('click', function () {
              selectedTag = opt.id;
              searchWrap.querySelectorAll('[data-tag]').forEach(function (b) {
                b.style.cssText = pillStyle + (b.getAttribute('data-tag') === opt.id ? ';' + pillActiveStyle : '');
              });
              renderList();
            });
            moreRow.appendChild(pill);
          });
          searchWrap.appendChild(moreRow);
        }
        classesPanelWrap.appendChild(searchWrap);
        var listContainer = document.createElement('div');
        listContainer.style.cssText = 'flex:1;min-height:0;overflow-y:auto;';
        classesPanelWrap.appendChild(listContainer);
        function renderList() {
          listContainer.innerHTML = '';
          var q = (searchInput.value || '').toLowerCase().trim();
          var filtered = items.filter(function (item) {
            if (selectedType && item.typeCat !== selectedType) return false;
            if (selectedUsage && item.usage !== selectedUsage) return false;
            if (selectedTag && item.tag !== selectedTag) return false;
            return !q || (item.name || '').toLowerCase().indexOf(q) >= 0;
          });
          var byCat = { text: [], 'image/video': [], icons: [] };
          filtered.forEach(function (item) { if (byCat[item.typeCat]) byCat[item.typeCat].push(item); });
          var shown = 0;
          var descPillStyle = 'display:inline-block;padding:3px 6px;font-size:9px;font-weight:600;font-family:' + COMMENT_FONT + ';border-radius:999px;background:var(--neutral-200,#E6E3E3);color:var(--neutral-800,#372828);margin:1px 2px 1px 0;';
          sectionOrder.forEach(function (cat) {
            var list = byCat[cat] || [];
            if (!list.length) return;
            var heading = document.createElement('div');
            heading.style.cssText = sectionTitleStyle;
            heading.textContent = sectionTitles[cat];
            listContainer.appendChild(heading);
            var cardWrap = document.createElement('div');
            cardWrap.style.cssText = cardWrapStyle;
            list.forEach(function (item) {
              shown++;
              var card = document.createElement('button');
              card.type = 'button';
              card.style.cssText = cardStyle;
              card.addEventListener('mouseenter', function () {
                card.style.borderColor = '#9E198C';
                card.style.boxShadow = '0 2px 8px rgba(158,25,140,0.2)';
                highlightElementsBySelector(item.type, item.name);
              });
              card.addEventListener('mouseleave', function () {
                card.style.borderColor = '';
                card.style.boxShadow = '';
                clearClassHighlights();
              });
              var row1 = document.createElement('div');
              row1.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
              var label = document.createElement('span');
              label.style.cssText = 'font-size:12px;font-weight:600;color:#9E198C;';
              label.textContent = (item.type === 'class' ? '.' : '<') + item.name + (item.type === 'tag' ? '>' : '');
              var count = document.createElement('span');
              count.style.cssText = 'font-size:11px;color:var(--neutral-600,#675C58);';
              count.textContent = item.count + (item.count === 1 ? ' use' : ' uses');
              row1.appendChild(label);
              row1.appendChild(count);
              card.appendChild(row1);
              var preview = getSelectorPreviewStyles(item.type, item.name);
              if (preview) {
                var row2 = document.createElement('div');
                row2.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;';
                var ttBox = document.createElement('span');
                ttBox.className = 'reforma-tt-preview';
                ttBox.textContent = 'Tt';
                var ff = preview.fontFamily;
                if (ff && ff !== 'inherit' && /[\s,]/.test(ff)) ff = "'" + ff.replace(/'/g, "\\'") + "'";
                ttBox.style.cssText = 'font-family:' + (preview.fontFamily !== 'inherit' ? (ff || 'inherit') : 'inherit') + ';font-weight:' + preview.fontWeight + ';color:' + preview.color + ';background:' + preview.backgroundColor + ';padding:2px 6px;border-radius:4px;font-size:14px;line-height:1.2;min-width:28px;text-align:center;';
                row2.appendChild(ttBox);
                [preview.fontFamily, preview.fontWeight, preview.color, preview.backgroundColor].forEach(function (val, i) {
                  var pill = document.createElement('span');
                  pill.style.cssText = descPillStyle;
                  pill.textContent = val || '—';
                  row2.appendChild(pill);
                });
                card.appendChild(row2);
              }
              card.addEventListener('click', function () {
                var elements = getElementsBySelector(item.type, item.name);
                if (!elements.length) return;
                currentGapBatchElements = elements;
                currentGapBatchLabel = (item.type === 'class' ? '.' : '') + item.name;
                currentGapTarget = null;
                highlightElementsBySelector(item.type, item.name);
                createComment(0, 0, null, elements[0], 'right');
              });
              cardWrap.appendChild(card);
            });
            listContainer.appendChild(cardWrap);
          });
          if (shown === 0) {
            var empty = document.createElement('p');
            empty.style.cssText = emptyStyle;
            empty.textContent = q ? ("No matches for \"" + q + "\".") : 'No classes or tags found.';
            listContainer.appendChild(empty);
          }
        }
        searchInput.addEventListener('input', renderList);
        searchInput.addEventListener('keyup', renderList);
        renderList();
      })();

      var changesPanelWrap = document.createElement('div');
      changesPanelWrap.className = 'reforma-tab-content';
      changesPanelWrap.style.cssText = 'flex:1;display:none;flex-direction:column;min-height:0;';
      changesPanelWrap.appendChild(buildReformaChangesPanel());

      function showEdit() {
        emptyWrap.style.display = 'flex';
        classesPanelWrap.style.display = 'none';
        changesPanelWrap.style.display = 'none';
        editTab.style.color = '#181211';
        editTab.style.borderBottomColor = '#181211';
        classesTab.style.color = 'var(--neutral-600,#675C58)';
        classesTab.style.borderBottomColor = 'transparent';
        changesTab.style.color = 'var(--neutral-600,#675C58)';
        changesTab.style.borderBottomColor = 'transparent';
      }
      function showClasses() {
        emptyWrap.style.display = 'none';
        classesPanelWrap.style.display = 'flex';
        changesPanelWrap.style.display = 'none';
        editTab.style.color = 'var(--neutral-600,#675C58)';
        editTab.style.borderBottomColor = 'transparent';
        classesTab.style.color = '#181211';
        classesTab.style.borderBottomColor = '#181211';
        changesTab.style.color = 'var(--neutral-600,#675C58)';
        changesTab.style.borderBottomColor = 'transparent';
      }
      function showChanges() {
        emptyWrap.style.display = 'none';
        classesPanelWrap.style.display = 'none';
        changesPanelWrap.style.display = 'flex';
        changesPanelWrap.innerHTML = '';
        changesPanelWrap.appendChild(buildReformaChangesPanel());
        editTab.style.color = 'var(--neutral-600,#675C58)';
        editTab.style.borderBottomColor = 'transparent';
        classesTab.style.color = 'var(--neutral-600,#675C58)';
        classesTab.style.borderBottomColor = 'transparent';
        changesTab.style.color = '#181211';
        changesTab.style.borderBottomColor = '#181211';
      }
      editTab.addEventListener('click', showEdit);
      classesTab.addEventListener('click', showClasses);
      changesTab.addEventListener('click', showChanges);

      wrap.appendChild(tabBar);
      wrap.appendChild(emptyWrap);
      wrap.appendChild(classesPanelWrap);
      wrap.appendChild(changesPanelWrap);
    } else if (!gapMode || !targetEl) {
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
      var targets = [];
      var editScope = 'element'; // 'element' | 'class'
      function refreshTargets() {
        var baseTargets = (currentGapBatchElements && currentGapBatchElements.length) ? currentGapBatchElements.slice() : (targetEl ? [targetEl] : []);
        var next = baseTargets;
        if (editScope === 'class' && targetEl && targetEl.classList && targetEl.classList.length) {
          var cls = targetEl.classList[0];
          try {
            next = Array.prototype.slice.call(document.querySelectorAll('.' + cls));
          } catch (e) {
            next = baseTargets;
          }
        }
        targets.length = 0;
        Array.prototype.push.apply(targets, next);
      }
      refreshTargets();
      function forEachTarget(fn) { targets.forEach(fn); }
      function forEachTargetAndDescendants(fn) {
        targets.forEach(function (t) {
          if (!t || !t.isConnected) return;
          fn(t);
          var list = t.querySelectorAll('*');
          for (var i = 0; i < list.length; i++) fn(list[i]);
        });
      }
      targets.forEach(function (t) {
        if (!originalStyles.has(t)) {
          var cs = window.getComputedStyle(t);
          originalStyles.set(t, {
            fontFamily: cs.fontFamily || '',
            color: cs.color || '',
            fontSize: cs.fontSize || '',
            lineHeight: cs.lineHeight || '',
            letterSpacing: cs.letterSpacing || '',
            fontWeight: cs.fontWeight || ''
          });
        }
      });
      var primaryEl = targets[0] || targetEl;
      var computedStyle = window.getComputedStyle(primaryEl);
      var sectionOriginals = (function () {
        var o = originalStyles.get(primaryEl) || {};
        var cs = window.getComputedStyle(primaryEl);
        return {
          typo: {
            fontFamily: o.fontFamily || cs.fontFamily || '',
            color: o.color || cs.color || '',
            fontSize: o.fontSize || cs.fontSize || '',
            lineHeight: o.lineHeight || cs.lineHeight || '',
            letterSpacing: o.letterSpacing || cs.letterSpacing || '',
            fontWeight: o.fontWeight || cs.fontWeight || '',
            backgroundColor: (primaryEl.style.backgroundColor || cs.backgroundColor || '').toString(),
            fontStyle: (primaryEl.style.fontStyle || cs.fontStyle || '').toString(),
            textDecoration: (primaryEl.style.textDecoration || cs.textDecoration || '').toString(),
            textTransform: (primaryEl.style.textTransform || cs.textTransform || '').toString(),
            textAlign: (primaryEl.style.textAlign || cs.textAlign || '').toString()
          },
          layout: {
            width: (primaryEl.style.width || cs.width || '').toString().trim(),
            height: (primaryEl.style.height || cs.height || '').toString().trim(),
            gap: (primaryEl.style.gap || cs.gap || '').toString().trim(),
            paddingTop: (primaryEl.style.paddingTop || cs.paddingTop || '').toString().trim(),
            paddingRight: (primaryEl.style.paddingRight || cs.paddingRight || '').toString().trim(),
            paddingBottom: (primaryEl.style.paddingBottom || cs.paddingBottom || '').toString().trim(),
            paddingLeft: (primaryEl.style.paddingLeft || cs.paddingLeft || '').toString().trim(),
            marginTop: (primaryEl.style.marginTop || cs.marginTop || '').toString().trim(),
            marginRight: (primaryEl.style.marginRight || cs.marginRight || '').toString().trim(),
            marginBottom: (primaryEl.style.marginBottom || cs.marginBottom || '').toString().trim(),
            marginLeft: (primaryEl.style.marginLeft || cs.marginLeft || '').toString().trim(),
            borderRadius: (primaryEl.style.borderRadius || cs.borderTopLeftRadius || '').toString().trim(),
            overflow: (primaryEl.style.overflow || cs.overflow || '').toString(),
            display: (primaryEl.style.display || cs.display || '').toString(),
            flexDirection: (primaryEl.style.flexDirection || cs.flexDirection || '').toString(),
            justifyContent: (primaryEl.style.justifyContent || cs.justifyContent || '').toString(),
            alignItems: (primaryEl.style.alignItems || cs.alignItems || '').toString()
          },
          position: {
            position: (primaryEl.style.position || cs.position || '').toString(),
            left: (primaryEl.style.left || cs.left || '').toString().trim(),
            right: (primaryEl.style.right || cs.right || '').toString().trim(),
            top: (primaryEl.style.top || cs.top || '').toString().trim(),
            bottom: (primaryEl.style.bottom || cs.bottom || '').toString().trim(),
            transform: (primaryEl.style.transform || cs.transform || '').toString()
          },
          effects: {
            borderRadius: (primaryEl.style.borderRadius || cs.borderTopLeftRadius || '').toString().trim(),
            opacity: (primaryEl.style.opacity || cs.opacity || '').toString(),
            filter: (primaryEl.style.filter || cs.filter || '').toString(),
            boxShadow: (primaryEl.style.boxShadow || cs.boxShadow || '').toString()
          },
          colors: {
            primary: (primaryEl.style.getPropertyValue && primaryEl.style.getPropertyValue('--reforma-primary')) || (cs.getPropertyValue && cs.getPropertyValue('--primary')) || (primaryEl.style.borderColor || cs.borderColor || '').toString() || (primaryEl.style.color || cs.color || '').toString(),
            secondary: (primaryEl.style.getPropertyValue && primaryEl.style.getPropertyValue('--reforma-secondary')) || (cs.getPropertyValue && cs.getPropertyValue('--secondary')) || '',
            section: (primaryEl.style.backgroundColor || cs.backgroundColor || '').toString(),
            button: (primaryEl.style.getPropertyValue && primaryEl.style.getPropertyValue('--reforma-button')) || (cs.getPropertyValue && cs.getPropertyValue('--button')) || (primaryEl.style.backgroundColor || cs.backgroundColor || '').toString(),
            text: (primaryEl.style.color || cs.color || '').toString()
          }
        };
      })();
      function makeSectionUndoBtn(sectionKey, label) {
        var btn = document.createElement('button');
        btn.type = 'button';
        var tip = 'Revert ' + label + ' to original (undo changes in this section)';
        btn.setAttribute('aria-label', tip);
        btn.title = tip;
        btn.style.cssText = 'display:none;width:24px;height:24px;padding:0;border:none;border-radius:999px;background:transparent;color:var(--neutral-600,#675C58);cursor:pointer;display:flex;align-items:center;justify-content:center;';
        btn.appendChild(createMaterialIcon('undo', 14, 'var(--neutral-600,#675C58)'));
        return {
          btn: btn,
          show: function () { btn.style.display = 'flex'; },
          hide: function () { btn.style.display = 'none'; }
        };
      }
      var sectionUndo = {
        typo: makeSectionUndoBtn('typography', 'Typography'),
        layout: makeSectionUndoBtn('layout', 'Layout'),
        position: makeSectionUndoBtn('position', 'Position'),
        effects: makeSectionUndoBtn('effects', 'Effects'),
        colors: makeSectionUndoBtn('colors', 'Color')
      };
      function markSectionDirty(key) { if (sectionUndo[key]) sectionUndo[key].show(); }
      var currentFontKey = null;
      var currentColor = computedStyle.color || '';
      var bgRaw = computedStyle.backgroundColor || '';
      var currentBgColor = (!bgRaw || bgRaw === 'transparent' || bgRaw === 'rgba(0, 0, 0, 0)') ? '' : bgRaw;
      var colorPrimary = sectionOriginals.colors.primary ? rgbToHex(sectionOriginals.colors.primary) : '#38052E';
      var colorSecondary = sectionOriginals.colors.secondary ? rgbToHex(sectionOriginals.colors.secondary) : '#9E198C';
      var colorButton = sectionOriginals.colors.button ? rgbToHex(sectionOriginals.colors.button) : (currentBgColor ? rgbToHex(currentBgColor) : '#D643E3');
      var currentFontSize = computedStyle.fontSize || '16px';
      var currentLineHeight = computedStyle.lineHeight || '';
      var currentLetterSpacing = computedStyle.letterSpacing || '';
      var rawWeight = computedStyle.fontWeight || '400';
      var currentFontWeight = (rawWeight === 'normal' ? '400' : rawWeight === 'bold' ? '700' : rawWeight);
      function applyTypographyToPreview() {
        // Preview card has been removed; we still keep this helper name
        // in case future logic wants to extend it. For now it is a no-op.
      }
      var tagLabel = targets.length > 1 && currentGapBatchLabel
        ? currentGapBatchLabel + ' (' + targets.length + ' elements)'
        : '<' + (primaryEl.tagName || '').toLowerCase() + '>';

      var tagName = (primaryEl.tagName || '').toLowerCase();
      var showTypography = !/^(img|video|picture|source|canvas|svg)$/.test(tagName);
      var showLayout = !/^(script|style|template|meta|link|noscript)$/.test(tagName);
      var showEffects = !/^(script|style|template|meta|link|noscript)$/.test(tagName);
      var showColor = !/^(script|style|template|meta|link|noscript|img|video|picture|source|canvas)$/.test(tagName);

      var layoutPanel = null;
      var effectsPanel = null;

      var headerRow = document.createElement('div');
      headerRow.style.cssText = 'display:flex;padding:0;justify-content:space-between;align-items:center;align-self:stretch;margin-bottom:2px;flex-wrap:nowrap;gap:8px;';
      var tagSpan = document.createElement('span');
      tagSpan.style.cssText = 'font-size:15px;white-space:nowrap;' + GAP_HEADER;
      tagSpan.textContent = tagLabel;
      var headerRight = document.createElement('div');
      headerRight.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:nowrap;';

      var endSessionBtn = document.createElement('button');
      endSessionBtn.type = 'button';
      endSessionBtn.textContent = '×';
      endSessionBtn.setAttribute('aria-label', 'End session');
      endSessionBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;min-width:28px;padding:0;font-size:20px;line-height:1;font-weight:400;font-family:' + COMMENT_FONT + ';border:none;border-radius:50%;background:rgba(158,25,140,0.2);color:#9E198C;cursor:pointer;';
      endSessionBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });

      headerRight.appendChild(endSessionBtn);
      headerRow.appendChild(tagSpan);
      headerRow.appendChild(headerRight);
      wrap.appendChild(headerRow);

      var fullTabBar = document.createElement('div');
      fullTabBar.style.cssText = 'display:flex;gap:0;border-bottom:1px solid var(--neutral-200,#E6E3E3);margin-bottom:8px;';
      var fullEditTab = document.createElement('button');
      fullEditTab.type = 'button';
      fullEditTab.textContent = 'Edit';
      fullEditTab.style.cssText = 'flex:1;padding:8px 12px;font-size:13px;font-weight:600;font-family:' + COMMENT_FONT + ';border:none;background:transparent;color:#181211;cursor:pointer;border-bottom:2px solid #181211;';
      var fullClassesTab = document.createElement('button');
      fullClassesTab.type = 'button';
      fullClassesTab.textContent = 'Classes';
      fullClassesTab.style.cssText = 'flex:1;padding:8px 12px;font-size:13px;font-weight:600;font-family:' + COMMENT_FONT + ';border:none;background:transparent;color:var(--neutral-600,#675C58);cursor:pointer;border-bottom:2px solid transparent;';
      var fullChangesTab = document.createElement('button');
      fullChangesTab.type = 'button';
      fullChangesTab.textContent = 'History';
      fullChangesTab.style.cssText = 'flex:1;padding:8px 12px;font-size:13px;font-weight:600;font-family:' + COMMENT_FONT + ';border:none;background:transparent;color:var(--neutral-600,#675C58);cursor:pointer;border-bottom:2px solid transparent;';
      fullTabBar.appendChild(fullEditTab);
      fullTabBar.appendChild(fullClassesTab);
      fullTabBar.appendChild(fullChangesTab);
      wrap.appendChild(fullTabBar);

      function makeBentoCard(title, contentEl) {
        var card = document.createElement('div');
        var isTypography = title === 'Typography';
        card.style.cssText = 'display:flex;flex-direction:column;gap:6px;' + (isTypography ? '' : 'padding:8px 10px;border:1px solid var(--neutral-200,#E6E3E3);border-radius:12px;background:var(--neutral-100,#F9F6F6);') + 'box-sizing:border-box;min-width:0;';
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:6px;';
        var iconKey = title === 'Text Styles' ? 'text'
          : title === 'Color' ? 'palette'
          : title === 'Weight' ? 'weight'
          : title === 'Size' ? 'size'
          : 'layout';
        var ic = createMaterialIcon(iconKey, 14);
        ic.style.opacity = '0.75';
        header.appendChild(ic);
        var t = document.createElement('div');
        t.style.cssText = GAP_SECTION_TITLE;
        t.textContent = title;
        header.appendChild(t);
        card.appendChild(header);
        card.appendChild(contentEl);
        return card;
      }

      var grid = document.createElement('div');
      grid.className = 'reforma-panel-text-grid';
      // Preview on top, typography controls underneath (stacked vertically).
      grid.style.cssText = 'display:flex;flex-direction:column;width:100%;box-sizing:border-box;gap:10px;margin-bottom:6px;align-items:stretch;';

      var fontSelect = document.createElement('select');
      fontSelect.style.cssText = 'width:100%;min-width:0;' + GAP_INPUT + 'cursor:pointer;border-radius:10px;';
      fontSelect.innerHTML =
        '<option value="">Font...</option>' +
        '<option value="google_sans">Google Sans</option>' +
        '<option value="shantell">Shantell Sans</option>' +
        '<option value="inter">Inter</option>' +
        '<option value="roboto">Roboto</option>' +
        '<option value="system">System UI</option>' +
        '<option value="__custom_google__">Browse Google font…</option>';

      function ensureCustomGoogleFontLoaded(family) {
        if (!family) return null;
        var cleanName = family.trim();
        if (!cleanName) return null;
        var slug = cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        var linkId = 'reforma-google-font-' + slug;
        if (!document.getElementById(linkId)) {
          var link = document.createElement('link');
          link.id = linkId;
          link.rel = 'stylesheet';
          // Use Google Fonts css2 endpoint; weights are a good default set.
          var familyParam = encodeURIComponent(cleanName.replace(/\s+/g, '+'));
          link.href = 'https://fonts.googleapis.com/css2?family=' + familyParam + ':wght@300;400;500;600;700&display=swap';
          document.head.appendChild(link);
        }
        return '\'' + cleanName + '\', system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif';
      }

      fontSelect.addEventListener('change', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var fontKey = fontSelect.value;
        if (!fontKey) return;

        var fontFamily = null;
        if (fontKey === '__custom_google__') {
          var input = window.prompt('Enter a Google Fonts family name (for example: \"Space Grotesk\" or \"DM Sans\")');
          fontSelect.value = '';
          if (!input) return;
          fontFamily = ensureCustomGoogleFontLoaded(input);
          if (!fontFamily) return;
          currentFontKey = 'custom:' + input;
        } else {
          currentFontKey = fontKey;
          fontFamily = resolvePlaygroundFont(fontKey);
          ensureFontsLoaded();
        }

        if (targets.length && fontFamily) {
          markSectionDirty('typo');
          forEachTargetAndDescendants(function (t) {
            if (!originalStyles.has(t)) {
              var cs = window.getComputedStyle(t);
              originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', fontSize: cs.fontSize || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
            }
            t.style.transition = 'font-family 0.25s ease, color 0.25s ease, font-weight 0.25s ease, font-size 0.25s ease';
            t.style.fontFamily = fontFamily;
          });
        }
        applyTypographyToPreview();
        if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn();
      });
      // Build grouped Typography card

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
      colorCircle.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;height:28px;min-height:28px;padding:0;margin:0;border-radius:8px;border:none;cursor:pointer;overflow:hidden;';
      function applyColorFromInput(val) {
        markSectionDirty('typo');
        forEachTargetAndDescendants(function (t) {
          if (!originalStyles.has(t)) {
            var cs = window.getComputedStyle(t);
            originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
          }
          t.style.transition = 'font-family 0.25s ease, color 0.25s ease, font-weight 0.25s ease, font-size 0.25s ease';
          t.style.color = val;
        });
        currentColor = val;
        syncCircleToPicker();
        applyTypographyToPreview();
      }
      colorInput.addEventListener('input', function () { syncCircleToPicker(); applyColorFromInput(colorInput.value); });
      colorInput.addEventListener('change', function () { syncCircleToPicker(); applyColorFromInput(colorInput.value); });
      colorCircle.appendChild(colorInput);
      syncCircleToPicker();

      var bgColorCircle = document.createElement('button');
      bgColorCircle.type = 'button';
      bgColorCircle.className = 'reforma-playground-color-circle';
      bgColorCircle.setAttribute('title', 'Background color');
      bgColorCircle.setAttribute('aria-label', 'Choose background color');
      var bgColorInput = document.createElement('input');
      bgColorInput.type = 'color';
      bgColorInput.className = 'reforma-playground-color-picker-in-circle';
      bgColorInput.value = rgbToHex(currentBgColor || '#FFFFFF');
      bgColorInput.setAttribute('tabindex', '-1');
      function syncBgCircle() { bgColorCircle.style.background = bgColorInput.value; }
      bgColorCircle.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;height:28px;min-height:28px;padding:0;margin:0;border-radius:8px;border:none;cursor:pointer;overflow:hidden;';
      function applyBgColor(val) {
        markSectionDirty('typo');
        currentBgColor = val;
        forEachTarget(function (t) {
          t.style.transition = 'background-color 0.25s ease';
          t.style.backgroundColor = val;
        });
        applyTypographyToPreview();
      }
      bgColorInput.addEventListener('input', function () { syncBgCircle(); applyBgColor(bgColorInput.value); });
      bgColorInput.addEventListener('change', function () { syncBgCircle(); applyBgColor(bgColorInput.value); });
      bgColorCircle.appendChild(bgColorInput);
      syncBgCircle();

      var textColorBox = document.createElement('div');
      textColorBox.className = 'reforma-color-swatch-box';
      textColorBox.style.cssText = 'display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px;box-sizing:border-box;cursor:pointer;transition:background 0.2s ease;';
      textColorBox.appendChild(colorCircle);
      var bgColorBox = document.createElement('div');
      bgColorBox.className = 'reforma-color-swatch-box';
      bgColorBox.style.cssText = 'display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px;box-sizing:border-box;cursor:pointer;transition:background 0.2s ease;';
      bgColorBox.appendChild(bgColorCircle);

      var weightsList = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
      var weightWrap = document.createElement('div');
      weightWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px 10px;box-sizing:border-box;';
      var weightVal = document.createElement('span');
      weightVal.style.cssText = 'min-width:32px;text-align:center;font-size:11px;font-family:\'Google Sans\',sans-serif;font-weight:600;color:#372828;letter-spacing:-0.2px;';
      var displayWeight = (weightsList.indexOf(currentFontWeight) >= 0 ? currentFontWeight : '400');
      weightVal.textContent = displayWeight;
      function setWeightValue(next) {
        markSectionDirty('typo');
        var w = (weightsList.indexOf(next) >= 0 ? next : displayWeight);
        currentFontWeight = w;
        displayWeight = w;
        weightVal.textContent = w;
        forEachTarget(function (t) {
          if (!originalStyles.has(t)) {
            var cs = window.getComputedStyle(t);
            originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
          }
          t.style.transition = 'font-family 0.25s ease, color 0.25s ease, font-weight 0.25s ease, font-size 0.25s ease';
          t.style.fontWeight = w;
        });
        applyTypographyToPreview();
      }
      weightWrap.appendChild(weightVal);
      makeValueEditableOnDblclick(weightVal, function () { return displayWeight; }, setWeightValue, function (v) { return v; }, function (val) {
        var s = String(val).trim();
        if (weightsList.indexOf(s) >= 0) return s;
        var n = parseInt(s, 10);
        if (n >= 100 && n <= 900) return String(n);
        return null;
      });
      addValueScrubber(weightWrap, function () { var i = weightsList.indexOf(currentFontWeight); return i >= 0 ? i : 1; }, function (idx) {
        markSectionDirty('typo');
        var i = Math.max(0, Math.min(weightsList.length - 1, Math.round(idx)));
        var next = weightsList[i];
        currentFontWeight = next;
        displayWeight = next;
        weightVal.textContent = next;
        forEachTargetAndDescendants(function (t) {
          if (!originalStyles.has(t)) { var cs = window.getComputedStyle(t); originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' }); }
          t.style.fontWeight = next;
        });
        applyTypographyToPreview();
      }, { step: 1, min: 0, max: weightsList.length - 1 });

      var sizeWrap = document.createElement('div');
      sizeWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px 10px;box-sizing:border-box;';
      var sizeVal = document.createElement('span');
      sizeVal.style.cssText = 'min-width:40px;text-align:center;font-size:11px;font-family:\'Google Sans\',sans-serif;font-weight:600;color:#372828;letter-spacing:-0.2px;';
      var px = parseInt(currentFontSize, 10) || 16;
      sizeVal.textContent = px + ' px';
      function setSizeValue(n) {
        markSectionDirty('typo');
        px = Math.max(8, Math.min(96, Math.round(n)));
        currentFontSize = px + 'px';
        sizeVal.textContent = px + ' px';
        forEachTargetAndDescendants(function (t) {
          if (!originalStyles.has(t)) {
            var cs = window.getComputedStyle(t);
            originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', fontSize: cs.fontSize || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
          }
          t.style.transition = 'font-family 0.25s ease, color 0.25s ease, font-weight 0.25s ease, font-size 0.25s ease';
          t.style.fontSize = currentFontSize;
        });
        applyTypographyToPreview();
      }
      sizeWrap.appendChild(sizeVal);
      makeValueEditableOnDblclick(sizeVal, function () { return px; }, setSizeValue, function (v) { return v + ' px'; }, function (val) {
        var n = parseInt(String(val).trim(), 10);
        return isNaN(n) ? null : Math.max(8, Math.min(96, n));
      });
      addValueScrubber(sizeWrap, function () { return px; }, function (n) {
        markSectionDirty('typo');
        px = Math.max(8, Math.min(96, Math.round(n)));
        currentFontSize = px + 'px';
        sizeVal.textContent = px + ' px';
        forEachTargetAndDescendants(function (t) {
          if (!originalStyles.has(t)) { var cs = window.getComputedStyle(t); originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', fontSize: cs.fontSize || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' }); }
          t.style.fontSize = currentFontSize;
        });
        applyTypographyToPreview();
      }, { step: 1, min: 8, max: 96 });

      var typoContent = document.createElement('div');
      typoContent.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      var TYPO_ICON = 'var(--neutral-600,#675C58)';
      var typoHeader = document.createElement('div');
      typoHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;gap:8px;';
      var typoTitle = document.createElement('div');
      typoTitle.style.cssText = 'font-size:13px;font-weight:800;color:#181211;font-family:' + COMMENT_FONT + ';letter-spacing:-0.1px;';
      typoTitle.textContent = 'Typography';
      var typoRightWrap = document.createElement('div');
      typoRightWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
      var scopeToggle = document.createElement('button');
      scopeToggle.type = 'button';
      scopeToggle.setAttribute('aria-pressed', editScope === 'class' ? 'true' : 'false');
      scopeToggle.title = 'Toggle between editing just this element or all elements with the same class';
      scopeToggle.style.cssText = 'border-radius:999px;border:1px solid var(--neutral-200,#E6E3E3);background:var(--neutral-100,#F9F6F6);padding:2px 8px;font-size:10px;font-family:' + COMMENT_FONT + ';color:var(--neutral-700,#504645);cursor:pointer;';
      function renderScopeToggle() {
        if (editScope === 'class') {
          scopeToggle.textContent = 'Class';
          scopeToggle.style.background = 'var(--primary-500,#F977DF)';
          scopeToggle.style.color = 'var(--primary-900,#38052E)';
          scopeToggle.setAttribute('aria-pressed', 'true');
        } else {
          scopeToggle.textContent = 'Element';
          scopeToggle.style.background = 'var(--neutral-100,#F9F6F6)';
          scopeToggle.style.color = 'var(--neutral-700,#504645)';
          scopeToggle.setAttribute('aria-pressed', 'false');
        }
      }
      renderScopeToggle();
      scopeToggle.addEventListener('click', function (e) {
        e.preventDefault();
        editScope = editScope === 'class' ? 'element' : 'class';
        refreshTargets();
        renderScopeToggle();
      });
      var typoUndoWrap = document.createElement('div');
      typoUndoWrap.style.cssText = 'display:flex;align-items:center;';
      typoUndoWrap.appendChild(sectionUndo.typo.btn);
      typoRightWrap.appendChild(scopeToggle);
      typoRightWrap.appendChild(typoUndoWrap);
      typoHeader.appendChild(typoTitle);
      typoHeader.appendChild(typoRightWrap);
      typoContent.appendChild(typoHeader);

      var fontRow = document.createElement('div');
      fontRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
      var fontRowIcon = createMaterialIcon('text', 14);
      fontRowIcon.style.cssText = 'color:' + TYPO_ICON + ';flex-shrink:0;';
      fontSelect.style.flex = '1';
      fontSelect.style.minWidth = '0';
      fontRow.appendChild(fontRowIcon);
      fontRow.appendChild(fontSelect);
      typoContent.appendChild(fontRow);

      var row0 = document.createElement('div');
      row0.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;';
      var textColorCol = document.createElement('div');
      textColorCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      var textColorLabel = document.createElement('div');
      textColorLabel.style.cssText = GAP_LABEL + 'display:flex;align-items:center;gap:4px;text-align:left;';
      var textColorIcon = createMaterialIcon('palette', 13);
      textColorIcon.style.color = TYPO_ICON;
      textColorLabel.appendChild(textColorIcon);
      textColorLabel.appendChild(document.createTextNode('Text color'));
      textColorCol.appendChild(textColorLabel);
      textColorCol.appendChild(textColorBox);
      var bgColorCol = document.createElement('div');
      bgColorCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      var bgColorLabel = document.createElement('div');
      bgColorLabel.style.cssText = GAP_LABEL + 'display:flex;align-items:center;gap:4px;text-align:left;';
      var bgColorIcon = createMaterialIcon('format_paint', 13);
      bgColorIcon.style.color = TYPO_ICON;
      bgColorLabel.appendChild(bgColorIcon);
      bgColorLabel.appendChild(document.createTextNode('Background'));
      bgColorCol.appendChild(bgColorLabel);
      bgColorCol.appendChild(bgColorBox);
      row0.appendChild(textColorCol);
      row0.appendChild(bgColorCol);
      typoContent.appendChild(row0);

      weightWrap.style.cssText = 'display:flex;align-items:center;gap:6px;border-radius:8px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px 8px;box-sizing:border-box;min-width:0;';
      weightWrap.insertBefore(createMaterialIcon('weight', 14), weightVal);
      weightWrap.querySelector('svg').style.color = TYPO_ICON;
      sizeWrap.style.cssText = 'display:flex;align-items:center;gap:6px;border-radius:8px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px 8px;box-sizing:border-box;min-width:0;';
      sizeWrap.insertBefore(createMaterialIcon('size', 14), sizeVal);
      sizeWrap.querySelector('svg').style.color = TYPO_ICON;
      var rowWeightSize = document.createElement('div');
      rowWeightSize.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;';
      rowWeightSize.appendChild(weightWrap);
      rowWeightSize.appendChild(sizeWrap);
      typoContent.appendChild(rowWeightSize);

      var lineWrap = document.createElement('div');
      var lineVal = document.createElement('span');
      lineVal.style.cssText = 'min-width:40px;text-align:center;font-size:11px;font-family:\'Google Sans\',sans-serif;font-weight:600;color:#372828;letter-spacing:-0.2px;';
      var lhParsed = parseFloat(currentLineHeight);
      var lh = (!lhParsed || lhParsed > 4) ? 1.4 : lhParsed;
      lineVal.textContent = lh.toFixed(2) + '';
      function applyLineHeight(next) {
        markSectionDirty('typo');
        lh = Math.max(0.8, Math.min(3, next));
        lineVal.textContent = lh.toFixed(2);
        currentLineHeight = lh.toFixed(2);
        forEachTargetAndDescendants(function (t) {
          if (!originalStyles.has(t)) {
            var cs = window.getComputedStyle(t);
            originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', fontSize: cs.fontSize || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
          }
          t.style.transition = 'line-height 0.25s ease';
          t.style.lineHeight = lh.toFixed(2);
        });
        applyTypographyToPreview();
      }
      lineWrap.appendChild(lineVal);
      makeValueEditableOnDblclick(lineVal, function () { return lh; }, applyLineHeight, function (v) { return v.toFixed(2); }, function (val) {
        var n = parseFloat(String(val).trim(), 10);
        return isNaN(n) ? null : Math.max(0.8, Math.min(3, n));
      });
      addValueScrubber(lineWrap, function () { return lh; }, function (n) { applyLineHeight(n); }, { step: 0.1, min: 0.8, max: 3 });

      var letterWrap = document.createElement('div');
      var letterVal = document.createElement('span');
      letterVal.style.cssText = 'min-width:52px;text-align:center;font-size:11px;font-family:\'Google Sans\',sans-serif;font-weight:600;color:#372828;letter-spacing:-0.2px;';
      var ls = parseFloat(currentLetterSpacing) || 0;
      letterVal.textContent = ls.toFixed(2) + ' px';
      function applyLetter(next) {
        markSectionDirty('typo');
        ls = Math.max(-5, Math.min(5, next));
        letterVal.textContent = ls.toFixed(2) + ' px';
        currentLetterSpacing = ls;
        forEachTargetAndDescendants(function (t) {
          if (!originalStyles.has(t)) {
            var cs2 = window.getComputedStyle(t);
            originalStyles.set(t, { fontFamily: cs2.fontFamily || '', color: cs2.color || '', fontSize: cs2.fontSize || '', lineHeight: cs2.lineHeight || '', letterSpacing: cs2.letterSpacing || '', fontWeight: cs2.fontWeight || '' });
          }
          t.style.transition = 'letter-spacing 0.25s ease';
          t.style.letterSpacing = ls === 0 ? '' : (ls.toFixed(2) + 'px');
        });
        applyTypographyToPreview();
      }
      letterWrap.appendChild(letterVal);
      makeValueEditableOnDblclick(letterVal, function () { return ls; }, applyLetter, function (v) { return v.toFixed(2) + ' px'; }, function (val) {
        var n = parseFloat(String(val).trim(), 10);
        return isNaN(n) ? null : Math.max(-5, Math.min(5, n));
      });
      addValueScrubber(letterWrap, function () { return ls; }, function (n) { applyLetter(n); }, { step: 0.1, min: -5, max: 5 });

      lineWrap.style.cssText = 'display:flex;align-items:center;gap:6px;border-radius:8px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px 8px;box-sizing:border-box;min-width:0;';
      lineWrap.insertBefore(createMaterialIcon('line_height', 14), lineVal);
      lineWrap.querySelector('svg').style.color = TYPO_ICON;
      letterWrap.style.cssText = 'display:flex;align-items:center;gap:6px;border-radius:8px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px 8px;box-sizing:border-box;min-width:0;';
      letterWrap.insertBefore(createMaterialIcon('letter_spacing', 14), letterVal);
      letterWrap.querySelector('svg').style.color = TYPO_ICON;
      var rowLineLetter = document.createElement('div');
      rowLineLetter.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;';
      rowLineLetter.appendChild(lineWrap);
      rowLineLetter.appendChild(letterWrap);
      typoContent.appendChild(rowLineLetter);

      var alignRow = document.createElement('div');
      alignRow.style.cssText = 'display:flex;align-items:center;gap:4px;';
      var textAlignValue = 'left';
      var alignBtnStyle = 'width:32px;height:28px;padding:0;border:1px solid var(--neutral-200,#E6E3E3);border-radius:6px;background:var(--neutral-100,#F9F6F6);color:var(--neutral-800,#372828);cursor:pointer;display:flex;align-items:center;justify-content:center;';
      var alignActiveStyle = 'background:var(--neutral-900,#181211);border-color:var(--neutral-900,#181211);color:#fff;';
      function setTextAlign(val) {
        markSectionDirty('typo');
        textAlignValue = val;
        alignRow.querySelectorAll('button').forEach(function (b) {
          var on = b.getAttribute('data-align') === val;
          b.style.cssText = alignBtnStyle + (on ? ';' + alignActiveStyle : '');
        });
        forEachTargetAndDescendants(function (t) {
          if (!originalStyles.has(t)) {
            var cs = window.getComputedStyle(t);
            originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', fontSize: cs.fontSize || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
          }
          t.style.textAlign = val;
        });
        applyTypographyToPreview();
      }
      [['left', 'align_left', 'Left align'], ['center', 'align_center', 'Center'], ['right', 'align_right', 'Right align'], ['justify', 'format_align_justify', 'Justify']].forEach(function (a) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-align', a[0]);
        btn.setAttribute('title', a[2]);
        btn.style.cssText = alignBtnStyle + (a[0] === 'left' ? ';' + alignActiveStyle : '');
        btn.appendChild(createMaterialIcon(a[1], 16));
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); setTextAlign(a[0]); });
        alignRow.appendChild(btn);
      });
      if (primaryEl) {
        var csAlign = window.getComputedStyle(primaryEl).textAlign || 'left';
        var a = csAlign.toLowerCase();
        if (a === 'center') textAlignValue = 'center';
        else if (a === 'right') textAlignValue = 'right';
        else if (a === 'justify') textAlignValue = 'justify';
        else textAlignValue = 'left';
        alignRow.querySelectorAll('button').forEach(function (b) {
          var on = b.getAttribute('data-align') === textAlignValue;
          b.style.cssText = alignBtnStyle + (on ? ';' + alignActiveStyle : '');
        });
      }
      typoContent.appendChild(alignRow);

      // Inline text style toggles (italic, underline, uppercase)
      var effectsRow = document.createElement('div');
      effectsRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:2px;';
      var effectsLabel = document.createElement('div');
      effectsLabel.style.cssText = GAP_LABEL + 'display:flex;align-items:center;gap:4px;text-align:left;';
      var effectsIcon = createMaterialIcon('format_italic', 13);
      effectsIcon.style.color = 'var(--neutral-700,#504645)';
      effectsLabel.appendChild(effectsIcon);
      var effectsLabelText = document.createElement('span');
      effectsLabelText.textContent = 'Text effects';
      effectsLabel.appendChild(effectsLabelText);
      effectsRow.appendChild(effectsLabel);
      var effectsBtns = document.createElement('div');
      effectsBtns.style.cssText = 'display:flex;gap:4px;';
      function makeToggle(label, title, applyFn) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.title = title;
        b.style.cssText = 'min-width:28px;height:24px;padding:0 6px;border-radius:8px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;font-size:10px;font-family:\'Google Sans\',sans-serif;font-weight:700;color:var(--neutral-800,#372828);cursor:pointer;';
        var on = false;
        function sync() {
          b.style.background = on ? 'var(--neutral-900,#181211)' : '#fff';
          b.style.color = on ? 'var(--neutral-100,#F9F6F6)' : 'var(--neutral-800,#372828)';
          b.style.borderColor = on ? 'var(--neutral-900,#181211)' : 'var(--neutral-200,#E6E3E3)';
        }
        b.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          on = !on;
          sync();
          if (!targets.length) return;
          markSectionDirty('typo');
          forEachTargetAndDescendants(function (t) {
            if (!originalStyles.has(t)) {
              var csEff = window.getComputedStyle(t);
              originalStyles.set(t, { fontFamily: csEff.fontFamily || '', color: csEff.color || '', fontSize: csEff.fontSize || '', lineHeight: csEff.lineHeight || '', letterSpacing: csEff.letterSpacing || '', fontWeight: csEff.fontWeight || '' });
            }
            applyFn(t, on);
          });
        });
        sync();
        return b;
      }
      var italicBtn = makeToggle('I', 'Italic', function (t, on) {
        t.style.fontStyle = on ? 'italic' : '';
      });
      var underlineBtn = makeToggle('U', 'Underline', function (t, on) {
        var existing = (t.style.textDecoration || '').toLowerCase();
        var hasUnderline = existing.indexOf('underline') !== -1;
        if (on && !hasUnderline) t.style.textDecoration = (existing ? existing + ' ' : '') + 'underline';
        if (!on && hasUnderline) {
          t.style.textDecoration = existing.replace(/\bunderline\b/, '').trim();
        }
      });
      var capsBtn = makeToggle('AA', 'Uppercase', function (t, on) {
        t.style.textTransform = on ? 'uppercase' : '';
      });
      effectsBtns.appendChild(italicBtn);
      effectsBtns.appendChild(underlineBtn);
      effectsBtns.appendChild(capsBtn);
      effectsRow.appendChild(effectsBtns);
      typoContent.appendChild(effectsRow);

      /* removed Describe changes UI
          describeSummary = document.createElement('div');
          describeSummary.style.cssText = 'margin-top:6px;padding:8px 10px;border-radius:8px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;display:flex;flex-direction:column;gap:6px;font-size:10px;color:var(--neutral-800,#372828);font-family:\'Google Sans\',sans-serif;';
          typoContent.appendChild(describeSummary);
        }

        describeSummary.innerHTML = '';
        var title = document.createElement('div');
        title.style.cssText = 'font-weight:700;margin-bottom:2px;';
        if (!plan.actions.length) {
          title.textContent = 'I’m not sure what to change';
          describeSummary.appendChild(title);
          var msg = document.createElement('div');
          msg.textContent = plan.notes[0] || '';
          describeSummary.appendChild(msg);
          return;
        }

        title.textContent = 'Recommended changes';
        describeSummary.appendChild(title);
        var list = document.createElement('ul');
        list.style.cssText = 'margin:0 0 4px 14px;padding:0;list-style:disc;';
        plan.notes.forEach(function (n) {
          var li = document.createElement('li');
          li.textContent = n;
          list.appendChild(li);
        });
        describeSummary.appendChild(list);

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.style.cssText = 'padding:6px 10px;border-radius:6px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;font-size:10px;font-family:\'Google Sans\',sans-serif;cursor:pointer;';
        cancel.addEventListener('click', function () {
          describeSummary.innerHTML = '';
        });
        var confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.textContent = 'Apply changes';
        confirmBtn.style.cssText = 'padding:6px 10px;border-radius:6px;border:1px solid var(--neutral-900,#181211);background:var(--neutral-900,#181211);color:#fff;font-size:10px;font-family:\'Google Sans\',sans-serif;font-weight:700;cursor:pointer;';
        confirmBtn.addEventListener('click', function () {
          plan.actions.forEach(function (fn) {
            try { fn(); } catch (err) {}
          });
          describeSummary.innerHTML = '';
        });
        btnRow.appendChild(cancel);
        btnRow.appendChild(confirmBtn);
        describeSummary.appendChild(btnRow);
      }); */

      // Typography controls only when the element involves text styling
      // Temporarily disabled so Edit tab only shows Preview CSS.
      if (false && showTypography) grid.appendChild(typoContent);

      var typoSection = document.createElement('div');
      typoSection.className = 'reforma-section-content';
      typoSection.setAttribute('data-section', 'typo');
      typoSection.style.cssText = 'display:flex;flex-direction:column;';
      typoSection.appendChild(grid);

      var panelContainer = document.createElement('div');
      panelContainer.className = 'reforma-comment-panel-container';
      panelContainer.style.cssText = 'width:100%;flex:1;box-sizing:border-box;flex-shrink:1;display:flex;flex-direction:column;justify-content:flex-start;overflow-y:auto;overflow-x:hidden;min-height:0;';
      // Lock Reforma palette so host page CSS variables do not bleed into the sidebar.
      panelContainer.style.setProperty('--primary-100', '#FFEBFE');
      panelContainer.style.setProperty('--primary-200', '#FFE5F2');
      panelContainer.style.setProperty('--primary-300', '#FEDAF5');
      panelContainer.style.setProperty('--primary-400', '#FFB7E2');
      panelContainer.style.setProperty('--primary-500', '#F977DF');
      panelContainer.style.setProperty('--primary-600', '#D643E3');
      panelContainer.style.setProperty('--primary-700', '#9E198C');
      panelContainer.style.setProperty('--primary-800', '#A911A9');
      panelContainer.style.setProperty('--primary-900', '#38052E');
      panelContainer.appendChild(typoSection);

      layoutPanel = document.createElement('div');
      layoutPanel.className = 'reforma-playground-layout-panel';
      layoutPanel.style.cssText = 'display:flex;flex-direction:column;gap:12px;font-size:11px;font-family:' + COMMENT_FONT + ';';
      var layoutSectionRow = document.createElement('div');
      layoutSectionRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;padding-bottom:6px;border-bottom:1px solid var(--neutral-200,#E6E3E3);gap:6px;';
      var layoutSectionLabel = document.createElement('div');
      layoutSectionLabel.style.cssText = 'font-size:13px;font-weight:800;color:#181211;font-family:' + COMMENT_FONT + ';letter-spacing:-0.1px;';
      layoutSectionLabel.textContent = 'Layout';
      layoutSectionRow.appendChild(layoutSectionLabel);
      layoutSectionRow.appendChild(sectionUndo.layout.btn);
      layoutPanel.appendChild(layoutSectionRow);
      var inputBoxStyle = 'width:28px;padding:2px 4px;border-radius:4px;border:1px solid var(--neutral-200,#E6E3E3);background:var(--neutral-100,#F9F6F6);font-family:' + COMMENT_FONT + ';font-size:10px;font-weight:600;text-align:center;box-sizing:border-box;';
      var inputWideStyle = 'width:64px;padding:4px 6px;border-radius:6px;border:1px solid var(--neutral-200,#E6E3E3);background:var(--neutral-100,#F9F6F6);font-family:' + COMMENT_FONT + ';font-size:11px;font-weight:600;color:var(--neutral-800,#372828);text-align:center;box-sizing:border-box;';
      var selectStyle = 'padding:4px 6px;border-radius:6px;border:1px solid var(--neutral-200,#E6E3E3);background:var(--neutral-100,#F9F6F6);font-family:' + COMMENT_FONT + ';font-size:11px;font-weight:600;color:var(--neutral-800,#372828);cursor:pointer;';

      function toNum(val) {
        if (val == null) return '';
        var m = String(val).trim().match(/^(-?[\d.]+)/);
        return m ? m[1] : '';
      }

      /** Scrubber: drag horizontally on a numeric input to adjust value. */
      function addInputScrubber(input, opts) {
        opts = opts || {};
        var step = opts.step != null ? opts.step : 1;
        var min = opts.min != null ? opts.min : -Infinity;
        var max = opts.max != null ? opts.max : Infinity;
        var shiftMult = opts.shiftMultiplier != null ? opts.shiftMultiplier : 10;
        var parse = opts.parse || function () { return parseFloat(input.value, 10) || 0; };
        var format = opts.format || function (v) { return String(Math.round(v)); };
        input.style.cursor = 'ew-resize';
        var existingTitle = input.getAttribute('title') || '';
        var scrubTip = 'Drag horizontally to change value';
        if (shiftMult !== 1) scrubTip += ' — Hold Shift for ' + shiftMult + '× step';
        input.setAttribute('title', existingTitle ? existingTitle + ' — ' + scrubTip : scrubTip);
        var parent = input.parentNode;
        if (parent && !input.getAttribute('data-scrubber-icon-added')) {
          input.setAttribute('data-scrubber-icon-added', '1');
          var scrubWrap = document.createElement('span');
          scrubWrap.style.cssText = 'display:inline-flex;align-items:center;gap:3px;';
          var scrubIcon = createMaterialIcon('scrubber', 12, 'var(--neutral-500,#8A8380)');
          scrubIcon.setAttribute('title', scrubTip);
          scrubIcon.style.pointerEvents = 'none';
          scrubIcon.style.flexShrink = '0';
          parent.replaceChild(scrubWrap, input);
          scrubWrap.appendChild(input);
          scrubWrap.appendChild(scrubIcon);
        }
        input.addEventListener('mousedown', function (e) {
          if (e.button !== 0) return;
          e.preventDefault();
          var startX = e.clientX;
          var startVal = parse();
          var doc = input.ownerDocument;
          function onMove(e2) {
            var dx = e2.clientX - startX;
            var mult = e2.shiftKey ? shiftMult : 1;
            var delta = Math.round(dx * 0.5) * step * mult;
            var next = Math.min(max, Math.max(min, startVal + delta));
            input.value = format(next);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          function onUp() {
            doc.removeEventListener('mousemove', onMove);
            doc.removeEventListener('mouseup', onUp);
          }
          doc.addEventListener('mousemove', onMove);
          doc.addEventListener('mouseup', onUp);
        });
      }

      /** Scrubber: drag horizontally on a value container (e.g. wrap with span) to adjust value. */
      function addValueScrubber(container, getValue, setValue, opts) {
        opts = opts || {};
        var step = opts.step != null ? opts.step : 1;
        var min = opts.min != null ? opts.min : -Infinity;
        var max = opts.max != null ? opts.max : Infinity;
        var shiftMult = opts.shiftMultiplier != null ? opts.shiftMultiplier : 10;
        container.style.cursor = 'ew-resize';
        var t = container.getAttribute('title') || '';
        var scrubTip = 'Drag horizontally to change value';
        if (shiftMult !== 1) scrubTip += ' — Hold Shift for ' + shiftMult + '× step';
        if (t.indexOf('Drag') === -1 && t.indexOf('scrub') === -1) container.setAttribute('title', t ? t + ' — ' + scrubTip : scrubTip);
        if (!container.getAttribute('data-scrubber-icon-added')) {
          container.setAttribute('data-scrubber-icon-added', '1');
          var scrubIcon = createMaterialIcon('scrubber', 12, 'var(--neutral-500,#8A8380)');
          scrubIcon.setAttribute('title', scrubTip);
          scrubIcon.style.pointerEvents = 'none';
          scrubIcon.style.flexShrink = '0';
          scrubIcon.style.marginLeft = '2px';
          container.appendChild(scrubIcon);
        }
        container.addEventListener('mousedown', function (e) {
          if (e.button !== 0) return;
          e.preventDefault();
          var startX = e.clientX;
          var startVal = getValue();
          var doc = container.ownerDocument;
          function onMove(e2) {
            var dx = e2.clientX - startX;
            var mult = e2.shiftKey ? shiftMult : 1;
            var delta = Math.round(dx * 0.5) * step * mult;
            var next = Math.min(max, Math.max(min, startVal + delta));
            setValue(next);
          }
          function onUp() {
            doc.removeEventListener('mousemove', onMove);
            doc.removeEventListener('mouseup', onUp);
          }
          doc.addEventListener('mousemove', onMove);
          doc.addEventListener('mouseup', onUp);
        });
      }

      /** Double-tap to edit: replace span with input, on blur/Enter apply and restore span. */
      function makeValueEditableOnDblclick(span, getRawValue, setValue, formatDisplay, parseInput) {
        span.setAttribute('title', 'Double-tap to edit');
        span.style.cursor = 'text';
        span.addEventListener('dblclick', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var parent = span.parentNode;
          if (!parent) return;
          var input = document.createElement('input');
          input.type = 'text';
          input.value = String(getRawValue());
          input.style.cssText = 'width:100%;min-width:48px;padding:2px 6px;border:1px solid var(--primary-700,#9E198C);border-radius:6px;background:#fff;font-size:11px;font-weight:600;font-family:\'Google Sans\',sans-serif;color:#372828;text-align:center;box-sizing:border-box;';
          input.style.width = Math.max(48, span.offsetWidth) + 'px';
          parent.replaceChild(input, span);
          input.focus();
          input.select();
          function commit() {
            var parsed = parseInput(input.value);
            if (parsed != null) setValue(parsed);
            span.textContent = formatDisplay(getRawValue());
            parent.replaceChild(span, input);
          }
          input.addEventListener('blur', commit);
          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') {
              e.preventDefault();
              span.textContent = formatDisplay(getRawValue());
              parent.replaceChild(span, input);
            }
          });
        });
      }

      function setPosProp(el, primaryProp, oppositeProp, rawNumber) {
        if (!el || !el.isConnected) return;
        if (!originalStyles.has(el)) {
          var cs0 = window.getComputedStyle(el);
          originalStyles.set(el, { fontFamily: cs0.fontFamily || '', color: cs0.color || '', fontSize: cs0.fontSize || '', lineHeight: cs0.lineHeight || '', letterSpacing: cs0.letterSpacing || '', fontWeight: cs0.fontWeight || '' });
        }
        el.style.transition = 'left 0.25s ease, right 0.25s ease, top 0.25s ease, bottom 0.25s ease, transform 0.25s ease';
        if (rawNumber === '') {
          el.style[primaryProp] = '';
          return;
        }
        el.style.position = el.style.position || 'absolute';
        el.style[oppositeProp] = '';
        el.style[primaryProp] = rawNumber + 'px';
        // No layout summary preview anymore.
      }

      function applyRotation(el, deg) {
        if (!el || !el.isConnected) return;
        if (!originalStyles.has(el)) {
          var cs1 = window.getComputedStyle(el);
          originalStyles.set(el, { fontFamily: cs1.fontFamily || '', color: cs1.color || '', fontSize: cs1.fontSize || '', lineHeight: cs1.lineHeight || '', letterSpacing: cs1.letterSpacing || '', fontWeight: cs1.fontWeight || '' });
        }
        el.style.transition = 'transform 0.25s ease';
        var d = (deg || '').toString().trim();
        if (d === '') {
          el.style.transform = '';
          return;
        }
        el.style.transform = 'rotate(' + d + 'deg)';
      }

      function makeLayoutCard(title, contentEl) {
        var card = document.createElement('div');
        card.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:0;border:none;border-radius:0;background:transparent;box-sizing:border-box;min-width:0;';
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:6px;';
        var iconKey = title === 'Margin' ? 'margin'
          : title === 'Padding' ? 'padding'
          : title === 'Flex' ? 'layout'
          : title === 'Position' ? 'position'
          : title === 'Sizing' || title === 'Gap' ? 'layout'
          : title === 'Radius & overflow' ? 'radius'
          : 'layout';
        var ic = createMaterialIcon(iconKey, 13);
        ic.style.opacity = '0.75';
        ic.style.color = 'var(--neutral-700,#504645)';
        header.appendChild(ic);
        var t = document.createElement('div');
        t.style.cssText = GAP_LABEL + 'margin-bottom:0;';
        t.textContent = title;
        header.appendChild(t);
        card.appendChild(header);
        card.appendChild(contentEl);
        return card;
      }

      // Position controls (X/Y + anchors + rotation)
      var posWrap = document.createElement('div');
      posWrap.style.cssText = 'display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap;';
      var posLeft = document.createElement('div');
      posLeft.style.cssText = 'display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;';

      function makeLabeledField(label, node) {
        var w = document.createElement('div');
        w.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
        var l = document.createElement('div');
        l.style.cssText = GAP_LABEL + 'display:flex;align-items:center;gap:4px;margin-bottom:0;';
        l.textContent = label;
        w.appendChild(l);
        w.appendChild(node);
        return w;
      }

      var xRow = document.createElement('div');
      xRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
      var xProp = document.createElement('select');
      xProp.style.cssText = selectStyle;
      xProp.innerHTML = '<option value="left">Left</option><option value="right">Right</option>';
      var xVal = document.createElement('input');
      xVal.type = 'text';
      xVal.inputMode = 'numeric';
      xVal.placeholder = '0';
      xVal.style.cssText = inputWideStyle;
      xRow.appendChild(xProp);
      xRow.appendChild(xVal);

      var yRow = document.createElement('div');
      yRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
      var yProp = document.createElement('select');
      yProp.style.cssText = selectStyle;
      yProp.innerHTML = '<option value="top">Top</option><option value="bottom">Bottom</option>';
      var yVal = document.createElement('input');
      yVal.type = 'text';
      yVal.inputMode = 'numeric';
      yVal.placeholder = '0';
      yVal.style.cssText = inputWideStyle;
      yRow.appendChild(yProp);
      yRow.appendChild(yVal);

      var rotRow = document.createElement('div');
      rotRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
      var rotVal = document.createElement('input');
      rotVal.type = 'text';
      rotVal.inputMode = 'numeric';
      rotVal.placeholder = '0';
      rotVal.style.cssText = inputWideStyle;
      var degSpan = document.createElement('span');
      degSpan.textContent = '°';
      degSpan.style.cssText = 'font-size:11px;font-weight:700;color:var(--neutral-700,#504645);';
      rotRow.appendChild(rotVal);
      rotRow.appendChild(degSpan);

      posLeft.appendChild(makeLabeledField('X', xRow));
      posLeft.appendChild(makeLabeledField('Y', yRow));
      posLeft.appendChild(makeLabeledField('Rotate', rotRow));
      posWrap.appendChild(posLeft);

      function syncPositionInputs() {
        if (!primaryEl) return;
        var csP = window.getComputedStyle(primaryEl);
        var xp = xProp.value;
        var yp = yProp.value;
        xVal.value = toNum((primaryEl.style[xp] || csP[xp] || '').trim());
        yVal.value = toNum((primaryEl.style[yp] || csP[yp] || '').trim());
        var tr = (primaryEl.style.transform || csP.transform || '').toString();
        var m = tr.match(/rotate\(([-\d.]+)deg\)/);
        rotVal.value = m ? m[1] : '';
      }

      xProp.addEventListener('change', function (e) { e.preventDefault(); e.stopPropagation(); syncPositionInputs(); });
      yProp.addEventListener('change', function (e) { e.preventDefault(); e.stopPropagation(); syncPositionInputs(); });
      xVal.addEventListener('input', function () {
        markSectionDirty('position');
        var p = xProp.value;
        forEachTarget(function (t) { setPosProp(t, p, p === 'left' ? 'right' : 'left', toNum(xVal.value)); });
      });
      yVal.addEventListener('input', function () {
        markSectionDirty('position');
        var p = yProp.value;
        forEachTarget(function (t) { setPosProp(t, p, p === 'top' ? 'bottom' : 'top', toNum(yVal.value)); });
      });
      rotVal.addEventListener('input', function () { markSectionDirty('position'); forEachTarget(function (t) { applyRotation(t, toNum(rotVal.value)); }); });
      addInputScrubber(xVal, { step: 1, parse: function () { return parseFloat(xVal.value, 10) || 0; } });
      addInputScrubber(yVal, { step: 1, parse: function () { return parseFloat(yVal.value, 10) || 0; } });
      addInputScrubber(rotVal, { step: 1, parse: function () { return parseFloat(rotVal.value, 10) || 0; } });
      syncPositionInputs();
      function makeInputWithPx(inp) {
        var cell = document.createElement('div');
        cell.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:3px;';
        cell.appendChild(inp);
        var pxSpan = document.createElement('span');
        pxSpan.textContent = 'px';
        pxSpan.style.cssText = 'font-size:9px;color:var(--neutral-600,#675C58);';
        cell.appendChild(pxSpan);
        return cell;
      }
      function makeFourSidedBox(label, prop, el, gridOnly) {
        var grid = document.createElement('div');
        grid.style.cssText = 'position:relative;width:210px;height:110px;border:1px solid var(--neutral-200,#E6E3E3);border-radius:10px;background:var(--neutral-100,#F9F6F6);box-sizing:border-box;padding:10px;';
        var topIn = document.createElement('input');
        topIn.type = 'text';
        topIn.inputMode = 'numeric';
        topIn.placeholder = prop === 'margin' ? '0' : '0';
        topIn.style.cssText = inputBoxStyle + 'width:44px;';
        topIn.setAttribute('data-side', 'top');
        var rightIn = document.createElement('input');
        rightIn.type = 'text';
        rightIn.inputMode = 'numeric';
        rightIn.placeholder = prop === 'margin' ? '0' : '0';
        rightIn.style.cssText = inputBoxStyle + 'width:44px;';
        rightIn.setAttribute('data-side', 'right');
        var bottomIn = document.createElement('input');
        bottomIn.type = 'text';
        bottomIn.inputMode = 'numeric';
        bottomIn.placeholder = prop === 'margin' ? '0' : '0';
        bottomIn.style.cssText = inputBoxStyle + 'width:44px;';
        bottomIn.setAttribute('data-side', 'bottom');
        var leftIn = document.createElement('input');
        leftIn.type = 'text';
        leftIn.inputMode = 'numeric';
        leftIn.placeholder = prop === 'margin' ? '0' : '0';
        leftIn.style.cssText = inputBoxStyle + 'width:44px;';
        leftIn.setAttribute('data-side', 'left');
        function place(node, css) {
          node.style.cssText += ';position:absolute;' + css;
          return node;
        }
        // Inner panel (padding box look)
        var inner = document.createElement('div');
        inner.style.cssText = 'position:absolute;left:38px;right:38px;top:30px;bottom:22px;border:1px solid var(--neutral-200,#E6E3E3);border-radius:8px;background:#fff;opacity:0.85;';
        var center = document.createElement('div');
        center.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:52px;height:22px;border-radius:6px;background:rgba(0,0,0,0.08);border:1px solid rgba(0,0,0,0.08);';
        grid.appendChild(inner);
        grid.appendChild(center);

        grid.appendChild(place(makeInputWithPx(topIn), 'left:50%;top:6px;transform:translateX(-50%);'));
        grid.appendChild(place(makeInputWithPx(bottomIn), 'left:50%;bottom:6px;transform:translateX(-50%);'));
        grid.appendChild(place(makeInputWithPx(leftIn), 'left:6px;top:50%;transform:translateY(-50%);'));
        grid.appendChild(place(makeInputWithPx(rightIn), 'right:6px;top:50%;transform:translateY(-50%);'));

        // Auto buttons (margin only) for left/right like devtools
        var autoLeft = null;
        var autoRight = null;
        if (prop === 'margin') {
          autoLeft = document.createElement('button');
          autoLeft.type = 'button';
          autoLeft.textContent = 'Auto';
          autoLeft.style.cssText = 'position:absolute;left:-4px;top:50%;transform:translate(-100%,-50%);padding:4px 8px;border-radius:8px;border:1px solid rgba(32,201,151,0.65);background:transparent;color:rgba(80,70,69,0.9);font-weight:700;font-size:10px;font-family:\'Google Sans\',sans-serif;cursor:pointer;';
          autoRight = document.createElement('button');
          autoRight.type = 'button';
          autoRight.textContent = 'Auto';
          autoRight.style.cssText = 'position:absolute;right:-4px;top:50%;transform:translate(100%,-50%);padding:4px 8px;border-radius:8px;border:1px solid rgba(32,201,151,0.65);background:transparent;color:rgba(80,70,69,0.9);font-weight:700;font-size:10px;font-family:\'Google Sans\',sans-serif;cursor:pointer;';
          grid.appendChild(autoLeft);
          grid.appendChild(autoRight);
        }
        var sides = { top: topIn, right: rightIn, bottom: bottomIn, left: leftIn };
        var styleKeys = { padding: { top: 'paddingTop', right: 'paddingRight', bottom: 'paddingBottom', left: 'paddingLeft' }, margin: { top: 'marginTop', right: 'marginRight', bottom: 'marginBottom', left: 'marginLeft' } }[prop];
        var transProp = prop === 'padding' ? 'padding' : 'margin';
        function parsePx(val) {
          if (!val) return '';
          if (String(val).trim() === 'auto') return 'auto';
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
            if (num === '') el.style[styleKeys[side]] = '';
            else if (num === 'auto') el.style[styleKeys[side]] = 'auto';
            else el.style[styleKeys[side]] = num + 'px';
          });
        }
        populateFromEl();
        [topIn, rightIn, bottomIn, leftIn].forEach(function (inp) {
          addInputScrubber(inp, { step: 1 });
          inp.addEventListener('input', applyFourSided);
          inp.addEventListener('change', applyFourSided);
          inp.addEventListener('keyup', applyFourSided);
        });
        if (autoLeft) {
          autoLeft.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            leftIn.value = 'auto';
            applyFourSided();
          });
        }
        if (autoRight) {
          autoRight.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            rightIn.value = 'auto';
            applyFourSided();
          });
        }
        if (gridOnly) return grid;
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:1px;';
        var lbl = document.createElement('div');
        lbl.style.cssText = 'font-weight:700;color:#181211;font-size:10px;margin-bottom:1px;';
        lbl.textContent = label;
        wrap.appendChild(lbl);
        wrap.appendChild(grid);
        return wrap;
      }
      function makeBoxModelDiagram() {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;gap:8px;';
        var box = document.createElement('div');
        box.style.cssText = 'position:relative;width:100%;min-width:200px;height:160px;border:3px solid #9E198C;border-radius:8px;background:rgba(158,25,140,0.08);box-sizing:border-box;';

        function makeSideInput() {
          var inp = document.createElement('input');
          inp.type = 'text';
          inp.inputMode = 'numeric';
          inp.placeholder = '0';
          inp.style.cssText = inputBoxStyle + 'width:36px;height:24px;border:1px solid rgba(158,25,140,0.5);background:#fff;font-size:11px;text-align:center;';
          return inp;
        }

        function parseVal(v) {
          if (!v) return '';
          var t = String(v).trim();
          if (t === 'auto') return 'auto';
          var m = t.match(/^(-?[\d.]+)/);
          return m ? m[1] : '';
        }

        function place(node, css) {
          node.style.cssText = (node.style.cssText || '') + ';position:absolute;' + css;
          return node;
        }

        function wrapInput(inp) {
          var cell = document.createElement('div');
          cell.style.cssText = 'display:flex;align-items:center;justify-content:center;';
          cell.appendChild(inp);
          return cell;
        }

        var mTop = makeSideInput();
        var mRight = makeSideInput();
        var mBottom = makeSideInput();
        var mLeft = makeSideInput();
        var pTop = makeSideInput();
        var pRight = makeSideInput();
        var pBottom = makeSideInput();
        var pLeft = makeSideInput();

        var paddingBox = document.createElement('div');
        paddingBox.style.cssText = 'position:absolute;left:50%;top:50%;width:120px;height:88px;margin-left:-60px;margin-top:-44px;border:2px dashed rgba(158,25,140,0.6);border-radius:8px;background:transparent;z-index:0;';
        box.appendChild(paddingBox);
        var innerBorder = document.createElement('div');
        innerBorder.style.cssText = 'position:absolute;left:50%;top:50%;width:80px;height:48px;margin-left:-40px;margin-top:-24px;border:2px solid #181211;border-radius:6px;background:#fff;z-index:1;';
        box.appendChild(innerBorder);

        var gap = 6;
        var gTop = document.createElement('div');
        gTop.style.cssText = 'position:absolute;left:50%;top:8px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:' + gap + 'px;z-index:4;';
        gTop.appendChild(wrapInput(mTop));
        gTop.appendChild(wrapInput(pTop));
        box.appendChild(gTop);
        var gBottom = document.createElement('div');
        gBottom.style.cssText = 'position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:flex;flex-direction:column-reverse;align-items:center;gap:' + gap + 'px;z-index:4;';
        gBottom.appendChild(wrapInput(mBottom));
        gBottom.appendChild(wrapInput(pBottom));
        box.appendChild(gBottom);
        var gLeft = document.createElement('div');
        gLeft.style.cssText = 'position:absolute;left:8px;top:50%;transform:translateY(-50%);display:flex;flex-direction:row;align-items:center;gap:' + gap + 'px;z-index:4;';
        gLeft.appendChild(wrapInput(mLeft));
        gLeft.appendChild(wrapInput(pLeft));
        box.appendChild(gLeft);
        var gRight = document.createElement('div');
        gRight.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;flex-direction:row-reverse;align-items:center;gap:' + gap + 'px;z-index:4;';
        gRight.appendChild(wrapInput(mRight));
        gRight.appendChild(wrapInput(pRight));
        box.appendChild(gRight);

        var content = document.createElement('div');
        content.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:4px 8px;font-size:10px;color:#181211;font-family:' + COMMENT_FONT + ';background:rgba(0,0,0,0.06);border-radius:4px;z-index:0;';
        content.textContent = 'content';
        box.appendChild(content);

        function populate() {
          if (!primaryEl || !primaryEl.isConnected) return;
          var cs = window.getComputedStyle(primaryEl);
          mTop.value = parseVal(cs.marginTop);
          mRight.value = parseVal(cs.marginRight);
          mBottom.value = parseVal(cs.marginBottom);
          mLeft.value = parseVal(cs.marginLeft);
          pTop.value = parseVal(cs.paddingTop);
          pRight.value = parseVal(cs.paddingRight);
          pBottom.value = parseVal(cs.paddingBottom);
          pLeft.value = parseVal(cs.paddingLeft);
        }

        function apply() {
          markSectionDirty('layout');
          var m = { top: mTop.value.trim(), right: mRight.value.trim(), bottom: mBottom.value.trim(), left: mLeft.value.trim() };
          var p = { top: pTop.value.trim(), right: pRight.value.trim(), bottom: pBottom.value.trim(), left: pLeft.value.trim() };
          forEachTarget(function (el) {
            if (!el || !el.isConnected) return;
            el.style.transition = 'margin 0.25s ease, padding 0.25s ease';
            ensureOriginal(el);
            el.style.marginTop = m.top === '' ? '' : (m.top === 'auto' ? 'auto' : m.top + 'px');
            el.style.marginRight = m.right === '' ? '' : (m.right === 'auto' ? 'auto' : m.right + 'px');
            el.style.marginBottom = m.bottom === '' ? '' : (m.bottom === 'auto' ? 'auto' : m.bottom + 'px');
            el.style.marginLeft = m.left === '' ? '' : (m.left === 'auto' ? 'auto' : m.left + 'px');
            el.style.paddingTop = p.top === '' ? '' : p.top + 'px';
            el.style.paddingRight = p.right === '' ? '' : p.right + 'px';
            el.style.paddingBottom = p.bottom === '' ? '' : p.bottom + 'px';
            el.style.paddingLeft = p.left === '' ? '' : p.left + 'px';
          });
        }

        [mTop, mRight, mBottom, mLeft, pTop, pRight, pBottom, pLeft].forEach(function (inp) {
          addInputScrubber(inp, { step: 1 });
          inp.addEventListener('input', apply);
          inp.addEventListener('change', apply);
          inp.addEventListener('keyup', apply);
        });
        populate();
        wrap.appendChild(box);
        return wrap;
      }

      var layoutGrid = document.createElement('div');
      layoutGrid.style.cssText = 'display:flex;flex-direction:column;gap:10px;align-items:stretch;';

      function makeFourInputsCard(title, cssKeys) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:center;';

        function makeField(label, initial) {
          var w = document.createElement('div');
          w.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
          var l = document.createElement('div');
          l.style.cssText = 'font-size:10px;font-weight:800;color:var(--neutral-700,#504645);font-family:\'Google Sans\',sans-serif;';
          l.textContent = label;
          var i = document.createElement('input');
          i.type = 'text';
          i.inputMode = 'numeric';
          i.placeholder = '0';
          i.value = initial || '';
          i.style.cssText = inputWideStyle + 'width:100%;';
          w.appendChild(l);
          w.appendChild(i);
          return { wrap: w, input: i };
        }

        if (!primaryEl) return makeLayoutCard(title, wrap);
        var cs = window.getComputedStyle(primaryEl);
        function parsePx(v) {
          if (!v) return '';
          var m = String(v).trim().match(/^(-?[\d.]+)/);
          return m ? m[1] : '';
        }

        var topF = makeField('Top', parsePx(cs[cssKeys.top]));
        var rightF = makeField('Right', parsePx(cs[cssKeys.right]));
        var bottomF = makeField('Bottom', parsePx(cs[cssKeys.bottom]));
        var leftF = makeField('Left', parsePx(cs[cssKeys.left]));
        wrap.appendChild(topF.wrap);
        wrap.appendChild(rightF.wrap);
        wrap.appendChild(bottomF.wrap);
        wrap.appendChild(leftF.wrap);

        function apply() {
          markSectionDirty('layout');
          var t = toNum(topF.input.value);
          var r = toNum(rightF.input.value);
          var b = toNum(bottomF.input.value);
          var l = toNum(leftF.input.value);
          forEachTarget(function (el) {
            if (!el || !el.isConnected) return;
            el.style.transition = 'margin 0.25s ease, padding 0.25s ease';
            ensureOriginal(el);
            el.style[cssKeys.top] = t === '' ? '' : t + 'px';
            el.style[cssKeys.right] = r === '' ? '' : r + 'px';
            el.style[cssKeys.bottom] = b === '' ? '' : b + 'px';
            el.style[cssKeys.left] = l === '' ? '' : l + 'px';
          });
        }
        [topF.input, rightF.input, bottomF.input, leftF.input].forEach(function (inp) {
          addInputScrubber(inp, { step: 1 });
          inp.addEventListener('input', apply);
          inp.addEventListener('change', apply);
          inp.addEventListener('keyup', apply);
        });

        return makeLayoutCard(title, wrap);
      }

      // ---- Sizing row (W & H, Hug = fit content) ----
      var sizingRow = document.createElement('div');
      sizingRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
      var wWrap = document.createElement('div');
      wWrap.style.cssText = 'display:flex;align-items:center;gap:4px;';
      var wLabel = document.createElement('span');
      wLabel.textContent = 'W';
      wLabel.style.cssText = 'font-size:10px;font-weight:800;color:var(--neutral-700,#504645);min-width:14px;';
      var wInput = document.createElement('input');
      wInput.type = 'text';
      wInput.inputMode = 'numeric';
      wInput.placeholder = 'auto';
      wInput.style.cssText = inputWideStyle + 'width:56px;';
      var hugBtn = document.createElement('button');
      hugBtn.type = 'button';
      hugBtn.textContent = 'Hug';
      hugBtn.title = 'Fit content (auto width)';
      hugBtn.style.cssText = 'padding:4px 8px;font-size:10px;font-weight:700;font-family:' + COMMENT_FONT + ';border:1px solid var(--neutral-200,#E6E3E3);border-radius:6px;background:var(--neutral-100,#F9F6F6);color:var(--neutral-800,#372828);cursor:pointer;';
      var hWrap = document.createElement('div');
      hWrap.style.cssText = 'display:flex;align-items:center;gap:4px;';
      var hLabel = document.createElement('span');
      hLabel.textContent = 'H';
      hLabel.style.cssText = 'font-size:10px;font-weight:800;color:var(--neutral-700,#504645);min-width:14px;';
      var hInput = document.createElement('input');
      hInput.type = 'text';
      hInput.inputMode = 'numeric';
      hInput.placeholder = 'auto';
      hInput.style.cssText = inputWideStyle + 'width:56px;';
      wWrap.appendChild(wLabel);
      wWrap.appendChild(wInput);
      wWrap.appendChild(hugBtn);
      hWrap.appendChild(hLabel);
      hWrap.appendChild(hInput);
      sizingRow.appendChild(wWrap);
      sizingRow.appendChild(hWrap);
      function applySizing() {
        markSectionDirty('layout');
        var w = (wInput.value || '').trim();
        var h = (hInput.value || '').trim();
        forEachTarget(function (el) {
          if (!el || !el.isConnected) return;
          el.style.transition = 'width 0.25s ease, height 0.25s ease';
          el.style.width = w === '' || w === 'auto' ? '' : (w.match(/^\d+$/) ? w + 'px' : w);
          el.style.height = h === '' || h === 'auto' ? '' : (h.match(/^\d+$/) ? h + 'px' : h);
        });
      }
      hugBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        markSectionDirty('layout');
        wInput.value = 'auto';
        forEachTarget(function (el) {
          if (!el || !el.isConnected) return;
          el.style.width = '';
        });
      });
      wInput.addEventListener('input', applySizing);
      wInput.addEventListener('change', applySizing);
      hInput.addEventListener('input', applySizing);
      hInput.addEventListener('change', applySizing);
      addInputScrubber(wInput, { step: 2, min: 0, parse: function () { var v = wInput.value.trim(); if (v === 'auto') return 0; return parseFloat(wInput.value, 10) || 0; }, format: function (v) { return v <= 0 ? 'auto' : String(Math.round(v)); } });
      addInputScrubber(hInput, { step: 2, min: 0, parse: function () { var v = hInput.value.trim(); if (v === 'auto') return 0; return parseFloat(hInput.value, 10) || 0; }, format: function (v) { return v <= 0 ? 'auto' : String(Math.round(v)); } });
      if (primaryEl) {
        var csS = window.getComputedStyle(primaryEl);
        var wVal = (primaryEl.style.width || csS.width || '').toString().trim();
        var hVal = (primaryEl.style.height || csS.height || '').toString().trim();
        wInput.value = wVal === 'auto' ? 'auto' : toNum(wVal) || '';
        hInput.value = hVal === 'auto' ? 'auto' : toNum(hVal) || '';
      }

      // ---- Gap row (][ style) ----
      var gapRow = document.createElement('div');
      gapRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
      var gapDecor = document.createElement('span');
      gapDecor.textContent = '][';
      gapDecor.style.cssText = 'font-size:12px;font-weight:700;color:var(--neutral-500,#8A8380);letter-spacing:-1px;';
      var gapInput = document.createElement('input');
      gapInput.type = 'text';
      gapInput.inputMode = 'numeric';
      gapInput.placeholder = '0';
      gapInput.style.cssText = inputWideStyle + 'width:48px;';
      gapRow.appendChild(gapDecor);
      gapRow.appendChild(gapInput);
      gapInput.addEventListener('input', function () {
        markSectionDirty('layout');
        var v = toNum(gapInput.value);
        forEachTarget(function (el) {
          if (!el || !el.isConnected) return;
          el.style.transition = 'gap 0.25s ease';
          el.style.gap = v === '' ? '' : v + 'px';
        });
      });
      gapInput.addEventListener('change', gapInput.oninput);
      addInputScrubber(gapInput, { step: 1, min: 0 });
      if (primaryEl) {
        var csG = window.getComputedStyle(primaryEl);
        gapInput.value = toNum((primaryEl.style.gap || csG.gap || '').trim()) || '';
      }

      // ---- Compact Padding row (| | V, H) ----
      var paddingCompactRow = document.createElement('div');
      paddingCompactRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
      var padDecor = document.createElement('span');
      padDecor.textContent = '| |';
      padDecor.style.cssText = 'font-size:12px;font-weight:700;color:var(--neutral-500,#8A8380);';
      var padVInput = document.createElement('input');
      padVInput.type = 'text';
      padVInput.inputMode = 'numeric';
      padVInput.placeholder = '0';
      padVInput.title = 'Vertical (top + bottom)';
      padVInput.style.cssText = inputWideStyle + 'width:40px;';
      var padHInput = document.createElement('input');
      padHInput.type = 'text';
      padHInput.inputMode = 'numeric';
      padHInput.placeholder = '0';
      padHInput.title = 'Horizontal (left + right)';
      padHInput.style.cssText = inputWideStyle + 'width:40px;';
      paddingCompactRow.appendChild(padDecor);
      paddingCompactRow.appendChild(padVInput);
      paddingCompactRow.appendChild(padHInput);
      function applyPaddingCompact() {
        markSectionDirty('layout');
        var v = toNum(padVInput.value);
        var h = toNum(padHInput.value);
        var pv = v === '' ? '' : v + 'px';
        var ph = h === '' ? '' : h + 'px';
        forEachTarget(function (el) {
          if (!el || !el.isConnected) return;
          el.style.transition = 'padding 0.25s ease';
          el.style.paddingTop = pv;
          el.style.paddingBottom = pv;
          el.style.paddingLeft = ph;
          el.style.paddingRight = ph;
        });
      }
      padVInput.addEventListener('input', applyPaddingCompact);
      padHInput.addEventListener('input', applyPaddingCompact);
      addInputScrubber(padVInput, { step: 1, min: 0 });
      addInputScrubber(padHInput, { step: 1, min: 0 });
      if (primaryEl) {
        var csP = window.getComputedStyle(primaryEl);
        var pt = toNum((primaryEl.style.paddingTop || csP.paddingTop || '').trim());
        var pl = toNum((primaryEl.style.paddingLeft || csP.paddingLeft || '').trim());
        padVInput.value = pt || '';
        padHInput.value = pl || '';
      }

      // ---- Compact Margin row (| | V, H) ----
      var marginCompactRow = document.createElement('div');
      marginCompactRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
      var marDecor = document.createElement('span');
      marDecor.textContent = '| |';
      marDecor.style.cssText = 'font-size:12px;font-weight:700;color:var(--neutral-500,#8A8380);';
      var marVInput = document.createElement('input');
      marVInput.type = 'text';
      marVInput.inputMode = 'numeric';
      marVInput.placeholder = '0';
      marVInput.title = 'Vertical margin';
      marVInput.style.cssText = inputWideStyle + 'width:40px;';
      var marHInput = document.createElement('input');
      marHInput.type = 'text';
      marHInput.inputMode = 'numeric';
      marHInput.placeholder = '0';
      marHInput.title = 'Horizontal margin';
      marHInput.style.cssText = inputWideStyle + 'width:40px;';
      marginCompactRow.appendChild(marDecor);
      marginCompactRow.appendChild(marVInput);
      marginCompactRow.appendChild(marHInput);
      function applyMarginCompact() {
        markSectionDirty('layout');
        var v = toNum(marVInput.value);
        var h = toNum(marHInput.value);
        var mv = v === '' ? '' : v + 'px';
        var mh = h === '' ? '' : h + 'px';
        forEachTarget(function (el) {
          if (!el || !el.isConnected) return;
          el.style.transition = 'margin 0.25s ease';
          el.style.marginTop = mv;
          el.style.marginBottom = mv;
          el.style.marginLeft = mh;
          el.style.marginRight = mh;
        });
      }
      marVInput.addEventListener('input', applyMarginCompact);
      marHInput.addEventListener('input', applyMarginCompact);
      addInputScrubber(marVInput, { step: 1 });
      addInputScrubber(marHInput, { step: 1 });
      if (primaryEl) {
        var csM = window.getComputedStyle(primaryEl);
        var mt = toNum((primaryEl.style.marginTop || csM.marginTop || '').trim());
        var ml = toNum((primaryEl.style.marginLeft || csM.marginLeft || '').trim());
        marVInput.value = mt || '';
        marHInput.value = ml || '';
      }

      // ---- Radius + Clip content row ----
      var radiusClipRow = document.createElement('div');
      radiusClipRow.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
      var radiusDecor = document.createElement('span');
      radiusDecor.textContent = '\u2013 \u2013';
      radiusDecor.style.cssText = 'font-size:12px;font-weight:700;color:var(--neutral-500,#8A8380);';
      var radiusLayoutInput = document.createElement('input');
      radiusLayoutInput.type = 'text';
      radiusLayoutInput.inputMode = 'numeric';
      radiusLayoutInput.placeholder = '0';
      radiusLayoutInput.title = 'Border radius';
      radiusLayoutInput.style.cssText = inputWideStyle + 'width:40px;';
      var clipCheckWrap = document.createElement('label');
      clipCheckWrap.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;font-weight:600;color:var(--neutral-800,#372828);font-family:' + COMMENT_FONT + ';';
      var clipCheck = document.createElement('input');
      clipCheck.type = 'checkbox';
      clipCheck.style.cssText = 'width:14px;height:14px;';
      var clipLabel = document.createElement('span');
      clipLabel.textContent = 'Clip content';
      clipCheckWrap.appendChild(clipCheck);
      clipCheckWrap.appendChild(clipLabel);
      radiusClipRow.appendChild(radiusDecor);
      radiusClipRow.appendChild(radiusLayoutInput);
      radiusClipRow.appendChild(clipCheckWrap);
      radiusLayoutInput.addEventListener('input', function () {
        markSectionDirty('layout');
        var v = toNum(radiusLayoutInput.value);
        var px = v === '' ? '' : (Math.max(0, parseInt(v, 10) || 0) + 'px');
        forEachTarget(function (el) {
          if (!el || !el.isConnected) return;
          el.style.transition = 'border-radius 0.25s ease';
          el.style.borderRadius = px;
        });
      });
      addInputScrubber(radiusLayoutInput, { step: 1, min: 0, max: 999 });
      clipCheck.addEventListener('change', function () {
        markSectionDirty('layout');
        forEachTarget(function (el) {
          if (!el || !el.isConnected) return;
          el.style.overflow = clipCheck.checked ? 'hidden' : '';
        });
      });
      if (primaryEl) {
        var csR = window.getComputedStyle(primaryEl);
        var br = parseInt((primaryEl.style.borderRadius || csR.borderTopLeftRadius || '0').toString(), 10) || 0;
        radiusLayoutInput.value = br || '';
        clipCheck.checked = (primaryEl.style.overflow || csR.overflow || '') === 'hidden';
      }

      var flexWrap = document.createElement('div');
      flexWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:8px;';
      var flexLbl = document.createElement('div');
      flexLbl.style.cssText = GAP_LABEL + 'margin-bottom:0;';
      flexLbl.textContent = 'Flex';
      // label is provided by card title
      var flexBtns = document.createElement('div');
      flexBtns.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start;';
      var flexOptions = [
        { value: '', label: 'None' },
        { value: 'row', label: 'Row' },
        { value: 'column', label: 'Column' },
        { value: 'row-center', label: 'Row center' },
        { value: 'column-center', label: 'Col center' }
      ];
      var flexValue = '';
      function applyFlexMode(mode) {
        flexValue = mode;
        flexOptions.forEach(function (o) {
          var b = flexBtns.querySelector('[data-flex="' + o.value + '"]');
          if (b) {
            b.style.background = o.value === flexValue ? 'var(--neutral-900,#181211)' : 'var(--neutral-100,#F9F6F6)';
            b.style.color = o.value === flexValue ? 'var(--neutral-100,#F9F6F6)' : 'var(--neutral-800,#372828)';
            b.style.borderColor = o.value === flexValue ? 'var(--neutral-900,#181211)' : 'var(--neutral-200,#E6E3E3)';
          }
        });
        forEachTarget(function (el) {
          el.style.transition = 'flex-direction 0.25s ease, justify-content 0.25s ease, align-items 0.25s ease';
          if (!flexValue) {
            el.style.display = '';
            el.style.justifyContent = '';
            el.style.alignItems = '';
            el.style.flexDirection = '';
            return;
          }
          el.style.display = 'flex';
          if (flexValue === 'row') {
            el.style.flexDirection = 'row';
            el.style.justifyContent = 'flex-start';
            el.style.alignItems = 'stretch';
          } else if (flexValue === 'column') {
            el.style.flexDirection = 'column';
            el.style.justifyContent = 'flex-start';
            el.style.alignItems = 'stretch';
          } else if (flexValue === 'row-center') {
            el.style.flexDirection = 'row';
            el.style.justifyContent = 'center';
            el.style.alignItems = 'center';
          } else if (flexValue === 'column-center') {
            el.style.flexDirection = 'column';
            el.style.justifyContent = 'center';
            el.style.alignItems = 'center';
          }
        });
        if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn();
        if (typeof refreshPreviewBoxFn === 'function') refreshPreviewBoxFn();
      }
      flexOptions.forEach(function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = '';
        var iconName = opt.value === '' ? 'flex_none'
          : opt.value === 'row' ? 'flex_row'
          : opt.value === 'column' ? 'flex_col'
          : opt.value === 'row-center' ? 'flex_row_center'
          : 'flex_col_center';
        btn.appendChild(createMaterialIcon(iconName, 16));
        btn.title = opt.label;
        btn.setAttribute('aria-label', opt.label);
        btn.style.cssText = 'width:32px;height:28px;display:flex;align-items:center;justify-content:center;padding:0;font-size:10px;font-family:' + COMMENT_FONT + ';font-weight:700;border:1px solid var(--neutral-200,#E6E3E3);border-radius:6px;background:var(--neutral-100,#F9F6F6);color:var(--neutral-800,#372828);cursor:pointer;';
        btn.setAttribute('data-flex', opt.value);
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          markSectionDirty('layout');
          applyFlexMode(opt.value);
        });
        flexBtns.appendChild(btn);
      });
      // Initialize flex selection from element's current styles
      if (primaryEl) {
        var csFlex = window.getComputedStyle(primaryEl);
        var d = csFlex.display || '';
        var dir = csFlex.flexDirection || '';
        var jc = csFlex.justifyContent || '';
        var ai = csFlex.alignItems || '';
        if (d === 'flex') {
          if (dir === 'row' && jc === 'center' && ai === 'center') flexValue = 'row-center';
          else if (dir === 'row') flexValue = 'row';
          else if (dir === 'column' && jc === 'center' && ai === 'center') flexValue = 'column-center';
          else if (dir === 'column') flexValue = 'column';
        }
        if (flexValue) {
          flexOptions.forEach(function (o) {
            var b = flexBtns.querySelector('[data-flex="' + o.value + '"]');
            if (b) {
              var on = o.value === flexValue;
              b.style.background = on ? 'var(--neutral-900,#181211)' : 'var(--neutral-100,#F9F6F6)';
              b.style.color = on ? 'var(--neutral-100,#F9F6F6)' : 'var(--neutral-800,#372828)';
              b.style.borderColor = on ? 'var(--neutral-900,#181211)' : 'var(--neutral-200,#E6E3E3)';
            }
          });
        }
      }
      flexWrap.appendChild(flexBtns);
      // Append in reference order: Flex, Sizing, Gap, Padding, Margin, Radius+Clip
      layoutGrid.appendChild(makeLayoutCard('Flex', flexWrap));
      layoutGrid.appendChild(makeLayoutCard('Sizing', sizingRow));
      layoutGrid.appendChild(makeLayoutCard('Gap', gapRow));
      layoutGrid.appendChild(makeLayoutCard('Padding', paddingCompactRow));
      layoutGrid.appendChild(makeLayoutCard('Margin', marginCompactRow));
      layoutGrid.appendChild(makeLayoutCard('Radius & overflow', radiusClipRow));
      layoutPanel.appendChild(layoutGrid);
      // Layout section disabled for now (Preview CSS only in Edit tab).
      if (false && showLayout) grid.appendChild(layoutPanel);

      // Position module (own section)
      var positionPanel = document.createElement('div');
      positionPanel.className = 'reforma-playground-position-panel';
      positionPanel.style.cssText = 'display:flex;flex-direction:column;gap:12px;font-size:11px;font-family:' + COMMENT_FONT + ';';
      var positionSectionRow = document.createElement('div');
      positionSectionRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;padding-bottom:6px;border-bottom:1px solid var(--neutral-200,#E6E3E3);gap:6px;';
      var positionSectionLabel = document.createElement('div');
      positionSectionLabel.style.cssText = 'font-size:13px;font-weight:800;color:#181211;font-family:' + COMMENT_FONT + ';letter-spacing:-0.1px;';
      positionSectionLabel.textContent = 'Position';
      positionSectionRow.appendChild(positionSectionLabel);
      positionSectionRow.appendChild(sectionUndo.position.btn);
      positionPanel.appendChild(positionSectionRow);
      positionPanel.appendChild(posWrap);
      // Position section disabled for now (Preview CSS only in Edit tab).
      if (false && showLayout) grid.appendChild(positionPanel);

      // Effects panel (bento cards like Text section)
      effectsPanel = document.createElement('div');
      effectsPanel.className = 'reforma-playground-effects-panel';
      effectsPanel.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
      var effectsSectionRow = document.createElement('div');
      effectsSectionRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;padding-bottom:6px;border-bottom:1px solid var(--neutral-200,#E6E3E3);gap:6px;';
      var effectsSectionLabel = document.createElement('div');
      effectsSectionLabel.style.cssText = 'font-size:13px;font-weight:800;color:#181211;font-family:' + COMMENT_FONT + ';letter-spacing:-0.1px;';
      effectsSectionLabel.textContent = 'Effects';
      effectsSectionRow.appendChild(effectsSectionLabel);
      effectsSectionRow.appendChild(sectionUndo.effects.btn);
      effectsPanel.appendChild(effectsSectionRow);
      var effectsGrid = document.createElement('div');
      effectsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:stretch;';

      function makeEffectsCard(title, contentEl) {
        var card = document.createElement('div');
        card.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:0;border:none;border-radius:0;background:transparent;box-sizing:border-box;min-width:0;';
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:6px;';
        var iconKey = title === 'Radius' ? 'radius'
          : title === 'Shadow' ? 'shadow'
          : title === 'Opacity' ? 'opacity'
          : title === 'Blur' ? 'blur'
          : 'effects';
        var ic = createMaterialIcon(iconKey, 13);
        ic.style.opacity = '0.75';
        ic.style.color = 'var(--neutral-700,#504645)';
        header.appendChild(ic);
        var t = document.createElement('div');
        t.style.cssText = GAP_LABEL + 'margin-bottom:0;';
        t.textContent = title;
        header.appendChild(t);
        card.appendChild(header);
        card.appendChild(contentEl);
        return card;
      }

      function ensureOriginal(el) {
        if (!el || !el.isConnected) return;
        if (!originalStyles.has(el)) {
          var cs = window.getComputedStyle(el);
          originalStyles.set(el, { fontFamily: cs.fontFamily || '', color: cs.color || '', fontSize: cs.fontSize || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' });
        }
      }

      // Radius
      var radiusWrap = document.createElement('div');
      radiusWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px 10px;box-sizing:border-box;';
      var radiusVal = document.createElement('span');
      radiusVal.style.cssText = 'min-width:56px;text-align:center;font-size:11px;font-family:\'Google Sans\',sans-serif;font-weight:700;color:var(--neutral-800,#372828);letter-spacing:-0.2px;';
      var radiusPx = 0;
      function setRadius(next) {
        markSectionDirty('effects');
        radiusPx = Math.max(0, Math.min(64, next));
        radiusVal.textContent = radiusPx + ' px';
        forEachTarget(function (el) {
          ensureOriginal(el);
          el.style.transition = 'border-radius 0.25s ease';
          el.style.borderRadius = radiusPx === 0 ? '' : (radiusPx + 'px');
        });
      }
      radiusWrap.appendChild(radiusVal);
      makeValueEditableOnDblclick(radiusVal, function () { return radiusPx; }, setRadius, function (v) { return v + ' px'; }, function (val) {
        var n = parseInt(String(val).trim(), 10);
        return isNaN(n) ? null : Math.max(0, Math.min(64, n));
      });
      addValueScrubber(radiusWrap, function () { return radiusPx; }, function (n) { setRadius(n); }, { step: 1, min: 0, max: 64 });
      effectsGrid.appendChild(makeEffectsCard('Radius', radiusWrap));

      // Shadow buttons
      var shadowBtns = document.createElement('div');
      shadowBtns.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
      var shadowOptions = [
        { v: '', label: 'None' },
        { v: '0 1px 2px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)', label: 'Soft' },
        { v: '0 4px 18px rgba(0,0,0,0.18)', label: 'Strong' }
      ];
      var shadowValue = '';
      shadowOptions.forEach(function (opt) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = opt.label;
        b.style.cssText = 'padding:6px 10px;border-radius:10px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;color:var(--neutral-800,#372828);font-family:\'Google Sans\',sans-serif;font-weight:700;font-size:11px;cursor:pointer;';
        b.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          markSectionDirty('effects');
          shadowValue = opt.v;
          Array.from(shadowBtns.children).forEach(function (btn) {
            var on = btn === b;
            btn.style.background = on ? 'var(--neutral-900,#181211)' : '#fff';
            btn.style.color = on ? 'var(--neutral-100,#F9F6F6)' : 'var(--neutral-800,#372828)';
            btn.style.borderColor = on ? 'var(--neutral-900,#181211)' : 'var(--neutral-200,#E6E3E3)';
          });
          forEachTarget(function (el) {
            ensureOriginal(el);
            el.style.transition = 'box-shadow 0.25s ease';
            el.style.boxShadow = shadowValue;
          });
        });
        shadowBtns.appendChild(b);
      });
      effectsGrid.appendChild(makeEffectsCard('Shadow', shadowBtns));

      // Opacity
      var opWrap = document.createElement('div');
      opWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px 10px;box-sizing:border-box;';
      var opVal = document.createElement('span');
      opVal.style.cssText = 'min-width:56px;text-align:center;font-size:11px;font-family:\'Google Sans\',sans-serif;font-weight:700;color:var(--neutral-800,#372828);letter-spacing:-0.2px;';
      var opPct = 100;
      function setOpacity(next) {
        markSectionDirty('effects');
        opPct = Math.max(0, Math.min(100, next));
        opVal.textContent = opPct + '%';
        forEachTarget(function (el) {
          ensureOriginal(el);
          el.style.transition = 'opacity 0.25s ease';
          el.style.opacity = opPct === 100 ? '' : String(opPct / 100);
        });
      }
      opWrap.appendChild(opVal);
      makeValueEditableOnDblclick(opVal, function () { return opPct; }, setOpacity, function (v) { return v + '%'; }, function (val) {
        var n = parseInt(String(val).trim(), 10);
        return isNaN(n) ? null : Math.max(0, Math.min(100, n));
      });
      addValueScrubber(opWrap, function () { return opPct; }, function (n) { setOpacity(n); }, { step: 5, min: 0, max: 100 });
      effectsGrid.appendChild(makeEffectsCard('Opacity', opWrap));

      // Blur
      var blurWrap = document.createElement('div');
      blurWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--neutral-200,#E6E3E3);background:#fff;padding:6px 10px;box-sizing:border-box;';
      var blurVal = document.createElement('span');
      blurVal.style.cssText = 'min-width:56px;text-align:center;font-size:11px;font-family:\'Google Sans\',sans-serif;font-weight:700;color:var(--neutral-800,#372828);letter-spacing:-0.2px;';
      var blurPx = 0;
      function setBlur(next) {
        markSectionDirty('effects');
        blurPx = Math.max(0, Math.min(24, next));
        blurVal.textContent = blurPx + ' px';
        forEachTarget(function (el) {
          ensureOriginal(el);
          el.style.transition = 'filter 0.25s ease';
          el.style.filter = blurPx === 0 ? '' : ('blur(' + blurPx + 'px)');
        });
      }
      blurWrap.appendChild(blurVal);
      makeValueEditableOnDblclick(blurVal, function () { return blurPx; }, setBlur, function (v) { return v + ' px'; }, function (val) {
        var n = parseInt(String(val).trim(), 10);
        return isNaN(n) ? null : Math.max(0, Math.min(24, n));
      });
      addValueScrubber(blurWrap, function () { return blurPx; }, function (n) { setBlur(n); }, { step: 1, min: 0, max: 24 });
      effectsGrid.appendChild(makeEffectsCard('Blur', blurWrap));

      // Initialize display values from computed style
      if (primaryEl) {
        var csEff = window.getComputedStyle(primaryEl);
        var br = parseInt(csEff.borderTopLeftRadius || '0', 10) || 0;
        setRadius(br);
        setOpacity(Math.round((parseFloat(csEff.opacity || '1') || 1) * 100));
        // try to parse blur(px)
        var f = (csEff.filter || '').toString();
        var bm = f.match(/blur\\(([-\\d.]+)px\\)/);
        setBlur(bm ? parseFloat(bm[1]) : 0);
      } else {
        radiusVal.textContent = radiusPx + ' px';
        opVal.textContent = opPct + '%';
        blurVal.textContent = blurPx + ' px';
      }

      effectsPanel.appendChild(effectsGrid);
      // Effects section disabled for now (Preview CSS only in Edit tab).
      if (false && showEffects) grid.appendChild(effectsPanel);

      function clearTypoAndColorFromDescendants(el) {
        var list = el.querySelectorAll('*');
        for (var d = 0; d < list.length; d++) {
          var desc = list[d];
          desc.style.fontFamily = '';
          desc.style.color = '';
          desc.style.fontSize = '';
          desc.style.lineHeight = '';
          desc.style.letterSpacing = '';
          desc.style.fontWeight = '';
          desc.style.textAlign = '';
          desc.style.fontStyle = '';
          desc.style.textDecoration = '';
          desc.style.textTransform = '';
          desc.style.backgroundColor = '';
          desc.style.removeProperty('--reforma-primary');
          desc.style.removeProperty('--reforma-secondary');
          desc.style.removeProperty('--reforma-button');
        }
      }
      function revertSection(key) {
        var o = sectionOriginals[key];
        if (!o) return;
        forEachTarget(function (el) {
          if (!el || !el.isConnected) return;
          var k, keys = Object.keys(o);
          for (k = 0; k < keys.length; k++) {
            var prop = keys[k];
            var val = o[prop];
            if (prop === 'fontFamily') el.style.fontFamily = val || '';
            else if (prop === 'color') el.style.color = val || '';
            else if (prop === 'fontSize') el.style.fontSize = val || '';
            else if (prop === 'lineHeight') el.style.lineHeight = val || '';
            else if (prop === 'letterSpacing') el.style.letterSpacing = val || '';
            else if (prop === 'fontWeight') el.style.fontWeight = val || '';
            else if (prop === 'backgroundColor') el.style.backgroundColor = val || '';
            else if (prop === 'fontStyle') el.style.fontStyle = val || '';
            else if (prop === 'textDecoration') el.style.textDecoration = val || '';
            else if (prop === 'textTransform') el.style.textTransform = val || '';
            else if (prop === 'textAlign') el.style.textAlign = val || '';
            else if (prop === 'width') el.style.width = val || '';
            else if (prop === 'height') el.style.height = val || '';
            else if (prop === 'gap') el.style.gap = val || '';
            else if (prop === 'paddingTop') el.style.paddingTop = val || '';
            else if (prop === 'paddingRight') el.style.paddingRight = val || '';
            else if (prop === 'paddingBottom') el.style.paddingBottom = val || '';
            else if (prop === 'paddingLeft') el.style.paddingLeft = val || '';
            else if (prop === 'marginTop') el.style.marginTop = val || '';
            else if (prop === 'marginRight') el.style.marginRight = val || '';
            else if (prop === 'marginBottom') el.style.marginBottom = val || '';
            else if (prop === 'marginLeft') el.style.marginLeft = val || '';
            else if (prop === 'borderRadius') el.style.borderRadius = val || '';
            else if (prop === 'overflow') el.style.overflow = val || '';
            else if (prop === 'display') el.style.display = val || '';
            else if (prop === 'flexDirection') el.style.flexDirection = val || '';
            else if (prop === 'justifyContent') el.style.justifyContent = val || '';
            else if (prop === 'alignItems') el.style.alignItems = val || '';
            else if (prop === 'position') el.style.position = val || '';
            else if (prop === 'left') el.style.left = val || '';
            else if (prop === 'right') el.style.right = val || '';
            else if (prop === 'top') el.style.top = val || '';
            else if (prop === 'bottom') el.style.bottom = val || '';
            else if (prop === 'transform') el.style.transform = val || '';
            else if (prop === 'opacity') el.style.opacity = val || '';
            else if (prop === 'filter') el.style.filter = val || '';
            else if (prop === 'boxShadow') el.style.boxShadow = val || '';
            else if (prop === 'primary') { el.style.setProperty('--reforma-primary', val || ''); el.style.borderColor = val || ''; }
            else if (prop === 'secondary') el.style.setProperty('--reforma-secondary', val || '');
            else if (prop === 'section') el.style.backgroundColor = val || '';
            else if (prop === 'button') el.style.setProperty('--reforma-button', val || '');
            else if (prop === 'text') el.style.color = val || '';
          }
          if (key === 'typo' || key === 'colors') clearTypoAndColorFromDescendants(el);
        });
        if (key === 'typo' && primaryEl) {
          var cs = window.getComputedStyle(primaryEl);
          currentFontSize = cs.fontSize || '16px';
          currentColor = cs.color || '';
          currentBgColor = (!cs.backgroundColor || cs.backgroundColor === 'transparent' || cs.backgroundColor === 'rgba(0, 0, 0, 0)') ? '' : cs.backgroundColor;
          currentLineHeight = cs.lineHeight || '';
          currentLetterSpacing = cs.letterSpacing || '';
          var rw = cs.fontWeight || '400';
          currentFontWeight = (rw === 'normal' ? '400' : rw === 'bold' ? '700' : rw);
          px = parseInt(currentFontSize, 10) || 16;
          sizeVal.textContent = px + ' px';
          weightVal.textContent = (weightsList.indexOf(currentFontWeight) >= 0 ? currentFontWeight : '400');
          displayWeight = weightVal.textContent;
          var lhParsed = parseFloat(currentLineHeight);
          lh = (!lhParsed || lhParsed > 4) ? 1.4 : lhParsed;
          lineVal.textContent = lh.toFixed(2) + '';
          ls = parseFloat(currentLetterSpacing) || 0;
          letterVal.textContent = ls.toFixed(2) + ' px';
          colorInput.value = rgbToHex(currentColor);
          syncCircleToPicker();
          bgColorInput.value = rgbToHex(currentBgColor || '#FFFFFF');
          syncBgCircle();
          var a = (cs.textAlign || 'left').toLowerCase();
          textAlignValue = (a === 'center' ? 'center' : a === 'right' ? 'right' : a === 'justify' ? 'justify' : 'left');
          alignRow.querySelectorAll('button').forEach(function (b) {
            var on = b.getAttribute('data-align') === textAlignValue;
            b.style.cssText = alignBtnStyle + (on ? ';' + alignActiveStyle : '');
          });
          var ff = (cs.fontFamily || '').toString();
          var firstFF = (ff.split(',')[0] || '').trim().replace(/^['"]|['"]$/g, '');
          ['google_sans', 'shantell', 'inter', 'roboto', 'system'].forEach(function (fk) {
            var resolved = resolvePlaygroundFont(fk);
            var firstResolved = (resolved.split(',')[0] || '').trim().replace(/^['"]|['"]$/g, '');
            if (firstResolved && firstFF && firstResolved === firstFF && fontSelect.querySelector('option[value="' + fk + '"]')) {
              currentFontKey = fk;
              fontSelect.value = fk;
            }
          });
        }
        if (key === 'layout' && primaryEl) {
          var csL = window.getComputedStyle(primaryEl);
          gapInput.value = toNum((primaryEl.style.gap || csL.gap || '').trim()) || '';
          var pt = toNum((primaryEl.style.paddingTop || csL.paddingTop || '').trim());
          var pl = toNum((primaryEl.style.paddingLeft || csL.paddingLeft || '').trim());
          padVInput.value = pt || '';
          padHInput.value = pl || '';
          var mt = toNum((primaryEl.style.marginTop || csL.marginTop || '').trim());
          var ml = toNum((primaryEl.style.marginLeft || csL.marginLeft || '').trim());
          marVInput.value = mt || '';
          marHInput.value = ml || '';
          var br = parseInt((primaryEl.style.borderRadius || csL.borderTopLeftRadius || '0').toString(), 10) || 0;
          radiusLayoutInput.value = br || '';
          clipCheck.checked = (primaryEl.style.overflow || csL.overflow || '') === 'hidden';
          var wVal = (primaryEl.style.width || csL.width || '').toString().trim();
          var hVal = (primaryEl.style.height || csL.height || '').toString().trim();
          wInput.value = wVal === 'auto' ? 'auto' : toNum(wVal) || '';
          hInput.value = hVal === 'auto' ? 'auto' : toNum(hVal) || '';
          var fd = (primaryEl.style.flexDirection || csL.flexDirection || '').toString();
          var jc = (primaryEl.style.justifyContent || csL.justifyContent || '').toString();
          var ai = (primaryEl.style.alignItems || csL.alignItems || '').toString();
          if (!fd && !primaryEl.style.display) flexValue = '';
          else if (fd === 'row' && jc !== 'center') flexValue = 'row';
          else if (fd === 'column' && ai !== 'center') flexValue = 'column';
          else if (fd === 'row' && jc === 'center') flexValue = 'row-center';
          else if (fd === 'column' && ai === 'center') flexValue = 'column-center';
          else flexValue = fd ? 'row' : '';
          flexOptions.forEach(function (opt) {
            var b = flexBtns.querySelector('[data-flex="' + opt.value + '"]');
            if (b) {
              b.style.background = opt.value === flexValue ? 'var(--neutral-900,#181211)' : 'var(--neutral-100,#F9F6F6)';
              b.style.color = opt.value === flexValue ? 'var(--neutral-100,#F9F6F6)' : 'var(--neutral-800,#372828)';
              b.style.borderColor = opt.value === flexValue ? 'var(--neutral-900,#181211)' : 'var(--neutral-200,#E6E3E3)';
            }
          });
        }
        if (key === 'position') {
          syncPositionInputs();
        }
        if (key === 'effects' && primaryEl) {
          var csE = window.getComputedStyle(primaryEl);
          var brE = parseInt(csE.borderTopLeftRadius || '0', 10) || 0;
          radiusPx = Math.max(0, Math.min(64, brE));
          radiusVal.textContent = radiusPx + ' px';
          opPct = Math.max(0, Math.min(100, Math.round((parseFloat(csE.opacity || '1') || 1) * 100)));
          opVal.textContent = opPct + '%';
          var fE = (csE.filter || '').toString();
          var bmE = fE.match(/blur\(([-\d.]+)px\)/);
          blurPx = bmE ? Math.max(0, Math.min(24, parseFloat(bmE[1]))) : 0;
          blurVal.textContent = blurPx + ' px';
          shadowValue = (primaryEl.style.boxShadow || csE.boxShadow || '').toString();
          Array.from(shadowBtns.children).forEach(function (btn) {
            var opt = shadowOptions.find(function (o) { return o.label === btn.textContent; });
            var on = opt && opt.v === shadowValue;
            btn.style.background = on ? 'var(--neutral-900,#181211)' : '#fff';
            btn.style.color = on ? 'var(--neutral-100,#F9F6F6)' : 'var(--neutral-800,#372828)';
            btn.style.borderColor = on ? 'var(--neutral-900,#181211)' : 'var(--neutral-200,#E6E3E3)';
          });
        }
        if (key === 'colors' && primaryEl && sectionOriginals.colors) {
          var co = sectionOriginals.colors;
          colorPrimary = (co.primary && rgbToHex(co.primary)) || '#38052E';
          colorSecondary = (co.secondary && rgbToHex(co.secondary)) || '#9E198C';
          currentBgColor = (co.section && co.section !== 'transparent' && co.section !== 'rgba(0, 0, 0, 0)') ? co.section : '';
          colorButton = (co.button && rgbToHex(co.button)) || '#D643E3';
          currentColor = (co.text && co.text) || '';
          if (colorInput) { colorInput.value = rgbToHex(currentColor || '#000000'); if (typeof syncCircleToPicker === 'function') syncCircleToPicker(); }
          if (bgColorInput) { bgColorInput.value = rgbToHex(currentBgColor || '#FFFFFF'); if (typeof syncBgCircle === 'function') syncBgCircle(); }
          if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn();
        }
        sectionUndo[key].hide();
        if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(updateSelectionOutline);
      }

      sectionUndo.typo.btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); revertSection('typo'); });
      sectionUndo.layout.btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); revertSection('layout'); });
      sectionUndo.position.btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); revertSection('position'); });
      sectionUndo.effects.btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); revertSection('effects'); });
      if (sectionUndo.colors && sectionUndo.colors.btn) sectionUndo.colors.btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); revertSection('colors'); });

      var refreshPreviewCodeLinesFn;
      var refreshPreviewBoxFn;
      // Persist drag/reorder mode across element selections (panel rebuilds).
      if (!self.__reformaDragDropState) self.__reformaDragDropState = { mode: 'off' }; // 'off' | 'snapped' | 'free'
      // ---- Preview CSS (code view + scrubable pills + live preview), branded ----
      (function addPreviewCssSection() {
        var previewWrap = document.createElement('div');
        previewWrap.className = 'reforma-preview-wrap';
        // Section container with clear 45° diagonal stripes behind inner content.
        previewWrap.style.cssText =
          'display:flex;flex-direction:column;gap:0;margin-top:12px;padding:3px;border-radius:14px;' +
          'border:1px solid rgba(134,151,255,0.9);' +
          'background:repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0, rgba(255,255,255,0.45) 3px, transparent 3px, transparent 7px), #2F3DFF;' +
          'overflow:visible;';
        var previewHeader = document.createElement('div');
        previewHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;gap:8px;font-family:' + COMMENT_FONT + ';';
        var previewHeaderLeft = document.createElement('button');
        previewHeaderLeft.type = 'button';
        previewHeaderLeft.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex:1;min-width:0;padding:0;border:none;background:transparent;cursor:pointer;font-family:inherit;text-align:left;';
        var previewTitle = document.createElement('div');
        previewTitle.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--primary-700,#9E198C);';
        previewTitle.appendChild(createMaterialIcon('code', 14));
        previewTitle.appendChild(document.createTextNode('Preview'));
        var previewChevron = document.createElement('span');
        previewChevron.style.cssText = 'font-size:10px;color:var(--neutral-600,#675C58);transition:transform 0.2s;';
        previewChevron.textContent = '\u25BC';
        previewHeaderLeft.appendChild(previewTitle);
        previewHeaderLeft.appendChild(previewChevron);
        var previewActions = document.createElement('div');
        previewActions.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
        var previewSaveBtn = document.createElement('button');
        previewSaveBtn.type = 'button';
        previewSaveBtn.className = 'reforma-preview-save-btn';
        previewSaveBtn.title = 'Copy changes to clipboard';
        previewSaveBtn.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid #D643E3;background:#D643E3;color:#38052E;font-size:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;';
        var previewSaveIcon = createMaterialIcon('content_copy', 16, '#38052E');
        previewSaveIcon.setAttribute('aria-hidden', 'true');
        previewSaveBtn.appendChild(previewSaveIcon);
        previewSaveBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var text = getAllChangesFormatted();
          if (text && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
              previewSaveBtn.style.background = '#20C997';
              previewSaveBtn.style.color = '#ffffff';
              previewSaveBtn.style.borderColor = '#20C997';
              setTimeout(function () {
                previewSaveBtn.style.background = '#D643E3';
                previewSaveBtn.style.color = '#38052E';
                previewSaveBtn.style.borderColor = '#D643E3';
              }, 1500);
            });
          }
        });
        previewActions.appendChild(previewSaveBtn);
        var dragDropMode = self.__reformaDragDropState.mode !== 'off';
        var dragDropSnap = self.__reformaDragDropState.mode === 'snapped';
        var dragDropOverlay = null;
        function setDragDropState(mode) {
          // mode: 'off' | 'snapped' | 'free'
          self.__reformaDragDropState.mode = mode;
          dragDropMode = mode !== 'off';
          dragDropSnap = mode === 'snapped';
        }
        var dragDropScrollResizeCleanup = null;
        function setDragDropMode(on) {
          dragDropMode = !!on;
          self.__reformaDragDropState.mode = dragDropMode ? (dragDropSnap ? 'snapped' : 'free') : 'off';
          if (dragDropScrollResizeCleanup) { dragDropScrollResizeCleanup(); dragDropScrollResizeCleanup = null; }
          if (dragDropOverlay && dragDropOverlay.parentNode) dragDropOverlay.parentNode.removeChild(dragDropOverlay);
          dragDropOverlay = null;
          if (!dragDropMode) return;
          var container = getContainer();
          if (!container) return;
          dragDropOverlay = document.createElement('div');
          dragDropOverlay.id = 'reforma-dragdrop-overlay';
          dragDropOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
          targets.forEach(function (el, idx) {
            if (!el || !el.isConnected) return;
            var r = el.getBoundingClientRect();
            var frame = document.createElement('div');
            frame.className = 'reforma-dragdrop-frame';
            frame.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;pointer-events:auto;cursor:move;border:2px dashed #D643E3;border-radius:6px;background:rgba(214,67,227,0.08);box-sizing:border-box;';
            frame.setAttribute('data-reforma-dragdrop-index', String(idx));
            var size = 10;
            var corners = [
              { pos: 'top:0;left:0;width:' + size + 'px;height:' + size + 'px;cursor:nwse-resize', edge: 'tl' },
              { pos: 'top:0;right:0;width:' + size + 'px;height:' + size + 'px;cursor:nesw-resize', edge: 'tr' },
              { pos: 'bottom:0;left:0;width:' + size + 'px;height:' + size + 'px;cursor:nesw-resize', edge: 'bl' },
              { pos: 'bottom:0;right:0;width:' + size + 'px;height:' + size + 'px;cursor:nwse-resize', edge: 'br' }
            ];
            corners.forEach(function (c) {
              var h = document.createElement('div');
              h.style.cssText = 'position:absolute;' + c.pos + ';background:#D643E3;border-radius:2px;pointer-events:auto;';
              h.setAttribute('data-edge', c.edge);
              h.addEventListener('mousedown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (e.button !== 0) return;
                markSectionDirty('layout');
                var startX = e.clientX, startY = e.clientY;
                var el0 = targets[idx];
                if (!el0 || !el0.isConnected) return;
                var cs = window.getComputedStyle(el0);
                var startW = parseFloat(cs.width) || el0.getBoundingClientRect().width;
                var startH = parseFloat(cs.height) || el0.getBoundingClientRect().height;
                el0.style.position = el0.style.position || (cs.position === 'static' ? 'relative' : cs.position) || 'relative';
                function onMove(e2) {
                  var dx = e2.clientX - startX, dy = e2.clientY - startY;
                  var newW = Math.max(20, startW + (c.edge === 'tl' || c.edge === 'bl' ? -dx : dx));
                  var newH = Math.max(20, startH + (c.edge === 'tl' || c.edge === 'tr' ? -dy : dy));
                  el0.style.width = newW + 'px';
                  el0.style.height = newH + 'px';
                  if (wInput) wInput.value = String(Math.round(newW));
                  if (hInput) hInput.value = String(Math.round(newH));
                  if (typeof applySizing === 'function') applySizing();
                  updateDragDropFrames();
                  if (typeof refreshPreviewBoxFn === 'function') refreshPreviewBoxFn();
                }
                function onUp() {
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(updateSelectionOutline);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              });
              frame.appendChild(h);
            });
            frame.addEventListener('mousedown', function (e) {
              if (e.target !== frame && e.target.getAttribute('data-edge')) return;
              if (e.target.getAttribute('data-edge')) return;
              e.preventDefault();
              e.stopPropagation();
              if (e.button !== 0) return;
              markSectionDirty('layout');
              var startX = e.clientX, startY = e.clientY;
              var el0 = targets[idx];
              if (!el0 || !el0.isConnected) return;
              var cs = window.getComputedStyle(el0);
              var parent = el0.parentElement;
              var parentCs = parent ? window.getComputedStyle(parent) : null;
              var disp = parentCs && (parentCs.display || '').toLowerCase();
              var isFlexOrGrid = disp === 'flex' || disp === 'inline-flex' || disp === 'grid' || disp === 'inline-grid';
              var useSnap = !!(dragDropSnap && isFlexOrGrid && parent);
              var startLeft = parseFloat(el0.style.left) || 0;
              var startTop = parseFloat(el0.style.top) || 0;
              var startFrameRect = frame.getBoundingClientRect();
              var snapPlaceholder = null;
              var snapOrigDisplay = '';
              var axis = 'y';
              if (useSnap) {
                var isFlex = (disp === 'flex' || disp === 'inline-flex');
                var flexDir = (parentCs && parentCs.flexDirection ? parentCs.flexDirection : '');
                axis = (isFlex && flexDir.indexOf('row') === 0) ? 'x' : 'y';
                snapOrigDisplay = el0.style.display || '';
                // Insert a "skeleton" placeholder where the element currently is.
                snapPlaceholder = document.createElement('div');
                snapPlaceholder.className = 'reforma-dragdrop-snap-placeholder';
                var rr0 = el0.getBoundingClientRect();
                snapPlaceholder.style.cssText =
                  'display:block;box-sizing:border-box;' +
                  'width:' + Math.max(8, rr0.width) + 'px;' +
                  'height:' + Math.max(8, rr0.height) + 'px;' +
                  'border-radius:' + (getComputedStyle(el0).borderRadius || '8px') + ';' +
                  'border:2px dashed rgba(214,67,227,0.9);' +
                  'background:repeating-linear-gradient(45deg, rgba(214,67,227,0.12) 0, rgba(214,67,227,0.12) 4px, transparent 4px, transparent 10px);';
                try {
                  parent.insertBefore(snapPlaceholder, el0);
                  el0.style.display = 'none';
                } catch (eIns) { snapPlaceholder = null; }
              }
              if (!useSnap) {
                el0.style.position = el0.style.position || (cs.position === 'static' ? 'relative' : cs.position) || 'relative';
              }
              function snapMovePlaceholder(clientX, clientY) {
                if (!snapPlaceholder || !parent) return;
                var kids = Array.prototype.slice.call(parent.children || []).filter(function (n) {
                  return n && n !== el0 && n !== snapPlaceholder;
                });
                var cx = clientX;
                var cy = clientY;
                var insertBeforeEl = null;
                for (var i = 0; i < kids.length; i++) {
                  var k = kids[i];
                  if (!k || k.nodeType !== 1) continue;
                  var r = k.getBoundingClientRect();
                  var mid = axis === 'x' ? (r.left + r.width / 2) : (r.top + r.height / 2);
                  var c = axis === 'x' ? cx : cy;
                  if (c < mid) { insertBeforeEl = k; break; }
                }
                try {
                  if (insertBeforeEl) parent.insertBefore(snapPlaceholder, insertBeforeEl);
                  else parent.appendChild(snapPlaceholder);
                } catch (eMove) {}
                // Move the overlay frame to match the placeholder position so it's obvious where it will land.
                try {
                  var pr = snapPlaceholder.getBoundingClientRect();
                  frame.style.left = pr.left + 'px';
                  frame.style.top = pr.top + 'px';
                  frame.style.width = pr.width + 'px';
                  frame.style.height = pr.height + 'px';
                } catch (ePR) {}
              }
              function onMove(e2) {
                var dx = e2.clientX - startX, dy = e2.clientY - startY;
                if (useSnap) {
                  // Live preview of drop result: move placeholder through the flex/grid children.
                  snapMovePlaceholder(e2.clientX, e2.clientY);
                } else {
                  el0.style.left = (startLeft + dx) + 'px';
                  el0.style.top = (startTop + dy) + 'px';
                  updateDragDropFrames();
                }
                if (typeof refreshPreviewBoxFn === 'function') refreshPreviewBoxFn();
              }
              function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (useSnap && parent && el0 && el0.isConnected) {
                  // Finalize: place element where placeholder is, then remove placeholder.
                  try {
                    el0.style.display = snapOrigDisplay;
                    if (snapPlaceholder && snapPlaceholder.parentNode === parent) {
                      parent.insertBefore(el0, snapPlaceholder);
                      snapPlaceholder.parentNode.removeChild(snapPlaceholder);
                    }
                  } catch (eFin) {}
                  updateDragDropFrames();
                  if (typeof refreshPreviewBoxFn === 'function') refreshPreviewBoxFn();
                }
                if (snapPlaceholder && snapPlaceholder.parentNode) {
                  try { snapPlaceholder.parentNode.removeChild(snapPlaceholder); } catch (eRm) {}
                }
                if (useSnap && el0 && el0.isConnected) {
                  try { el0.style.display = snapOrigDisplay; } catch (eDisp) {}
                }
                if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(updateSelectionOutline);
              }
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            });
            dragDropOverlay.appendChild(frame);
          });
          function updateDragDropFrames() {
            if (!dragDropOverlay || !dragDropOverlay.parentNode) return;
            var frames = dragDropOverlay.querySelectorAll('.reforma-dragdrop-frame');
            targets.forEach(function (el, idx) {
              if (!el || !el.isConnected || !frames[idx]) return;
              var r = el.getBoundingClientRect();
              frames[idx].style.left = r.left + 'px';
              frames[idx].style.top = r.top + 'px';
              frames[idx].style.width = r.width + 'px';
              frames[idx].style.height = r.height + 'px';
            });
          }
          window.addEventListener('scroll', updateDragDropFrames, true);
          window.addEventListener('resize', updateDragDropFrames);
          dragDropScrollResizeCleanup = function () {
            window.removeEventListener('scroll', updateDragDropFrames, true);
            window.removeEventListener('resize', updateDragDropFrames);
          };
          container.appendChild(dragDropOverlay);
          if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(updateSelectionOutline);
        }
        // 3-state toggle above preview code: Off / Snapped / Free
        var dragToggleRow = document.createElement('div');
        dragToggleRow.className = 'reforma-dragdrop-toggle-row';
        dragToggleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 10px;';
        var dragToggleLabel = document.createElement('div');
        dragToggleLabel.style.cssText = 'font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:rgba(103,92,88,0.95);font-family:' + COMMENT_FONT + ';display:flex;align-items:center;gap:6px;';
        dragToggleLabel.appendChild(createMaterialIcon('open_with', 14, 'rgba(103,92,88,0.95)'));
        dragToggleLabel.appendChild(document.createTextNode('Layout'));
        var dragToggle = document.createElement('div');
        dragToggle.style.cssText = 'display:inline-flex;align-items:center;gap:0;border-radius:999px;border:1px solid rgba(56,5,46,0.25);overflow:hidden;background:rgba(255,255,255,0.5);';
        function makeSeg(id, label, icon) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('data-dd-mode', id);
          b.style.cssText = 'padding:6px 10px;font-size:10px;font-weight:700;border:none;background:transparent;color:#38052E;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:' + COMMENT_FONT + ';';
          b.appendChild(createMaterialIcon(icon, 12, '#38052E'));
          b.appendChild(document.createTextNode(label));
          b.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            setDragDropState(id);
            syncSegs();
            setDragDropMode(dragDropMode);
          });
          return b;
        }
        var segOff = makeSeg('off', 'Off', 'block');
        var segSnap = makeSeg('snapped', 'Snap', 'grid_3x3');
        var segFree = makeSeg('free', 'Free', 'open_with');
        dragToggle.appendChild(segOff);
        dragToggle.appendChild(segSnap);
        dragToggle.appendChild(segFree);
        dragToggleRow.appendChild(dragToggleLabel);
        dragToggleRow.appendChild(dragToggle);
        function syncSegs() {
          var mode = self.__reformaDragDropState.mode || 'off';
          [segOff, segSnap, segFree].forEach(function (b) {
            var on = b.getAttribute('data-dd-mode') === mode;
            b.style.background = on ? '#38052E' : 'transparent';
            b.style.color = on ? '#FFEBFE' : '#38052E';
            var svg = b.querySelector('svg');
            if (svg) svg.style.color = on ? '#FFEBFE' : '#38052E';
          });
        }
        syncSegs();
        previewHeader.appendChild(previewHeaderLeft);
        previewHeader.appendChild(previewActions);
        previewWrap.appendChild(previewHeader);
        var previewBody = document.createElement('div');
        previewBody.style.cssText = 'display:flex;flex-direction:column;';
        // Place drag controls above preview box/code area.
        previewBody.appendChild(dragToggleRow);
        var codeBlock = document.createElement('div');
        codeBlock.style.cssText = 'padding:10px 12px;font-family:ui-monospace,monospace;font-size:11px;line-height:1.6;color:var(--neutral-800,#372828);background:#FBF8F6;border-bottom:1px solid var(--neutral-200,#E6E3E3);overflow-x:auto;';
        var PREVIEW_PILL = 'display:inline-block;min-width:28px;padding:2px 8px;margin:0 1px;border-radius:4px;background:#F977DF;color:#38052E;font-weight:700;text-align:center;cursor:ew-resize;user-select:none;font-size:11px;';
        function makeScrubablePill(getValue, setValue, format, step, min, max) {
          step = step != null ? step : 1;
          min = min != null ? min : -Infinity;
          max = max != null ? max : Infinity;
          var pill = document.createElement('span');
          pill.className = 'reforma-preview-css-pill';
          pill.style.cssText = PREVIEW_PILL;
          pill.setAttribute('title', 'Drag to scrub • Double-click to type');
          function updateText() { pill.textContent = format(getValue()); }
          updateText();
          function startInlineEdit() {
            if (pill.getAttribute('data-editing') === '1') return;
            pill.setAttribute('data-editing', '1');
            var current = getValue();
            var input = document.createElement('input');
            input.type = 'text';
            input.value = (current == null ? '' : String(current));
            input.className = 'reforma-preview-pill-input';
            input.style.cssText = 'width:54px;max-width:72px;background:#FFFFFF;border:1px solid rgba(56,5,46,0.25);border-radius:8px;padding:2px 6px;font-size:11px;font-weight:700;font-family:' + COMMENT_FONT + ';color:#38052E;outline:none;text-align:center;box-sizing:border-box;';
            var prevCursor = pill.style.cursor;
            pill.style.cursor = 'text';
            pill.innerHTML = '';
            pill.appendChild(input);
            input.focus();
            input.select();
            function finish(apply) {
              if (pill.getAttribute('data-editing') !== '1') return;
              pill.setAttribute('data-editing', '0');
              pill.style.cursor = prevCursor;
              var nextRaw = input.value;
              if (apply) {
                var num = parseFloat(String(nextRaw).trim());
                if (!isNaN(num)) {
                  var clamped = Math.min(max, Math.max(min, num));
                  setValue(clamped);
                }
              }
              pill.innerHTML = '';
              updateText();
              refreshPreviewBox();
            }
            input.addEventListener('keydown', function (e) {
              if (e.key === 'Enter') { e.preventDefault(); finish(true); }
              if (e.key === 'Escape') { e.preventDefault(); finish(false); }
            });
            input.addEventListener('blur', function () { finish(true); });
          }
          pill.addEventListener('dblclick', function (e) {
            e.preventDefault();
            e.stopPropagation();
            startInlineEdit();
          });
          pill.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (pill.getAttribute('data-editing') === '1') return;
            e.preventDefault();
            var startX = e.clientX;
            var startVal = getValue();
            var doc = pill.ownerDocument;
            function onMove(e2) {
              var dx = e2.clientX - startX;
              var mult = e2.shiftKey ? 10 : 1;
              var delta = Math.round(dx * 0.5) * step * mult;
              var next = Math.min(max, Math.max(min, startVal + delta));
              setValue(next);
              updateText();
              refreshPreviewBox();
            }
            function onUp() {
              doc.removeEventListener('mousemove', onMove);
              doc.removeEventListener('mouseup', onUp);
            }
            doc.addEventListener('mousemove', onMove);
            doc.addEventListener('mouseup', onUp);
          });
          return pill;
        }
        function makeCodeLine(propLabel, pillOrText) {
          var line = document.createElement('div');
          line.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:2px;';
          var labelSpan = document.createElement('span');
          labelSpan.style.cssText = 'color:var(--primary-900,#38052E);font-weight:600;';
          labelSpan.textContent = propLabel;
          line.appendChild(labelSpan);
          if (typeof pillOrText === 'object' && pillOrText.nodeType) line.appendChild(pillOrText);
          else { var t = document.createElement('span'); t.textContent = pillOrText; line.appendChild(t); }
          return line;
        }
        function makeCodeLineWithUndo(propLabel, pill, getCurrentVal, getOriginalVal, revertFn) {
          var line = document.createElement('div');
          line.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:2px;';
          var labelSpan = document.createElement('span');
          labelSpan.style.cssText = 'color:var(--primary-900,#38052E);font-weight:600;';
          labelSpan.textContent = propLabel;
          line.appendChild(labelSpan);
          var wrap = document.createElement('span');
          wrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
          wrap.appendChild(pill);
          var undoBtn = document.createElement('button');
          undoBtn.type = 'button';
          undoBtn.className = 'reforma-pill-undo';
          undoBtn.title = 'Revert this property to original';
          undoBtn.setAttribute('aria-label', 'Revert to original');
          undoBtn.appendChild(createMaterialIcon('undo', 12, '#38052E'));
          undoBtn.style.display = 'none';
          undoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof revertFn === 'function') revertFn();
            if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn();
            if (typeof refreshPreviewBoxFn === 'function') refreshPreviewBoxFn();
          });
          wrap.appendChild(undoBtn);
          line.appendChild(wrap);
          function syncChanged() {
            var cur = getCurrentVal();
            var orig = getOriginalVal();
            var changed = (cur !== orig) && (String(cur).trim() !== String(orig).trim());
            if (changed) {
              pill.classList.add('reforma-pill-changed');
              undoBtn.style.display = 'inline-flex';
            } else {
              pill.classList.remove('reforma-pill-changed');
              undoBtn.style.display = 'none';
            }
          }
          syncChanged();
          line._syncPreviewUndo = syncChanged;
          return line;
        }
        var previewCodeLines = document.createElement('div');
        previewCodeLines.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
        var previewSeparator = document.createElement('div');
        previewSeparator.style.cssText = 'height:8px;background:transparent;';
        var previewBox = document.createElement('div');
        previewBox.className = 'reforma-preview-box';
        // Sticky so preview stays visible while scrolling the Edit tab.
        previewBox.style.cssText = 'height:140px;padding:12px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;position:sticky;top:0;z-index:3;border-bottom:1px solid rgba(205,200,198,0.6);width:100%;max-width:100%;min-width:0;box-sizing:border-box;';
        previewBox.setAttribute('title', 'Click to refresh preview');
        var previewDragIndex = null;
        var previewPlaceholder = null;
        function enablePreviewReorder(containerClone, realContainer) {
          var directChildren = Array.prototype.slice.call(containerClone.children || []);
          if (!directChildren.length || !realContainer || !realContainer.children || !realContainer.children.length) return;
          function isAtomic(el) {
            if (!el || el.nodeType !== 1) return false;
            var tag = (el.tagName || '').toLowerCase();
            if (tag === 'img' || tag === 'svg' || tag === 'picture' || tag === 'video' || tag === 'canvas') return true;
            if (el.classList && (el.classList.contains('material-icons') || el.classList.contains('material-symbols-outlined'))) return true;
            if (el.getAttribute && (el.getAttribute('data-icon') || el.getAttribute('role') === 'img')) return true;
            return false;
          }
          directChildren.forEach(function (child, idx) {
            // Use inner image/icon/text as drag handle when it's the only meaningful content
            var handle = child;
            if (child.children && child.children.length === 1) {
              var inner = child.children[0];
              if (isAtomic(inner) || (inner.tagName && /^(SPAN|P|H[1-6]|A)$/.test(inner.tagName) && (inner.textContent || '').trim().length > 0)) {
                handle = inner;
              }
            } else if (isAtomic(child)) {
              handle = child;
            }
            handle.setAttribute('draggable', 'true');
            handle.setAttribute('data-reforma-preview-index', String(idx));
            handle.style.cursor = 'grab';
            var parentForPlaceholder = child.parentNode;
            var nextSiblingForPlaceholder = child.nextSibling;
            handle.addEventListener('mouseenter', function () {
              child.classList.add('reforma-preview-hover');
            });
            handle.addEventListener('mouseleave', function () {
              child.classList.remove('reforma-preview-hover');
            });
            handle.addEventListener('dragstart', function (e) {
              previewDragIndex = idx;
              child.classList.add('reforma-preview-dragging');
              if (!previewPlaceholder) {
                previewPlaceholder = document.createElement('div');
                previewPlaceholder.className = 'reforma-preview-drop-placeholder';
              }
              var r = child.getBoundingClientRect();
              previewPlaceholder.style.height = (r.height || 40) + 'px';
              previewPlaceholder.style.borderRadius = getComputedStyle(child).borderRadius || '8px';
              if (parentForPlaceholder) {
                parentForPlaceholder.insertBefore(previewPlaceholder, nextSiblingForPlaceholder);
              }
              try { e.dataTransfer && e.dataTransfer.setData('text/plain', String(idx)); } catch (e2) {}
            });
            handle.addEventListener('dragover', function (e) {
              e.preventDefault();
              if (!previewPlaceholder || !parentForPlaceholder || !child.parentNode) return;
              var r = child.getBoundingClientRect();
              var before = e.clientY < (r.top + r.height / 2);
              if (before && previewPlaceholder.nextSibling !== child) {
                parentForPlaceholder.insertBefore(previewPlaceholder, child);
              } else if (!before && previewPlaceholder.previousSibling !== child) {
                parentForPlaceholder.insertBefore(previewPlaceholder, child.nextSibling);
              }
            });
            handle.addEventListener('drop', function (e) {
              e.preventDefault();
              var targetIdx = parseInt(handle.getAttribute('data-reforma-preview-index'), 10);
              if (previewDragIndex == null || targetIdx === previewDragIndex) return;
              var children = Array.prototype.slice.call(realContainer.children || []);
              if (!children.length) return;
              var from = Math.max(0, Math.min(children.length - 1, previewDragIndex));
              var to = Math.max(0, Math.min(children.length - 1, targetIdx));
              if (from === to) return;
              var moving = children[from];
              if (!moving || !moving.parentNode) return;
              if (from < to) {
                realContainer.insertBefore(moving, children[to].nextSibling);
              } else {
                realContainer.insertBefore(moving, children[to]);
              }
              previewDragIndex = null;
              child.classList.remove('reforma-preview-dragging');
              if (previewPlaceholder && previewPlaceholder.parentNode) {
                previewPlaceholder.parentNode.removeChild(previewPlaceholder);
              }
              refreshPreviewBox();
            });
            handle.addEventListener('dragend', function () {
              child.classList.remove('reforma-preview-dragging');
              previewDragIndex = null;
              if (previewPlaceholder && previewPlaceholder.parentNode) {
                previewPlaceholder.parentNode.removeChild(previewPlaceholder);
              }
            });
          });
        }
        function refreshPreviewBox() {
          previewBox.innerHTML = '';
          if (!primaryEl || !primaryEl.isConnected) return;
          try {
            // Walk up to find the flex/grid row container so layout matches the real UI.
            var previewSource = primaryEl;
            try {
              var node = primaryEl;
              while (node && node.parentElement && node.parentElement !== document.body) {
                var p = node.parentElement;
                var pcs = window.getComputedStyle(p);
                var disp = (pcs.display || '').toLowerCase();
                if ((disp === 'flex' || disp === 'inline-flex' || disp === 'grid') && p.children.length > 1) {
                  previewSource = p;
                  node = p;
                } else {
                  node = p;
                }
              }
            } catch (eFlex) {}

            var cs = window.getComputedStyle(previewSource);
            var isContainer = previewSource.children.length > 0 || /^(flex|grid)$/.test((cs.display || '').toLowerCase());
            var clone = previewSource.cloneNode(true);
            clone.style.cssText = previewSource.style.cssText || '';
            ['fontFamily', 'fontSize', 'fontWeight', 'color', 'lineHeight', 'letterSpacing', 'backgroundColor', 'padding', 'margin', 'borderRadius', 'width', 'height', 'gap', 'display', 'flexDirection', 'alignItems', 'justifyContent', 'opacity', 'boxShadow', 'filter', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'overflow'].forEach(function (k) {
              try { clone.style[k] = previewSource.style[k] || cs[k] || ''; } catch (err) {}
            });
            var resolvedFont = (previewSource.style.fontFamily || cs.fontFamily || '').toString();
            if (resolvedFont) clone.style.setProperty('font-family', resolvedFont, 'important');
            var resolvedColor = (previewSource.style.color || cs.color || '').toString();
            if (resolvedColor) clone.style.setProperty('color', resolvedColor, 'important');
            // If element has margin / padding / gap, use a 45deg striped backdrop
            var gapVal = parseFloat((previewSource.style.gap || cs.gap || '0').toString()) || 0;
            var padVal = parseFloat((previewSource.style.paddingTop || cs.paddingTop || '0').toString()) || 0;
            var marVal = parseFloat((previewSource.style.marginTop || cs.marginTop || '0').toString()) || 0;
            if (gapVal > 0 || padVal > 0 || marVal > 0) {
              previewBox.style.backgroundImage = 'repeating-linear-gradient(45deg, rgba(249,119,223,0.38) 0, rgba(249,119,223,0.38) 2px, transparent 2px, transparent 6px)';
            } else {
              previewBox.style.backgroundImage = 'none';
            }
            // Try to match the visual background from ancestors when the element itself is transparent.
            (function () {
              function isTransparent(bg) {
                if (!bg) return true;
                bg = bg.toString().trim().toLowerCase();
                if (bg === 'transparent') return true;
                // rgba(0,0,0,0) or equivalent
                if (bg.indexOf('rgba') === 0 && /,?\s*0\)$/i.test(bg)) return true;
                return false;
              }
              var bgColor = (primaryEl.style.backgroundColor || cs.backgroundColor || '').toString();
              var node = primaryEl;
              while (isTransparent(bgColor) && node && node.parentNode && node.parentNode !== node && node !== document.body && node !== document.documentElement) {
                node = node.parentNode;
                if (node.nodeType !== 1) break;
                try {
                  var pcs = window.getComputedStyle(node);
                  bgColor = (pcs && pcs.backgroundColor) || bgColor;
                } catch (e) {}
              }
              if (isTransparent(bgColor)) bgColor = '#FFEBFE';
              clone.style.setProperty('background-color', bgColor, 'important');
            })();
            clone.style.transformOrigin = 'top left';
            if (isContainer) {
              clone.style.minWidth = '60px';
              clone.style.minHeight = '40px';
              clone.style.border = '1px solid var(--neutral-200,#E6E3E3)';
              clone.style.borderRadius = clone.style.borderRadius || '8px';
              clone.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
              clone.style.overflow = clone.style.overflow || 'hidden';
              enablePreviewReorder(clone, previewSource);
            }
            // Disable interactive behavior inside preview: no real links or buttons
            Array.prototype.forEach.call(clone.querySelectorAll('a, button, [role="button"], [onclick]'), function (el) {
              el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
              el.style.pointerEvents = 'none';
              if (el.tagName === 'A') el.setAttribute('href', 'javascript:void(0)');
            });
            // Scale clone uniformly so it always fits inside the preview box (no overflow/scrollbars).
            previewBox.appendChild(clone);
            function measureAndScale() {
              if (!clone.getBoundingClientRect || !previewBox.getBoundingClientRect) return;
              var r = clone.getBoundingClientRect();
              var pb = previewBox.getBoundingClientRect();
              var availW = previewBox.clientWidth > 0 ? previewBox.clientWidth : Math.max(0, pb.width - 24);
              var availH = previewBox.clientHeight > 0 ? previewBox.clientHeight : Math.max(0, pb.height - 24);
              if (availW <= 0) availW = Math.max(60, (pb.width || 280) - 24);
              if (availH <= 0) availH = Math.max(40, (pb.height || 140) - 24);
              var maxContentW = Math.max(60, availW);
              var maxContentH = Math.max(40, availH);
              var cw = Math.max(r.width, 1);
              var ch = Math.max(r.height, 1);
              var scaleX = maxContentW / cw;
              var scaleY = maxContentH / ch;
              var scale = Math.min(1, scaleX, scaleY);
              if (scale <= 0) scale = 0.1;
              if (scale < 1 || cw > maxContentW || ch > maxContentH) {
                scale = Math.min(scale, maxContentW / cw, maxContentH / ch);
                if (scale > 1) scale = 1;
                clone.style.transformOrigin = 'top left';
                clone.style.transform = 'scale(' + scale.toFixed(3) + ')';
                var wrapper = document.createElement('div');
                wrapper.className = 'reforma-preview-scaled-wrap';
                wrapper.style.cssText = 'display:flex;align-items:flex-start;justify-content:flex-start;flex-shrink:0;width:' + (r.width * scale) + 'px;height:' + (r.height * scale) + 'px;max-width:100%;max-height:100%;overflow:hidden;min-width:0;';
                try {
                  previewBox.removeChild(clone);
                  wrapper.appendChild(clone);
                  previewBox.appendChild(wrapper);
                } catch (e) {}
              }
            }
            if (previewBox.clientWidth > 0 && previewBox.clientHeight > 0) {
              measureAndScale();
            } else {
              requestAnimationFrame(function () { requestAnimationFrame(measureAndScale); });
            }
          } catch (err) {}
        }
        function getFontDisplayName() {
          var opt = fontSelect.selectedOptions && fontSelect.selectedOptions[0];
          if (opt && opt.value && opt.value !== '__custom_google__' && opt.textContent) {
            return opt.textContent.trim();
          }
          var key = currentFontKey || '';
          if (key.indexOf('custom:') === 0) return key.replace('custom:', '');
          var labels = { google_sans: 'Google Sans', shantell: 'Shantell Sans', inter: 'Inter', roboto: 'Roboto', system: 'System UI' };
          if (labels[key]) return labels[key];
          var ff = (computedStyle.fontFamily || '').toString();
          var firstFF = (ff.split(',')[0] || '').trim().replace(/^['"]|['"]$/g, '');
          var matched = null;
          ['google_sans', 'shantell', 'inter', 'roboto', 'system'].forEach(function (fk) {
            if (matched) return;
            var resolved = resolvePlaygroundFont(fk);
            var firstResolved = (resolved.split(',')[0] || '').trim().replace(/^['"]|['"]$/g, '');
            if (firstResolved && firstFF && firstResolved === firstFF) matched = fk;
          });
          if (matched && labels[matched]) return labels[matched];
          return firstFF || 'System UI';
        }
        var previewGroupsCollapsed = { typography: false, layout: false, effects: false, color: false };
        function buildPreviewCodeLines() {
          previewCodeLines.innerHTML = '';
          function addGroup(key, label) {
            var header = document.createElement('button');
            header.type = 'button';
            header.className = 'reforma-preview-group-header';
            header.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:8px 0 6px;border:none;border-top:1px solid rgba(205,200,198,0.6);background:transparent;cursor:pointer;transition:background 0.15s ease,color 0.15s ease;';
            var left = document.createElement('div');
            left.style.cssText = 'font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:rgba(103,92,88,0.95);font-family:' + COMMENT_FONT + ';';
            left.textContent = label;
            var chevron = document.createElement('span');
            chevron.textContent = '\u25BE';
            chevron.style.cssText = 'font-size:10px;color:rgba(103,92,88,0.95);transition:transform 0.15s ease;';
            header.appendChild(left);
            header.appendChild(chevron);
            var body = document.createElement('div');
            body.style.cssText = 'display:flex;flex-direction:column;gap:2px;overflow:hidden;max-height:2000px;transition:max-height 0.2s ease;';
            function render() {
              var collapsed = !!previewGroupsCollapsed[key];
              chevron.style.transform = collapsed ? 'rotate(-90deg)' : '';
              header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
              if (collapsed) {
                body.style.maxHeight = '0';
                body.addEventListener('transitionend', function onEnd() {
                  body.removeEventListener('transitionend', onEnd);
                  body.style.display = 'none';
                }, { once: true });
              } else {
                var wasCollapsed = (body.style.display === 'none');
                body.style.display = 'flex';
                if (wasCollapsed) {
                  body.style.maxHeight = '0';
                  requestAnimationFrame(function () {
                    body.style.maxHeight = '2000px';
                  });
                } else {
                  body.style.maxHeight = '2000px';
                }
              }
            }
            header.addEventListener('click', function (e) {
              e.preventDefault();
              previewGroupsCollapsed[key] = !previewGroupsCollapsed[key];
              render();
            });
            render();
            previewCodeLines.appendChild(header);
            previewCodeLines.appendChild(body);
            return body;
          }
          if (showTypography) {
            var typoGroup = addGroup('typography', 'Typography');
            var fontPill = document.createElement('span');
            fontPill.className = 'reforma-preview-css-pill';
            fontPill.style.cssText = PREVIEW_PILL;
            fontPill.style.cursor = 'default';
            function updateFontPill() { fontPill.textContent = getFontDisplayName(); }
            updateFontPill();
            typoGroup.appendChild(makeCodeLine('font-family: ', fontPill));
            // Text color
            typoGroup.appendChild(makeCodeLine('color: ', makeScrubablePill(function () {
              return 0;
            }, function () {
              // No numeric scrub – clicking opens native color picker from main Typography section
              if (colorInput && typeof colorInput.click === 'function') colorInput.click();
            }, function () { return rgbToHex(currentColor || (computedStyle.color || '#000000')); }, 0, 0, 0)));
            typoGroup.appendChild(makeCodeLineWithUndo('font-size: ', makeScrubablePill(function () { return px; }, function (n) {
              px = Math.max(8, Math.min(96, Math.round(n)));
              currentFontSize = px + 'px';
              sizeVal.textContent = px + ' px';
              forEachTargetAndDescendants(function (t) {
                if (!originalStyles.has(t)) { var cs = window.getComputedStyle(t); originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', fontSize: cs.fontSize || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' }); }
                t.style.fontSize = currentFontSize;
              });
              applyTypographyToPreview();
              if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn();
            }, function (v) { return v + 'px'; }, 1, 8, 96), function () { return px; }, function () { var v = (sectionOriginals.typo.fontSize || '').toString(); return parseInt(v, 10) || 16; }, function () {
              var orig = (sectionOriginals.typo.fontSize || '16px').toString();
              px = Math.max(8, Math.min(96, parseInt(orig, 10) || 16));
              currentFontSize = px + 'px';
              sizeVal.textContent = px + ' px';
              forEachTargetAndDescendants(function (t) { t.style.fontSize = currentFontSize; });
              applyTypographyToPreview();
            }));
            typoGroup.appendChild(makeCodeLineWithUndo('font-weight: ', makeScrubablePill(function () { var i = weightsList.indexOf(currentFontWeight); return i >= 0 ? i : 1; }, function (idx) {
              var i = Math.max(0, Math.min(weightsList.length - 1, Math.round(idx)));
              var next = weightsList[i];
              currentFontWeight = next;
              displayWeight = next;
              weightVal.textContent = next;
              forEachTargetAndDescendants(function (t) {
                if (!originalStyles.has(t)) { var cs = window.getComputedStyle(t); originalStyles.set(t, { fontFamily: cs.fontFamily || '', color: cs.color || '', lineHeight: cs.lineHeight || '', letterSpacing: cs.letterSpacing || '', fontWeight: cs.fontWeight || '' }); }
                t.style.fontWeight = next;
              });
              applyTypographyToPreview();
              if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn();
            }, function (v) { return weightsList[Math.round(v)] || '400'; }, 1, 0, weightsList.length - 1), function () { return currentFontWeight; }, function () { return (sectionOriginals.typo.fontWeight || '400').toString(); }, function () {
              var orig = (sectionOriginals.typo.fontWeight || '400').toString();
              currentFontWeight = orig;
              displayWeight = orig;
              weightVal.textContent = orig;
              forEachTargetAndDescendants(function (t) { t.style.fontWeight = orig; });
              applyTypographyToPreview();
            }));
            typoGroup.appendChild(makeCodeLineWithUndo('line-height: ', makeScrubablePill(function () { return lh; }, function (n) { applyLineHeight(n); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return String(v); }, 0.1, 0.8, 3), function () { return lh; }, function () { return parseFloat(String(sectionOriginals.typo.lineHeight || '1.4'), 10) || 1.4; }, function () {
              var orig = parseFloat(String(sectionOriginals.typo.lineHeight || '1.4'), 10) || 1.4;
              applyLineHeight(orig);
            }));
            typoGroup.appendChild(makeCodeLineWithUndo('letter-spacing: ', makeScrubablePill(function () { return ls; }, function (n) { applyLetter(n); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v + 'px'; }, 0.1, -5, 5), function () { return ls; }, function () { var v = (sectionOriginals.typo.letterSpacing || '0px').toString(); return parseFloat(v, 10) || 0; }, function () {
              var orig = parseFloat(String(sectionOriginals.typo.letterSpacing || '0px').replace('px', ''), 10) || 0;
              applyLetter(orig);
            }));
          }
          if (showLayout) {
            var layoutGroup = addGroup('layout', 'Layout');
            // Flex layout as icon buttons (reusing main Flex controls)
            var displayFlexRow = document.createElement('div');
            displayFlexRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;';
            flexOptions.forEach(function (opt) {
              var btn = document.createElement('button');
              btn.type = 'button';
              btn.innerHTML = '';
              var iconName = opt.value === '' ? 'flex_none'
                : opt.value === 'row' ? 'flex_row'
                : opt.value === 'column' ? 'flex_col'
                : opt.value === 'row-center' ? 'flex_row_center'
                : 'flex_col_center';
              btn.appendChild(createMaterialIcon(iconName, 14));
              btn.title = opt.label;
              btn.setAttribute('aria-label', opt.label);
              btn.className = 'reforma-preview-flex-btn';
              btn.style.cssText = 'min-width:28px;padding:4px 8px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;border:1px solid rgba(56,5,46,0.2);background:#F977DF;color:#38052E;font-weight:700;cursor:pointer;font-size:0;';
              btn.setAttribute('data-preview-flex', opt.value);
              function syncBtn() {
                var on = (opt.value === flexValue);
                btn.style.background = on ? '#38052E' : '#F977DF';
                btn.style.color = on ? '#FFEBFE' : '#38052E';
                btn.style.borderColor = on ? '#38052E' : 'rgba(56,5,46,0.2)';
              }
              syncBtn();
              btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                markSectionDirty('layout');
                applyFlexMode(opt.value);
                flexOptions.forEach(function (o2) {
                  var b2 = displayFlexRow.querySelector('[data-preview-flex=\"' + o2.value + '\"]');
                  if (!b2) return;
                  var on2 = (o2.value === flexValue);
                  b2.style.background = on2 ? '#38052E' : '#F977DF';
                  b2.style.color = on2 ? '#FFEBFE' : '#38052E';
                  b2.style.borderColor = on2 ? '#38052E' : 'rgba(56,5,46,0.2)';
                });
              });
              displayFlexRow.appendChild(btn);
            });
            layoutGroup.appendChild(makeCodeLine('display: ', displayFlexRow));
            layoutGroup.appendChild(makeCodeLineWithUndo('width: ', makeScrubablePill(function () { var v = wInput.value.trim(); return v === 'auto' ? 0 : parseFloat(wInput.value, 10) || 0; }, function (n) { wInput.value = n <= 0 ? 'auto' : String(Math.round(n)); applySizing(); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v <= 0 ? 'auto' : v + 'px'; }, 2, 0, 9999), function () { return wInput.value.trim(); }, function () { return (sectionOriginals.layout.width || '').toString().trim() || 'auto'; }, function () {
              var orig = (sectionOriginals.layout.width || '').toString().trim();
              wInput.value = orig || 'auto';
              applySizing();
            }));
            layoutGroup.appendChild(makeCodeLineWithUndo('height: ', makeScrubablePill(function () { var v = hInput.value.trim(); return v === 'auto' ? 0 : parseFloat(hInput.value, 10) || 0; }, function (n) { hInput.value = n <= 0 ? 'auto' : String(Math.round(n)); applySizing(); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v <= 0 ? 'auto' : v + 'px'; }, 2, 0, 9999), function () { return hInput.value.trim(); }, function () { return (sectionOriginals.layout.height || '').toString().trim() || 'auto'; }, function () {
              var orig = (sectionOriginals.layout.height || '').toString().trim();
              hInput.value = orig || 'auto';
              applySizing();
            }));
            layoutGroup.appendChild(makeCodeLineWithUndo('gap: ', makeScrubablePill(function () { return parseFloat(gapInput.value, 10) || 0; }, function (n) { gapInput.value = String(Math.max(0, Math.round(n))); gapInput.dispatchEvent(new Event('input', { bubbles: true })); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v + 'px'; }, 1, 0, 999), function () { return parseFloat(gapInput.value, 10) || 0; }, function () { return parseFloat(String(sectionOriginals.layout.gap || '0').replace('px', ''), 10) || 0; }, function () {
              var orig = (sectionOriginals.layout.gap || '0').toString().replace('px', '');
              gapInput.value = String(Math.max(0, parseFloat(orig, 10) || 0));
              gapInput.dispatchEvent(new Event('input', { bubbles: true }));
            }));
            layoutGroup.appendChild(makeCodeLineWithUndo('padding: ', makeScrubablePill(function () { return parseFloat(padVInput.value, 10) || 0; }, function (n) { padVInput.value = String(Math.max(0, Math.round(n))); padHInput.value = padHInput.value || '0'; applyPaddingCompact(); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v + 'px'; }, 1, 0, 999), function () { return parseFloat(padVInput.value, 10) || 0; }, function () { return parseFloat(String(sectionOriginals.layout.paddingTop || '0').replace('px', ''), 10) || 0; }, function () {
              var pt = (sectionOriginals.layout.paddingTop || '0').toString().replace('px', '');
              padVInput.value = String(Math.max(0, parseFloat(pt, 10) || 0));
              padHInput.value = padHInput.value || '0';
              applyPaddingCompact();
            }));
            layoutGroup.appendChild(makeCodeLineWithUndo('margin: ', makeScrubablePill(function () { return parseFloat(marVInput.value, 10) || 0; }, function (n) { marVInput.value = String(Math.round(n)); marHInput.value = marHInput.value || '0'; applyMarginCompact(); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v + 'px'; }, 1, -999, 999), function () { return parseFloat(marVInput.value, 10) || 0; }, function () { return parseFloat(String(sectionOriginals.layout.marginTop || '0').replace('px', ''), 10) || 0; }, function () {
              var mt = (sectionOriginals.layout.marginTop || '0').toString().replace('px', '');
              marVInput.value = String(parseFloat(mt, 10) || 0);
              marHInput.value = marHInput.value || '0';
              applyMarginCompact();
            }));
            layoutGroup.appendChild(makeCodeLineWithUndo('border-radius: ', makeScrubablePill(function () { return parseInt(radiusLayoutInput.value, 10) || 0; }, function (n) { radiusLayoutInput.value = String(Math.max(0, Math.min(999, Math.round(n)))); radiusLayoutInput.dispatchEvent(new Event('input', { bubbles: true })); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v + 'px'; }, 1, 0, 999), function () { return parseInt(radiusLayoutInput.value, 10) || 0; }, function () { return parseInt(String(sectionOriginals.layout.borderRadius || '0').replace('px', ''), 10) || 0; }, function () {
              var br = (sectionOriginals.layout.borderRadius || '0').toString().replace('px', '');
              radiusLayoutInput.value = String(Math.max(0, Math.min(999, parseInt(br, 10) || 0)));
              radiusLayoutInput.dispatchEvent(new Event('input', { bubbles: true }));
            }));
          }
          if (showEffects) {
            var effectsGroup = addGroup('effects', 'Effects');
            effectsGroup.appendChild(makeCodeLineWithUndo('radius: ', makeScrubablePill(function () { return radiusPx; }, function (n) { setRadius(n); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v + 'px'; }, 1, 0, 64), function () { return radiusPx; }, function () { return parseInt(String(sectionOriginals.effects.borderRadius || '0').replace('px', ''), 10) || 0; }, function () {
              var orig = parseInt(String(sectionOriginals.effects.borderRadius || '0').replace('px', ''), 10) || 0;
              setRadius(Math.max(0, Math.min(64, orig)));
            }));
            effectsGroup.appendChild(makeCodeLineWithUndo('opacity: ', makeScrubablePill(function () { return opPct; }, function (n) { setOpacity(n); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v + '%'; }, 5, 0, 100), function () { return opPct; }, function () { var v = parseFloat(String(sectionOriginals.effects.opacity || '1'), 10); return isNaN(v) ? 100 : Math.round(v * 100); }, function () {
              var v = parseFloat(String(sectionOriginals.effects.opacity || '1'), 10);
              setOpacity(isNaN(v) ? 100 : Math.min(100, Math.max(0, Math.round(v * 100))));
            }));
            effectsGroup.appendChild(makeCodeLineWithUndo('blur: ', makeScrubablePill(function () { return blurPx; }, function (n) { setBlur(n); if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn(); }, function (v) { return v + 'px'; }, 1, 0, 24), function () { return blurPx; }, function () { var m = (sectionOriginals.effects.filter || '').match(/blur\(([-\d.]+)px\)/); return m ? parseInt(m[1], 10) || 0 : 0; }, function () {
              var m = (sectionOriginals.effects.filter || '').match(/blur\(([-\d.]+)px\)/);
              var orig = m ? Math.max(0, Math.min(24, parseInt(m[1], 10) || 0)) : 0;
              setBlur(orig);
            }));
          }
          if (showColor) {
            var colorGroup = addGroup('color', 'Color');
            function makeColorRow(label, getHex, setVal, applyToTargets) {
              var line = document.createElement('div');
              line.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
              var lbl = document.createElement('span');
              lbl.style.cssText = 'color:var(--primary-900,#38052E);font-weight:600;font-size:11px;min-width:72px;';
              lbl.textContent = label + ':';
              line.appendChild(lbl);
              var wrap = document.createElement('span');
              wrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
              var swatch = document.createElement('button');
              swatch.type = 'button';
              swatch.className = 'reforma-playground-color-circle';
              swatch.style.cssText = 'width:24px;height:24px;min-width:24px;min-height:24px;padding:0;margin:0;border:2px solid #CDC8C6;border-radius:50%;cursor:pointer;overflow:hidden;position:relative;';
              var inp = document.createElement('input');
              inp.type = 'color';
              inp.className = 'reforma-playground-color-picker-in-circle';
              inp.value = getHex();
              inp.setAttribute('tabindex', '-1');
              inp.style.cssText = 'position:absolute;top:50%;left:50%;width:200%;height:200%;transform:translate(-50%,-50%);opacity:0;cursor:pointer;border:none;padding:0;';
              function sync() { swatch.style.background = inp.value; }
              swatch.appendChild(inp);
              sync();
              inp.addEventListener('input', function () { setVal(inp.value); applyToTargets(inp.value); sync(); if (typeof refreshPreviewBoxFn === 'function') refreshPreviewBoxFn(); });
              inp.addEventListener('change', function () { setVal(inp.value); applyToTargets(inp.value); sync(); });
              wrap.appendChild(swatch);
              line.appendChild(wrap);
              line._colorInput = inp;
              line._syncColor = function () { inp.value = getHex(); sync(); };
              line.classList.add('reforma-color-row');
              return line;
            }
            function applyPrimary(hex) {
              markSectionDirty('colors');
              colorPrimary = hex;
              forEachTarget(function (t) {
                t.style.setProperty('--reforma-primary', hex);
                t.style.borderColor = hex;
              });
              applyTypographyToPreview();
            }
            function applySecondary(hex) {
              markSectionDirty('colors');
              colorSecondary = hex;
              forEachTarget(function (t) { t.style.setProperty('--reforma-secondary', hex); });
              applyTypographyToPreview();
            }
            function applySection(hex) {
              markSectionDirty('colors');
              currentBgColor = hex;
              forEachTarget(function (t) { t.style.backgroundColor = hex; });
              if (bgColorInput) { bgColorInput.value = hex; if (typeof syncBgCircle === 'function') syncBgCircle(); }
              applyTypographyToPreview();
            }
            function applyButton(hex) {
              markSectionDirty('colors');
              colorButton = hex;
              forEachTarget(function (t) {
                t.style.setProperty('--reforma-button', hex);
                var tag = (t.tagName || '').toLowerCase();
                var role = (t.getAttribute && t.getAttribute('role')) || '';
                if (tag === 'button' || tag === 'a' || role === 'button') t.style.backgroundColor = hex;
              });
              applyTypographyToPreview();
            }
            function applyText(hex) {
              markSectionDirty('colors');
              currentColor = hex;
              forEachTargetAndDescendants(function (t) { t.style.color = hex; });
              if (colorInput) { colorInput.value = hex; if (typeof syncCircleToPicker === 'function') syncCircleToPicker(); }
              applyTypographyToPreview();
            }
            colorGroup.appendChild(makeColorRow('Primary', function () { return colorPrimary; }, function (h) { colorPrimary = h; }, applyPrimary));
            colorGroup.appendChild(makeColorRow('Secondary', function () { return colorSecondary; }, function (h) { colorSecondary = h; }, applySecondary));
            colorGroup.appendChild(makeColorRow('Section', function () { return currentBgColor ? rgbToHex(currentBgColor) : '#FFFFFF'; }, function (h) { currentBgColor = h; }, applySection));
            colorGroup.appendChild(makeColorRow('Button', function () { return colorButton; }, function (h) { colorButton = h; }, applyButton));
            colorGroup.appendChild(makeColorRow('Text', function () { return currentColor ? rgbToHex(currentColor) : '#000000'; }, function (h) { currentColor = h; }, applyText));
            var actionRow = document.createElement('div');
            actionRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
            function addColorActionBtn(label, title, fn) {
              var btn = document.createElement('button');
              btn.type = 'button';
              btn.textContent = label;
              btn.title = title;
              btn.setAttribute('aria-label', title);
              btn.style.cssText = 'padding:4px 8px;font-size:10px;font-weight:600;font-family:' + COMMENT_FONT + ';border:1px solid rgba(56,5,46,0.3);border-radius:4px;background:rgba(249,119,223,0.25);color:#38052E;cursor:pointer;';
              btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                fn();
                if (typeof refreshPreviewCodeLinesFn === 'function') refreshPreviewCodeLinesFn();
                if (typeof refreshPreviewBoxFn === 'function') refreshPreviewBoxFn();
                colorGroup.querySelectorAll('.reforma-color-row').forEach(function (row) { if (row._syncColor) row._syncColor(); });
              });
              actionRow.appendChild(btn);
            }
            addColorActionBtn('More accessible', 'Increase contrast (WCAG-friendly)', function () {
              var textHex = currentColor ? rgbToHex(currentColor) : '#000000';
              var bgHex = currentBgColor ? rgbToHex(currentBgColor) : '#FFFFFF';
              var lum = function (hex) {
                var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
                r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
                g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
                b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
              };
              var contrast = function (a, b) {
                var La = lum(a), Lb = lum(b);
                return (Math.max(La, Lb) + 0.05) / (Math.min(La, Lb) + 0.05);
              };
              var cur = contrast(textHex, bgHex);
              if (cur < 4.5) {
                var Ltext = lum(textHex), Lbg = lum(bgHex);
                if (Lbg > 0.5) {
                  applyText('#000000');
                  applySection('#FFFFFF');
                } else {
                  applyText('#FFFFFF');
                  applySection('#111111');
                }
              }
            });
            addColorActionBtn('Randomize', 'Randomize palette', function () {
              var hue = function () { return Math.floor(Math.random() * 360); };
              var sat = 50 + Math.floor(Math.random() * 40);
              var light = function (lmin, lmax) { return lmin + Math.floor(Math.random() * (lmax - lmin)); };
              var hsl = function (h, s, l) {
                var s0 = s / 100, l0 = l / 100;
                var c = (1 - Math.abs(2 * l0 - 1)) * s0, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l0 - c / 2;
                var r = 0, g = 0, b = 0;
                if (h < 60) { r = c; g = x; b = 0; } else if (h < 120) { r = x; g = c; b = 0; } else if (h < 180) { r = 0; g = c; b = x; } else if (h < 240) { r = 0; g = x; b = c; } else if (h < 300) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
                return '#' + [r + m, g + m, b + m].map(function (v) { var hex = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return hex.length === 1 ? '0' + hex : hex; }).join('');
              };
              var h1 = hue(), h2 = (h1 + 180) % 360;
              applyPrimary(hsl(h1, sat, 25));
              applySecondary(hsl(h2, sat, 45));
              applySection(hsl(h1, 15, 97));
              applyButton(hsl(h1, sat, 55));
              applyText(hsl(h1, 40, 15));
            });
            addColorActionBtn('Match theme', 'Sample colors from page', function () {
              var root = document.documentElement;
              var body = document.body;
              var getVar = function (names) {
                for (var i = 0; i < names.length; i++) {
                  var v = root.style.getPropertyValue(names[i]) || (window.getComputedStyle(root).getPropertyValue(names[i]) || '').trim();
                  if (v) return rgbToHex(v);
                  if (body) { v = body.style.getPropertyValue(names[i]) || (window.getComputedStyle(body).getPropertyValue(names[i]) || '').trim(); if (v) return rgbToHex(v); }
                }
                return null;
              };
              var primary = getVar(['--primary', '--color-primary', '--brand-primary', '--reforma-primary']);
              var secondary = getVar(['--secondary', '--color-secondary', '--brand-secondary']);
              var bodyBg = body ? (window.getComputedStyle(body).backgroundColor || '').toString() : '';
              var bodyColor = body ? (window.getComputedStyle(body).color || '').toString() : '';
              if (primary) applyPrimary(primary);
              if (secondary) applySecondary(secondary);
              if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') applySection(rgbToHex(bodyBg));
              if (bodyColor) applyText(rgbToHex(bodyColor));
              var btn = document.querySelector('button, [role="button"], a.button, .btn');
              if (btn) {
                var bc = (btn.style.backgroundColor || window.getComputedStyle(btn).backgroundColor || '').toString();
                if (bc && bc !== 'transparent') applyButton(rgbToHex(bc));
              }
            });
            colorGroup.appendChild(actionRow);
          }
        }
        // Put live preview window above code list
        previewBox.addEventListener('click', refreshPreviewBox);
        previewBody.appendChild(previewBox);
        previewBody.appendChild(previewSeparator);
        buildPreviewCodeLines();
        codeBlock.appendChild(previewCodeLines);
        previewBody.appendChild(codeBlock);
        previewWrap.appendChild(previewBody);
        refreshPreviewBox();
        refreshPreviewCodeLinesFn = buildPreviewCodeLines;
        refreshPreviewBoxFn = refreshPreviewBox;
        // Reapply drag-drop overlay for the newly selected element(s) if enabled.
        if (self.__reformaDragDropState && self.__reformaDragDropState.mode && self.__reformaDragDropState.mode !== 'off') {
          setDragDropState(self.__reformaDragDropState.mode);
          syncSegs();
          setDragDropMode(true);
        }
        var previewCollapsed = false;
        previewHeaderLeft.addEventListener('click', function () {
          previewCollapsed = !previewCollapsed;
          previewBody.style.display = previewCollapsed ? 'none' : 'flex';
          previewChevron.style.transform = previewCollapsed ? 'rotate(-90deg)' : '';
        });
        grid.insertBefore(previewWrap, grid.firstChild);
      })();

      var editContentWrap = document.createElement('div');
      editContentWrap.className = 'reforma-tab-content';
      editContentWrap.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;';
      editContentWrap.appendChild(panelContainer);
      panelContainer.addEventListener('input', function () { requestAnimationFrame(updateSelectionOutline); });
      panelContainer.addEventListener('change', function () { requestAnimationFrame(updateSelectionOutline); });

      var fullClassesPanelWrap = document.createElement('div');
      fullClassesPanelWrap.className = 'reforma-tab-content';
      fullClassesPanelWrap.style.cssText = 'flex:1;display:none;flex-direction:column;min-height:0;overflow-y:auto;';
      (function buildFullClassesPanel() {
        fullClassesPanelWrap.innerHTML = '';
        var enriched = getTopSelectorsEnriched(10);
        var items = enriched.items;
        var sectionTitles = { text: 'Text', 'image/video': 'Image/Video', icons: 'Icons' };
        var sectionOrder = ['text', 'image/video', 'icons'];
        var sectionTitleStyle = 'font-size:11px;font-weight:600;color:var(--neutral-600,#675C58);font-family:' + COMMENT_FONT + ';margin:12px 0 6px;padding:0 4px;';
        var cardWrapStyle = 'display:flex;flex-direction:column;gap:8px;';
        var cardStyle = 'display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:10px 12px;border:1px solid var(--neutral-200,#E6E3E3);border-radius:10px;background:var(--neutral-100,#F9F6F6);text-align:left;cursor:pointer;font-family:' + COMMENT_FONT + ';transition:border-color 0.2s, box-shadow 0.2s;';
        var emptyStyle = 'font-size:12px;color:var(--neutral-600,#675C58);font-family:' + COMMENT_FONT + ';';
        var pillStyle = 'padding:4px 8px;font-size:10px;font-weight:600;font-family:' + COMMENT_FONT + ';border:1px solid var(--neutral-200,#E6E3E3);border-radius:999px;background:var(--neutral-100,#F9F6F6);color:var(--neutral-700,#504645);cursor:pointer;transition:background 0.2s,border-color 0.2s,color 0.2s;';
        var pillActiveStyle = 'background:var(--neutral-900,#181211);border-color:var(--neutral-900,#181211);color:#fff;';
        var pillRowStyle = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;';
        var searchWrap = document.createElement('div');
        searchWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:8px;flex-shrink:0;';
        var searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search classes & tags';
        searchInput.style.cssText = 'width:100%;padding:8px 10px;font-size:12px;font-family:' + COMMENT_FONT + ';border:1px solid var(--neutral-200,#E6E3E3);border-radius:8px;background:#fff;color:#181211;box-sizing:border-box;';
        function addPillRow(label, options, key, selected, setSelected, updateAllInWrap) {
          var row = document.createElement('div');
          row.style.cssText = pillRowStyle;
          var lbl = document.createElement('span');
          lbl.style.cssText = 'font-size:10px;font-weight:700;color:var(--neutral-600,#675C58);margin-right:4px;flex-shrink:0;';
          lbl.textContent = label + ':';
          row.appendChild(lbl);
          options.forEach(function (opt) {
            var pill = document.createElement('button');
            pill.type = 'button';
            pill.textContent = opt.label;
            pill.style.cssText = pillStyle + (selected === opt.id ? ';' + pillActiveStyle : '');
            pill.setAttribute('data-' + key, opt.id);
            pill.addEventListener('click', function () {
              setSelected(opt.id);
              var toUpdate = updateAllInWrap ? searchWrap.querySelectorAll('[data-' + key + ']') : row.querySelectorAll('button');
              toUpdate.forEach(function (b) {
                b.style.cssText = pillStyle + (b.getAttribute('data-' + key) === opt.id ? ';' + pillActiveStyle : '');
              });
              renderList();
            });
            row.appendChild(pill);
          });
          searchWrap.appendChild(row);
        }
        var selectedType = '', selectedUsage = '', selectedTag = '';
        addPillRow('Type', [{ id: '', label: 'All' }, { id: 'text', label: 'Text' }, { id: 'image/video', label: 'Image/Video' }, { id: 'icons', label: 'Icons' }], 'type', selectedType, function (v) { selectedType = v; });
        addPillRow('Usage', [{ id: '', label: 'All' }, { id: 'container', label: 'Container' }, { id: 'button', label: 'Button' }, { id: 'header', label: 'Header' }, { id: 'link', label: 'Link' }, { id: 'nav', label: 'Nav' }, { id: 'footer', label: 'Footer' }, { id: 'image', label: 'Image' }, { id: 'icon', label: 'Icon' }, { id: 'other', label: 'Other' }], 'usage', selectedUsage, function (v) { selectedUsage = v; });
        var tagOpts = [{ id: '', label: 'All' }].concat(enriched.tags.map(function (t) { return { id: t, label: '<' + t + '>' }; }));
        addPillRow('Tag', tagOpts.slice(0, 12), 'tag', selectedTag, function (v) { selectedTag = v; }, true);
        if (tagOpts.length > 12) {
          var moreRow = document.createElement('div');
          moreRow.style.cssText = pillRowStyle + 'margin-left:0;';
          tagOpts.slice(12).forEach(function (opt) {
            var pill = document.createElement('button');
            pill.type = 'button';
            pill.textContent = opt.label;
            pill.style.cssText = pillStyle + (selectedTag === opt.id ? ';' + pillActiveStyle : '');
            pill.setAttribute('data-tag', opt.id);
            pill.addEventListener('click', function () {
              selectedTag = opt.id;
              searchWrap.querySelectorAll('[data-tag]').forEach(function (b) {
                b.style.cssText = pillStyle + (b.getAttribute('data-tag') === opt.id ? ';' + pillActiveStyle : '');
              });
              renderList();
            });
            moreRow.appendChild(pill);
          });
          searchWrap.appendChild(moreRow);
        }
        fullClassesPanelWrap.appendChild(searchWrap);
        var listContainer = document.createElement('div');
        listContainer.style.cssText = 'flex:1;min-height:0;overflow-y:auto;';
        fullClassesPanelWrap.appendChild(listContainer);
        function renderList() {
          listContainer.innerHTML = '';
          var q = (searchInput.value || '').toLowerCase().trim();
          var filtered = items.filter(function (item) {
            if (selectedType && item.typeCat !== selectedType) return false;
            if (selectedUsage && item.usage !== selectedUsage) return false;
            if (selectedTag && item.tag !== selectedTag) return false;
            return !q || (item.name || '').toLowerCase().indexOf(q) >= 0;
          });
          var byCat = { text: [], 'image/video': [], icons: [] };
          filtered.forEach(function (item) { if (byCat[item.typeCat]) byCat[item.typeCat].push(item); });
          var shown = 0;
          var descPillStyle = 'display:inline-block;padding:3px 6px;font-size:9px;font-weight:600;font-family:' + COMMENT_FONT + ';border-radius:999px;background:var(--neutral-200,#E6E3E3);color:var(--neutral-800,#372828);margin:1px 2px 1px 0;';
          sectionOrder.forEach(function (cat) {
            var list = byCat[cat] || [];
            if (!list.length) return;
            var heading = document.createElement('div');
            heading.style.cssText = sectionTitleStyle;
            heading.textContent = sectionTitles[cat];
            listContainer.appendChild(heading);
            var cardWrap = document.createElement('div');
            cardWrap.style.cssText = cardWrapStyle;
            list.forEach(function (item) {
              shown++;
              var card = document.createElement('button');
              card.type = 'button';
              card.style.cssText = cardStyle;
              card.addEventListener('mouseenter', function () {
                card.style.borderColor = '#9E198C';
                card.style.boxShadow = '0 2px 8px rgba(158,25,140,0.2)';
                highlightElementsBySelector(item.type, item.name);
              });
              card.addEventListener('mouseleave', function () {
                card.style.borderColor = '';
                card.style.boxShadow = '';
                clearClassHighlights();
              });
              var row1 = document.createElement('div');
              row1.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
              var label = document.createElement('span');
              label.style.cssText = 'font-size:12px;font-weight:600;color:#9E198C;';
              label.textContent = (item.type === 'class' ? '.' : '<') + item.name + (item.type === 'tag' ? '>' : '');
              var count = document.createElement('span');
              count.style.cssText = 'font-size:11px;color:var(--neutral-600,#675C58);';
              count.textContent = item.count + (item.count === 1 ? ' use' : ' uses');
              row1.appendChild(label);
              row1.appendChild(count);
              card.appendChild(row1);
              var preview = getSelectorPreviewStyles(item.type, item.name);
              if (preview) {
                var row2 = document.createElement('div');
                row2.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;';
                var ttBox = document.createElement('span');
                ttBox.className = 'reforma-tt-preview';
                ttBox.textContent = 'Tt';
                var ff = preview.fontFamily;
                if (ff && ff !== 'inherit' && /[\s,]/.test(ff)) ff = "'" + ff.replace(/'/g, "\\'") + "'";
                ttBox.style.cssText = 'font-family:' + (preview.fontFamily !== 'inherit' ? (ff || 'inherit') : 'inherit') + ';font-weight:' + preview.fontWeight + ';color:' + preview.color + ';background:' + preview.backgroundColor + ';padding:2px 6px;border-radius:4px;font-size:14px;line-height:1.2;min-width:28px;text-align:center;';
                row2.appendChild(ttBox);
                [preview.fontFamily, preview.fontWeight, preview.color, preview.backgroundColor].forEach(function (val) {
                  var pill = document.createElement('span');
                  pill.style.cssText = descPillStyle;
                  pill.textContent = val || '—';
                  row2.appendChild(pill);
                });
                card.appendChild(row2);
              }
              card.addEventListener('click', function () {
                var elements = getElementsBySelector(item.type, item.name);
                if (!elements.length) return;
                currentGapBatchElements = elements;
                currentGapBatchLabel = (item.type === 'class' ? '.' : '') + item.name;
                currentGapTarget = null;
                highlightElementsBySelector(item.type, item.name);
                createComment(0, 0, null, elements[0], 'right');
              });
              cardWrap.appendChild(card);
            });
            listContainer.appendChild(cardWrap);
          });
          if (shown === 0) {
            var empty = document.createElement('p');
            empty.style.cssText = emptyStyle;
            empty.textContent = q ? ("No matches for \"" + q + "\".") : 'No classes or tags found.';
            listContainer.appendChild(empty);
          }
        }
        searchInput.addEventListener('input', renderList);
        searchInput.addEventListener('keyup', renderList);
        renderList();
      })();

      var fullChangesPanelWrap = document.createElement('div');
      fullChangesPanelWrap.className = 'reforma-tab-content';
      fullChangesPanelWrap.style.cssText = 'flex:1;display:none;flex-direction:column;min-height:0;';
      fullChangesPanelWrap.appendChild(buildReformaChangesPanel());

      fullEditTab.addEventListener('click', function () {
        editContentWrap.style.display = 'flex';
        fullClassesPanelWrap.style.display = 'none';
        fullChangesPanelWrap.style.display = 'none';
        fullEditTab.style.color = '#181211';
        fullEditTab.style.borderBottomColor = '#181211';
        fullClassesTab.style.color = 'var(--neutral-600,#675C58)';
        fullClassesTab.style.borderBottomColor = 'transparent';
        fullChangesTab.style.color = 'var(--neutral-600,#675C58)';
        fullChangesTab.style.borderBottomColor = 'transparent';
      });
      fullClassesTab.addEventListener('click', function () {
        editContentWrap.style.display = 'none';
        fullClassesPanelWrap.style.display = 'flex';
        fullChangesPanelWrap.style.display = 'none';
        fullEditTab.style.color = 'var(--neutral-600,#675C58)';
        fullEditTab.style.borderBottomColor = 'transparent';
        fullClassesTab.style.color = '#181211';
        fullClassesTab.style.borderBottomColor = '#181211';
        fullChangesTab.style.color = 'var(--neutral-600,#675C58)';
        fullChangesTab.style.borderBottomColor = 'transparent';
      });
      fullChangesTab.addEventListener('click', function () {
        editContentWrap.style.display = 'none';
        fullClassesPanelWrap.style.display = 'none';
        fullChangesPanelWrap.style.display = 'flex';
        fullChangesPanelWrap.innerHTML = '';
        fullChangesPanelWrap.appendChild(buildReformaChangesPanel());
        fullEditTab.style.color = 'var(--neutral-600,#675C58)';
        fullEditTab.style.borderBottomColor = 'transparent';
        fullClassesTab.style.color = 'var(--neutral-600,#675C58)';
        fullClassesTab.style.borderBottomColor = 'transparent';
        fullChangesTab.style.color = '#181211';
        fullChangesTab.style.borderBottomColor = '#181211';
      });

      wrap.appendChild(editContentWrap);
      wrap.appendChild(fullClassesPanelWrap);
      wrap.appendChild(fullChangesPanelWrap);
    }

    if (!gapMode || !targetEl) {
      wrap.appendChild(row);
    }
  }

  var COMMENT_FONT = "'Google Sans', sans-serif";

  /** Maps a font key (google_sans, shantell, inter, etc.) to a CSS font-family string. */
  function resolvePlaygroundFont(key) {
    switch (key) {
      case 'shantell': return "'Shantell Sans', cursive";
      case 'inter': return "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      case 'roboto': return "'Roboto', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      case 'system': return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      case 'google_sans':
      default:
        return "'Google Sans', sans-serif";
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
    style.textContent =
      '.reforma-playground-color-circle{position:relative;display:block;box-sizing:border-box;flex-shrink:0;width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;max-width:24px!important;max-height:24px!important;padding:0!important;margin:0!important;border:2px solid #CDC8C6!important;border-radius:100px!important;cursor:pointer;overflow:hidden;transition:border-radius 0.2s ease,background 0.2s ease}.reforma-color-swatch-box:hover .reforma-playground-color-circle{border-radius:4px!important;}.reforma-color-swatch-box:hover{background:var(--neutral-100,#F9F6F6)!important;}' +
      '.reforma-playground-color-circle .reforma-playground-color-picker-in-circle{position:absolute!important;top:50%!important;left:50%!important;width:200%!important;height:200%!important;min-width:48px!important;min-height:48px!important;padding:0!important;margin:0!important;border:none!important;border-radius:100px!important;cursor:pointer!important;opacity:0!important;-webkit-appearance:none!important;appearance:none!important;background:transparent!important;transform:translate(-50%,-50%)!important;}.reforma-playground-color-circle .reforma-playground-color-picker-in-circle::-webkit-color-swatch-wrapper,.reforma-playground-color-circle .reforma-playground-color-picker-in-circle::-webkit-color-swatch{padding:0!important;border:none!important;opacity:0!important;background:transparent!important;}.reforma-playground-color-circle .reforma-playground-color-picker-in-circle::-moz-color-swatch{border:none!important;opacity:0!important;background:transparent!important;}' +
      '.reforma-playground-comment, .reforma-playground-comment *:not(.reforma-tt-preview){font-family:\"Google Sans\",system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif!important;}' +
      '@keyframes reforma-gap-stripe-opacity-sweep{0%{-webkit-mask-position:-100% 0;mask-position:-100% 0;}100%{-webkit-mask-position:100% 0;mask-position:100% 0;}}' +
      '.reforma-gap-hover-outline,.reforma-gap-selected-outline{position:fixed;pointer-events:none;z-index:2147483646;border-radius:2px;box-sizing:border-box;border:1px solid rgba(214,67,227,0.28);background-image:repeating-linear-gradient(45deg,rgba(214,67,227,0.32) 0,rgba(214,67,227,0.32) 1px,transparent 1px,transparent 6px);background-size:8.5px 8.5px;-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0.5) 0%,black 25%,black 75%,rgba(0,0,0,0.5) 100%);-webkit-mask-size:200% 100%;-webkit-mask-position:0 0;mask-image:linear-gradient(90deg,rgba(0,0,0,0.5) 0%,black 25%,black 75%,rgba(0,0,0,0.5) 100%);mask-size:200% 100%;mask-position:0 0;animation:reforma-gap-stripe-opacity-sweep 1.2s ease-in-out infinite;}' +
      '.reforma-class-highlight-outline{position:fixed;pointer-events:none;z-index:2147483646;border-radius:2px;box-sizing:border-box;border:none;background:transparent;box-shadow:inset 0 0 0 1px rgba(158,25,140,0.4);}' +
      '.reforma-comment-panel-container{scrollbar-width:none;-ms-overflow-style:none;}.reforma-comment-panel-container::-webkit-scrollbar{display:none;}' +
      '.reforma-comment-panel-container .reforma-preview-box{background:#FFFFFF!important;overflow:hidden!important;}' +
      '.reforma-comment-panel-container .reforma-preview-scaled-wrap{overflow:hidden!important;}' +
      '.reforma-comment-panel-container .reforma-preview-css-pill{background:#F977DF!important;color:#38052E!important;border-radius:4px!important;transition:background 0.15s ease,transform 0.15s ease,box-shadow 0.15s ease,outline 0.15s ease!important;}' +
      '.reforma-comment-panel-container .reforma-preview-css-pill:hover{background:#FFB7E2!important;transform:scale(1.02);box-shadow:0 1px 4px rgba(56,5,46,0.12)!important;}' +
      '.reforma-comment-panel-container .reforma-preview-css-pill.reforma-pill-changed{outline:1px solid #38052E!important;outline-offset:1px!important;}' +
      '.reforma-comment-panel-container .reforma-pill-undo{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:none;border-radius:4px;background:rgba(56,5,46,0.15);color:#38052E;cursor:pointer;flex-shrink:0;transition:background 0.15s ease!important;}' +
      '.reforma-comment-panel-container .reforma-pill-undo:hover{background:rgba(56,5,46,0.3)!important;}' +
      '.reforma-comment-panel-container .reforma-preview-save-btn{background:#D643E3!important;color:#38052E!important;border-color:#D643E3!important;border-radius:4px!important;transition:background 0.15s ease,transform 0.15s ease,box-shadow 0.15s ease!important;}' +
      '.reforma-comment-panel-container .reforma-preview-save-btn:hover{background:#9E198C!important;transform:scale(1.03);box-shadow:0 2px 6px rgba(158,25,140,0.25)!important;}' +
      '.reforma-comment-panel-container .reforma-preview-wrap{background:#F9F6F6!important;border-color:#E6E3E3!important;}' +
      '.reforma-comment-panel-container .reforma-preview-display-select{background:#F977DF!important;color:#38052E!important;border-radius:4px!important;transition:background 0.15s ease!important;}' +
      '.reforma-comment-panel-container .reforma-preview-display-select:hover{background:#FFB7E2!important;}' +
      '.reforma-comment-panel-container .reforma-preview-flex-btn{border-radius:4px!important;transition:background 0.15s ease,color 0.15s ease,border-color 0.15s ease,transform 0.15s ease!important;}' +
      '.reforma-comment-panel-container .reforma-preview-flex-btn:hover{transform:scale(1.04);}' +
      '.reforma-comment-panel-container .reforma-preview-group-header:hover{background:rgba(249,119,223,0.08)!important;}' +
      '.reforma-comment-panel-container .reforma-preview-hover{outline:1px solid rgba(56,5,46,0.45);outline-offset:-1px;border-radius:10px;box-shadow:0 0 0 1px rgba(249,119,223,0.35);background-color:rgba(255,235,254,0.6);transition:outline-color 0.12s ease,box-shadow 0.12s ease,background-color 0.12s ease;}' +
      '.reforma-comment-panel-container .reforma-preview-dragging{opacity:0.85;transform:scale(1.02);box-shadow:0 8px 24px rgba(0,0,0,0.16);transition:transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;cursor:grabbing!important;}' +
      '.reforma-comment-panel-container .reforma-preview-drop-placeholder{border-radius:8px;border:1px dashed rgba(56,5,46,0.35);background:rgba(249,119,223,0.08);margin:4px 0;transition:all 0.15s ease;}' +
      '.reforma-saved-changes-list{scrollbar-width:none;-ms-overflow-style:none;}.reforma-saved-changes-list::-webkit-scrollbar{display:none;}.reforma-chat-preview-text{scrollbar-width:none;-ms-overflow-style:none;}.reforma-chat-preview-text::-webkit-scrollbar{display:none;}';
    document.head.appendChild(style);
  }

  /** Ensures Google Fonts stylesheet (Google Sans, Inter, Roboto, Shantell) is loaded. */
  function ensureFontsLoaded() {
    if (document.getElementById('reforma-playground-fonts')) return;
    var link = document.createElement('link');
    link.id = 'reforma-playground-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Shantell+Sans:wght@400;700&family=Google+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  /** Ensures Google Sans (and other playground fonts) are loaded. */
  function ensureGoogleSansLoaded() {
    ensureFontsLoaded();
  }

  /** Gets or creates the main overlay container for comments. */
  function getContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (!el) {
      ensurePlaygroundStyles();
      ensureGoogleSansLoaded();
      el = document.createElement('div');
      el.id = CONTAINER_ID;
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;';
      document.body.appendChild(el);
    }
    return el;
  }

  /** Updates selection and class-highlight outlines to match current element rects (e.g. after margin/padding/size changes). */
  function updateSelectionOutline() {
    var hl = document.getElementById(HIGHLIGHT_LAYER_ID);
    if (!hl) return;
    var el = currentGapTarget || (currentGapBatchElements && currentGapBatchElements[0]);
    if (currentGapOutline && el && el.isConnected) {
      var rect = el.getBoundingClientRect();
      currentGapOutline.style.left = rect.left + 'px';
      currentGapOutline.style.top = rect.top + 'px';
      currentGapOutline.style.width = rect.width + 'px';
      currentGapOutline.style.height = rect.height + 'px';
    }
    for (var i = 0; i < currentClassHighlightOutlines.length; i++) {
      var target = currentClassHighlightElements[i];
      var outline = currentClassHighlightOutlines[i];
      if (target && target.isConnected && outline && outline.parentNode) {
        var r = target.getBoundingClientRect();
        outline.style.left = r.left + 'px';
        outline.style.top = r.top + 'px';
        outline.style.width = r.width + 'px';
        outline.style.height = r.height + 'px';
      }
    }
  }

  /** Injects keyframes for the animated purple border. */
  function ensureReformaBorderAnimation() {
    if (document.getElementById('reforma-border-animation-style')) return;
    var style = document.createElement('style');
    style.id = 'reforma-border-animation-style';
    style.textContent = '@keyframes reforma-border-pulse{0%{box-shadow:inset 0 -8px 24px 4px rgba(214,67,227,0.6),inset 8px 0 24px 4px rgba(214,67,227,0.2),inset 0 8px 24px 4px rgba(214,67,227,0.2),inset -8px 0 24px 4px rgba(214,67,227,0.2);}25%{box-shadow:inset 0 -8px 24px 4px rgba(214,67,227,0.2),inset 8px 0 24px 4px rgba(214,67,227,0.6),inset 0 8px 24px 4px rgba(214,67,227,0.2),inset -8px 0 24px 4px rgba(214,67,227,0.2);}50%{box-shadow:inset 0 -8px 24px 4px rgba(214,67,227,0.2),inset 8px 0 24px 4px rgba(214,67,227,0.2),inset 0 8px 24px 4px rgba(214,67,227,0.6),inset -8px 0 24px 4px rgba(214,67,227,0.2);}75%{box-shadow:inset 0 -8px 24px 4px rgba(214,67,227,0.2),inset 8px 0 24px 4px rgba(214,67,227,0.2),inset 0 8px 24px 4px rgba(214,67,227,0.2),inset -8px 0 24px 4px rgba(214,67,227,0.6);}100%{box-shadow:inset 0 -8px 24px 4px rgba(214,67,227,0.6),inset 8px 0 24px 4px rgba(214,67,227,0.2),inset 0 8px 24px 4px rgba(214,67,227,0.2),inset -8px 0 24px 4px rgba(214,67,227,0.2);}}';
    document.head.appendChild(style);
  }

  /** Creates overlay and highlight layer elements needed for Gap mode. */
  function ensureGapModeLayers() {
    var container = getContainer();
    if (!overlayDiv || !document.getElementById(OVERLAY_ID)) {
      overlayDiv = document.createElement('div');
      overlayDiv.id = OVERLAY_ID;
      overlayDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483645;pointer-events:auto;box-sizing:border-box;touch-action:pan-y;';
      container.appendChild(overlayDiv);
    }
    var hl = document.getElementById(HIGHLIGHT_LAYER_ID);
    if (!hl) {
      hl = document.createElement('div');
      hl.id = HIGHLIGHT_LAYER_ID;
      hl.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483646;pointer-events:none;box-sizing:border-box;';
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

  /** Toggle visibility of applied changes (hide = revert to original, show = reapply). */
  function toggleChangesVisibility() {
    changesVisible = !changesVisible;
    var keys = ['fontFamily', 'color', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing', 'backgroundColor'];
    if (changesVisible) {
      hiddenChangesCache.forEach(function (cached, el) {
        if (!el || !el.isConnected) return;
        keys.forEach(function (key) {
          if (cached[key] !== undefined) el.style[key] = cached[key] || '';
        });
      });
      hiddenChangesCache.clear();
    } else {
      originalStyles.forEach(function (orig, el) {
        if (!el || !el.isConnected) return;
        var cs = window.getComputedStyle(el);
        var cached = {};
        keys.forEach(function (key) {
          var computedKey = key === 'fontFamily' ? 'fontFamily' : key === 'fontWeight' ? 'fontWeight' : key === 'fontSize' ? 'fontSize' : key === 'lineHeight' ? 'lineHeight' : key === 'letterSpacing' ? 'letterSpacing' : key;
          var val = el.style[key] || (key === 'backgroundColor' ? cs.backgroundColor : cs[computedKey]) || '';
          cached[key] = val;
          var origVal = orig[key];
          if (key === 'backgroundColor' && origVal === undefined) origVal = '';
          el.style[key] = origVal !== undefined ? (origVal || '') : '';
        });
        hiddenChangesCache.set(el, cached);
      });
    }
    updateChangesVisibilityToggleIcon();
  }

  function updateChangesVisibilityToggleIcon() {
    var btn = document.getElementById(CHANGES_TOGGLE_ID);
    if (!btn) return;
    btn.innerHTML = '';
    var ic = createMaterialIcon(changesVisible ? 'visibility' : 'visibility_off', 22, '#fff');
    btn.appendChild(ic);
    btn.setAttribute('aria-label', changesVisible ? 'Hide changes' : 'Show changes');
  }

  /** Creates the center-of-screen hide/show changes toggle (icon only). */
  function ensureChangesVisibilityToggle() {
    var container = getContainer();
    var btn = document.getElementById(CHANGES_TOGGLE_ID);
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = CHANGES_TOGGLE_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', changesVisible ? 'Hide changes' : 'Show changes');
    btn.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483646;width:44px;height:44px;padding:0;border:none;border-radius:50%;background:rgba(0,0,0,0.75);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;pointer-events:auto;box-shadow:0 2px 12px rgba(0,0,0,0.3);transition:opacity 0.2s,background 0.2s;';
    btn.addEventListener('mouseenter', function () { btn.style.background = 'rgba(158,25,140,0.9)'; });
    btn.addEventListener('mouseleave', function () { btn.style.background = 'rgba(0,0,0,0.75)'; });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleChangesVisibility();
    });
    var ic = createMaterialIcon(changesVisible ? 'visibility' : 'visibility_off', 22, '#fff');
    btn.appendChild(ic);
    container.appendChild(btn);
    return btn;
  }

  function removeChangesVisibilityToggle() {
    var btn = document.getElementById(CHANGES_TOGGLE_ID);
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  }

  /** Returns formatted string of all changes for copy. Only includes current selection. */
  function getAllChangesFormatted() {
    var lines = [];
    lines.push('Reforma – Changes applied');
    lines.push('URL: ' + (window.location.href || ''));
    lines.push('');
    var currentTargets = (currentGapBatchElements && currentGapBatchElements.length) ? currentGapBatchElements : (currentGapTarget ? [currentGapTarget] : []);
    originalStyles.forEach(function (orig, el) {
      if (!el || !el.isConnected || currentTargets.indexOf(el) < 0) return;
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

  /** Returns changes formatted as a single text prompt for a chatbot. Only includes current selection. */
  function getChangesAsChatPrompt() {
    var lines = [];
    lines.push('Implement the following CSS changes on this page.');
    lines.push('URL: ' + (window.location.href || ''));
    lines.push('');
    lines.push('Apply these styles to the matching elements:');
    lines.push('');
    var currentTargets = (currentGapBatchElements && currentGapBatchElements.length) ? currentGapBatchElements : (currentGapTarget ? [currentGapTarget] : []);
    originalStyles.forEach(function (orig, el) {
      if (!el || !el.isConnected || currentTargets.indexOf(el) < 0) return;
      var changes = getGapModeChanges(el);
      if (changes.length === 0) return;
      var tag = (el.tagName || '').toLowerCase();
      var classes = (el.className || '').toString().trim();
      var selector = tag + (classes ? '.' + classes.split(/\s+/).join('.') : '');
      lines.push('Selector: ' + selector);
      changes.forEach(function (r) {
        var prop = r.property || r.label.toLowerCase().replace(/\s+/g, '-');
        lines.push('  ' + prop + ': ' + (r.after || '(default)'));
      });
      lines.push('');
    });
    lines.push('Apply these CSS rules to the page. You can add a <style> block or update existing stylesheets.');
    return lines.length > 5 ? lines.join('\n') : 'No changes yet. Paste this in a chat to implement.';
  }

  /** Populates the changes drawer with current changes. Only shows current selection. */
  function populateChangesDrawer() {
    var drawer = document.getElementById(CHANGES_DRAWER_ID);
    if (!drawer) return;
    var list = drawer.querySelector('.reforma-changes-list');
    if (!list) return;
    list.innerHTML = '';
    var hasChanges = false;
    var currentTargets = (currentGapBatchElements && currentGapBatchElements.length) ? currentGapBatchElements : (currentGapTarget ? [currentGapTarget] : []);
    originalStyles.forEach(function (orig, el) {
      if (!el || !el.isConnected || currentTargets.indexOf(el) < 0) return;
      var changes = getGapModeChanges(el);
      if (changes.length === 0) return;
      hasChanges = true;
      var tag = (el.tagName || '').toLowerCase();
      var classes = (el.className || '').toString().trim();
      var section = document.createElement('div');
      section.style.cssText = 'margin-bottom:12px;padding:8px;background:rgba(0,0,0,0.04);border-radius:6px;font-size:11px;';
      var header = document.createElement('div');
      header.style.cssText = 'font-weight:600;color:#181211;margin-bottom:6px;';
      // Short human-readable summary instead of raw tag/class
      var uniqueLabels = [];
      changes.forEach(function (r) {
        if (r && r.label && uniqueLabels.indexOf(r.label) === -1) uniqueLabels.push(r.label);
      });
      var summary = uniqueLabels.length
        ? ('Updated ' + uniqueLabels.join(', '))
        : 'Updated styles';
      if (tag) summary += ' for <' + tag + '>';
      header.textContent = summary;
      section.appendChild(header);
      changes.forEach(function (r) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;color:#181211;';
        var text = document.createElement('span');
        text.style.flex = '1';
        text.style.minWidth = '0';
        text.innerHTML = '<strong>' + escapeHtml(r.label) + ':</strong> <span style="color:#6c757d;">' + escapeHtml(r.before || '(default)') + '</span> → <span style="color:#20C997;">' + escapeHtml(r.after || '(default)') + '</span>';
        row.appendChild(text);
        var copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copy';
        copyBtn.style.cssText = 'flex-shrink:0;padding:4px 8px;font-size:10px;font-weight:600;font-family:' + COMMENT_FONT + ';border:1px solid #D643E3;border-radius:4px;background:#FFE5F2;color:#9E198C;cursor:pointer;';
        var cssCode = (r.property || '') + ': ' + (r.after || '(default)');
        copyBtn.addEventListener('click', function () {
          navigator.clipboard.writeText(cssCode).then(function () {
            copyBtn.textContent = 'Copied!';
            copyBtn.style.background = '#20C997';
            copyBtn.style.color = '#fff';
            copyBtn.style.borderColor = '#20C997';
            setTimeout(function () {
              copyBtn.textContent = 'Copy';
              copyBtn.style.background = '#FFE5F2';
              copyBtn.style.color = '#9E198C';
              copyBtn.style.borderColor = '#D643E3';
            }, 1200);
          });
        });
        row.appendChild(copyBtn);
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
    if (!isOpen) populateChangesDrawer();
  }

  /** Creates the changes side drawer and adds toggle to pill. */
  function ensureChangesDrawer() {
    if (document.getElementById(CHANGES_DRAWER_ID)) return;
    var drawer = document.createElement('div');
    drawer.id = CHANGES_DRAWER_ID;
    drawer.setAttribute('data-open', 'false');
    drawer.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:280px;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,0.15);z-index:2147483648;display:flex;flex-direction:column;font-family:' + COMMENT_FONT + ';transform:translateX(100%);transition:transform 0.25s ease;';
    drawer.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #E6E3E3;"><span style="font-weight:600;font-size:14px;color:#181211;">History</span><button type="button" class="reforma-drawer-close" style="width:28px;height:28px;padding:0;border:none;border-radius:50%;background:rgba(0,0,0,0.08);cursor:pointer;font-size:18px;line-height:1;">×</button></div><div class="reforma-changes-list" style="flex:1;overflow-y:auto;padding:12px;"></div><div style="display:flex;flex-direction:column;gap:8px;margin:0 16px 12px;"><button type="button" class="reforma-drawer-copy" style="padding:10px 16px;font-size:12px;font-weight:600;font-family:' + COMMENT_FONT + ';border:1px solid #D643E3;border-radius:6px;background:#FFE5F2;color:#9E198C;cursor:pointer;">Copy</button></div>';
    document.body.appendChild(drawer);
    drawer.querySelector('.reforma-drawer-close').addEventListener('click', toggleChangesDrawer);
    drawer.querySelector('.reforma-drawer-copy').addEventListener('click', function () {
      var text = getAllChangesFormatted();
      navigator.clipboard.writeText(text).then(function () {
        var btn = drawer.querySelector('.reforma-drawer-copy');
        btn.textContent = 'Copied!';
        btn.style.background = '#20C997';
        btn.style.color = '#fff';
        btn.style.borderColor = '#20C997';
        setTimeout(function () {
          btn.textContent = 'Copy';
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
      try {
        document.body.style.marginRight = '';
      } catch (e2) {}
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

  /** Returns 'text' | 'image/video' | 'icons' for a selector (type + name). */
  function categorizeSelector(type, name) {
    var n = (name || '').toLowerCase();
    if (type === 'tag') {
      if (/^(img|video|picture|source|canvas)$/.test(n)) return 'image/video';
      if (n === 'svg') return 'icons';
      return 'text';
    }
    if (/icon|ico\b/.test(n)) return 'icons';
    if (/img|image|photo|picture|video|media|poster|thumb|avatar/.test(n)) return 'image/video';
    return 'text';
  }

  /** Returns usage bucket: container | button | header | link | nav | footer | image | icon | other. */
  function getSelectorUsage(type, name) {
    var n = (name || '').toLowerCase();
    var tag = type === 'tag' ? n : '';
    if (/^(button|btn)$/.test(tag) || /\b(btn|button)\b/.test(n)) return 'button';
    if (/^(header|h[1-6])$/.test(tag) || /\b(header|heading|title)\b/.test(n)) return 'header';
    if (tag === 'a' || /\blink\b/.test(n)) return 'link';
    if (tag === 'nav' || /\b(nav|menu)\b/.test(n)) return 'nav';
    if (tag === 'footer' || /\bfooter\b/.test(n)) return 'footer';
    if (/^(img|video|picture|canvas)$/.test(tag) || /\b(img|image|photo|video|media)\b/.test(n)) return 'image';
    if (tag === 'svg' || /\bicon\b/.test(n)) return 'icon';
    if (/^(div|section|main|article|aside)$/.test(tag) || /\b(container|wrapper|box|section)\b/.test(n)) return 'container';
    return 'other';
  }

  /** Returns color kind from first element: none | text | background | both. */
  function getSelectorColorKind(type, name) {
    var els = getElementsBySelector(type, name);
    if (!els.length) return 'none';
    var cs = window.getComputedStyle(els[0]);
    var color = (cs.color || '').toString().toLowerCase();
    var bg = (cs.backgroundColor || '').toString().toLowerCase();
    var hasText = color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent' && color !== 'inherit';
    var hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    if (hasText && hasBg) return 'both';
    if (hasText) return 'text';
    if (hasBg) return 'background';
    return 'none';
  }

  /** Returns tag name for selector (for type=tag the name; for class, first element's tagName lowercased). */
  function getSelectorTag(type, name) {
    if (type === 'tag') return (name || '').toLowerCase();
    var els = getElementsBySelector(type, name);
    if (!els.length) return 'div';
    return ((els[0].tagName || '') + '').toLowerCase();
  }

  /** Returns flat list of selectors with typeCat, usage, colorKind, tag; and array of unique tags. */
  function getTopSelectorsEnriched(limitPerCategory) {
    var byCat = getTopSelectorsByCategory(limitPerCategory);
    var items = [];
    var tagSet = {};
    var sectionOrder = ['text', 'image/video', 'icons'];
    sectionOrder.forEach(function (cat) {
      (byCat[cat] || []).forEach(function (item) {
        var typeCat = categorizeSelector(item.type, item.name);
        var usage = getSelectorUsage(item.type, item.name);
        var colorKind = getSelectorColorKind(item.type, item.name);
        var tag = getSelectorTag(item.type, item.name);
        items.push({ type: item.type, name: item.name, count: item.count, typeCat: typeCat, usage: usage, colorKind: colorKind, tag: tag });
        tagSet[tag] = true;
      });
    });
    var tags = Object.keys(tagSet).sort();
    return { items: items, tags: tags };
  }

  /** Returns top selectors (classes and tags) grouped by category: { text: [], 'image/video': [], icons: [] }. Up to limitPerCategory per group. */
  function getTopSelectorsByCategory(limitPerCategory) {
    limitPerCategory = limitPerCategory || 10;
    var container = document.getElementById(CONTAINER_ID);
    var classCounts = {};
    var tagCounts = {};
    var totalElements = 0;
    function walk(root) {
      if (!root || root === container || (container && container.contains(root))) return;
      if (root.nodeType !== 1) return;
      totalElements++;
      var tag = (root.tagName || '').toLowerCase();
      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      var cls = (root.className && typeof root.className === 'string') ? root.className.trim() : '';
      if (cls) {
        cls.split(/\s+/).forEach(function (c) {
          c = c.trim();
          if (c && c.indexOf('reforma') === -1) classCounts[c] = (classCounts[c] || 0) + 1;
        });
      }
      for (var i = 0; i < (root.children ? root.children.length : 0); i++) walk(root.children[i]);
    }
    walk(document.body);
    var maxClassCount = Math.max(100, Math.floor(totalElements * 0.4));
    var combined = Object.keys(classCounts)
      .filter(function (c) { return classCounts[c] <= maxClassCount; })
      .map(function (c) {
        return { type: 'class', name: c, count: classCounts[c] };
      }).concat(Object.keys(tagCounts).map(function (t) {
        return { type: 'tag', name: t, count: tagCounts[t] };
      }));
    combined.sort(function (a, b) { return b.count - a.count; });
    var out = { text: [], 'image/video': [], icons: [] };
    var taken = { text: 0, 'image/video': 0, icons: 0 };
    for (var i = 0; i < combined.length; i++) {
      var item = combined[i];
      var cat = categorizeSelector(item.type, item.name);
      if (taken[cat] < limitPerCategory) {
        out[cat].push(item);
        taken[cat]++;
      }
    }
    return out;
  }

  /** Returns top N selectors (classes and tags) by usage count on the page, excluding playground UI. Excludes classes that appear on too many elements (>40% of page or >100 elements). */
  function getTopSelectorsFromPage(limit) {
    limit = limit || 10;
    var byCat = getTopSelectorsByCategory(limit);
    return byCat.text.concat(byCat['image/video']).concat(byCat.icons);
  }

  /** Returns preview styles (font, weight, color, bg) from first matching element for Classes panel. No size. */
  function getSelectorPreviewStyles(type, name) {
    var elements = getElementsBySelector(type, name);
    if (!elements.length) return null;
    var cs = window.getComputedStyle(elements[0]);
    var fontFamily = (cs.fontFamily || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'inherit';
    return {
      fontFamily: fontFamily,
      fontWeight: cs.fontWeight || '400',
      color: cs.color || 'currentColor',
      backgroundColor: cs.backgroundColor || 'transparent'
    };
  }

  /** Short preview text for Classes card: font, weight, color, bg (no size). */
  function formatSelectorPreviewText(type, name) {
    var s = getSelectorPreviewStyles(type, name);
    if (!s) return '';
    return s.fontFamily + ' ' + s.fontWeight + ' ' + s.color + ' ' + s.backgroundColor;
  }

  /** Formats selector for Classes panel: tag/class + font family + weight + size. e.g. "<div> TwitterChirp 400 15px" */
  function formatSelectorLabel(type, name) {
    var elements = getElementsBySelector(type, name);
    var tagOrClass = type === 'class' ? '.' + name : '<' + name + '>';
    if (!elements.length) return tagOrClass;
    var el = elements[0];
    var cs = window.getComputedStyle(el);
    var fontFamily = (cs.fontFamily || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'inherit';
    var weight = cs.fontWeight || '400';
    var size = cs.fontSize || '16px';
    return tagOrClass + ' ' + fontFamily + ' ' + weight + ' ' + size;
  }

  /** Categorizes a single element by type (text | image/video | icons) and layout (block | flex | grid | inline | inline-block | other). */
  function categorizeElement(el) {
    if (!el || el.nodeType !== 1) return { typeCat: 'text', layoutCat: 'other' };
    var tag = (el.tagName || '').toLowerCase();
    var typeCat = 'text';
    if (/^(img|video|picture|source|canvas)$/.test(tag)) typeCat = 'image/video';
    else if (tag === 'svg') typeCat = 'icons';
    else {
      var cls = (el.className && typeof el.className === 'string') ? el.className : '';
      var n = (cls + ' ' + tag).toLowerCase();
      if (/icon|ico\b/.test(n)) typeCat = 'icons';
      else if (/img|image|photo|picture|video|media|poster|thumb|avatar/.test(n)) typeCat = 'image/video';
    }
    var layoutCat = 'other';
    try {
      var display = (window.getComputedStyle(el).display || '').toLowerCase();
      if (display === 'flex' || display === 'inline-flex') layoutCat = 'flex';
      else if (display === 'grid' || display === 'inline-grid') layoutCat = 'grid';
      else if (display === 'block') layoutCat = 'block';
      else if (display === 'inline-block') layoutCat = 'inline-block';
      else if (display === 'inline') layoutCat = 'inline';
      else if (display) layoutCat = display.indexOf('flex') >= 0 ? 'flex' : display.indexOf('grid') >= 0 ? 'grid' : display;
    } catch (e) {}
    return { typeCat: typeCat, layoutCat: layoutCat };
  }

  /** Returns elements matching the selector (class or tag), excluding playground UI. */
  function getElementsBySelector(selectorType, name) {
    var container = document.getElementById(CONTAINER_ID);
    var list;
    if (selectorType === 'tag') {
      try { list = document.querySelectorAll(name); } catch (e) { return []; }
    } else {
      var escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(name) : (name || '').replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
      try { list = document.querySelectorAll('.' + escaped); } catch (e) { return []; }
    }
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (container && (el === container || container.contains(el))) continue;
      out.push(el);
    }
    return out;
  }

  /** Highlights all elements matching the selector (class or tag). Optionally switches to Edit. */
  function highlightElementsBySelector(selectorType, name, showEditFn) {
    clearClassHighlights();
    if (currentGapOutline && currentGapOutline.parentNode) {
      currentGapOutline.parentNode.removeChild(currentGapOutline);
    }
    currentGapOutline = null;
    var container = document.getElementById(CONTAINER_ID);
    var list;
    if (selectorType === 'tag') {
      try { list = document.querySelectorAll(name); } catch (e) { return; }
    } else {
      var escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(name) : (name || '').replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
      try { list = document.querySelectorAll('.' + escaped); } catch (e) { return; }
    }
    currentClassHighlightElements.length = 0;
    var hl = document.getElementById(HIGHLIGHT_LAYER_ID);
    if (!hl) return;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (container && (el === container || container.contains(el))) continue;
      if (!el.getBoundingClientRect) continue;
      var rect = el.getBoundingClientRect();
      var outline = document.createElement('div');
      outline.className = 'reforma-class-highlight-outline';
      outline.setAttribute('data-reforma-type', 'class-highlight');
      outline.style.left = rect.left + 'px';
      outline.style.top = rect.top + 'px';
      outline.style.width = rect.width + 'px';
      outline.style.height = rect.height + 'px';
      hl.appendChild(outline);
      currentClassHighlightOutlines.push(outline);
      currentClassHighlightElements.push(el);
    }
    if (showEditFn) showEditFn();
  }

  function clearClassHighlights() {
    currentClassHighlightOutlines.forEach(function (o) {
      if (o && o.parentNode) o.parentNode.removeChild(o);
    });
    currentClassHighlightOutlines.length = 0;
    currentClassHighlightElements.length = 0;
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
    // Clear transient hover UI but keep the persistent selected outline and class highlights.
    Array.from(hl.children).forEach(function (node) {
      if (node !== currentGapOutline && node.getAttribute('data-reforma-type') !== 'class-highlight') {
        hl.removeChild(node);
      }
    });
    var el = getElementUnderPoint(x, y);
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var s = window.getComputedStyle(el);
    // Hover state: dotted outline with animated line, separate from the persistent selected outline.
    var hoverOutline = document.createElement('div');
    hoverOutline.className = 'reforma-gap-hover-outline';
    hoverOutline.style.left = rect.left + 'px';
    hoverOutline.style.top = rect.top + 'px';
    hoverOutline.style.width = rect.width + 'px';
    hoverOutline.style.height = rect.height + 'px';
    hl.appendChild(hoverOutline);
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

  /** Stores current body/html styles. Page is never frozen (no overflow/position applied). */
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
    /* Do not set overflow hidden or position fixed – keep page scrollable. */
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

  /** Builds the History tab content with reference-style formatting (icon, description, snippet, actions). */
  function buildReformaChangesPanel() {
    var panel = document.createElement('div');
    panel.className = 'reforma-changes-tab-panel';
    panel.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;font-family:' + COMMENT_FONT + ';';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
    var title = document.createElement('span');
    title.style.cssText = 'font-size:15px;font-weight:700;color:#181211;';
    title.textContent = 'History';
    var currentTargets = (currentGapBatchElements && currentGapBatchElements.length) ? currentGapBatchElements : (currentGapTarget ? [currentGapTarget] : []);
    var badge = document.createElement('span');
    badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--neutral-200,#E6E3E3);font-size:11px;font-weight:700;color:var(--neutral-700,#504645);';
    badge.textContent = '0';
    header.appendChild(title);
    header.appendChild(badge);
    panel.appendChild(header);

    var list = document.createElement('div');
    list.className = 'reforma-saved-changes-list';
    list.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:0;';

    var hasAny = false;
    var allEntries = [];
    originalStyles.forEach(function (orig, el) {
      if (!el || !el.isConnected || currentTargets.indexOf(el) < 0) return;
      var changes = getGapModeChanges(el);
      if (changes.length === 0) return;
      hasAny = true;
      changes.forEach(function (r) {
        allEntries.push({ el: el, orig: orig, r: r });
      });
    });

    function hasAncestorWithSameChange(el, key, after) {
      var p = el.parentElement;
      while (p) {
        if (currentTargets.indexOf(p) >= 0) {
          var ancChanges = getGapModeChanges(p);
          for (var i = 0; i < ancChanges.length; i++) {
            if (ancChanges[i].key === key && String(ancChanges[i].after || '').trim() === String(after || '').trim()) return true;
          }
        }
        p = p.parentElement;
      }
      return false;
    }

    var filteredEntries = allEntries.filter(function (entry) {
      return !hasAncestorWithSameChange(entry.el, entry.r.key, entry.r.after);
    });

    // Collapse by unique change (key|after): keep only parent (topmost) per change
    var changeKeyToEntries = {};
    filteredEntries.forEach(function (entry) {
      var k = (entry.r.key || '') + '|' + (entry.r.after || '');
      if (!changeKeyToEntries[k]) changeKeyToEntries[k] = [];
      changeKeyToEntries[k].push(entry);
    });

    function findTopmost(entries) {
      for (var i = 0; i < entries.length; i++) {
        var candidate = entries[i];
        var isTopmost = true;
        for (var j = 0; j < entries.length; j++) {
          if (i !== j && entries[j].el.contains(candidate.el) && entries[j].el !== candidate.el) {
            isTopmost = false;
            break;
          }
        }
        if (isTopmost) return candidate;
      }
      return entries[0];
    }

    var uniqueItems = [];
    Object.keys(changeKeyToEntries).forEach(function (k) {
      var entries = changeKeyToEntries[k];
      var parent = findTopmost(entries);
      var revertList = entries.map(function (e) { return { el: e.el, orig: e.orig }; });
      uniqueItems.push({ r: parent.r, revertList: revertList });
    });

    var uniqueChangeCount = uniqueItems.length;

    uniqueItems.forEach(function (entry) {
      var r = entry.r;
      var revertList = entry.revertList;
      var item = document.createElement('div');
      item.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:12px 0;padding-left:12px;border-left:3px solid rgba(158,25,140,0.2);margin-left:0;border-bottom:1px solid var(--neutral-200,#E6E3E3);';
      var topRow = document.createElement('div');
      topRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
      var iconBar = document.createElement('div');
      iconBar.style.cssText = 'width:4px;min-width:4px;height:32px;border-radius:2px;background:#D643E3;flex-shrink:0;';
      var descWrap = document.createElement('div');
      descWrap.style.cssText = 'flex:1;min-width:0;';
      var desc = document.createElement('div');
      desc.style.cssText = 'font-size:12px;font-weight:600;color:#181211;';
      desc.textContent = r.label + ' · ' + (r.after || '(default)');
      descWrap.appendChild(desc);
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.style.cssText = 'width:28px;height:28px;min-width:28px;min-height:28px;padding:0;border:none;border-radius:50%;background:var(--neutral-200,#E6E3E3);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
      copyBtn.appendChild(createMaterialIcon('copy', 14, 'var(--neutral-300,#CDC8C6)'));
      copyBtn.setAttribute('title', 'Copy');
      copyBtn.addEventListener('click', function () {
        var css = (r.property || '') + ': ' + (r.after || '');
        navigator.clipboard.writeText(css).then(function () {
          var ic = copyBtn.querySelector('svg');
          if (ic) ic.style.color = '#20C997';
          setTimeout(function () { if (ic) ic.style.color = 'var(--neutral-300,#CDC8C6)'; }, 1200);
        });
      });
      topRow.appendChild(iconBar);
      topRow.appendChild(descWrap);
      topRow.appendChild(copyBtn);
      item.appendChild(topRow);
      var actions = document.createElement('div');
      actions.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
      var revertBtn = document.createElement('button');
      revertBtn.type = 'button';
      revertBtn.textContent = 'Revert';
      revertBtn.style.cssText = 'padding:0;font-size:11px;font-weight:600;font-family:' + COMMENT_FONT + ';border:none;background:transparent;color:var(--neutral-600,#675C58);cursor:pointer;text-decoration:underline;';
      revertBtn.addEventListener('click', function () {
        revertList.forEach(function (x) {
          if (x.el && x.el.isConnected && x.orig && x.orig[r.key] !== undefined) {
            x.el.style[r.key] = x.orig[r.key] || '';
          }
        });
        item.remove();
        var c = parseInt(badge.textContent, 10) - 1;
        badge.textContent = String(Math.max(0, c));
      });
      actions.appendChild(revertBtn);
      item.appendChild(actions);
      list.appendChild(item);
    });
    badge.textContent = String(uniqueChangeCount);

    if (!hasAny) {
      var empty = document.createElement('p');
      empty.style.cssText = 'font-size:13px;color:var(--neutral-600,#675C58);margin:0;padding:24px 0;';
      empty.textContent = 'No changes yet. Edit an element to see changes.';
      list.appendChild(empty);
    }

    panel.appendChild(list);

    return panel;
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
    var labels = { fontFamily: 'Changed font', color: 'Changed color', fontWeight: 'Changed font weight', fontSize: 'Changed font size', lineHeight: 'Changed line height', letterSpacing: 'Changed letter spacing' };
    var props = { fontFamily: 'font-family', color: 'color', fontWeight: 'font-weight', fontSize: 'font-size', lineHeight: 'line-height', letterSpacing: 'letter-spacing' };
    ['fontFamily', 'color', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing'].forEach(function (key) {
      var b = (orig[key] || '').toString().trim();
      var a = (curr[key] || '').toString().trim();
      if (b !== a) rows.push({ key: key, label: labels[key], property: props[key], before: b || '(default)', after: a || '(default)' });
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
    var baseStyle;
    if (gapMode) {
      // In Gap mode, show the playground as a fixed sidebar on the right,
      // similar to the Changes drawer instead of a floating bubble.
      baseStyle =
        'position:fixed;top:0;right:0;bottom:0;width:320px;min-width:260px;max-width:360px;' +
        'background:#F9F6F6;color:#181211;padding:8px 12px 10px 12px;' +
        'box-shadow:-4px 0 20px rgba(0,0,0,0.18);border:none;z-index:2147483647;' +
        'font-family:' + COMMENT_FONT + ';font-weight:500;font-size:12px;' +
        'pointer-events:auto;overflow:hidden;box-sizing:border-box;' +
        'display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch;gap:4px;' +
        'max-width:calc(100vw - 24px);transform-origin:top right;opacity:0;' +
        'transform:translateX(12px);transition:opacity 160ms ease-out,transform 160ms cubic-bezier(0.16,1,0.3,1);';
    } else {
      baseStyle =
        'position:fixed;left:' + x + 'px;top:' + y + 'px;min-width:180px;max-width:300px;' +
        'background:rgba(255,255,255,0.98);color:#181211;padding:6px 8px 8px 8px;border-radius:8px;' +
        'box-shadow:0 2px 10px rgba(0,0,0,0.18);border:none;z-index:2147483646;font-family:' + COMMENT_FONT + ';' +
        'font-weight:500;font-size:12px;pointer-events:auto;overflow:hidden;box-sizing:border-box;' +
        'max-width:calc(100vw - 24px);max-height:420px;transform-origin:top left;opacity:0;' +
        'transform:translateY(4px) scale(0.96);transition:opacity 160ms ease-out,transform 160ms cubic-bezier(0.16,1,0.3,1);';
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

    container.appendChild(wrap);

    if (gapMode) {
      currentGapComment = wrap;
    }

    var clickX = x;
    var clickY = y;

    // Position correction (keep on-screen) + animate comment in from the cursor.
    requestAnimationFrame(function () {
      // Sidebar mode: no cursor-based repositioning, just fade/slide in.
      if (gapMode) {
        wrap.style.opacity = '1';
        wrap.style.transform = 'translateX(0) translateZ(0)';
        return;
      }
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
      wrap.style.transform = 'translateY(0) translateZ(0) scale(1)';
    });

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
      clearClassHighlights();
      currentGapBatchElements = null;
      currentGapBatchLabel = null;
      targetEl = getElementUnderPoint(e.clientX, e.clientY);
      if (targetEl) {
        gapDetails = getBoxModelDetails(targetEl);
        currentGapTarget = targetEl;
        // Create / update a persistent animated dotted outline around the selected element.
        var hl = document.getElementById(HIGHLIGHT_LAYER_ID);
        if (hl) {
          if (currentGapOutline && currentGapOutline.parentNode) {
            currentGapOutline.parentNode.removeChild(currentGapOutline);
          }
          var rect = targetEl.getBoundingClientRect();
          var outline = document.createElement('div');
          outline.className = 'reforma-gap-selected-outline';
          outline.style.left = rect.left + 'px';
          outline.style.top = rect.top + 'px';
          outline.style.width = rect.width + 'px';
          outline.style.height = rect.height + 'px';
          hl.appendChild(outline);
          currentGapOutline = outline;
        }
      }
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
      ensureGapModeLayers();
      container.style.background = '';
      container.style.border = '';
      overlayDiv = document.getElementById(OVERLAY_ID);
      if (overlayDiv) {
        overlayDiv.style.background = 'transparent';
        overlayDiv.style.border = 'none';
        overlayDiv.style.boxSizing = 'border-box';
        ensureReformaBorderAnimation();
        overlayDiv.style.animation = 'reforma-border-pulse 3s linear infinite';
      }
      gapMoveHandler = function (ev) { updateGapHighlight(ev.clientX, ev.clientY); };
      gapWheelHandler = function (e) {
        var dy = e.deltaY;
        var target = document.elementFromPoint(e.clientX, e.clientY);
        var scrollEl = null;
        while (target && target !== document.body) {
          var style = window.getComputedStyle(target);
          var ox = style.overflowX;
          var oy = style.overflowY;
          var overflow = style.overflow;
          var canScroll = (oy === 'auto' || oy === 'scroll' || overflow === 'auto' || overflow === 'scroll') && target.scrollHeight > target.clientHeight;
          if (canScroll) {
            scrollEl = target;
            break;
          }
          target = target.parentElement;
        }
        if (scrollEl) {
          scrollEl.scrollTop += dy;
        } else {
          var root = document.scrollingElement || document.documentElement || document.body;
          if (root) root.scrollTop += dy;
          else window.scrollBy(0, dy);
        }
      };
      if (overlayDiv) {
        overlayDiv.addEventListener('mousemove', gapMoveHandler, true);
        overlayDiv.addEventListener('wheel', gapWheelHandler, { passive: true });
      }
      container.addEventListener('click', onOverlayClick, true);
      createComment(0, 0, null, null, 'right');
      ensureChangesVisibilityToggle();
    } else {
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
      currentGapTarget = null;
      currentGapBatchElements = null;
      currentGapBatchLabel = null;
      clearClassHighlights();
      if (currentGapOutline && currentGapOutline.parentNode) {
        currentGapOutline.parentNode.removeChild(currentGapOutline);
      }
      currentGapOutline = null;
      var cont = document.getElementById(CONTAINER_ID);
      if (cont) {
        var ov = document.getElementById(OVERLAY_ID);
        if (ov) {
          if (gapMoveHandler) ov.removeEventListener('mousemove', gapMoveHandler, true);
          if (gapWheelHandler) ov.removeEventListener('wheel', gapWheelHandler, { passive: true });
        }
        gapMoveHandler = null;
        gapWheelHandler = null;
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
      removeChangesVisibilityToggle();
      unfreezePage();
    }
    return enabled;
  }

  /** Handles messages from popup: reforma-enable-playground, reforma-get-playground-state. */
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'reforma-enable-playground') {
      // Playground comments and all UI always use Google Sans (ignore popup font selector for UI).
      COMMENT_FONT = "'Google Sans', sans-serif";
      ensureGoogleSansLoaded();
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
