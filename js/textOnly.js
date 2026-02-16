import { getActiveTab } from './utils.js';
import { updateUI } from './ui.js';

const textOnlyButton = document.getElementById('textOnlyButton');

let textOnlyMode = false;

// Typography system mapping
  const typographyStyles = {
    'h1': { fontSize: 19.44, fontWeight: 700, lineHeight: 1.6, letterSpacing: 0.03 },
    'h2': { fontSize: 18.22, fontWeight: 600, lineHeight: 1.6, letterSpacing: 0.03 },
    'h3': { fontSize: 17.63, fontWeight: 600, lineHeight: 1.6, letterSpacing: 0.03 },
    'h4': { fontSize: 17.07, fontWeight: 500, lineHeight: 1.6, letterSpacing: 0.03 },
    'h5': { fontSize: 16.8, fontWeight: 500, lineHeight: 1.6, letterSpacing: 0.03 },
    'h6': { fontSize: 16.53, fontWeight: 500, lineHeight: 1.6, letterSpacing: 0.03 },
    'p': { fontSize: 16, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0.03 },
    'body': { fontSize: 16, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0.03 },
    'body-xl': { fontSize: 16.26, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0.03 },
    'body-small': { fontSize: 15.74, fontWeight: 400, lineHeight: 1.65, letterSpacing: 0.03 },
    'caption': { fontSize: 15.24, fontWeight: 400, lineHeight: 1.65, letterSpacing: 0.03 },
    'display-large': { fontSize: 20.74, fontWeight: 800, lineHeight: 1.6, letterSpacing: 0.025 },
    'display-medium': { fontSize: 20.08, fontWeight: 800, lineHeight: 1.6, letterSpacing: 0.025 }
  };

  function getTypographyStyle(tagName, className = '') {
    const tag = tagName.toLowerCase();
    
    // Check for display classes first
    if (className.includes('display-large') || className.includes('display-lg')) {
      return typographyStyles['display-large'];
    }
    if (className.includes('display-medium') || className.includes('display-md')) {
      return typographyStyles['display-medium'];
    }
    if (className.includes('body-xl')) {
      return typographyStyles['body-xl'];
    }
    if (className.includes('body-small') || className.includes('body-sm')) {
      return typographyStyles['body-small'];
    }
    if (className.includes('caption')) {
      return typographyStyles['caption'];
    }
    
    // Default to tag-based styles
    return typographyStyles[tag] || typographyStyles['body'];
  }

function applyTypographyStyle(tagName, className, text) {
    const style = getTypographyStyle(tagName, className);
  const styleStr = `
    font-family: 'Urbanist', sans-serif;
    font-size: ${style.fontSize}px;
    font-weight: ${style.fontWeight};
    line-height: ${style.lineHeight};
    letter-spacing: ${style.letterSpacing}em;
    margin-top: ${tagName.startsWith('h') ? '1.5em' : '0'};
    margin-bottom: ${tagName.startsWith('h') ? '0.5em' : '1em'};
    color: #333;
  `.trim().replace(/\s+/g, ' ');
  
  return `<${tagName} style="${styleStr}">${text}</${tagName}>`;
}

