(function () {
  'use strict';
  if (document.getElementById('screenshotImg')) {
    var params = new URLSearchParams(location.search);
    var id = params.get('id');
    var img = document.getElementById('screenshotImg');
    var loading = document.getElementById('loading');
    var notFound = document.getElementById('notFound');
    var downloadBtn = document.getElementById('downloadBtn');
    if (!id) {
      loading.style.display = 'none';
      notFound.textContent = 'No screenshot ID in URL.';
      notFound.style.display = 'block';
      return;
    }
    chrome.storage.local.get(['reforma_screenshots'], function (result) {
      loading.style.display = 'none';
      var list = result.reforma_screenshots || [];
      var item = list.find(function (s) { return s.id === id; });
      if (!item || !item.dataUrl) {
        notFound.style.display = 'block';
        return;
      }
      img.src = item.dataUrl;
      img.style.display = 'block';
      downloadBtn.addEventListener('click', function () {
        var a = document.createElement('a');
        a.href = item.dataUrl;
        a.download = 'reforma-screenshot-' + item.id + '.png';
        a.click();
      });
    });
    return;
  }
  var OVERLAY_ID = 'reforma-screenshot-overlay';
  var BOX_ID = 'reforma-screenshot-box';
  function getOverlay() { return document.getElementById(OVERLAY_ID); }
  function removeOverlay() { var el = getOverlay(); if (el) el.remove(); }
  function showSelectionMode() {
    removeOverlay();
    if (!document.body) return;
    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.3);font-family:system-ui,sans-serif';
    var hint = document.createElement('div');
    hint.textContent = 'Drag to select an area. Release to capture. Press Esc to cancel.';
    hint.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#372828;color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:none;z-index:2147483648';
    overlay.appendChild(hint);
    var box = document.createElement('div');
    box.id = BOX_ID;
    box.style.cssText = 'position:fixed;border:2px solid #D643E3;background:rgba(214,67,227,0.15);pointer-events:none;display:none;z-index:2147483648;box-sizing:border-box';
    var startX = 0, startY = 0;
    function setBoxRect(x1, y1, x2, y2) {
      var left = Math.min(x1, x2), top = Math.min(y1, y2), width = Math.abs(x2 - x1), height = Math.abs(y2 - y1);
      box.style.left = left + 'px'; box.style.top = top + 'px'; box.style.width = width + 'px'; box.style.height = height + 'px';
      box.style.display = width > 2 && height > 2 ? 'block' : 'none';
    }
    overlay.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      startX = e.clientX; startY = e.clientY;
      setBoxRect(startX, startY, startX, startY);
      box.style.display = 'block';
      function onMove(e) { setBoxRect(startX, startY, e.clientX, e.clientY); }
      function onUp(e) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        var left = Math.min(startX, e.clientX), top = Math.min(startY, e.clientY), width = Math.abs(e.clientX - startX), height = Math.abs(e.clientY - startY);
        if (width > 5 && height > 5) {
          removeOverlay();
          chrome.runtime.sendMessage({ action: 'screenshotRect', rect: { x: left, y: top, width: width, height: height }, devicePixelRatio: window.devicePixelRatio || 1 }).catch(function () {});
        } else removeOverlay();
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, { once: true });
    });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') removeOverlay(); });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.setAttribute('tabindex', '0');
    overlay.focus();
  }
  function cropAndSave(dataUrl, rect, devicePixelRatio) {
    var imgEl = new Image();
    imgEl.onload = function () {
      var dpr = devicePixelRatio || 1;
      var sx = rect.x * dpr, sy = rect.y * dpr, sw = rect.width * dpr, sh = rect.height * dpr;
      var canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, sw, sh);
      chrome.runtime.sendMessage({ action: 'saveScreenshot', dataUrl: canvas.toDataURL('image/png'), tabUrl: typeof location !== 'undefined' ? location.href : '', tabTitle: typeof document !== 'undefined' ? document.title : '' }).catch(function () {});
    };
    imgEl.onerror = function () {};
    imgEl.src = dataUrl;
  }
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.action === 'startScreenshotMode') { showSelectionMode(); sendResponse({ ok: true }); }
    else if (msg.action === 'cropAndSave') { cropAndSave(msg.dataUrl, msg.rect, msg.devicePixelRatio); sendResponse({ ok: true }); }
    return true;
  });
})();
