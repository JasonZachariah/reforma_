import { getActiveTab } from './utils.js';
import { updateUI } from './ui.js';

// DOM elements
const textOnlyButton = document.getElementById('textOnlyButton');
const includeImagesCheckbox = document.getElementById('includeImagesCheckbox');

let textOnlyMode = false;
let includeImages = false;

// Injected function to toggle text-only view
export function injectedToggleTextOnly(enabled = false, includeImages = false) {
  // Typography system mapping (needs to be inside injected function)
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

  function htmlEscape(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // Remove emojis from text
  function removeEmojis(text) {
    if (!text) return text;
    // Remove emoji characters (Unicode ranges for emojis)
    return text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Miscellaneous Symbols and Pictographs
               .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
               .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map Symbols
               .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Miscellaneous Symbols
               .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
               .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flag emojis
               .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
               .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
               .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
               .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
               .replace(/[\u{200D}]/gu, '')            // Zero Width Joiner
               .replace(/[\u{FE0F}]/gu, '')           // Variation Selector-16
               .trim();
  }

  function processLinksInElement(el) {
    if (!el) return '';
    
    let html = '';
    const children = Array.from(el.childNodes);
    
    children.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Remove emojis from text nodes
        const text = removeEmojis(node.textContent);
        html += htmlEscape(text);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName?.toLowerCase();
        let href = node.getAttribute('href') || '';
        const onclick = node.getAttribute('onclick') || '';
        const role = node.getAttribute('role') || '';
        let text = node.textContent?.trim() || '';
        // Remove emojis from text
        text = removeEmojis(text);
        
        // Check if it's a link element
        if (tagName === 'a') {
          // Direct anchor tag - create clickable link
          href = href || node.getAttribute('data-href') || '#';
          const linkStyle = `color: #0066cc; text-decoration: underline; text-decoration-color: #0066cc; cursor: pointer;`;
          const target = node.getAttribute('target') || '_blank';
          const rel = node.getAttribute('rel') || 'noopener noreferrer';
          html += `<a href="${htmlEscape(href)}" target="${htmlEscape(target)}" rel="${htmlEscape(rel)}" style="${linkStyle}">${htmlEscape(text)}</a>`;
        } else if (node.closest('a')) {
          // Element is inside an anchor tag - get the parent anchor's href
          const parentLink = node.closest('a');
          href = parentLink.getAttribute('href') || parentLink.getAttribute('data-href') || '#';
          const linkStyle = `color: #0066cc; text-decoration: underline; text-decoration-color: #0066cc; cursor: pointer;`;
          const target = parentLink.getAttribute('target') || '_blank';
          const rel = parentLink.getAttribute('rel') || 'noopener noreferrer';
          html += `<a href="${htmlEscape(href)}" target="${htmlEscape(target)}" rel="${htmlEscape(rel)}" style="${linkStyle}">${htmlEscape(text)}</a>`;
        } else if ((tagName === 'span' || tagName === 'div') && (href || onclick || role === 'link')) {
          // Span or div that acts as a link
          href = href || (onclick ? '#' : '#');
          const linkStyle = `color: #0066cc; text-decoration: underline; text-decoration-color: #0066cc; cursor: pointer;`;
          if (onclick) {
            // For onclick handlers, create a link that executes the onclick
            html += `<a href="${htmlEscape(href)}" onclick="${htmlEscape(onclick)}" style="${linkStyle}">${htmlEscape(text)}</a>`;
          } else {
            html += `<a href="${htmlEscape(href)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${htmlEscape(text)}</a>`;
          }
        } else {
          // Recursively process nested elements
          html += processLinksInElement(node);
        }
      }
    });
    
    return html;
  }

  function applyTypographyStyle(tagName, className, element) {
    const style = getTypographyStyle(tagName, className);
    
    // Process the element to preserve links (emojis are removed in processLinksInElement)
    const content = processLinksInElement(element);
    
    const styleStr = `font-family: 'Inter', sans-serif; font-size: ${style.fontSize}px; font-weight: ${style.fontWeight}; line-height: ${style.lineHeight}; letter-spacing: ${style.letterSpacing}em; margin-top: ${tagName.startsWith('h') ? '1.5em' : '0'}; margin-bottom: ${tagName.startsWith('h') ? '0.5em' : '1em'}; color: #333;`;
    
    return `<${tagName} style="${styleStr}">${content}</${tagName}>`;
  }
  
  // Detect social media platform
  function detectSocialMediaPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return 'twitter';
    }
    if (hostname.includes('facebook.com')) {
      return 'facebook';
    }
    if (hostname.includes('instagram.com')) {
      return 'instagram';
    }
    if (hostname.includes('linkedin.com')) {
      return 'linkedin';
    }
    if (hostname.includes('reddit.com')) {
      return 'reddit';
    }
    if (hostname.includes('youtube.com')) {
      return 'youtube';
    }
    if (hostname.includes('tiktok.com')) {
      return 'tiktok';
    }
    
    return null;
  }

  // Extract social media post structure
  function extractSocialMediaPost(element, platform) {
    const post = {
      username: '',
      timestamp: '',
      content: '',
      engagement: '',
      images: [],
      element: element
    };
    
    // Common selectors for usernames
    const usernameSelectors = [
      '[data-testid="User-Name"]',
      '[data-testid="UserName"]',
      '.username',
      '[class*="username"]',
      '[class*="user"]',
      '[class*="author"]',
      'a[href*="/user/"]',
      'a[href*="/@"]',
      '[aria-label*="user"]',
      '[aria-label*="author"]'
    ];
    
    // Common selectors for timestamps
    const timeSelectors = [
      'time',
      '[datetime]',
      '[data-testid*="time"]',
      '[class*="time"]',
      '[class*="timestamp"]',
      '[class*="date"]'
    ];
    
    // Common selectors for engagement (likes, retweets, etc.)
    const engagementSelectors = [
      '[data-testid*="like"]',
      '[data-testid*="reply"]',
      '[data-testid*="retweet"]',
      '[class*="like"]',
      '[class*="retweet"]',
      '[class*="share"]',
      '[aria-label*="like"]',
      '[aria-label*="retweet"]'
    ];
    
    // Try to find username
    for (const selector of usernameSelectors) {
      const usernameEl = element.querySelector(selector);
      if (usernameEl) {
        post.username = usernameEl.textContent?.trim() || '';
        if (post.username) break;
      }
    }
    
    // Try to find timestamp
    for (const selector of timeSelectors) {
      const timeEl = element.querySelector(selector);
      if (timeEl) {
        post.timestamp = timeEl.textContent?.trim() || timeEl.getAttribute('datetime') || timeEl.getAttribute('title') || '';
        if (post.timestamp) break;
      }
    }
    
    // Try to find engagement metrics
    const engagementTexts = [];
    for (const selector of engagementSelectors) {
      const engagementEls = element.querySelectorAll(selector);
      engagementEls.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.match(/\d+/)) {
          engagementTexts.push(text);
        }
      });
    }
    if (engagementTexts.length > 0) {
      post.engagement = engagementTexts.join(' • ');
    }
    
    // Extract main content - try multiple strategies (more lenient)
    const contentSelectors = [
      '[data-testid="tweetText"]', // Twitter/X
      '[data-testid*="tweetText"]', // Twitter/X variants
      '[data-testid="post"]', // Reddit
      '[class*="tweet-text"]', // Twitter/X
      '[class*="post-text"]', // General
      '[class*="content"][class*="text"]', // Combined
      'div[dir="auto"]', // Twitter/X, Facebook
      '[lang]', // Language-specific content
      'p:not([class*="meta"]):not([class*="time"])', // Paragraphs excluding metadata
      '[class*="text"]:not([class*="meta"]):not([class*="time"])' // Text elements
    ];
    
    // Try to find the main content element
    let contentEl = null;
    for (const selector of contentSelectors) {
      try {
        const found = element.querySelector(selector);
        if (found) {
          const text = found.textContent?.trim();
          // Be more lenient - just check it's not just metadata
          if (text && text.length > 5 && !text.match(/^(like|reply|retweet|share|follow)$/i)) {
            contentEl = found;
            break;
          }
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }
    
    if (contentEl) {
      // Use the element itself for processing links
      post.element = contentEl;
      let contentText = contentEl.textContent?.trim();
      // Remove emojis from content
      post.content = removeEmojis(contentText);
    } else {
      // Fallback: find the largest text block in the element (more lenient)
      const allTextElements = Array.from(element.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, article, section'))
        .filter(el => {
          const text = el.textContent?.trim();
          return text && text.length > 5 && 
                 !el.closest('[class*="meta"]') && 
                 !el.closest('[class*="time"]') &&
                 !el.closest('[class*="action"]') &&
                 !el.closest('[class*="button"]');
        })
        .sort((a, b) => b.textContent.length - a.textContent.length);
      
      if (allTextElements.length > 0) {
        post.element = allTextElements[0];
        let contentText = allTextElements[0].textContent?.trim();
        // Remove emojis from content
        post.content = removeEmojis(contentText);
      } else {
        // Final fallback - use element's direct text, excluding children that are likely metadata
        const directText = Array.from(element.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent?.trim())
          .filter(text => text && text.length > 0)
          .join(' ');
        
        if (directText && directText.length > 5) {
          // Remove emojis from content
          post.content = removeEmojis(directText);
        } else {
          // Last resort - use all text and remove emojis
          post.content = removeEmojis(element.textContent?.trim());
        }
      }
    }
    
    // Extract images from the post (excluding profile pictures)
    const imageSelectors = [
      'img',
      'picture img',
      '[class*="image"] img',
      '[class*="media"] img',
      '[class*="photo"] img',
      'video',
      '[class*="video"]'
    ];
    
    // Junk selectors for filtering
    const junkSelectorsForImages = 'nav, header, footer, aside, [role="navigation"], [role="banner"], .ad, .advertisement';
    
    // Profile picture/avatar indicators
    const profileIndicators = [
      'avatar', 'profile', 'profile-pic', 'profilepic', 'profile_pic',
      'user-image', 'userimage', 'user-img', 'userimg',
      'author-image', 'authorimage', 'author-img',
      'thumbnail', 'thumb', 'icon', 'logo'
    ];
    
    imageSelectors.forEach(selector => {
      try {
        const images = element.querySelectorAll(selector);
        images.forEach(img => {
          // Skip if in junk container
          if (img.closest(junkSelectorsForImages)) return;
          
          const src = img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
          const alt = img.alt || img.getAttribute('alt') || '';
          
          if (src && !src.includes('data:image/svg')) {
            // Check if image is substantial (not an icon)
            const width = img.naturalWidth || img.width || img.offsetWidth || 0;
            const height = img.naturalHeight || img.height || img.offsetHeight || 0;
            const computedStyle = window.getComputedStyle(img);
            const displayWidth = parseFloat(computedStyle.width) || width;
            const displayHeight = parseFloat(computedStyle.height) || height;
            
            // Get class names, id, and parent classes
            const className = (img.className || '').toLowerCase();
            const id = (img.id || '').toLowerCase();
            const parent = img.parentElement;
            const parentClass = (parent?.className || '').toLowerCase();
            const parentId = (parent?.id || '').toLowerCase();
            
            // Check if it's a profile picture/avatar
            const isProfilePic = profileIndicators.some(indicator => 
              className.includes(indicator) || 
              id.includes(indicator) ||
              parentClass.includes(indicator) ||
              parentId.includes(indicator) ||
              src.toLowerCase().includes(indicator)
            );
            
            // Check if it's circular (likely a profile picture)
            const borderRadius = computedStyle.borderRadius;
            const isCircular = borderRadius.includes('50%') || borderRadius.includes('9999px') || 
                              (width === height && width < 150);
            
            // Check if it's very small (likely an icon/avatar)
            const isTooSmall = (width < 100 && height < 100) || 
                              (displayWidth < 100 && displayHeight < 100);
            
            // Skip profile pictures, avatars, and very small images
            if (!isProfilePic && !isCircular && !isTooSmall && width >= 100 && height >= 100) {
              post.images.push({
                src: src,
                alt: alt,
                width: width,
                height: height
              });
            }
          }
        });
      } catch (e) {
        // Skip invalid selectors
      }
    });
    
    return post;
  }

  // Format social media post as HTML
  function formatSocialMediaPost(post, platform) {
    // Each post gets its own styled box
    const cardStyle = `background: #ffffff; border: 1px solid #e0e0e0; border-left: 4px solid #0066cc; padding: 1.5em; margin-bottom: 2em; border-radius: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-width: 100%;`;
    
    let header = '';
    if (post.username) {
      header += `<div style="font-weight: 600; color: #333; margin-bottom: 0.5em; font-size: 15px;">${htmlEscape(post.username)}</div>`;
    }
    if (post.timestamp) {
      header += `<div style="font-size: 13px; color: #666; margin-bottom: 1em;">${htmlEscape(post.timestamp)}</div>`;
    }
    
    const contentStyle = `font-size: 16px; line-height: 1.6; color: #333; margin-bottom: ${post.images.length > 0 || post.engagement ? '1em' : '0'};`;
    const content = processLinksInElement(post.element);
    
    // Display images
    let imagesHtml = '';
    if (post.images && post.images.length > 0) {
      imagesHtml = '<div style="margin: 1em 0;">';
      post.images.forEach((imgData, index) => {
        const maxWidth = Math.min(imgData.width || 600, 600);
        imagesHtml += `<img src="${htmlEscape(imgData.src)}" alt="${htmlEscape(imgData.alt)}" style="max-width: ${maxWidth}px; width: 100%; height: auto; margin: ${index > 0 ? '0.5em' : '0'} 0; border-radius: 0.5rem; display: block; box-shadow: 0 2px 6px rgba(0,0,0,0.1);" />`;
        if (imgData.alt) {
          imagesHtml += `<div style="font-size: 13px; color: #666; margin-top: 0.25em; margin-bottom: 0.5em; font-style: italic;">${htmlEscape(imgData.alt)}</div>`;
        }
      });
      imagesHtml += '</div>';
    }
    
    let footer = '';
    if (post.engagement) {
      footer = `<div style="font-size: 13px; color: #666; margin-top: 1em; padding-top: 1em; border-top: 1px solid #e0e0e0;">${htmlEscape(post.engagement)}</div>`;
    }
    
    return `<div style="${cardStyle}">
      ${header}
      <div style="${contentStyle}">${content || htmlEscape(post.content)}</div>
      ${imagesHtml}
      ${footer}
    </div>`;
  }

  const overlayId = 'reforma-text-only-overlay';
  let overlay = document.getElementById(overlayId);
  
  if (enabled) {
    const platform = detectSocialMediaPlatform();
    const isSocialMedia = platform !== null;
    // Selectors for junk content to exclude
    const junkSelectors = [
      'nav', 'header', 'footer', 'aside',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]', '[role="complementary"]',
      '.nav', '.navigation', '.menu', '.header', '.footer', '.sidebar', '.aside',
      '.ad', '.advertisement', '.ads', '.ad-container', '.sponsored',
      '.cookie', '.cookie-banner', '.consent', '.newsletter', '.subscribe',
      '.social', '.share', '.comments', '.comment-section',
      '.skip', '.skip-link', '.breadcrumb', '.breadcrumbs'
    ].join(', ');
    
    // Remove junk elements temporarily
    const junkElements = document.querySelectorAll(junkSelectors);
    const junkDisplay = new Map();
    junkElements.forEach(el => {
      junkDisplay.set(el, el.style.display);
      el.style.display = 'none';
    });
    
    // Focus on main content areas - try multiple strategies
    let mainContent = document.querySelector('article, main, [role="main"], .content, .main-content, .post, .article');
    
    // Social media specific content selectors (but don't restrict too much)
    if (isSocialMedia) {
      const socialSelectors = {
        twitter: '[data-testid="tweet"], [data-testid="tweetText"]',
        facebook: '[role="article"], [data-pagelet*="FeedUnit"]',
        instagram: 'article, [class*="post"]',
        linkedin: '[data-id*="urn"], [class*="feed"]',
        reddit: '[data-testid="post-container"], [class*="Post"]',
        youtube: '#content, [id*="video"]',
        tiktok: '[data-e2e*="video"], [class*="video"]'
      };
      
      const platformSelector = socialSelectors[platform];
      if (platformSelector) {
        try {
          const socialContent = document.querySelector(platformSelector)?.closest('[data-testid*="tweet"], [role="article"], article, [class*="post"], [class*="feed"]') || 
                               document.querySelector('[data-testid*="tweet"], [role="article"], article');
          if (socialContent) {
            mainContent = socialContent;
          }
        } catch (e) {
          // If selector fails, continue with default
        }
      }
    }
    
    // If no main content found, try body or a large container
    if (!mainContent) {
      // Try to find the largest content container
      const bodyChildren = Array.from(document.body.children).filter(child => {
        const rect = child.getBoundingClientRect();
        return rect.width > 200 && rect.height > 200;
      });
      
      if (bodyChildren.length > 0) {
        // Use the largest child
        mainContent = bodyChildren.sort((a, b) => {
          const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
          const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
          return areaB - areaA;
        })[0];
      } else {
        mainContent = document.body;
      }
    }
    
    // For social media, extract posts first (but don't fail if none found)
    // Search from document.body to find ALL posts, not just in mainContent
    let posts = [];
    if (isSocialMedia) {
      // Platform-specific post selectors (more comprehensive)
      const platformSelectors = {
        twitter: [
          'article[data-testid="tweet"]',
          'article[data-testid*="tweet"]',
          '[data-testid="tweet"]',
          '[data-testid*="tweet"] article',
          'div[data-testid*="tweet"]'
        ],
        instagram: [
          'article',
          'article[class*="post"]',
          'article[class*="Post"]',
          '[class*="Post"] article',
          'div[role="presentation"] article',
          'div[class*="post"] article'
        ],
        facebook: [
          '[role="article"]',
          '[data-pagelet*="FeedUnit"]',
          'div[data-pagelet*="Feed"]'
        ],
        linkedin: [
          '[data-id*="urn"]',
          '[class*="feed"] [role="article"]',
          '[role="article"]'
        ],
        reddit: [
          '[data-testid="post-container"]',
          '[class*="Post"]',
          '[class*="post-container"]'
        ],
        youtube: [
          '#content',
          '[id*="video"]',
          '[class*="video"]'
        ],
        tiktok: [
          '[data-e2e*="video"]',
          '[class*="video"]',
          '[class*="item"]'
        ]
      };
      
      // Use platform-specific selectors first, then fallback to general
      const specificSelectors = platformSelectors[platform] || [];
      const generalSelectors = [
        'article[data-testid*="tweet"]',
        '[data-testid*="tweet"]',
        '[role="article"]',
        'article[class*="post"]',
        'article'
      ];
      
      const allSelectors = [...specificSelectors, ...generalSelectors];
      const foundPostElements = new Set();
      
      // Search from document.body to find all posts on the page
      const searchRoot = document.body;
      
      allSelectors.forEach(selector => {
        try {
          // Use querySelectorAll to find ALL matching posts
          const foundPosts = Array.from(searchRoot.querySelectorAll(selector));
          
          foundPosts.forEach(postEl => {
            // Skip if in junk container
            if (postEl.closest(junkSelectors)) return;
            
            // Skip if already processed
            if (foundPostElements.has(postEl)) return;
            
            // Skip if element is not visible
            const rect = postEl.getBoundingClientRect();
            if (rect.height < 20 && rect.width < 20) return;
            
            // Check if this element is nested inside another post we've already found
            let isNested = false;
            for (const processedEl of foundPostElements) {
              if (processedEl.contains(postEl) && processedEl !== postEl) {
                isNested = true;
                break;
              }
            }
            if (isNested) return;
            
            // Extract the post
            const post = extractSocialMediaPost(postEl, platform);
            
            // Accept posts with content or images
            if ((post.content && post.content.length > 3) || (post.images && post.images.length > 0)) {
              // Avoid duplicates by checking content/image similarity (but be less strict)
              const isDuplicate = posts.some(existingPost => {
                // Check if same element
                if (existingPost.element === post.element) return true;
                
                // Check content similarity (only if both have substantial content)
                if (post.content && existingPost.content && 
                    post.content.length > 20 && existingPost.content.length > 20) {
                  const contentStart = post.content.substring(0, 30);
                  const existingStart = existingPost.content.substring(0, 30);
                  if (contentStart === existingStart && 
                      Math.abs(existingPost.content.length - post.content.length) < 10) {
                    return true;
                  }
                }
                
                // Check image similarity (only if both have images)
                if (post.images.length > 0 && existingPost.images.length > 0) {
                  if (post.images[0].src === existingPost.images[0].src) {
                    return true;
                  }
                }
                
                return false;
              });
              
              if (!isDuplicate) {
                posts.push(post);
                foundPostElements.add(postEl);
              }
            }
          });
        } catch (e) {
          // Skip invalid selectors
          console.log('Selector error:', selector, e);
        }
      });
      
      // Sort posts by DOM position (top to bottom)
      if (posts.length > 0) {
        posts.sort((a, b) => {
          const rectA = a.element.getBoundingClientRect();
          const rectB = b.element.getBoundingClientRect();
          // Sort by top position, then by left position
          if (Math.abs(rectA.top - rectB.top) > 10) {
            return rectA.top - rectB.top;
          }
          return rectA.left - rectB.left;
        });
      }
    }
    
    // Extract only headings and paragraphs from main content
    const textSelectors = 'h1, h2, h3, h4, h5, h6, p';
    const elements = Array.from(mainContent.querySelectorAll(textSelectors));
    
    // Filter out elements that are likely junk or already in social media posts
    const filteredElements = elements.filter(el => {
      const text = el.textContent?.trim() || '';
      const className = (el.className || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const parent = el.closest(junkSelectors);
      
      // Skip if in junk container
      if (parent) return false;
      
      // Skip if already part of a social media post
      if (isSocialMedia && posts.length > 0) {
        const isInPost = posts.some(post => post.element.contains(el) || post.element === el);
        if (isInPost) return false;
      }
      
      // Skip if has junk class/id
      if (className.includes('ad') || className.includes('nav') || className.includes('menu') || 
          className.includes('footer') || className.includes('header') || className.includes('sidebar') ||
          id.includes('ad') || id.includes('nav') || id.includes('menu')) {
        return false;
      }
      
      // Skip very short text (likely navigation or buttons)
      if (text.length < 30 && !el.tagName.match(/^h[1-6]$/i)) {
        return false;
      }
      
      // Skip if looks like a link list (navigation)
      if (el.tagName === 'P' && el.querySelectorAll('a').length > 3) {
        return false;
      }
      
      return true;
    });
    
    let textContent = '';
    const processed = new Set();
    const imageMap = new Map(); // Map elements to their nearby images
    
    // If we found social media posts, format them first
    if (isSocialMedia && posts.length > 0) {
      // Display all found posts
      posts.forEach((post, index) => {
        textContent += formatSocialMediaPost(post, platform) + '\n';
        processed.add(post.element);
        // Also mark all children as processed to avoid duplicate extraction
        const allChildren = post.element.querySelectorAll('*');
        allChildren.forEach(child => processed.add(child));
      });
    }
    
    // If no social media posts found, or if we need more content, continue with regular extraction
    
    // Extract images if enabled
    if (includeImages) {
      const images = Array.from(mainContent.querySelectorAll('img, picture img'));
      const imageElements = [];
      
      images.forEach(img => {
        // Skip if in junk container
        if (img.closest(junkSelectors)) return;
        
        // Skip very small images (likely icons)
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;
        if (width < 50 || height < 50) return;
        
        // Skip if looks like an ad
        const className = (img.className || '').toLowerCase();
        const id = (img.id || '').toLowerCase();
        if (className.includes('ad') || className.includes('sponsor') || 
            id.includes('ad') || id.includes('sponsor')) return;
        
        const src = img.src || img.getAttribute('src') || '';
        const alt = img.alt || '';
        if (src) {
          // Find the nearest text element or use the image's position
          let nearestEl = null;
          let current = img;
          
          // Check if in a figure element
          const figure = img.closest('figure');
          if (figure) {
            // Try to find caption or nearby text
            const figcaption = figure.querySelector('figcaption');
            if (figcaption) {
              nearestEl = figcaption;
            } else {
              // Find next or previous sibling text element
              let sibling = figure.nextElementSibling;
              for (let i = 0; i < 3 && sibling; i++) {
                if (sibling.tagName.match(/^h[1-6]$/i) || sibling.tagName === 'P') {
                  nearestEl = sibling;
                  break;
                }
                sibling = sibling.nextElementSibling;
              }
            }
          }
          
          // If no figure, find nearest text element
          if (!nearestEl) {
            for (let i = 0; i < 5; i++) {
              current = current.parentElement;
              if (!current) break;
              if (current.tagName.match(/^h[1-6]$/i) || current.tagName === 'P') {
                nearestEl = current;
                break;
              }
            }
          }
          
          if (nearestEl) {
            if (!imageMap.has(nearestEl)) {
              imageMap.set(nearestEl, []);
            }
            imageMap.get(nearestEl).push({ src, alt, width, height });
          } else {
            // Store standalone images to insert between text blocks
            imageElements.push({ src, alt, width, height, element: img });
          }
        }
      });
      
      // Insert standalone images between text elements
      if (imageElements.length > 0 && filteredElements.length > 0) {
        imageElements.forEach(imgData => {
          // Find the closest text element by DOM position
          let closestEl = null;
          let minDistance = Infinity;
          
          filteredElements.forEach(el => {
            const rect1 = el.getBoundingClientRect();
            const rect2 = imgData.element.getBoundingClientRect();
            const distance = Math.abs(rect1.top - rect2.top);
            if (distance < minDistance) {
              minDistance = distance;
              closestEl = el;
            }
          });
          
          if (closestEl) {
            if (!imageMap.has(closestEl)) {
              imageMap.set(closestEl, []);
            }
            imageMap.get(closestEl).push({ src: imgData.src, alt: imgData.alt, width: imgData.width, height: imgData.height });
          }
        });
      }
    }
    
    // Process elements in order, avoiding duplicates
    filteredElements.forEach((el) => {
      if (processed.has(el)) return;
      
      // Check if nested in another processed element
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
        const text = el.textContent?.trim();
        
        if (text && text.length > 0) {
          if (tagName.startsWith('h')) {
            textContent += applyTypographyStyle(tagName, className, el) + '\n';
            
            // Add images after heading if any
            if (includeImages && imageMap.has(el)) {
              imageMap.get(el).forEach(imgData => {
                const maxWidth = Math.min(imgData.width, 700);
                textContent += `<img src="${imgData.src}" alt="${imgData.alt.replace(/"/g, '&quot;')}" style="max-width: ${maxWidth}px; width: 100%; height: auto; margin: 1em 0; border-radius: 0.25rem; display: block;" />\n`;
              });
            }
          } else if (tagName === 'p') {
            // Include paragraphs with content (more lenient)
            if (text.length >= 10) {
              // Add images before paragraph if any
              if (includeImages && imageMap.has(el)) {
                imageMap.get(el).forEach(imgData => {
                  const maxWidth = Math.min(imgData.width, 700);
                  textContent += `<img src="${imgData.src}" alt="${imgData.alt.replace(/"/g, '&quot;')}" style="max-width: ${maxWidth}px; width: 100%; height: auto; margin: 1em 0; border-radius: 0.25rem; display: block;" />\n`;
                });
              }
              
              textContent += applyTypographyStyle('p', className, el) + '\n';
            }
          }
          processed.add(el);
        }
      }
    });
    
    // Restore junk elements
    junkElements.forEach(el => {
      const display = junkDisplay.get(el);
      if (display !== undefined) {
        el.style.display = display;
      }
    });
    
    // Fallback: minimal extraction if nothing found (more lenient)
    if (!textContent || textContent.trim().length < 20) {
      // Try to extract any text content
      const allTextElements = Array.from(mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, span, li, td, th, blockquote, article, section'))
        .filter(el => {
          const text = el.textContent?.trim() || '';
          const className = (el.className || '').toLowerCase();
          const id = (el.id || '').toLowerCase();
          
          // Skip if in junk container
          if (el.closest(junkSelectors)) return false;
          
          // Skip if has junk class/id
          if (className.includes('ad') || className.includes('nav') || className.includes('menu') || 
              className.includes('footer') || className.includes('header') || className.includes('sidebar') ||
              id.includes('ad') || id.includes('nav') || id.includes('menu')) {
            return false;
          }
          
          // Skip if already processed
          if (processed.has(el)) return false;
          
          // Skip if too short (but be lenient)
          if (text.length < 10) return false;
          
          // Skip if looks like navigation
          if (el.tagName === 'P' && el.querySelectorAll('a').length > 5) return false;
          
          return true;
        })
        .sort((a, b) => {
          // Sort by DOM position
          const pos = a.compareDocumentPosition(b);
          return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
      
      // Limit to first 50 elements to avoid too much content
      allTextElements.slice(0, 50).forEach(el => {
        const tagName = el.tagName.toLowerCase();
        const className = el.className || '';
        const text = el.textContent?.trim();
        
        if (text && text.length >= 10) {
          if (tagName.startsWith('h')) {
            textContent += applyTypographyStyle(tagName, className, el) + '\n';
          } else if (tagName === 'p' || tagName === 'div' || tagName === 'span' || tagName === 'li' || tagName === 'blockquote') {
            textContent += applyTypographyStyle('p', className, el) + '\n';
          }
          processed.add(el);
        }
      });
    }
    
    // Create overlay
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = overlayId;
      // Set initial styles with opacity 0 for fade-in animation
      overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: white; z-index: 999999; overflow-y: auto; font-family: 'Inter', sans-serif; padding: 2rem; box-sizing: border-box; opacity: 0; transition: opacity 0.8s ease-in-out;`;
      
      // Add Inter font if not already loaded
      if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
        const fontLink = document.createElement('link');
        fontLink.rel = 'preconnect';
        fontLink.href = 'https://fonts.googleapis.com';
        document.head.appendChild(fontLink);
        
        const fontLink2 = document.createElement('link');
        fontLink2.rel = 'preconnect';
        fontLink2.href = 'https://fonts.gstatic.com';
        fontLink2.crossOrigin = 'anonymous';
        document.head.appendChild(fontLink2);
        
        const fontLink3 = document.createElement('link');
        fontLink3.rel = 'stylesheet';
        fontLink3.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap';
        document.head.appendChild(fontLink3);
      }
      
      // Add style tag to ensure typography is applied
      const styleTag = document.createElement('style');
      styleTag.id = 'reforma-text-only-styles';
      styleTag.textContent = `
        #reforma-text-only-overlay, #reforma-text-only-overlay * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          box-sizing: border-box;
        }
        #reforma-text-only-overlay h1, #reforma-text-content h1 {
          font-size: 19.44px !important;
          font-weight: 700 !important;
          line-height: 1.6 !important;
          letter-spacing: 0.03em !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
          color: #333 !important;
        }
        #reforma-text-only-overlay h2, #reforma-text-content h2 {
          font-size: 18.22px !important;
          font-weight: 600 !important;
          line-height: 1.6 !important;
          letter-spacing: 0.03em !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
          color: #333 !important;
        }
        #reforma-text-only-overlay h3, #reforma-text-content h3 {
          font-size: 17.63px !important;
          font-weight: 600 !important;
          line-height: 1.6 !important;
          letter-spacing: 0.03em !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
          color: #333 !important;
        }
        #reforma-text-only-overlay h4, #reforma-text-content h4 {
          font-size: 17.07px !important;
          font-weight: 500 !important;
          line-height: 1.6 !important;
          letter-spacing: 0.03em !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
          color: #333 !important;
        }
        #reforma-text-only-overlay h5, #reforma-text-content h5 {
          font-size: 16.8px !important;
          font-weight: 500 !important;
          line-height: 1.6 !important;
          letter-spacing: 0.03em !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
          color: #333 !important;
        }
        #reforma-text-only-overlay h6, #reforma-text-content h6 {
          font-size: 16.53px !important;
          font-weight: 500 !important;
          line-height: 1.6 !important;
          letter-spacing: 0.03em !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
          color: #333 !important;
        }
        #reforma-text-only-overlay p, #reforma-text-content p {
          font-size: 16px !important;
          font-weight: 400 !important;
          line-height: 1.6 !important;
          letter-spacing: 0.03em !important;
          margin-bottom: 1em !important;
          color: #333 !important;
        }
        #reforma-text-only-overlay img, #reforma-text-content img {
          max-width: 100% !important;
          height: auto !important;
          margin: 1em 0 !important;
          border-radius: 0.25rem !important;
          display: block !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
        }
        /* Style links in text-only mode */
        #reforma-text-only-overlay a, #reforma-text-content a,
        #reforma-text-only-overlay a[style*="color: #0066cc"], #reforma-text-content a[style*="color: #0066cc"],
        #reforma-text-only-overlay span[style*="color: #0066cc"], #reforma-text-content span[style*="color: #0066cc"] {
          color: #0066cc !important;
          text-decoration: underline !important;
          text-decoration-color: #0066cc !important;
          cursor: pointer !important;
        }
        #reforma-text-only-overlay a:hover, #reforma-text-content a:hover {
          color: #0052a3 !important;
          text-decoration-color: #0052a3 !important;
        }
        #reforma-text-only-overlay a:visited, #reforma-text-content a:visited {
          color: #551a8b !important;
        }
        /* Social media post cards */
        #reforma-text-only-overlay > div > div[style*="background: #ffffff"],
        #reforma-text-content > div[style*="background: #ffffff"],
        #reforma-text-only-overlay > div > div[style*="background: #f8f9fa"],
        #reforma-text-content > div[style*="background: #f8f9fa"] {
          background: #ffffff !important;
          border: 1px solid #e0e0e0 !important;
          border-left: 4px solid #0066cc !important;
          padding: 1.5em !important;
          margin-bottom: 2em !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
          max-width: 100% !important;
        }
        /* Images within post cards */
        #reforma-text-only-overlay div[style*="background: #ffffff"] img,
        #reforma-text-content div[style*="background: #ffffff"] img,
        #reforma-text-only-overlay div[style*="background: #f8f9fa"] img,
        #reforma-text-content div[style*="background: #f8f9fa"] img {
          max-width: 100% !important;
          height: auto !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1) !important;
          display: block !important;
          margin: 0.5em 0 !important;
        }
      `;
      document.head.appendChild(styleTag);
      
      // Add close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕ Close Text View';
      closeBtn.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        padding: 0.5rem 1rem;
        background: #D84315;
        color: white;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        z-index: 1000000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;
      closeBtn.onclick = () => {
        // Fade out before closing
        if (overlay) {
          overlay.style.transition = 'opacity 0.8s ease-in-out';
          overlay.style.opacity = '0';
          
          setTimeout(() => {
            injectedToggleTextOnly(false, false);
            // Trigger update in popup
            window.dispatchEvent(new CustomEvent('reforma-text-only-closed'));
          }, 800);
        } else {
          injectedToggleTextOnly(false, false);
          window.dispatchEvent(new CustomEvent('reforma-text-only-closed'));
        }
      };
      overlay.appendChild(closeBtn);
      
      // Add content container
      const content = document.createElement('div');
      content.id = 'reforma-text-content';
      const bodyStyle = typographyStyles['body'];
      content.style.cssText = `max-width: 700px; margin: 0 auto; padding-top: 3rem; font-family: 'Inter', sans-serif; font-size: ${bodyStyle.fontSize}px; font-weight: ${bodyStyle.fontWeight}; line-height: ${bodyStyle.lineHeight}; letter-spacing: ${bodyStyle.letterSpacing}em; color: #333;`;
      overlay.appendChild(content);
      
      document.body.appendChild(overlay);
      
      // Trigger fade-in animation after a brief delay
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.style.opacity = '1';
        });
      });
    } else {
      // If overlay already exists, ensure it's visible and trigger fade-in
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.8s ease-in-out';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.style.opacity = '1';
        });
      });
    }
    
    // Update content
    const content = document.getElementById('reforma-text-content');
    if (content) {
      if (textContent && textContent.trim().length > 0) {
        content.innerHTML = textContent;
        
        // Force apply typography styles directly to ensure they're applied
        setTimeout(() => {
          const h1s = content.querySelectorAll('h1');
          h1s.forEach(el => {
            el.style.fontFamily = "'Inter', sans-serif";
            el.style.fontSize = '19.44px';
            el.style.fontWeight = '700';
            el.style.lineHeight = '1.6';
            el.style.letterSpacing = '0.03em';
          });
          
          const h2s = content.querySelectorAll('h2');
          h2s.forEach(el => {
            el.style.fontFamily = "'Inter', sans-serif";
            el.style.fontSize = '18.22px';
            el.style.fontWeight = '600';
            el.style.lineHeight = '1.6';
            el.style.letterSpacing = '0.03em';
          });
          
          const h3s = content.querySelectorAll('h3');
          h3s.forEach(el => {
            el.style.fontFamily = "'Inter', sans-serif";
            el.style.fontSize = '17.63px';
            el.style.fontWeight = '600';
            el.style.lineHeight = '1.6';
            el.style.letterSpacing = '0.03em';
          });
          
          const h4s = content.querySelectorAll('h4');
          h4s.forEach(el => {
            el.style.fontFamily = "'Inter', sans-serif";
            el.style.fontSize = '17.07px';
            el.style.fontWeight = '500';
            el.style.lineHeight = '1.6';
            el.style.letterSpacing = '0.03em';
          });
          
          const h5s = content.querySelectorAll('h5');
          h5s.forEach(el => {
            el.style.fontFamily = "'Inter', sans-serif";
            el.style.fontSize = '16.8px';
            el.style.fontWeight = '500';
            el.style.lineHeight = '1.6';
            el.style.letterSpacing = '0.03em';
          });
          
          const h6s = content.querySelectorAll('h6');
          h6s.forEach(el => {
            el.style.fontFamily = "'Inter', sans-serif";
            el.style.fontSize = '16.53px';
            el.style.fontWeight = '500';
            el.style.lineHeight = '1.6';
            el.style.letterSpacing = '0.03em';
          });
          
          const ps = content.querySelectorAll('p');
          ps.forEach(el => {
            el.style.fontFamily = "'Inter', sans-serif";
            el.style.fontSize = '16px';
            el.style.fontWeight = '400';
            el.style.lineHeight = '1.6';
            el.style.letterSpacing = '0.03em';
          });
        }, 10);
      } else {
        const bodyStyle = typographyStyles['body'];
        const styleStr = `font-family: 'Inter', sans-serif; font-size: ${bodyStyle.fontSize}px; font-weight: ${bodyStyle.fontWeight}; line-height: ${bodyStyle.lineHeight}; letter-spacing: ${bodyStyle.letterSpacing}em; margin-bottom: 1em; color: #333;`;
        content.innerHTML = `<p style="${styleStr}">No substantial text content found on this page.</p>`;
      }
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
    // Restore original view with fade-out animation
    if (overlay) {
      // Fade out before removing
      overlay.style.transition = 'opacity 0.8s ease-in-out';
      overlay.style.opacity = '0';
      
      // Remove after fade-out completes
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.remove();
        }
      }, 800);
    }
    
    // Remove style tag
    const styleTag = document.getElementById('reforma-text-only-styles');
    if (styleTag) {
      styleTag.remove();
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
  if (!textOnlyButton) {
    console.error('Text only button not found');
    return;
  }
  
  textOnlyMode = !textOnlyMode;
  includeImages = includeImagesCheckbox ? includeImagesCheckbox.checked : false;
  updateButtonText();
  
  // Store state for syncing
  if (!window.reformaSyncState) {
    window.reformaSyncState = {};
  }
  window.reformaSyncState.textOnlyMode = textOnlyMode;
  window.reformaSyncState.textOnlyIncludeImages = includeImages;
  
  const tab = await getActiveTab();
  if (!tab?.id) {
    console.error('No active tab found');
    textOnlyMode = !textOnlyMode; // Revert
    updateButtonText();
    return;
  }
  
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

// Update when checkbox changes
if (includeImagesCheckbox) {
  includeImagesCheckbox.addEventListener('change', () => {
    includeImages = includeImagesCheckbox.checked;
    // If text-only mode is already on, refresh it
    if (textOnlyMode) {
      toggleTextOnly(); // This will toggle off
      setTimeout(() => {
        toggleTextOnly(); // Then toggle back on with new setting
      }, 100);
    }
  });
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
