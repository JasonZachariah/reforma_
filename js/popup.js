// Reforma popup: all features in one file
function setText(el, text) { if (!el) return; el.textContent = String(text); }
function clampNumber(value, min, max, fallback) { const n = Number(value); if (!Number.isFinite(n)) return fallback; return Math.min(max, Math.max(min, n)); }
async function getActiveTab() { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return tab; }
function clearEl(el) { if (!el) return; while (el.firstChild) el.removeChild(el.firstChild); }

const state = { imagesEnabled: true, imagesBlurred: false, animationsDisabled: false, selectedTextStyle: null, originalStylesStored: false };
function getImagesEnabled() { return state.imagesEnabled; }
function setImagesEnabled(v) { state.imagesEnabled = v; }
function getImagesBlurred() { return state.imagesBlurred; }
function setImagesBlurred(v) { state.imagesBlurred = v; }
function getAnimationsDisabled() { return state.animationsDisabled; }
function setAnimationsDisabled(v) { state.animationsDisabled = v; }
function getSelectedTextStyle() { return state.selectedTextStyle; }
function setSelectedTextStyle(v) { state.selectedTextStyle = v; }
function getOriginalStylesStored() { return state.originalStylesStored; }
function setOriginalStylesStored(v) { state.originalStylesStored = v; }
function resetState() { state.imagesEnabled = true; state.imagesBlurred = false; state.animationsDisabled = false; state.selectedTextStyle = null; }

const fontSizeSlider = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSizeValue');
const highlightSlider = document.getElementById('highlight');
const highlightValue = document.getElementById('highlightValue');
const toggleImagesButton = document.getElementById('toggleImagesButton');
const blurImagesButton = document.getElementById('blurImagesButton');
const toggleAnimationsButton = document.getElementById('toggleAnimationsButton');

function updateUI() {
  const fontSize = clampNumber(fontSizeSlider?.value, 10, 32, 16);
  const highlight = clampNumber(highlightSlider?.value, 0, 100, 0);
  setText(fontSizeValue, fontSize + 'px');
  setText(highlightValue, highlight + '%');
  if (toggleImagesButton) toggleImagesButton.textContent = 'Images: ' + (getImagesEnabled() ? 'ON' : 'OFF');
  if (blurImagesButton) blurImagesButton.textContent = 'Blur Images: ' + (getImagesBlurred() ? 'ON' : 'OFF');
  if (toggleAnimationsButton) toggleAnimationsButton.textContent = 'Remove Animations: ' + (getAnimationsDisabled() ? 'ON' : 'OFF');
}

function injectedStoreOriginalStyles() {
  if (window.reformaOriginalStyles) return;
  const selectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li, div, td, th';
  const elements = document.querySelectorAll(selectors);
  const originalStyles = new Map();
  elements.forEach((el, index) => {
    const c = window.getComputedStyle(el);
    originalStyles.set(index, { fontSize: c.fontSize, fontFamily: c.fontFamily, fontWeight: c.fontWeight, fontStyle: c.fontStyle, backgroundColor: c.backgroundColor, color: c.color, padding: c.padding, borderRadius: c.borderRadius, boxDecorationBreak: c.boxDecorationBreak, display: c.display, filter: c.filter, transition: c.transition });
  });
  window.reformaOriginalStyles = originalStyles;
  window.reformaOriginalElements = Array.from(elements);
}

function injectedApplyStyles(opts) {
  opts = opts || {};
  const fontSizePx = opts.fontSizePx ?? 16, highlightPct = opts.highlightPct ?? 0, fontFamily = opts.fontFamily ?? null, fontWeight = opts.fontWeight ?? null, fontStyle = opts.fontStyle ?? null;
  if (!window.reformaOriginalStyles) injectedStoreOriginalStyles();
  const selectors = 'p, h1, h2, h3, h4, h5, h6, a, span, li';
  const size = Number(fontSizePx) || 16;
  const pct = Math.max(0, Math.min(100, Number(highlightPct) || 0));
  const alpha = pct / 100;
  document.querySelectorAll(selectors).forEach((el) => {
    el.style.transition = 'font-size 0.3s ease-out';
    el.style.fontSize = size + 'px';
    if (fontFamily) el.style.fontFamily = String(fontFamily);
    if (fontWeight) el.style.fontWeight = String(fontWeight);
    if (fontStyle) el.style.fontStyle = String(fontStyle);
    el.style.backgroundColor = alpha > 0 ? 'rgba(255, 235, 59, ' + alpha + ')' : '';
    el.style.boxDecorationBreak = alpha > 0 ? 'clone' : '';
    el.style.padding = alpha > 0 ? '0.05em 0.2em' : '';
    el.style.borderRadius = alpha > 0 ? '0.2em' : '';
  });
}