// Injected function to toggle text-only view
export function injectedToggleTextOnly(enabled = false, includeImages = false) {
  // Typography styles must be inside the function for serialization
  const typographyStyles = {
    'h1': { fontSize: 19.44, fontWeight: 700, lineHeight: 1.6, letterSpacing: 0.03 },
    'h2': { fontSize: 18.22, fontWeight: 600, lineHeight: 1.6, letterSpacing: 0.03 },
    'h3': { fontSize: 17.63, fontWeight: 600, lineHeight: 1.6, letterSpacing: 0.03 },
    'h4': { fontSize: 17.07, fontWeight: 500, lineHeight: 1.6, letterSpacing: 0.03 },
    'h5': { fontSize: 16.8, fontWeight: 500, lineHeight: 1.6, letterSpacing: 0.03 },
    'h6': { fontSize: 16.53, fontWeight: 500, lineHeight: 1.6, letterSpacing: 0.03 },
    'p': { fontSize: 16, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0.03 },
    'body': { fontSize: 16, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0.03 },
    'body-xl': { fontSize: 16.26, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0.03 },
    'body-small': { fontSize: 15.74, fontWeight: 400, lineHeight: 1.65, letterSpacing: 0.03 },
    'caption': { fontSize: 15.24, fontWeight: 400, lineHeight: 1.65, letterSpacing: 0.03 },
    'display-large': { fontSize: 20.74, fontWeight: 800, lineHeight: 1.6, letterSpacing: 0.025 },
    'display-medium': { fontSize: 20.08, fontWeight: 800, lineHeight: 1.6, letterSpacing: 0.025 }
  };

  function getTypographyStyle(tagName, className) {
    const tag = tagName.toLowerCase();
    if (typeof className !== 'string') className = '';
    if (className.includes('display-large') || className.includes('display-lg')) return typographyStyles['display-large'];
    if (className.includes('display-medium') || className.includes('display-md')) return typographyStyles['display-medium'];
    if (className.includes('body-xl')) return typographyStyles['body-xl'];
    if (className.includes('body-small') || className.includes('body-sm')) return typographyStyles['body-small'];
    if (className.includes('caption')) return typographyStyles['caption'];
    return typographyStyles[tag] || typographyStyles['body'];
  }

  function applyTypographyStyle(tagName, className, text) {
    const style = getTypographyStyle(tagName, className);
    const styleStr = [
      "font-family: 'Urbanist', sans-serif",
      `font-size: ${style.fontSize}px`,
      `font-weight: ${style.fontWeight}`,
      `line-height: ${style.lineHeight}`,
      `letter-spacing: ${style.letterSpacing}em`,
      `margin-top: ${tagName.toLowerCase().startsWith('h') ? '1.5em' : '0'}`,
      `margin-bottom: ${tagName.toLowerCase().startsWith('h') ? '0.5em' : '1em'}`,
      'color: #333'
    ].join('; ');
    return `<${tagName} style="${styleStr}">${text}</${tagName}>`;
  }

  // Selectors for elements to skip (ads, nav, sidebars, etc.)
  const skipSelectors = [
    'nav', 'header', 'footer', 'aside', '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
    '.ad', '.ads', '.advertisement', '.sponsored', '.promo', '.sidebar', '.widget', '.social-share',
    '[class*="sidebar"]', '[class*="nav"]', '[id*="sidebar"]', '[id*="nav"]', '[class*="ad-"]',
    '[class*="advertisement"]', '[data-ad]', '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]',
    'iframe', 'script', 'style', 'noscript', '.comments', '[class*="comment"]', '[id*="comment"]'
  ].join(',');

  function shouldSkipElement(el) {
    if (!el || !el.tagName) return true;
    try {
      if (el.matches && el.matches(skipSelectors)) return true;
      if (el.closest && el.closest(skipSelectors)) return true;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function createDivider() {
    return '<hr style="border:none;border-top:2px solid #e5e7eb;margin:2.5em 0;"/>';
  }

  const overlayId = 'reforma-text-only-overlay';
  let overlay = document.getElementById(overlayId);
  
  if (enabled) {
    console.log('Text-only view enabled. Include images:', includeImages);
    // Find main content containers (articles, posts, main sections)
    const contentGroups = [];
    
    // Special handling for Twitter/X
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    if (tweets.length > 0) {
      tweets.forEach((tweet) => {
        if (shouldSkipElement(tweet)) return;
        const group = [];
        
        // Try to get username/author
        const userNameEl = tweet.querySelector('[data-testid="User-Name"]');
        if (userNameEl) {
          const userName = userNameEl.textContent?.trim();
          if (userName) {
            group.push(applyTypographyStyle('h3', '', userName));
          }
        }
        
        // Get tweet text - try multiple selectors
        let tweetText = '';
        const tweetTextEl = tweet.querySelector('[data-testid="tweetText"]');
        if (tweetTextEl) {
          tweetText = tweetTextEl.textContent?.trim();
        } else {
          // Fallback: get text from div with lang attribute (tweet text container)
          const langDiv = tweet.querySelector('div[lang]');
          if (langDiv) {
            tweetText = langDiv.textContent?.trim();
          }
        }
        
        if (tweetText && tweetText.length > 5) {
          group.push(applyTypographyStyle('p', '', tweetText));
        }
        
        // Include images if enabled
        if (includeImages) {
          const images = tweet.querySelectorAll('img[src]');
          console.log('Tweet images found:', images.length);
          images.forEach((img) => {
            const src = img.src;
            const alt = img.alt || '';
            console.log('Image src:', src, 'naturalWidth:', img.naturalWidth);
            // Filter out emojis, avatars, and profile images - be more permissive
            const isSmallIcon = src.includes('emoji') || src.includes('twemoji') || 
                               src.includes('profile_image');
            if (src && !isSmallIcon && src.startsWith('http')) {
              console.log('Adding image:', src);
              group.push(`<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;margin:1em 0;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);"/>`);
            }
          });
        }
        
        if (group.length > 0) contentGroups.push(group.join('\n'));
      });
    }
    
    // If no tweets found, look for general content containers
    if (contentGroups.length === 0) {
      const mainContainers = document.querySelectorAll('article, [role="article"], main, [role="main"], .post, [class*="post"], [class*="article"], [class*="content"]');
      
      if (mainContainers.length > 0) {
        mainContainers.forEach((container) => {
          if (shouldSkipElement(container)) return;
          const text = container.textContent?.trim();
          if (!text || text.length < 30) return;
          
          const group = [];
          const textElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p');
          textElements.forEach((el) => {
            if (shouldSkipElement(el)) return;
            const elText = el.textContent?.trim();
            if (elText && elText.length > 10) {
              const tagName = el.tagName.toLowerCase();
              const className = el.className || '';
              group.push(applyTypographyStyle(tagName, className, elText));
            }
          });
          
          // Include images if enabled
          if (includeImages) {
            const images = container.querySelectorAll('img[src]');
            console.log('Container images found:', images.length);
            images.forEach((img) => {
              const src = img.src;
              const alt = img.alt || '';
              console.log('Image src:', src);
              // Filter out small icons and emojis - be more permissive
              const isSmallIcon = src.includes('emoji') || src.includes('icon.') || 
                                 src.includes('logo.') || src.includes('avatar.');
              if (src && !isSmallIcon && src.startsWith('http')) {
                console.log('Adding image:', src);
                group.push(`<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;margin:1em 0;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);"/>`);
              }
            });
          }
          
          if (group.length > 0) contentGroups.push(group.join('\n'));
        });
      }
    }
    
    // Fallback: extract all text elements not in skip list
    if (contentGroups.length === 0) {
      const textSelectors = 'p, h1, h2, h3, h4, h5, h6';
      const elements = Array.from(document.querySelectorAll(textSelectors));
      const processed = new Set();
      const fallbackGroup = [];

      elements.forEach((el) => {
        if (processed.has(el) || shouldSkipElement(el)) return;
        const text = el.textContent?.trim();
        if (text && text.length > 20) {
          let isNested = false;
          for (const processedEl of processed) {
            if (processedEl.contains(el) && processedEl !== el) {
              isNested = true;
              break;
            }
          }
          if (!isNested) {
            const tagName = el.tagName.toLowerCase();
            const className = el.className || '';
            fallbackGroup.push(applyTypographyStyle(tagName, className, text));
            processed.add(el);
          }
        }
      });
      
      if (fallbackGroup.length > 0) contentGroups.push(fallbackGroup.join('\n'));
    }

    let textContent = contentGroups.join(createDivider());

    if (!textContent) {
      const bodyText = document.body.innerText || document.body.textContent || '';
      const paragraphs = bodyText.split(/\n\s*\n/).filter(p => p.trim().length > 20);
      const bodyStyle = typographyStyles['body'];
      const styleStr = `
        font-family: 'Urbanist', sans-serif;
        font-size: ${bodyStyle.fontSize}px;
        font-weight: ${bodyStyle.fontWeight};
        line-height: ${bodyStyle.lineHeight};
        letter-spacing: ${bodyStyle.letterSpacing}em;
        margin-bottom: 1em;
        color: #333;
      `.trim().replace(/\s+/g, ' ');
      textContent = paragraphs.map(p => `<p style="${styleStr}">${p.trim()}</p>\n`).join('');
    }
    
    // Create overlay
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = overlayId;
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        z-index: 999999;
        overflow-y: auto;
        font-family: 'Urbanist', sans-serif;
        padding: 2rem;
          box-sizing: border-box;
      `;
      
      // Add close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕ Close Text View';
      closeBtn.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        padding: 0.5rem 1rem;
        background: #D643E3;
        color: white;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        font-family: 'Urbanist', sans-serif;
        font-size: 0.875rem;
        z-index: 1000000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;
      closeBtn.onclick = () => {
        injectedToggleTextOnly(false);
            // Trigger update in popup
            window.dispatchEvent(new CustomEvent('reforma-text-only-closed'));
      };
      overlay.appendChild(closeBtn);
      
      // Add content container
      const content = document.createElement('div');
      content.id = 'reforma-text-content';
      const bodyStyle = typographyStyles['body'];
      content.style.cssText = `
        max-width: 700px;
        margin: 0 auto;
        padding-top: 3rem;
        font-family: 'Urbanist', sans-serif;
        font-size: ${bodyStyle.fontSize}px;
        font-weight: ${bodyStyle.fontWeight};
        line-height: ${bodyStyle.lineHeight};
        letter-spacing: ${bodyStyle.letterSpacing}em;
        color: #333;
      `;
      overlay.appendChild(content);
      
      document.body.appendChild(overlay);
    }
    
    // Update content
    const content = document.getElementById('reforma-text-content');
    if (content) {
      content.innerHTML = textContent || '<p>No substantial text content found on this page.</p>';
    }
    
    // Hide original body content (but don't remove it)
    if (!window.reformaOriginalBodyDisplay) {
      window.reformaOriginalBodyDisplay = new Map();
      Array.from(document.body.children).forEach(child => {
        if (child.id !== overlayId) {
          window.reformaOriginalBodyDisplay.set(child, child.style.display);
          child.style.display = 'none';
        }
      });
    }
    
    document.body.style.overflow = 'hidden';
    
  } else {
    // Restore original view
    if (overlay) {
          overlay.remove();
    }
    
    // Restore original display styles
    if (window.reformaOriginalBodyDisplay) {
      window.reformaOriginalBodyDisplay.forEach((display, el) => {
        if (el && el.parentNode) {
          el.style.display = display || '';
        }
      });
      window.reformaOriginalBodyDisplay = null;
    }
    
    document.body.style.overflow = '';
  }
}

export async function toggleTextOnly() {
  textOnlyMode = !textOnlyMode;
  updateButtonText();
  
  const tab = await getActiveTab();
  if (!tab?.id) return;
  
  // Check if images should be included
  const includeImagesCheckbox = document.getElementById('includeImagesCheckbox');
  const includeImages = includeImagesCheckbox ? includeImagesCheckbox.checked : false;
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedToggleTextOnly,
      args: [textOnlyMode, includeImages],
    });
  } catch (e) {
    console.error('Error toggling text-only view:', e);
    textOnlyMode = !textOnlyMode; // Revert on error
    updateButtonText();
  }
}

function updateButtonText() {
  if (textOnlyButton) {
    textOnlyButton.textContent = `Text Only View: ${textOnlyMode ? 'ON' : 'OFF'}`;
  }
}

// Listen for close event from injected script
chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
  if (message.type === 'text-only-closed') {
    textOnlyMode = false;
    updateButtonText();
  }
});

// Initialize event listener
if (textOnlyButton) {
  textOnlyButton.addEventListener('click', toggleTextOnly);
}
