// Content script to inject floating button on web pages
(function() {
  'use strict';

  // Store button visibility state globally
  let buttonVisibilityState = true; // Default to visible

  // Listen for messages to hide/show button (set up globally)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleFloatingButton') {
      buttonVisibilityState = request.visible;
      const button = document.getElementById('reforma-floating-button');
      if (button) {
        if (request.visible) {
          button.classList.remove('hidden');
          button.style.display = 'flex';
          button.style.visibility = 'visible';
          button.style.opacity = '1';
          button.style.pointerEvents = 'auto';
        } else {
          button.classList.add('hidden');
          button.style.display = 'none';
          button.style.visibility = 'hidden';
          button.style.opacity = '0';
          button.style.pointerEvents = 'none';
        }
        console.log('Floating button visibility toggled to:', request.visible);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, message: 'Button not found' });
      }
    }
    
    if (request.action === 'updateComments') {
      injectComments(request.comments || []);
      sendResponse({ success: true });
    }
    
    if (request.action === 'updateTextCommentMode') {
      isCommentModeEnabled = request.enabled !== false;
      sendResponse({ success: true });
    }
    
    if (request.action === 'updateHighlightTextMode') {
      isHighlightModeEnabled = request.enabled !== false;
      sendResponse({ success: true });
    }
    
    if (request.action === 'applyTextHighlight') {
      console.log('Received applyTextHighlight message:', request.text, request.color);
      applyTextHighlight(request.text, request.color || '#FFEB3B');
      sendResponse({ success: true });
    }
    
    return true;
  });
  
  // Inject comments on page
  function injectComments(comments) {
    // Remove existing comments panel
    const existing = document.getElementById('reforma-comments-panel');
    if (existing) {
      existing.remove();
    }
    
    if (!comments || comments.length === 0) {
      return;
    }
    
    // Create comments panel
    const panel = document.createElement('div');
    panel.id = 'reforma-comments-panel';
    panel.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      width: 300px !important;
      max-height: 400px !important;
      background: white !important;
      border: 1px solid #E6E3E3 !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      z-index: 2147483646 !important;
      padding: 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
      overflow-y: auto !important;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Page Comments';
    title.style.cssText = 'margin: 0 0 12px 0 !important; font-size: 14px !important; font-weight: 600 !important; color: #000 !important;';
    panel.appendChild(title);
    
    const commentsList = document.createElement('div');
    comments.forEach(comment => {
      const commentDiv = document.createElement('div');
      commentDiv.style.cssText = 'margin-bottom: 12px !important; padding: 8px !important; background: #F9F6F6 !important; border-radius: 4px !important;';
      
      const text = document.createElement('p');
      text.textContent = comment.text;
      text.style.cssText = 'margin: 0 0 4px 0 !important; font-size: 13px !important; color: #000 !important;';
      commentDiv.appendChild(text);
      
      const date = document.createElement('p');
      const dateObj = new Date(comment.timestamp);
      date.textContent = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      date.style.cssText = 'margin: 0 !important; font-size: 11px !important; color: #666 !important;';
      commentDiv.appendChild(date);
      
      commentsList.appendChild(commentDiv);
    });
    
    panel.appendChild(commentsList);
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute !important;
      top: 8px !important;
      right: 8px !important;
      background: none !important;
      border: none !important;
      font-size: 20px !important;
      cursor: pointer !important;
      color: #666 !important;
      width: 24px !important;
      height: 24px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
    `;
    closeBtn.onclick = () => panel.remove();
    panel.appendChild(closeBtn);
    
    document.body.appendChild(panel);
  }
  
  // Load comments when page loads
  function loadCommentsForPage() {
    chrome.storage.local.get(['pageComments'], (result) => {
      const allComments = result.pageComments || {};
      const url = window.location.href;
      const comments = allComments[url] || [];
      if (comments.length > 0) {
        injectComments(comments);
      }
    });
  }
  
  // Load comments on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCommentsForPage);
  } else {
    loadCommentsForPage();
  }
  
  // Text selection and highlighting system
  let selectedText = '';
  let selectedRange = null;
  let commentPopup = null;
  let selectionTimeout = null;
  let isCommentModeEnabled = false;
  let isHighlightModeEnabled = false;
  let currentSelectionForHighlight = null;
  
  // Check if modes are enabled from storage
  chrome.storage.local.get(['textCommentMode', 'highlightTextMode'], (result) => {
    isCommentModeEnabled = result.textCommentMode !== false; // Default to true
    isHighlightModeEnabled = result.highlightTextMode !== false; // Default to true
  });
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.textCommentMode) {
        isCommentModeEnabled = changes.textCommentMode.newValue !== false;
      }
      if (changes.highlightTextMode) {
        isHighlightModeEnabled = changes.highlightTextMode.newValue !== false;
      }
    }
  });
  
  // Listen for text selection (for both comment and highlight modes)
  document.addEventListener('mouseup', handleTextSelection, true);
  document.addEventListener('keyup', (e) => {
    // Only handle if it's a modifier key release
    if (e.key === 'Control' || e.key === 'Meta') {
      handleTextSelection(e);
    }
  }, true);
  
  function handleTextSelection(e) {
    // Clear any pending timeout
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
      selectionTimeout = null;
    }
    
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text.length === 0) {
      // Hide popup if selection is cleared
      if (commentPopup) {
        commentPopup.remove();
        commentPopup = null;
      }
      // Clear selection in storage
      if (isHighlightModeEnabled) {
        chrome.storage.local.set({
          currentTextSelection: null
        });
      }
      return;
    }
    
    selectedText = text;
    selectedRange = selection.getRangeAt(0);
    
    // Handle highlight mode - store selection in storage for popup to read
    if (isHighlightModeEnabled) {
      currentSelectionForHighlight = {
        text: text,
        range: {
          startContainer: selection.anchorNode,
          startOffset: selection.anchorOffset,
          endContainer: selection.focusNode,
          endOffset: selection.focusOffset
        }
      };
      
      // Store in chrome.storage for popup to read
      chrome.storage.local.set({
        currentTextSelection: {
          text: text,
          timestamp: Date.now()
        }
      });
    }
    
    // Handle comment mode
    if (isCommentModeEnabled) {
      // Check if modifier key is held (Ctrl on Windows/Linux, Cmd on Mac)
      const modifierHeld = e && (e.ctrlKey || e.metaKey);
      
      if (modifierHeld) {
        // Show popup immediately if modifier is held
        showCommentPopup(selection);
      }
    }
  }
  
  function showCommentPopup(selection) {
    // Remove existing popup
    if (commentPopup) {
      commentPopup.remove();
    }
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Highlight the selected text immediately when popup appears
    let tempHighlight = null;
    try {
      // Clone the range to avoid modifying the selection
      const highlightRange = range.cloneRange();
      
      // Create a temporary highlight span
      tempHighlight = document.createElement('span');
      tempHighlight.className = 'reforma-temp-highlight';
      tempHighlight.style.cssText = 'background-color: rgba(255, 235, 59, 0.6) !important; padding: 2px 0 !important; border-radius: 2px !important;';
      
      // Try to wrap the selection
      try {
        highlightRange.surroundContents(tempHighlight);
      } catch (e) {
        // If surroundContents fails, use extractContents
        const contents = highlightRange.extractContents();
        tempHighlight.appendChild(contents);
        highlightRange.insertNode(tempHighlight);
      }
    } catch (e) {
      console.log('Could not highlight selection:', e);
      tempHighlight = null;
    }
    
    // Create popup
    commentPopup = document.createElement('div');
    commentPopup.id = 'reforma-comment-popup';
    commentPopup.style.cssText = `
      position: fixed !important;
      top: ${rect.bottom + window.scrollY + 10}px !important;
      left: ${rect.left + window.scrollX}px !important;
      background: white !important;
      border: 1px solid #E6E3E3 !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      z-index: 2147483647 !important;
      padding: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
      min-width: 250px !important;
    `;
    
    const selectedTextEl = document.createElement('div');
    selectedTextEl.textContent = `"${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`;
    selectedTextEl.style.cssText = 'font-size: 12px !important; color: #666 !important; margin-bottom: 8px !important; font-style: italic !important;';
    commentPopup.appendChild(selectedTextEl);
    
    const input = document.createElement('textarea');
    input.placeholder = 'Add a comment...';
    input.style.cssText = 'width: 100% !important; padding: 8px !important; border: 1px solid #ddd !important; border-radius: 4px !important; font-size: 13px !important; resize: none !important; margin-bottom: 8px !important; min-height: 60px !important; box-sizing: border-box !important;';
    commentPopup.appendChild(input);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex !important; gap: 8px !important;';
    
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Comment';
    addBtn.style.cssText = 'flex: 1 !important; padding: 6px 12px !important; background: #D84315 !important; color: white !important; border: none !important; border-radius: 4px !important; cursor: pointer !important; font-size: 12px !important;';
    addBtn.onclick = () => {
      const commentText = input.value.trim();
      if (commentText) {
        // Use the temp highlight as the base for permanent highlight
        let rangeToUse = selectedRange;
        
        if (tempHighlight && tempHighlight.parentNode) {
          // Create range from the temp highlight
          const newRange = document.createRange();
          newRange.selectNodeContents(tempHighlight);
          rangeToUse = newRange;
        }
        
        if (rangeToUse) {
          addTextComment(selectedText, rangeToUse, commentText, tempHighlight);
        } else {
          // Fallback: try to find the text
          const newRange = document.createRange();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          while (node = walker.nextNode()) {
            const index = node.textContent.indexOf(selectedText);
            if (index !== -1) {
              newRange.setStart(node, index);
              newRange.setEnd(node, index + selectedText.length);
              addTextComment(selectedText, newRange, commentText);
              break;
            }
          }
        }
        
        commentPopup.remove();
        commentPopup = null;
        selection.removeAllRanges();
      }
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'flex: 1 !important; padding: 6px 12px !important; background: #f0f0f0 !important; color: #333 !important; border: none !important; border-radius: 4px !important; cursor: pointer !important; font-size: 12px !important;';
    cancelBtn.onclick = () => {
      // Remove temp highlight
      if (tempHighlight) {
        const parent = tempHighlight.parentNode;
        if (parent) {
          while (tempHighlight.firstChild) {
            parent.insertBefore(tempHighlight.firstChild, tempHighlight);
          }
          parent.removeChild(tempHighlight);
        }
      }
      commentPopup.remove();
      commentPopup = null;
      selection.removeAllRanges();
    };
    
    buttonContainer.appendChild(addBtn);
    buttonContainer.appendChild(cancelBtn);
    commentPopup.appendChild(buttonContainer);
    
    document.body.appendChild(commentPopup);
    
    // Focus input
    input.focus();
    
    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function closePopup(e) {
        if (commentPopup && !commentPopup.contains(e.target)) {
          // Check if click is on the highlighted text
          const clickedElement = e.target;
          let isOnHighlight = false;
          if (tempHighlight) {
            isOnHighlight = tempHighlight.contains(clickedElement) || tempHighlight === clickedElement;
          }
          
          if (!isOnHighlight) {
            // Remove temp highlight
            if (tempHighlight && tempHighlight.parentNode) {
              const parent = tempHighlight.parentNode;
              while (tempHighlight.firstChild) {
                parent.insertBefore(tempHighlight.firstChild, tempHighlight);
              }
              parent.removeChild(tempHighlight);
            }
            commentPopup.remove();
            commentPopup = null;
            selection.removeAllRanges();
            document.removeEventListener('click', closePopup);
          }
        }
      }, { once: true });
    }, 100);
  }
  
  async function addTextComment(selectedText, range, commentText, tempHighlight = null) {
    // Create a unique ID for this highlight
    const highlightId = 'reforma-highlight-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    let highlightSpan;
    
    // If we have a temp highlight, convert it to permanent
    if (tempHighlight && tempHighlight.parentNode) {
      highlightSpan = tempHighlight;
      highlightSpan.id = highlightId;
      highlightSpan.className = 'reforma-text-highlight';
      highlightSpan.style.cssText = 'background-color: rgba(255, 235, 59, 0.4) !important; padding: 2px 0 !important; cursor: pointer !important; position: relative !important; border-radius: 2px !important;';
    } else {
      // Create new highlight span
      highlightSpan = document.createElement('span');
      highlightSpan.id = highlightId;
      highlightSpan.className = 'reforma-text-highlight';
      highlightSpan.style.cssText = 'background-color: rgba(255, 235, 59, 0.4) !important; padding: 2px 0 !important; cursor: pointer !important; position: relative !important; border-radius: 2px !important;';
      
      try {
        range.surroundContents(highlightSpan);
      } catch (e) {
        // If surroundContents fails, try a different approach
        const contents = range.extractContents();
        highlightSpan.appendChild(contents);
        range.insertNode(highlightSpan);
      }
    }
    
    // Set attributes
    highlightSpan.setAttribute('data-comment-text', commentText);
    highlightSpan.setAttribute('data-selected-text', selectedText);
    highlightSpan.setAttribute('data-comment-id', highlightId);
    
    // Add hover tooltip
    addTooltipToHighlight(highlightSpan, commentText);
    
    // Save to storage
    const url = window.location.href;
    chrome.storage.local.get(['pageHighlights'], (result) => {
      const allHighlights = result.pageHighlights || {};
      if (!allHighlights[url]) {
        allHighlights[url] = [];
      }
      
      // Get XPath or other identifier for the element
      const xpath = getXPath(highlightSpan);
      
      allHighlights[url].push({
        id: highlightId,
        selectedText: selectedText,
        commentText: commentText,
        xpath: xpath,
        timestamp: new Date().toISOString()
      });
      
      chrome.storage.local.set({ pageHighlights: allHighlights });
    });
  }
  
  // Get XPath for an element (for persistence)
  function getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    if (element === document.body) {
      return '/html/body';
    }
    
    let ix = 0;
    const siblings = element.parentNode.childNodes;
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) {
        return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
  }
  
  // Load saved highlights on page load
  // Convert hex color to rgba
  function hexToRgba(hex, alpha = 0.5) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(255, 235, 59, ${alpha})`; // Default yellow
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  // Inject highlight styles if not already present
  function ensureHighlightStyles() {
    if (document.getElementById('reforma-highlight-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'reforma-highlight-styles';
    style.textContent = `
      mark.reforma-text-highlight,
      .reforma-text-highlight {
        background-color: #FFFF00 !important;
        background: #FFFF00 !important;
        color: #000000 !important;
        padding: 4px 2px !important;
        margin: 0 !important;
        border: 2px solid #FFD700 !important;
        border-radius: 3px !important;
        display: inline !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        font-weight: bold !important;
        z-index: 999999 !important;
        position: relative !important;
        box-decoration-break: clone !important;
        -webkit-box-decoration-break: clone !important;
      }
      .reforma-text-highlight * {
        background-color: transparent !important;
        background: transparent !important;
        color: inherit !important;
      }
    `;
    document.head.appendChild(style);
    console.log('[HIGHLIGHT] Styles injected');
  }
  
  // Apply text highlight (without comment) - SIMPLIFIED AND MORE VISIBLE
  function applyTextHighlight(text, color) {
    if (!text || text.trim().length === 0) {
      console.log('[HIGHLIGHT] No text to highlight');
      return;
    }
    
    ensureHighlightStyles();
    
    // Use bright yellow with high opacity
    const bgColor = '#FFFF00'; // Bright yellow
    const searchText = text.trim();
    
    console.log('[HIGHLIGHT] Applying highlight for text:', searchText.substring(0, 50));
    console.log('[HIGHLIGHT] Searching in document body:', document.body);
    
    // Try a simpler approach - use Range API to find and highlight
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (range.toString().trim() === searchText) {
        // Use the current selection
        try {
          const highlightSpan = document.createElement('mark');
          const highlightId = 'reforma-highlight-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          highlightSpan.id = highlightId;
          highlightSpan.className = 'reforma-text-highlight';
          
          // Use mark element with very visible styles
          highlightSpan.style.cssText = `
            background-color: #FFFF00 !important;
            background: #FFFF00 !important;
            color: #000000 !important;
            padding: 4px 2px !important;
            margin: 0 !important;
            border: 2px solid #FFD700 !important;
            border-radius: 3px !important;
            display: inline !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            font-weight: bold !important;
            z-index: 999999 !important;
            position: relative !important;
          `;
          
          highlightSpan.setAttribute('data-highlight-id', highlightId);
          highlightSpan.setAttribute('data-highlight-text', searchText);
          
          // Wrap the selection
          try {
            range.surroundContents(highlightSpan);
            console.log('[HIGHLIGHT] Successfully wrapped selection with mark element');
          } catch (e) {
            // If surroundContents fails, extract and wrap
            const contents = range.extractContents();
            highlightSpan.appendChild(contents);
            range.insertNode(highlightSpan);
            console.log('[HIGHLIGHT] Used extractContents method');
          }
          
          // Save to storage
          const url = window.location.href;
          chrome.storage.local.get(['pageHighlights'], (result) => {
            const allHighlights = result.pageHighlights || {};
            if (!allHighlights[url]) {
              allHighlights[url] = [];
            }
            
            allHighlights[url].push({
              id: highlightId,
              selectedText: searchText,
              color: color,
              timestamp: new Date().toISOString(),
              type: 'highlight'
            });
            
            chrome.storage.local.set({ pageHighlights: allHighlights });
            console.log('[HIGHLIGHT] Saved to storage');
          });
          
          // Clear current selection
          chrome.storage.local.set({ currentTextSelection: null });
          selection.removeAllRanges();
          
          return;
        } catch (e) {
          console.error('[HIGHLIGHT] Error wrapping selection:', e);
        }
      }
    }
    
    // Fallback: search for text in document
    console.log('[HIGHLIGHT] Using fallback search method');
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          let parent = node.parentNode;
          while (parent && parent !== document.body) {
            if (parent.classList && parent.classList.contains('reforma-text-highlight')) {
              return NodeFilter.FILTER_REJECT;
            }
            if (parent.tagName === 'MARK' && parent.classList && parent.classList.contains('reforma-text-highlight')) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
    
    let node;
    let found = false;
    
    while (node = walker.nextNode()) {
      const nodeText = node.textContent;
      const index = nodeText.indexOf(searchText);
      
      if (index !== -1) {
        try {
          // Create range for the text
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + searchText.length);
          
          // Create highlight span using mark element
          const highlightSpan = document.createElement('mark');
          const highlightId = 'reforma-highlight-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          highlightSpan.id = highlightId;
          highlightSpan.className = 'reforma-text-highlight';
          
          highlightSpan.style.cssText = `
            background-color: #FFFF00 !important;
            background: #FFFF00 !important;
            color: #000000 !important;
            padding: 4px 2px !important;
            margin: 0 !important;
            border: 2px solid #FFD700 !important;
            border-radius: 3px !important;
            display: inline !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            font-weight: bold !important;
            z-index: 999999 !important;
            position: relative !important;
          `;
          
          highlightSpan.setAttribute('data-highlight-id', highlightId);
          highlightSpan.setAttribute('data-highlight-text', searchText);
          
          // Wrap the range
          try {
            range.surroundContents(highlightSpan);
            console.log('[HIGHLIGHT] Successfully highlighted text using range');
          } catch (e) {
            const contents = range.extractContents();
            highlightSpan.appendChild(contents);
            range.insertNode(highlightSpan);
            console.log('[HIGHLIGHT] Used extractContents for range');
          }
          
          found = true;
          
          // Save to storage
          const url = window.location.href;
          chrome.storage.local.get(['pageHighlights'], (result) => {
            const allHighlights = result.pageHighlights || {};
            if (!allHighlights[url]) {
              allHighlights[url] = [];
            }
            
            allHighlights[url].push({
              id: highlightId,
              selectedText: searchText,
              color: color,
              timestamp: new Date().toISOString(),
              type: 'highlight'
            });
            
            chrome.storage.local.set({ pageHighlights: allHighlights });
          });
          
          // Clear current selection
          chrome.storage.local.set({ currentTextSelection: null });
          
          break;
        } catch (e) {
          console.error('[HIGHLIGHT] Error in fallback method:', e);
          continue;
        }
      }
    }
    
    if (!found) {
      console.warn('[HIGHLIGHT] Could not find text to highlight:', searchText.substring(0, 50));
      // Try one more time with a visual test
      const testSpan = document.createElement('mark');
      testSpan.textContent = 'TEST HIGHLIGHT';
      testSpan.style.cssText = 'background-color: #FFFF00 !important; padding: 10px !important; border: 3px solid red !important; position: fixed !important; top: 10px !important; left: 10px !important; z-index: 9999999 !important;';
      document.body.appendChild(testSpan);
      setTimeout(() => testSpan.remove(), 3000);
      console.log('[HIGHLIGHT] Added test highlight to verify styles work');
    }
  }
  
  function loadHighlights() {
    const url = window.location.href;
    chrome.storage.local.get(['pageHighlights'], (result) => {
      const allHighlights = result.pageHighlights || {};
      const highlights = allHighlights[url] || [];
      
      if (highlights.length === 0) return;
      
      // Wait a bit for page to fully load
      setTimeout(() => {
        highlights.forEach(highlight => {
          try {
            if (highlight.type === 'highlight') {
              // This is a highlight-only (no comment)
              restoreHighlightOnly(highlight);
            } else {
              // This is a comment with highlight
              restoreHighlight(highlight);
            }
          } catch (e) {
            console.log('Error loading highlight:', e);
          }
        });
      }, 500);
    });
  }
  
  function restoreHighlightOnly(highlight) {
    ensureHighlightStyles();
    
    const textToFind = highlight.selectedText.trim();
    if (!textToFind || textToFind.length < 3) return;
    
    // Check if already highlighted
    const existing = document.getElementById(highlight.id);
    if (existing) return;
    
    // Convert hex to rgba if needed (use higher opacity for visibility)
    let bgColor = highlight.color || '#FFEB3B';
    if (bgColor.startsWith('#')) {
      bgColor = hexToRgba(bgColor, 0.9); // Much more visible
    } else if (!bgColor.includes('rgba')) {
      bgColor = `rgba(255, 235, 59, 0.9)`; // Default bright yellow
    }
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          let parent = node.parentNode;
          while (parent && parent !== document.body) {
            if (parent.classList && parent.classList.contains('reforma-text-highlight')) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      const index = text.indexOf(textToFind);
      
      if (index !== -1) {
        try {
          const beforeText = node.splitText(index);
          const highlightText = beforeText.splitText(textToFind.length);
          
          const highlightSpan = document.createElement('mark');
          highlightSpan.id = highlight.id;
          highlightSpan.className = 'reforma-text-highlight';
          
          // Use very visible styles with mark element
          highlightSpan.style.cssText = `
            background-color: #FFFF00 !important;
            background: #FFFF00 !important;
            color: #000000 !important;
            padding: 4px 2px !important;
            margin: 0 !important;
            border: 2px solid #FFD700 !important;
            border-radius: 3px !important;
            display: inline !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            font-weight: bold !important;
            z-index: 999999 !important;
            position: relative !important;
          `;
          
          highlightSpan.setAttribute('data-highlight-id', highlight.id);
          highlightSpan.setAttribute('data-highlight-text', highlight.selectedText);
          
          highlightSpan.appendChild(highlightText.cloneNode(true));
          beforeText.parentNode.replaceChild(highlightSpan, beforeText);
          
          return;
        } catch (e) {
          console.log('Error restoring highlight:', e);
          continue;
        }
      }
    }
  }
  
  function restoreHighlight(highlight) {
    // Find text in the document
    const textToFind = highlight.selectedText.trim();
    if (!textToFind || textToFind.length < 3) return;
    
    // Check if already highlighted
    const existing = document.getElementById(highlight.id);
    if (existing) return;
    
    // Search for the text in the document
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip if node is inside a highlight
          let parent = node.parentNode;
          while (parent && parent !== document.body) {
            if (parent.classList && parent.classList.contains('reforma-text-highlight')) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      const index = text.indexOf(textToFind);
      
      if (index !== -1) {
        try {
          // Split the text node
          const beforeText = node.splitText(index);
          const highlightText = beforeText.splitText(textToFind.length);
          
          // Create highlight span
          const highlightSpan = document.createElement('span');
          highlightSpan.id = highlight.id;
          highlightSpan.className = 'reforma-text-highlight';
          highlightSpan.style.cssText = 'background-color: rgba(255, 235, 59, 0.4) !important; padding: 2px 0 !important; cursor: pointer !important; position: relative !important;';
          highlightSpan.setAttribute('data-comment-text', highlight.commentText);
          highlightSpan.setAttribute('data-selected-text', highlight.selectedText);
          highlightSpan.setAttribute('data-comment-id', highlight.id);
          
          // Replace the text node with the span containing the text
          highlightSpan.appendChild(highlightText.cloneNode(true));
          beforeText.parentNode.replaceChild(highlightSpan, beforeText);
          
          // Add hover tooltip
          addTooltipToHighlight(highlightSpan, highlight.commentText);
          
          // Only restore the first match to avoid duplicates
          return;
        } catch (e) {
          console.log('Error restoring highlight:', e);
          continue;
        }
      }
    }
  }
  
  function addTooltipToHighlight(highlightSpan, commentText) {
    let tooltip = null;
    
    highlightSpan.addEventListener('mouseenter', function(e) {
      tooltip = document.createElement('div');
      tooltip.className = 'reforma-comment-tooltip';
      tooltip.textContent = commentText;
      tooltip.style.cssText = `
        position: absolute !important;
        bottom: 100% !important;
        left: 0 !important;
        background: #333 !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        white-space: normal !important;
        max-width: 300px !important;
        z-index: 2147483647 !important;
        margin-bottom: 5px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        pointer-events: none !important;
      `;
      
      const arrow = document.createElement('div');
      arrow.style.cssText = `
        position: absolute !important;
        top: 100% !important;
        left: 20px !important;
        width: 0 !important;
        height: 0 !important;
        border-left: 6px solid transparent !important;
        border-right: 6px solid transparent !important;
        border-top: 6px solid #333 !important;
      `;
      tooltip.appendChild(arrow);
      
      document.body.appendChild(tooltip);
      
      const rect = highlightSpan.getBoundingClientRect();
      tooltip.style.left = rect.left + 'px';
      tooltip.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
    });
    
    highlightSpan.addEventListener('mouseleave', function() {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    });
  }
  
  // Ensure highlight styles are injected on page load
  ensureHighlightStyles();
  
  // Load highlights on page load (replaces the old loadHighlights call)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureHighlightStyles();
      loadHighlights();
    });
  } else {
    ensureHighlightStyles();
    loadHighlights();
  }

  async function initButton() {
    // Check if button already exists
    const existingButton = document.getElementById('reforma-floating-button');
    if (existingButton) {
      // Button exists, just update its visibility based on stored state
      chrome.storage.local.get(['floatingButtonVisible'], (result) => {
        const visible = result.floatingButtonVisible !== false; // Default to true
        buttonVisibilityState = visible;
        if (visible) {
          existingButton.classList.remove('hidden');
          existingButton.style.display = 'flex';
          existingButton.style.visibility = 'visible';
          existingButton.style.opacity = '1';
          existingButton.style.pointerEvents = 'auto';
        } else {
          existingButton.classList.add('hidden');
          existingButton.style.display = 'none';
          existingButton.style.visibility = 'hidden';
          existingButton.style.opacity = '0';
          existingButton.style.pointerEvents = 'none';
        }
      });
      return;
    }

    // Wait for body to be available
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initButton);
        return;
      } else {
        setTimeout(initButton, 100);
        return;
      }
    }

    // Get extension URL for the logo
    const logoUrl = chrome.runtime.getURL('jz_logo.png');

    // Create the floating button
    const button = document.createElement('button');
    button.id = 'reforma-floating-button';
    
    // Create image element for the logo
    const img = document.createElement('img');
    img.src = logoUrl;
    img.alt = 'Reforma';
    img.style.cssText = 'width: 32px; height: 32px; object-fit: contain; display: block;';
    
    // Add error handling for image load
    img.onerror = function() {
      console.error('Failed to load jz_logo_png, URL:', logoUrl);
      // Fallback: show text if image fails
      button.textContent = 'R';
    };
    
    button.appendChild(img);
    button.setAttribute('aria-label', 'Open Reforma Extension');
    button.title = 'Reforma Extension';

    // Add styles
    const style = document.createElement('style');
    style.id = 'reforma-floating-button-styles';
    style.textContent = `
      #reforma-floating-button {
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        width: 56px !important;
        height: 56px !important;
        background-color: #D84315 !important;
        color: white !important;
        border: none !important;
        border-radius: 50% !important;
        cursor: pointer !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        padding: 0 !important;
        margin: 0 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
        pointer-events: auto !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      #reforma-floating-button:hover {
        background-color: #BF360C !important;
        transform: scale(1.1) !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15) !important;
      }
      
      #reforma-floating-button:active {
        transform: scale(0.95) !important;
      }
      
      #reforma-floating-button img {
        width: 32px !important;
        height: 32px !important;
        display: block !important;
        pointer-events: none !important;
        object-fit: contain !important;
        max-width: 100% !important;
        max-height: 100% !important;
      }
      
      #reforma-floating-button.hidden {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;

    // Inject styles
    if (!document.getElementById('reforma-floating-button-styles')) {
      document.head.appendChild(style);
    }

    // Add click handler
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        chrome.runtime.sendMessage({ action: 'openPopup' }, (response) => {
          if (chrome.runtime.lastError) {
            showNotification('Click the Reforma extension icon in the toolbar to open settings');
          }
        });
      } catch (error) {
        showNotification('Click the Reforma extension icon in the toolbar to open settings');
      }
    });

    // Helper function to show notification
    function showNotification(message) {
      const existing = document.getElementById('reforma-notification');
      if (existing) {
        existing.remove();
      }

      const notification = document.createElement('div');
      notification.id = 'reforma-notification';
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed !important;
        bottom: 90px !important;
        right: 20px !important;
        background-color: #D84315 !important;
        color: white !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
        font-size: 14px !important;
        max-width: 250px !important;
        animation: slideIn 0.3s ease-out !important;
      `;
      
      if (!document.getElementById('reforma-notification-styles')) {
        const notifStyle = document.createElement('style');
        notifStyle.id = 'reforma-notification-styles';
        notifStyle.textContent = `
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `;
        document.head.appendChild(notifStyle);
      }
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 3000);
    }

    // Append button to body
    try {
      document.body.appendChild(button);
      console.log('Reforma floating button injected successfully');
      
      // Check initial state from storage
      chrome.storage.local.get(['floatingButtonVisible'], (result) => {
        const visible = result.floatingButtonVisible !== false; // Default to true
        buttonVisibilityState = visible;
        if (!visible) {
          button.classList.add('hidden');
          button.style.display = 'none';
          button.style.visibility = 'hidden';
          button.style.opacity = '0';
          button.style.pointerEvents = 'none';
          console.log('Floating button hidden by default');
        } else {
          button.classList.remove('hidden');
          button.style.display = 'flex';
          button.style.visibility = 'visible';
          button.style.opacity = '1';
          button.style.pointerEvents = 'auto';
          console.log('Floating button visible by default');
        }
      });
    } catch (error) {
      console.error('Error injecting Reforma button:', error);
      setTimeout(initButton, 500);
      return;
    }

    // Handle page navigation (for SPAs)
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => {
          if (!document.getElementById('reforma-floating-button') && document.body) {
            // Reinitialize button and apply stored visibility state
            initButton();
          } else {
            // Button exists, just sync visibility
            const button = document.getElementById('reforma-floating-button');
            if (button) {
              chrome.storage.local.get(['floatingButtonVisible'], (result) => {
                const visible = result.floatingButtonVisible !== false;
                buttonVisibilityState = visible;
                if (visible) {
                  button.classList.remove('hidden');
                  button.style.display = 'flex';
                  button.style.visibility = 'visible';
                  button.style.opacity = '1';
                  button.style.pointerEvents = 'auto';
                } else {
                  button.classList.add('hidden');
                  button.style.display = 'none';
                  button.style.visibility = 'hidden';
                  button.style.opacity = '0';
                  button.style.pointerEvents = 'none';
                }
              });
            }
          }
        }, 100);
      }
    });
    observer.observe(document, { subtree: true, childList: true });
  }

  // Initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initButton);
  } else {
    initButton();
  }
})();