function updateSliderUI() {
  setText(fontSizeValue, (clampNumber(fontSizeSlider?.value, 10, 32, 16)) + 'px');
  setText(highlightValue, (clampNumber(highlightSlider?.value, 0, 100, 0)) + '%');
}

async function applyStyles() {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  const fontSize = clampNumber(fontSizeSlider?.value, 10, 32, 16);
  const highlight = clampNumber(highlightSlider?.value, 0, 100, 0);
  const style = getSelectedTextStyle();
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedStoreOriginalStyles });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedApplyStyles, args: [{ fontSizePx: fontSize, highlightPct: highlight, fontFamily: style?.fontFamily ?? null, fontWeight: style?.fontWeight ?? null, fontStyle: style?.fontStyle ?? null }] });
}

if (fontSizeSlider) fontSizeSlider.addEventListener('input', () => { updateSliderUI(); applyStyles(); });
if (highlightSlider) highlightSlider.addEventListener('input', () => { updateSliderUI(); applyStyles(); });

function resetSliders() {
  if (fontSizeSlider) fontSizeSlider.value = '16';
  if (highlightSlider) highlightSlider.value = '0';
  updateSliderUI();
}

function injectedStoreOriginalImageStyles() {
  if (window.reformaOriginalImageStyles) return;
  const imgs = document.querySelectorAll('img, picture, svg, video');
  const m = new Map();
  imgs.forEach((el, i) => { const c = window.getComputedStyle(el); m.set(i, { display: c.display, filter: c.filter, transition: c.transition }); });
  window.reformaOriginalImageStyles = m;
  window.reformaOriginalImageElements = Array.from(imgs);
}

function injectedSetImagesEnabled(enabled) {
  if (!window.reformaOriginalImageStyles) injectedStoreOriginalImageStyles();
  document.querySelectorAll('img, picture, svg, video').forEach((el) => { el.style.display = enabled ? '' : 'none'; });
}

function injectedBlurImages(blurred) {
  if (!window.reformaOriginalImageStyles) injectedStoreOriginalImageStyles();
  document.querySelectorAll('img, picture img, video').forEach((el) => {
    const w = el.naturalWidth || el.width || el.offsetWidth || 0, h = el.naturalHeight || el.height || el.offsetHeight || 0;
    const cs = window.getComputedStyle(el);
    const dw = parseFloat(cs.width) || w, dh = parseFloat(cs.height) || h;
    const major = (w >= 100 || h >= 100 || dw >= 100 || dh >= 100);
    const cn = (el.className || '').toLowerCase(), id = (el.id || '').toLowerCase();
    const icon = cn.includes('icon') || id.includes('icon') || (cn.includes('logo') && w < 200 && h < 200) || (w < 80 && h < 80);
    if (major && !icon) { el.style.filter = blurred ? 'blur(10px)' : ''; el.style.transition = blurred ? 'filter 0.3s ease' : ''; }
  });
  document.querySelectorAll('video').forEach((el) => { el.style.filter = blurred ? 'blur(10px)' : ''; el.style.transition = blurred ? 'filter 0.3s ease' : ''; });
}

async function toggleImages() {
  setImagesEnabled(!getImagesEnabled());
  updateUI();
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedStoreOriginalImageStyles });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedSetImagesEnabled, args: [getImagesEnabled()] });
}

async function toggleBlurImages() {
  setImagesBlurred(!getImagesBlurred());
  updateUI();
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedStoreOriginalImageStyles });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedBlurImages, args: [getImagesBlurred()] });
}

if (toggleImagesButton) toggleImagesButton.addEventListener('click', toggleImages);
if (blurImagesButton) blurImagesButton.addEventListener('click', toggleBlurImages);

