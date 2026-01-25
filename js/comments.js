import { getActiveTab } from './utils.js';

// DOM elements
const commentsButton = document.getElementById('commentsButton');
const commentsSection = document.getElementById('commentsSection');
const commentsList = document.getElementById('commentsList');
const commentInput = document.getElementById('commentInput');
const addCommentButton = document.getElementById('addCommentButton');

// Normalize URL for consistent storage/retrieval
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    // Remove hash/fragment, keep query params
    urlObj.hash = '';
    return urlObj.href;
  } catch (e) {
    // If URL parsing fails, return as-is
    return url;
  }
}

// Get comments for a specific URL
export async function getCommentsForUrl(url) {
  try {
    const normalizedUrl = normalizeUrl(url);
    const result = await chrome.storage.local.get(['pageComments']);
    const allComments = result.pageComments || {};
    console.log('Getting comments for normalized URL:', normalizedUrl);
    console.log('Available URLs in storage:', Object.keys(allComments));
    return allComments[normalizedUrl] || [];
  } catch (error) {
    console.error('Error getting comments:', error);
    return [];
  }
}

// Save comments for a specific URL
export async function saveCommentsForUrl(url, comments) {
  try {
    const normalizedUrl = normalizeUrl(url);
    const result = await chrome.storage.local.get(['pageComments']);
    const allComments = result.pageComments || {};
    allComments[normalizedUrl] = comments;
    console.log('Saving comments for normalized URL:', normalizedUrl);
    console.log('Comments to save:', comments);
    await chrome.storage.local.set({ pageComments: allComments });
    console.log('Comments saved successfully');
  } catch (error) {
    console.error('Error saving comments:', error);
  }
}

// Add a comment to the current page
export async function addComment(text, selectedText = null) {
  if (!text || !text.trim()) {
    console.error('No text provided for comment');
    return null;
  }
  
  const tab = await getActiveTab();
  if (!tab?.id || !tab?.url) {
    console.error('No active tab or URL');
    return null;
  }
  
  const url = tab.url;
  const normalizedUrl = normalizeUrl(url);
  console.log('Adding comment to URL:', url);
  console.log('Normalized URL:', normalizedUrl);
  const comments = await getCommentsForUrl(url);
  console.log('Current comments:', comments);
  
  const newComment = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    text: text.trim(),
    selectedText: selectedText ? selectedText.trim() : null,
    timestamp: new Date().toISOString(),
    url: url
  };
  
  comments.push(newComment);
  console.log('Saving comments:', comments);
  await saveCommentsForUrl(url, comments);
  
  // Verify it was saved
  const savedComments = await getCommentsForUrl(url);
  console.log('Verified saved comments:', savedComments);
  
  // Notify content script to update comments
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'updateComments',
      comments: comments
    });
  } catch (e) {
    // Content script might not be loaded - that's okay
    console.log('Could not send message to tab (content script may not be loaded):', e.message);
  }
  
  return newComment;
}

// Delete a comment
export async function deleteComment(commentId) {
  const tab = await getActiveTab();
  if (!tab?.id || !tab?.url) return;
  
  const url = tab.url;
  const comments = await getCommentsForUrl(url);
  const filtered = comments.filter(c => c.id !== commentId);
  
  await saveCommentsForUrl(url, filtered);
  
  // Notify content script
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'updateComments',
      comments: filtered
    });
  } catch (e) {
    console.log('Could not send message to tab:', e);
  }
}

