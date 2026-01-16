// Text Highlight Reader - Reads selected/highlighted text from the active tab
console.log("Text Highlight Reader popup loaded!");

document.addEventListener("DOMContentLoaded", async () => {
  const statusDiv = document.getElementById("status");
  const textContentDiv = document.getElementById("textContent");
  const refreshBtn = document.getElementById("refreshBtn");

  // Function to get selected text from the active tab
  async function getSelectedText() {
    // Ensure DOM elements exist
    if (!statusDiv || !textContentDiv) {
      console.error("DOM elements not found");
      return;
    }

    try {
      statusDiv.textContent = "Reading highlighted text...";
      statusDiv.className = "status loading";

      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.id) {
        throw new Error("No active tab found");
      }

      // Check if we can access this tab (not a special page)
      if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("edge://"))) {
        throw new Error("Cannot read text from Chrome internal pages. Please navigate to a regular webpage.");
      }

      // Check if scripting API is available
      if (!chrome.scripting || !chrome.scripting.executeScript) {
        throw new Error("Scripting API not available. Please reload the extension in chrome://extensions/");
      }

      // Check if we're on Google Docs - if so, execute in all frames
      const isGoogleDocs = tab.url && tab.url.includes('docs.google.com');
      
      // Execute script to get selected text with style information
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: isGoogleDocs },
        func: () => {
          // Special handling for Google Docs
          function getGoogleDocsSelection() {
            try {
              // Google Docs uses iframes - find the document iframe
              const iframes = document.querySelectorAll('iframe');
              for (let iframe of iframes) {
                try {
                  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                  if (iframeDoc) {
                    const iframeSelection = iframe.contentWindow?.getSelection();
                    if (iframeSelection && iframeSelection.rangeCount > 0) {
                      return {
                        selection: iframeSelection,
                        document: iframeDoc,
                        window: iframe.contentWindow
                      };
                    }
                  }
                } catch (e) {
                  // Cross-origin iframe, skip
                  continue;
                }
              }
              
              // Try to find the editor element directly
              const editor = document.getElementById('kix-appview-editor') || 
                            document.querySelector('.kix-appview-editor') ||
                            document.querySelector('[role="textbox"]');
              
              if (editor) {
                const editorSelection = window.getSelection();
                if (editorSelection && editorSelection.rangeCount > 0) {
                  return {
                    selection: editorSelection,
                    document: document,
                    window: window
                  };
                }
              }
            } catch (e) {
              console.error('Error accessing Google Docs:', e);
            }
            return null;
          }

          // Check if we're on Google Docs
          const isGoogleDocs = window.location.hostname === 'docs.google.com';
          let selection = window.getSelection();
          let doc = document;
          let win = window;
          
          if (isGoogleDocs) {
            const gdocsContext = getGoogleDocsSelection();
            if (gdocsContext) {
              selection = gdocsContext.selection;
              doc = gdocsContext.document;
              win = gdocsContext.window;
            } else {
              // Fallback: try to get text from Google Docs using the main window selection
              const mainSelection = window.getSelection();
              if (mainSelection && mainSelection.toString().trim()) {
                // Google Docs selection might be available in main window
                selection = mainSelection;
                doc = document;
                win = window;
              } else {
                // Last resort: try to extract from Google Docs DOM structure
                try {
                  const editor = document.getElementById('kix-appview-editor') || 
                                document.querySelector('.kix-appview-editor') ||
                                document.querySelector('[role="textbox"]');
                  
                  if (editor) {
                    // Try to get selected text using various methods
                    const selectedText = window.getSelection()?.toString() || 
                                       editor.innerText?.substring(0, 1000) || 
                                       editor.textContent?.substring(0, 1000);
                    
                    if (selectedText && selectedText.trim()) {
                      // Try to get style from selected elements in Google Docs
                      const selectedElements = editor.querySelectorAll('.kix-paragraphrenderer, .kix-lineview-text-block');
                      let style = {
                        fontWeight: 'normal',
                        fontStyle: 'normal',
                        fontSize: '14px',
                        fontFamily: 'Arial',
                        color: 'rgb(32, 33, 36)',
                        textDecoration: 'none',
                        backgroundColor: 'transparent',
                      };
                      
                      if (selectedElements.length > 0) {
                        const firstEl = selectedElements[0];
                        const computed = window.getComputedStyle(firstEl);
                        style = {
                          fontWeight: computed.fontWeight || 'normal',
                          fontStyle: computed.fontStyle || 'normal',
                          fontSize: computed.fontSize || '14px',
                          fontFamily: computed.fontFamily?.split(',')[0]?.replace(/['"]/g, '')?.trim() || 'Arial',
                          color: computed.color || 'rgb(32, 33, 36)',
                          textDecoration: computed.textDecoration || 'none',
                          backgroundColor: 'transparent',
                        };
                      }
                      
                      return [{
                        text: selectedText.trim(),
                        style: style
                      }];
                    }
                  }
                } catch (e) {
                  console.error('Error extracting from Google Docs:', e);
                }
                return null;
              }
            }
          }

          if (!selection || selection.rangeCount === 0) {
            return null;
          }

          const textSegments = [];
          const range = selection.getRangeAt(0);

          // Function to extract style properties from an element
          function getStyleProperties(element) {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
              return null;
            }
            const computed = win.getComputedStyle(element);
            return {
              fontWeight: computed.fontWeight,
              fontStyle: computed.fontStyle,
              fontSize: computed.fontSize,
              fontFamily: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(), // Get first font family
              color: computed.color,
              textDecoration: computed.textDecoration,
              backgroundColor: computed.backgroundColor !== 'rgba(0, 0, 0, 0)' && computed.backgroundColor !== 'transparent' 
                ? computed.backgroundColor 
                : 'transparent',
            };
          }

          // Function to get the effective style for a text node
          function getTextNodeStyle(textNode) {
            // Get the parent element
            let element = textNode.parentElement;
            if (!element) {
              element = textNode.parentNode;
            }
            
            // If we have an element, get its computed style
            if (element && element.nodeType === Node.ELEMENT_NODE) {
              return getStyleProperties(element);
            }
            
            // Fallback to body style
            return getStyleProperties(doc.body) || {
              fontWeight: 'normal',
              fontStyle: 'normal',
              fontSize: '16px',
              fontFamily: 'Arial',
              color: 'rgb(0, 0, 0)',
              textDecoration: 'none',
              backgroundColor: 'transparent',
            };
          }

          // Helper function to create style signature (needed in injected script)
          function createStyleSignature(style) {
            if (!style) return 'default';
            return `${style.fontWeight || 'normal'}-${style.fontStyle || 'normal'}-${style.fontSize || '16px'}-${(style.fontFamily || 'Arial').substring(0, 20)}-${style.color || 'rgb(0,0,0)'}-${style.textDecoration || 'none'}`;
          }

          // Extract text segments by iterating through the actual range
          const startContainer = range.startContainer;
          const endContainer = range.endContainer;
          const startOffset = range.startOffset;
          const endOffset = range.endOffset;

          // Extract text segments by iterating through the actual range
          // Simple case: single text node
          if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
            const text = startContainer.textContent.substring(startOffset, endOffset);
            if (text.trim()) {
              const style = getTextNodeStyle(startContainer);
              textSegments.push({ text: text, style: style });
            }
          } else {
              // Multi-node: use a simpler approach
              const walker = doc.createTreeWalker(
                range.commonAncestorContainer,
                NodeFilter.SHOW_TEXT,
                null
              );

              let node;
              let currentText = '';
              let currentStyle = null;
              let lastStyleSig = null;

              while (node = walker.nextNode()) {
                // Check if this node is within our range
                const nodeRange = doc.createRange();
                nodeRange.selectNodeContents(node);
                
                if (range.compareBoundaryPoints(Range.START_TO_START, nodeRange) > 0) continue;
                if (range.compareBoundaryPoints(Range.END_TO_END, nodeRange) < 0) break;

                let text = node.textContent;
                
                // Adjust for start/end boundaries
                if (node === startContainer) {
                  text = text.substring(startOffset);
                }
                if (node === endContainer) {
                  text = text.substring(0, endOffset);
                }

                if (text && text.trim()) {
                  const style = getTextNodeStyle(node);
                  const styleSig = createStyleSignature(style);
                  
                  if (lastStyleSig === null || lastStyleSig !== styleSig) {
                    // Style changed - save previous segment
                    if (currentText && currentStyle) {
                      textSegments.push({ text: currentText, style: currentStyle });
                    }
                    currentText = text;
                    currentStyle = style;
                    lastStyleSig = styleSig;
                  } else {
                    // Same style - append to current segment
                    currentText += text;
                  }
                }
              }

              // Add the last segment
              if (currentText && currentStyle) {
                textSegments.push({ text: currentText, style: currentStyle });
              }
          }

          // Fallback: if no segments found, try simple extraction
          if (textSegments.length === 0) {
            const text = selection.toString().trim();
            if (text) {
              const container = range.commonAncestorContainer;
              const element = container.nodeType === Node.TEXT_NODE 
                ? container.parentElement 
                : container;
              const defaultStyle = element ? getStyleProperties(element) : getStyleProperties(doc.body);
              if (defaultStyle) {
                textSegments.push({ text: text, style: defaultStyle });
              }
            }
          }

          return textSegments.length > 0 ? textSegments : null;
        },
      });

      // Handle results - could be single result or array (when allFrames is true)
      let textSegments = null;
      
      if (results && Array.isArray(results)) {
        // Find the first frame that has a valid result with text segments
        for (let result of results) {
          if (result && result.result) {
            if (Array.isArray(result.result) && result.result.length > 0) {
              textSegments = result.result;
              break;
            } else if (result.result !== null && typeof result.result === 'object') {
              textSegments = [result.result];
              break;
            }
          }
        }
      } else if (results && results[0] && results[0].result) {
        textSegments = Array.isArray(results[0].result) ? results[0].result : [results[0].result];
      }

      if (textSegments) {

        if (!textSegments || !Array.isArray(textSegments) || textSegments.length === 0) {
          if (statusDiv) {
            statusDiv.textContent = "No text highlighted";
            statusDiv.className = "status warning";
          }
          if (textContentDiv) {
            textContentDiv.innerHTML =
              '<p class="placeholder">Please highlight some text on the page first.</p>';
          }
          return;
        }

        // Group segments by style signature
        const styleGroups = {};
        const highlightColors = [
          "#fff9c4", // Light yellow
          "#c8e6c9", // Light green
          "#bbdefb", // Light blue
          "#f8bbd0", // Light pink
          "#d1c4e9", // Light purple
          "#ffe0b2", // Light orange
          "#b2ebf2", // Light cyan
          "#ffccbc", // Light coral
        ];

        textSegments.forEach((segment, index) => {
          if (!segment || !segment.style || !segment.text) {
            console.warn("Invalid segment:", segment);
            return;
          }
          const styleSig = createStyleSignature(segment.style);
          if (!styleGroups[styleSig]) {
            styleGroups[styleSig] = {
              segments: [],
              style: segment.style,
              colorIndex: Object.keys(styleGroups).length % highlightColors.length,
            };
          }
          styleGroups[styleSig].segments.push(segment);
        });

        // Build display HTML
        let displayHTML = '<div class="text-display">';
        let totalChars = 0;

        Object.values(styleGroups).forEach((group, groupIndex) => {
          const highlightColor = highlightColors[group.colorIndex];
          const styleInfo = formatStyleInfo(group.style);
          
          group.segments.forEach((segment) => {
            totalChars += segment.text.length;
            displayHTML += `<span class="text-segment" style="background-color: ${highlightColor}; padding: 2px 4px; border-radius: 3px; margin: 1px;" data-style="${escapeHtml(styleInfo)}">${escapeHtml(segment.text)}</span>`;
          });
        });

        displayHTML += '</div>';

        // Add style legend
        let legendHTML = '<div class="style-legend"><strong>Style Groups:</strong><ul>';
        Object.values(styleGroups).forEach((group, index) => {
          const highlightColor = highlightColors[group.colorIndex];
          const styleInfo = formatStyleInfo(group.style);
          legendHTML += `<li><span class="legend-color" style="background-color: ${highlightColor};"></span> ${styleInfo}</li>`;
        });
        legendHTML += '</ul></div>';

        if (statusDiv) {
          statusDiv.textContent = "✓ Text found!";
          statusDiv.className = "status success";
        }
        if (textContentDiv) {
          textContentDiv.innerHTML = displayHTML + legendHTML + `
            <div class="text-info">
              <span>${totalChars} characters, ${Object.keys(styleGroups).length} style group(s)</span>
            </div>
          `;
        }
      } else {
        throw new Error("No text found");
      }
    } catch (error) {
      console.error("Error:", error);
      if (statusDiv) {
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.className = "status error";
      }
      if (textContentDiv) {
        textContentDiv.innerHTML =
          '<p class="placeholder">Could not read highlighted text. Make sure you have text selected on the page.</p>';
      }
    }
  }

  // Get selected text when popup opens
  await getSelectedText();

  // Refresh button functionality
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      await getSelectedText();
    });
  }
});

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Helper function to create style signature
function createStyleSignature(style) {
  if (!style) return 'default';
  return `${style.fontWeight || 'normal'}-${style.fontStyle || 'normal'}-${style.fontSize || '16px'}-${(style.fontFamily || 'Arial').substring(0, 20)}-${style.color || 'rgb(0,0,0)'}-${style.textDecoration || 'none'}`;
}

// Helper function to format style information for display
function formatStyleInfo(style) {
  const parts = [];
  
  if (parseInt(style.fontWeight) >= 600 || style.fontWeight === 'bold') {
    parts.push('Bold');
  }
  if (style.fontStyle === 'italic') {
    parts.push('Italic');
  }
  if (style.textDecoration && style.textDecoration !== 'none') {
    parts.push('Underline');
  }
  
  parts.push(style.fontSize);
  parts.push(style.color);
  
  return parts.join(' ---') || 'Default';
}