function injectedToggleAnimations(disabled) {
  const styleId = 'reforma-disable-animations';
  let styleEl = document.getElementById(styleId);
  if (disabled) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}';
      document.head.appendChild(styleEl);
    }
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(...a) { if (a[0] && typeof a[0] === 'object') a[0].behavior = 'auto'; return orig.apply(this, a); };
    const origTo = window.scrollTo;
    window.scrollTo = function(...a) { if (a[0] && typeof a[0] === 'object' && a[0].behavior) a[0].behavior = 'auto'; return origTo.apply(this, a); };
    const origS = window.scroll;
    window.scroll = function(...a) { if (a[0] && typeof a[0] === 'object' && a[0].behavior) a[0].behavior = 'auto'; return origS.apply(this, a); };
  } else if (styleEl) styleEl.remove();
}

async function toggleAnimations() {
  setAnimationsDisabled(!getAnimationsDisabled());
  updateUI();
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedToggleAnimations, args: [getAnimationsDisabled()] });
}

if (toggleAnimationsButton) toggleAnimationsButton.addEventListener('click', toggleAnimations);

function injectedApplyColorBlindMode(type) {
  function getRgb(c) {
    if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return null;
    const rgb = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3])];
    const hex = c.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
    if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
    return null;
  }
  function lum(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(v => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  const existing = document.getElementById('reforma-color-blind');
  if (existing) existing.remove();
  if (!type || type === 'none') return;
  let svgFilter = document.getElementById('reforma-cb-filter');
  if (!svgFilter) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;z-index:-1';
    svg.id = 'reforma-cb-svg';
    svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    svgFilter.id = 'reforma-cb-filter';
    svg.appendChild(svgFilter);
    document.body.appendChild(svg);
  }
  const oldM = svgFilter.querySelector('feColorMatrix');
  if (oldM) oldM.remove();
  const matrices = { deuteranopia: [0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0], protanopia: [0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0], tritanopia: [0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0], monochromacy: [0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 1, 0] };
  const matrix = matrices[type];
  if (!matrix) return;
  const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
  fe.setAttribute('type', 'matrix');
  fe.setAttribute('values', matrix.join(' '));
  svgFilter.appendChild(fe);
  const style = document.createElement('style');
  style.id = 'reforma-color-blind';
  style.textContent = 'html{filter:url(#reforma-cb-filter);isolation:isolate;will-change:filter}';
  document.head.appendChild(style);
  if (type === 'monochromacy') {
    document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, span, li, div, td, th, button, input, label').forEach((el) => {
      const bg = getRgb(window.getComputedStyle(el).backgroundColor), tx = getRgb(window.getComputedStyle(el).color);
      if (bg && tx && Math.abs(lum(bg[0], bg[1], bg[2]) - lum(tx[0], tx[1], tx[2])) < 0.3)
        el.style.color = lum(bg[0], bg[1], bg[2]) > 0.5 ? '#000' : '#fff';
    });
  }
}

async function applyColorBlindMode(type) {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedApplyColorBlindMode, args: [type] });
  } catch (e) { console.error(e); }
}

const deuteranopiaButton = document.getElementById('deuteranopiaButton');
const tritanopiaButton = document.getElementById('tritanopiaButton');
const protanopiaButton = document.getElementById('protanopiaButton');
const monochromacyButton = document.getElementById('monochromacyButton');
if (deuteranopiaButton) deuteranopiaButton.addEventListener('click', () => applyColorBlindMode('deuteranopia'));
if (tritanopiaButton) tritanopiaButton.addEventListener('click', () => applyColorBlindMode('tritanopia'));
if (protanopiaButton) protanopiaButton.addEventListener('click', () => applyColorBlindMode('protanopia'));
if (monochromacyButton) monochromacyButton.addEventListener('click', () => applyColorBlindMode('monochromacy'));