// Load and display comments for current page
async function loadComments() {
  console.log('loadComments called');
  
  // Try to get commentsList again in case it wasn't found initially
  const commentsListEl = document.getElementById('commentsList') || commentsList;
  
  if (!commentsListEl) {
    console.error('commentsList element not found. Available elements:', {
      commentsSection: document.getElementById('commentsSection'),
      commentsList: document.getElementById('commentsList'),
      commentInput: document.getElementById('commentInput')
    });
    return;
  }
  
  const tab = await getActiveTab();
  if (!tab?.url) {
    commentsListEl.innerHTML = '<p class="text-xs text-black/70">No page loaded</p>';
    console.log('No active tab URL');
    return;
  }
  
  console.log('Loading comments for URL:', tab.url);
  const comments = await getCommentsForUrl(tab.url);
  console.log('Found comments:', comments, 'Count:', comments.length);
  
  // Also check all stored comments for debugging
  try {
    const allStored = await chrome.storage.local.get(['pageComments']);
    console.log('All stored comments:', allStored);
  } catch (e) {
    console.error('Error getting all comments:', e);
  }
  
  if (comments.length === 0) {
    commentsListEl.innerHTML = '<p class="text-xs text-black/70">No comments yet</p>';
    console.log('No comments found for this URL');
    return;
  }
  
  // Sort comments by timestamp (newest first)
  const sortedComments = [...comments].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  console.log('Rendering', sortedComments.length, 'comments');
  
  const commentsHtml = sortedComments.map(comment => {
    const date = new Date(comment.timestamp);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const selectedTextDisplay = comment.selectedText 
      ? `<div class="mt-2 p-2 bg-yellow-100 rounded border border-yellow-300">
           <p class="text-xs text-black/70 italic">Selected text:</p>
           <p class="text-xs text-black font-medium">"${escapeHtml(comment.selectedText.substring(0, 200))}${comment.selectedText.length > 200 ? '...' : ''}"</p>
         </div>`
      : '';
    return `
      <div class="comment-item mt-2 p-2 bg-gray-50 rounded border border-gray-200">
        ${selectedTextDisplay}
        <p class="text-xs text-black mt-2">${escapeHtml(comment.text)}</p>
        <p class="text-xs text-black/50 mt-1">${dateStr}</p>
        <button 
          class="delete-comment mt-1 text-xs text-red-600 hover:text-red-800" 
          data-comment-id="${comment.id}"
        >
          Delete
        </button>
      </div>
    `;
  }).join('');
  
  commentsListEl.innerHTML = commentsHtml;
  console.log('Comments HTML rendered, length:', commentsHtml.length);
  
  // Add delete handlers
  commentsListEl.querySelectorAll('.delete-comment').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const commentId = e.target.getAttribute('data-comment-id');
      await deleteComment(commentId);
      await loadComments();
    });
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Toggle comments section
function toggleComments() {
  if (!commentsSection) {
    console.error('commentsSection element not found');
    return;
  }
  
  const isCurrentlyHidden = commentsSection.style.display === 'none' || 
                           commentsSection.style.display === '' ||
                           window.getComputedStyle(commentsSection).display === 'none';
  
  console.log('Toggling comments section. Currently hidden:', isCurrentlyHidden);
  
  if (isCurrentlyHidden) {
    // Section is being shown, make it visible and load comments
    commentsSection.style.display = 'block';
    console.log('Comments section made visible');
    
    // Ensure commentsList is accessible
    const commentsListEl = document.getElementById('commentsList');
    if (!commentsListEl) {
      console.error('commentsList still not found after showing section!');
      return;
    }
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      console.log('Loading comments after toggle...');
      loadComments();
    }, 100);
  } else {
    // Section is being hidden
    commentsSection.style.display = 'none';
    console.log('Comments section hidden');
  }
}

// Handle adding comments
async function handleAddComment() {
  if (!commentInput) {
    console.error('commentInput element not found');
    return;
  }
  
  const text = commentInput.value.trim();
  if (!text) {
    alert('Please enter a comment');
    return;
  }
  
  // Disable button during save
  if (addCommentButton) {
    addCommentButton.disabled = true;
    addCommentButton.textContent = 'Saving...';
  }
  
  try {
    // Make sure comments section is visible
    if (commentsSection && (commentsSection.style.display === 'none' || !commentsSection.style.display)) {
      commentsSection.style.display = 'block';
    }
    
    // Get selected text from storage if available
    let selectedText = null;
    try {
      const result = await chrome.storage.local.get(['currentTextSelection']);
      if (result.currentTextSelection && result.currentTextSelection.text) {
        selectedText = result.currentTextSelection.text;
      }
    } catch (e) {
      console.log('Could not get selected text:', e);
    }
    
    const newComment = await addComment(text, selectedText);
    if (newComment) {
      commentInput.value = '';
      // Small delay to ensure storage is updated
      await new Promise(resolve => setTimeout(resolve, 50));
      // Reload comments to show the new one
      await loadComments();
      console.log('Comment added successfully:', newComment);
      
      // Show success feedback
      if (addCommentButton) {
        addCommentButton.textContent = '✓ Added!';
        setTimeout(() => {
          if (addCommentButton) {
            addCommentButton.textContent = 'Add Comment';
          }
        }, 1000);
      }
      
      // Scroll to the new comment
      if (commentsList) {
        commentsList.scrollTop = 0;
      }
    } else {
      throw new Error('Failed to create comment');
    }
  } catch (error) {
    console.error('Error adding comment:', error);
    alert('Failed to add comment. Please try again.');
    if (addCommentButton) {
      addCommentButton.textContent = 'Add Comment';
    }
  } finally {
    if (addCommentButton) {
      addCommentButton.disabled = false;
    }
  }
}

// Initialize when DOM is ready
function initializeComments() {
  console.log('Initializing comments module...');
  console.log('commentsButton:', commentsButton);
  console.log('commentsSection:', commentsSection);
  console.log('commentsList:', commentsList);
  console.log('commentInput:', commentInput);
  console.log('addCommentButton:', addCommentButton);
  
  if (commentsButton) {
    commentsButton.addEventListener('click', toggleComments);
    console.log('Comments button event listener added');
  } else {
    console.error('Comments button not found!');
  }

  if (addCommentButton) {
    addCommentButton.addEventListener('click', handleAddComment);
    console.log('Add comment button event listener added');
  } else {
    console.error('Add comment button not found!');
  }

  if (commentInput) {
    commentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleAddComment();
      }
    });
    console.log('Comment input event listener added');
  } else {
    console.error('Comment input not found!');
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeComments);
} else {
  // DOM is already ready
  initializeComments();
}

// Export for use in other modules
export { loadComments };
