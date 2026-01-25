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
    return true;
  });

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