function injectedResetAll() {
  if (window.reformaOriginalStyles && window.reformaOriginalElements) {
    window.reformaOriginalElements.forEach((el, i) => {
      const o = window.reformaOriginalStyles.get(i);
      if (o && el) { el.style.fontSize = o.fontSize; el.style.fontFamily = o.fontFamily; el.style.fontWeight = o.fontWeight; el.style.fontStyle = o.fontStyle; el.style.backgroundColor = o.backgroundColor; el.style.color = o.color; el.style.padding = o.padding; el.style.borderRadius = o.borderRadius; el.style.boxDecorationBreak = o.boxDecorationBreak; el.style.transition = o.transition; }
    });
  } else {
    document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, span, li, div, td, th').forEach((el) => { el.style.fontSize = el.style.fontFamily = el.style.fontWeight = el.style.fontStyle = el.style.backgroundColor = el.style.boxDecorationBreak = el.style.padding = el.style.borderRadius = el.style.color = el.style.transition = ''; });
  }
  if (window.reformaOriginalImageStyles && window.reformaOriginalImageElements) {
    window.reformaOriginalImageElements.forEach((el, i) => {
      const o = window.reformaOriginalImageStyles.get(i);
      if (o && el) { el.style.display = o.display; el.style.filter = o.filter; el.style.transition = o.transition; }
    });
  } else document.querySelectorAll('img, picture, svg, video').forEach((el) => { el.style.display = el.style.filter = el.style.transition = ''; });
  const a = document.getElementById('reforma-disable-animations'); if (a) a.remove();
  const b = document.getElementById('reforma-color-blind'); if (b) b.remove();
  const c = document.getElementById('reforma-cb-svg'); if (c) c.remove();
  window.reformaOriginalStyles = window.reformaOriginalElements = window.reformaOriginalImageStyles = window.reformaOriginalImageElements = null;
  try {
    document.querySelectorAll('mark.reforma-highlight').forEach((mark) => {
      try {
        const parent = mark.parentNode;
        if (!parent) return;
        const parts = [];
        for (let i = 0; i < mark.childNodes.length; i++) {
          const ch = mark.childNodes[i];
          if (ch.nodeType === Node.TEXT_NODE) parts.push(ch.textContent);
          else if (ch.nodeType === Node.ELEMENT_NODE && ch.className !== 'reforma-highlight-delete') parts.push(ch.textContent);
        }
        parent.replaceChild(document.createTextNode(parts.join('')), mark);
      } catch (e) {}
    });
  } catch (e) {}
}

const HIGHLIGHTS_STORAGE_KEY = 'reforma_highlights';
const resetButton = document.getElementById('resetButton');

async function resetAll() {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: injectedResetAll });
    const url = tab.url || '';
    if (url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://')) {
      const result = await chrome.storage.local.get([HIGHLIGHTS_STORAGE_KEY]);
      const all = result[HIGHLIGHTS_STORAGE_KEY] || {};
      all[url] = [];
      await chrome.storage.local.set({ [HIGHLIGHTS_STORAGE_KEY]: all });
      try { await chrome.tabs.sendMessage(tab.id, { action: 'reforma-reload-highlights' }); } catch (e) {}
    }
    resetState();
    resetSliders();
    updateUI();
  } catch (e) { console.error(e); }
}

if (resetButton) resetButton.addEventListener('click', resetAll);

import './textOnly.js';

async function syncToAllTabs() {
  const fontSize = clampNumber(fontSizeSlider?.value, 10, 32, 16);
  const highlight = clampNumber(highlightSlider?.value, 0, 100, 0);
  const style = getSelectedTextStyle();
  const tabs = await chrome.tabs.query({});
  const injectable = tabs.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));
  for (const tab of injectable) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedStoreOriginalStyles });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedApplyStyles, args: [{ fontSizePx: fontSize, highlightPct: highlight, fontFamily: style?.fontFamily ?? null, fontWeight: style?.fontWeight ?? null, fontStyle: style?.fontStyle ?? null }] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedStoreOriginalImageStyles });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedSetImagesEnabled, args: [getImagesEnabled()] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedBlurImages, args: [getImagesBlurred()] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectedToggleAnimations, args: [getAnimationsDisabled()] });
    } catch (e) {}
  }
}
const syncAllTabsButton = document.getElementById('syncAllTabsButton');
if (syncAllTabsButton) syncAllTabsButton.addEventListener('click', syncToAllTabs);

const highlightCommentFocusBtn = document.getElementById('highlightCommentFocusBtn');
if (highlightCommentFocusBtn) highlightCommentFocusBtn.addEventListener('click', async () => { const tab = await getActiveTab(); if (tab?.id) try { await chrome.tabs.sendMessage(tab.id, { action: 'reforma-show-highlight-hint' }); } catch (e) {} });
const togglePageToolbarButton = document.getElementById('togglePageToolbarButton');
if (togglePageToolbarButton) togglePageToolbarButton.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
      return;
    }
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'reforma-toggle-page-toolbar' });
    } catch (err) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['js/content.js'] });
      await chrome.tabs.sendMessage(tab.id, { action: 'reforma-toggle-page-toolbar' });
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Reforma: Reload the page and try again.', e?.message || String(e));
    }
  }
});
const screenshotAreaButton = document.getElementById('screenshotAreaButton');
if (screenshotAreaButton) screenshotAreaButton.addEventListener('click', async () => { const tab = await getActiveTab(); if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) return; try { await chrome.runtime.sendMessage({ action: 'startScreenshotMode', tabId: tab.id }); setTimeout(() => window.close(), 150); } catch (e) { console.error(e); } });

const HL_STORAGE = 'reforma_highlights';
const CODE_PREFIX = 'RF-';
function normUrl(u) { try { if (!u) return ''; var a = new URL(u); return a.origin + a.pathname + a.search; } catch (e) { return u || ''; } }
function b64Enc(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64Dec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); if (s.length % 4) s += '===='.slice(0, 4 - s.length % 4); try { return decodeURIComponent(escape(atob(s))); } catch (e) { return null; } }
async function generateRestoreCode() {
  const tab = await getActiveTab();
  const url = tab?.url || '';
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return { ok: false, error: 'Cannot use on this page.' };
  return new Promise((res) => {
    chrome.storage.local.get([HL_STORAGE], (r) => {
      try { const all = r[HL_STORAGE] || {}; const list = all[normUrl(url)] || []; const code = CODE_PREFIX + b64Enc(JSON.stringify({ url: normUrl(url), highlights: list })); res({ ok: true, code, count: list.length }); } catch (e) { res({ ok: false, error: 'Failed.' }); }
    });
  });
}
async function restoreFromCode(code) {
  const tab = await getActiveTab();
  const url = tab?.url || '';
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return { ok: false, error: 'Cannot use on this page.' };
  const raw = String(code).trim();
  if (!raw.startsWith(CODE_PREFIX)) return { ok: false, error: 'Invalid code. Use RF-...' };
  const dec = b64Dec(raw.slice(CODE_PREFIX.length));
  if (!dec) return { ok: false, error: 'Invalid code.' };
  let pl; try { pl = JSON.parse(dec); } catch (e) { return { ok: false, error: 'Invalid code.' }; }
  if (!pl || typeof pl.url !== 'string' || !Array.isArray(pl.highlights)) return { ok: false, error: 'Invalid code.' };
  if (pl.url !== normUrl(url)) return { ok: false, error: 'Code is for a different page URL.' };
  return new Promise((res) => {
    chrome.storage.local.get([HL_STORAGE], (r) => {
      try { const all = r[HL_STORAGE] || {}; all[normUrl(url)] = pl.highlights; chrome.storage.local.set({ [HL_STORAGE]: all }, () => { setTimeout(() => { chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: () => { try { window.dispatchEvent(new CustomEvent('reforma-reload-highlights')); } catch (e) {} } }).then(() => { chrome.tabs.sendMessage(tab.id, { action: 'reforma-show-page-toast', text: 'Restored ' + pl.highlights.length + ' comment(s).' }).catch(() => {}); res({ ok: true, count: pl.highlights.length }); }).catch(() => { chrome.tabs.sendMessage(tab.id, { action: 'reforma-reload-highlights' }, () => { chrome.tabs.sendMessage(tab.id, { action: 'reforma-show-page-toast', text: 'Restored.' }).catch(() => {}); res({ ok: true, count: pl.highlights.length }); }); }); }, 80); }); } catch (e) { res({ ok: false, error: 'Failed.' }); }
    });
  });
}
const genBtn = document.getElementById('highlightGenerateCodeBtn');
const codeOut = document.getElementById('highlightRestoreCodeOutput');
const copyBtn = document.getElementById('highlightRestoreCodeCopyBtn');
const restoreIn = document.getElementById('highlightRestoreCodeInput');
const restoreBtn = document.getElementById('highlightRestoreCodeRestoreBtn');
const statusEl = document.getElementById('highlightRestoreCodeStatus');
if (genBtn && codeOut) genBtn.addEventListener('click', async () => { codeOut.value = ''; if (statusEl) statusEl.textContent = ''; const r = await generateRestoreCode(); if (r.ok) { codeOut.value = r.code; if (statusEl) statusEl.textContent = r.count ? 'Code generated (' + r.count + '). Copy and use on same page.' : 'No highlights.'; } else if (statusEl) statusEl.textContent = r.error || 'Failed'; });
if (copyBtn && codeOut) copyBtn.addEventListener('click', async () => { const c = codeOut.value; if (!c) return; try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(c); else { codeOut.select(); document.execCommand('copy'); } const t = copyBtn.textContent; copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = t; }, 1500); } catch (e) {} });
if (restoreBtn && restoreIn && statusEl) restoreBtn.addEventListener('click', async () => { statusEl.textContent = ''; const c = restoreIn.value.trim(); if (!c) { statusEl.textContent = 'Paste a code first.'; return; } const r = await restoreFromCode(c); if (r.ok) { statusEl.textContent = 'Restored ' + r.count + '.'; restoreIn.value = ''; } else statusEl.textContent = r.error || 'Failed'; });

const SS_KEY = 'reforma_screenshots';
const listEl = document.getElementById('savedScreenshotsList');
const emptyEl = document.getElementById('savedScreenshotsEmpty');
const previewWrap = document.getElementById('savedScreenshotsPreview');
const previewImg = document.getElementById('savedScreenshotsPreviewImg');
const previewLink = document.getElementById('savedScreenshotsPreviewLink');
function fmtDate(ts) { var d = new Date(ts), n = new Date(); if (d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
function renderSS(list) {
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = '';
  if (!list || list.length === 0) { emptyEl.classList.remove('hidden'); if (previewWrap) previewWrap.classList.add('hidden'); return; }
  emptyEl.classList.add('hidden');
  var latest = list[0];
  if (previewWrap && previewImg && previewLink && latest) { previewImg.src = latest.dataUrl; previewImg.alt = latest.tabTitle || 'Screenshot'; previewLink.href = chrome.runtime.getURL('screenshot-viewer.html?id=' + encodeURIComponent(latest.id)); previewLink.target = '_blank'; previewWrap.classList.remove('hidden'); }
  list.forEach((item) => {
    var wrap = document.createElement('div');
    wrap.className = 'flex items-center gap-2 p-2 rounded bg-gray-100 border border-gray-200';
    var thumb = document.createElement('img');
    thumb.src = item.dataUrl; thumb.alt = ''; thumb.className = 'w-14 h-14 object-cover rounded flex-shrink-0 border border-gray-300';
    var col = document.createElement('div');
    col.className = 'flex-1 min-w-0';
    var title = document.createElement('p');
    title.className = 'text-xs font-medium text-black truncate';
    title.textContent = item.tabTitle || 'Screenshot';
    var meta = document.createElement('p');
    meta.className = 'text-xs text-black/70 truncate';
    try { if (item.tabUrl) meta.textContent = fmtDate(item.date) + ' · ' + new URL(item.tabUrl).hostname; else meta.textContent = fmtDate(item.date); } catch (e) { meta.textContent = fmtDate(item.date); }
    col.appendChild(title); col.appendChild(meta);
    var btns = document.createElement('div');
    btns.className = 'flex flex-shrink-0 gap-1';
    var dl = document.createElement('button');
    dl.type = 'button'; dl.className = 'px-2 py-1 text-xs bg-teal-600 text-white rounded hover:opacity-90';
    dl.textContent = 'Download';
    dl.addEventListener('click', () => { var a = document.createElement('a'); a.href = item.dataUrl; a.download = 'reforma-screenshot-' + item.id + '.png'; a.click(); });
    var del = document.createElement('button');
    del.type = 'button'; del.className = 'px-2 py-1 text-xs bg-gray-500 text-white rounded hover:opacity-90';
    del.textContent = 'Delete';
    del.addEventListener('click', () => { chrome.storage.local.get([SS_KEY], (r) => { const L = (r[SS_KEY] || []).filter((x) => x.id !== item.id); chrome.storage.local.set({ [SS_KEY]: L }, () => renderSS(L)); }); });
    btns.appendChild(dl); btns.appendChild(del);
    wrap.appendChild(thumb); wrap.appendChild(col); wrap.appendChild(btns);
    listEl.appendChild(wrap);
  });
}
if (listEl && emptyEl) chrome.storage.local.get([SS_KEY], (r) => renderSS(r[SS_KEY] || []));

updateUI();
