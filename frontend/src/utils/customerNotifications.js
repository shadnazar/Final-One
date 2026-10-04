/**
 * Customer Notification System
 * MINIMAL, NON-INTRUSIVE notifications
 * - Only ONE notification at a time
 * - Top-right position (out of the way of buy buttons)
 * - Max 5 notifications in 3 minutes
 * - Soft Instagram/Messenger-like sound
 */
import axios from 'axios';
import DOMPurify from 'dompurify';

const API = process.env.REACT_APP_BACKEND_URL;

// Instagram/Messenger style soft pop sound
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';

let audioElement = null;
let notificationContainer = null;
let isInitialized = false;
let currentNotification = null;
let dismissedBroadcasts = new Set();
let broadcastPollInterval = null;

// Notification limiting
let notificationCount = 0;
let sessionStartTime = Date.now();
const MAX_NOTIFICATIONS_PER_SESSION = 5; // Max 5 notifications per 3-minute window
const SESSION_WINDOW_MS = 180000; // 3 minutes
const MIN_NOTIFICATION_INTERVAL_MS = 36000; // Minimum 36 seconds between notifications
let lastNotificationTime = 0;
let notificationQueue = [];
let isShowingNotification = false;

export const initCustomerNotifications = () => {
  if (isInitialized || typeof window === 'undefined') return;
  
  // Record page load time - used to filter out old broadcasts
  if (!window._celestaPageLoadTime) {
    window._celestaPageLoadTime = Date.now();
  }
  
  audioElement = new Audio(NOTIFICATION_SOUND_URL);
  audioElement.volume = 0.15; // Very soft
  audioElement.preload = 'auto';
  
  // Load dismissed broadcasts from localStorage
  try {
    const dismissed = localStorage.getItem('dismissedBroadcasts');
    if (dismissed) {
      dismissedBroadcasts = new Set(JSON.parse(dismissed));
    }
  } catch (e) {}
  
  // TOP-RIGHT position - away from buy buttons and pricing
  notificationContainer = document.createElement('div');
  notificationContainer.id = 'customer-notifications';
  notificationContainer.style.cssText = `
    position: fixed;
    top: 80px;
    right: 16px;
    z-index: 900;
    max-width: 260px;
  `;
  document.body.appendChild(notificationContainer);
  
  if (!document.getElementById('notif-styles')) {
    const style = document.createElement('style');
    style.id = 'notif-styles';
    style.textContent = `
      @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes slideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(20px); } }
      .notif-popup { animation: slideIn 0.3s ease-out; }
      .notif-popup.hide { animation: slideOut 0.3s ease-in forwards; }
    `;
    document.head.appendChild(style);
  }
  
  isInitialized = true;
  
  // Start polling for broadcast notifications (every 60 seconds - less frequent)
  setTimeout(() => checkBroadcastNotifications(), 15000); // First check after 15 seconds
  broadcastPollInterval = setInterval(checkBroadcastNotifications, 60000); // Then every 60 seconds
};

// Check if we can show a notification (rate limiting)
const canShowNotification = () => {
  const now = Date.now();
  
  // Reset counter if session window expired
  if (now - sessionStartTime > SESSION_WINDOW_MS) {
    sessionStartTime = now;
    notificationCount = 0;
  }
  
  // Check if we've exceeded max notifications
  if (notificationCount >= MAX_NOTIFICATIONS_PER_SESSION) {
    return false;
  }
  
  // Check minimum interval
  if (now - lastNotificationTime < MIN_NOTIFICATION_INTERVAL_MS) {
    return false;
  }
  
  return true;
};

export const playNotificationSound = () => {
  if (audioElement) {
    audioElement.currentTime = 0;
    audioElement.play().catch(() => {});
  }
};

// Process notification queue - shows ONE at a time
const processQueue = () => {
  if (isShowingNotification || notificationQueue.length === 0) return;
  if (!canShowNotification()) return;
  
  const notification = notificationQueue.shift();
  if (notification) {
    showNotificationInternal(notification.message, notification.options);
  }
};

// Internal function to actually display notification
const showNotificationInternal = (message, options = {}) => {
  if (!notificationContainer) initCustomerNotifications();
  if (isShowingNotification) return;
  
  const { duration = 4000, playSound = true, type = 'social', isBroadcast = false } = options;
  
  // Remove any existing notification first
  if (currentNotification?.parentNode) {
    currentNotification.parentNode.removeChild(currentNotification);
    currentNotification = null;
  }
  
  isShowingNotification = true;
  lastNotificationTime = Date.now();
  notificationCount++;
  
  if (playSound) playNotificationSound();
  
  const notification = document.createElement('div');
  notification.className = 'notif-popup';
  
  if (isBroadcast) {
    // Broadcast style - subtle green
    notification.style.cssText = `
      background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
      color: white;
      border-radius: 10px;
      padding: 10px 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      font-size: 13px;
      line-height: 1.4;
    `;
  } else {
    // Social proof style - minimal white
    notification.style.cssText = `
      background: rgba(255,255,255,0.98);
      border-radius: 10px;
      padding: 10px 14px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #374151;
      cursor: pointer;
      border: 1px solid rgba(0,0,0,0.05);
    `;
    notification.innerHTML = `<span style="color:#22c55e;font-size:8px;">●</span> ${DOMPurify.sanitize(message)}`;
  }
  
  if (isBroadcast) {
    notification.innerHTML = `
      <div style="font-weight:600; font-size:12px; margin-bottom:2px;">${DOMPurify.sanitize(options.title || 'Sale')}</div>
      <div style="font-size:11px; opacity:0.95;">${DOMPurify.sanitize(message)}</div>
    `;
  }
  
  notification.onclick = () => removeNotification(notification);
  
  notificationContainer.appendChild(notification);
  currentNotification = notification;
  
  // Auto-remove after duration
  setTimeout(() => {
    removeNotification(notification);
    // Process next in queue after a small delay
    setTimeout(processQueue, 2000);
  }, duration);
};

const removeNotification = (n) => {
  if (!n?.parentNode) return;
  n.classList.add('hide');
  setTimeout(() => {
    n.parentNode?.removeChild(n);
    if (currentNotification === n) {
      currentNotification = null;
      isShowingNotification = false;
    }
  }, 300);
};

// Public function to queue a notification
export const showNotification = (message, options = {}) => {
  if (!canShowNotification() && notificationQueue.length > 2) {
    // Don't queue too many
    return;
  }
  notificationQueue.push({ message, options });
  processQueue();
};

export const showPurchaseNotification = (location) => {
  showNotification(`Order from ${location}`, { duration: 4000, type: 'social' });
};

// Admin Broadcast Notification - higher priority but still rate-limited
export const showBroadcastNotification = (broadcast) => {
  if (!notificationContainer) initCustomerNotifications();
  if (dismissedBroadcasts.has(broadcast.notification_id)) return;
  
  // Add to front of queue with broadcast flag
  notificationQueue.unshift({ 
    message: broadcast.body, 
    options: { 
      duration: 6000, 
      playSound: true, 
      type: 'broadcast',
      isBroadcast: true,
      title: broadcast.title,
      notificationId: broadcast.notification_id
    }
  });
  
  // Mark as shown so we don't show again
  dismissedBroadcasts.add(broadcast.notification_id);
  localStorage.setItem('dismissedBroadcasts', JSON.stringify([...dismissedBroadcasts]));
  
  processQueue();
};

// Check for new broadcast notifications from admin
export const checkBroadcastNotifications = async () => {
  try {
    // Get page load time - only show broadcasts created AFTER page load
    const pageLoadTime = window._celestaPageLoadTime || Date.now();
    
    const res = await axios.get(`${API}/api/notifications/broadcast`);
    const broadcasts = res.data?.broadcasts || [];
    
    // Only show broadcasts that:
    // 1. Haven't been dismissed
    // 2. Were created AFTER the user loaded the page (to avoid showing old broadcasts to new visitors)
    for (const broadcast of broadcasts.slice(0, 1)) {
      if (dismissedBroadcasts.has(broadcast.notification_id)) continue;
      
      // Check if broadcast was created after page load
      const broadcastTime = new Date(broadcast.created_at).getTime();
      if (broadcastTime < pageLoadTime) {
        // This broadcast was created before user loaded the page - skip it
        continue;
      }
      
      showBroadcastNotification(broadcast);
      break; // Only show one
    }
  } catch (e) {
    // Silent fail
  }
};

const LOCATIONS = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata', 'Jaipur', 'Kerala', 'Ahmedabad'];

// Start minimal social proof - much less frequent
export const startSocialProofNotifications = () => {
  // First notification after 45 seconds
  setTimeout(() => {
    showPurchaseNotification(LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)]);
  }, 45000);
  
  // Then every 60-90 seconds (randomized for natural feel)
  setInterval(() => {
    const randomDelay = 60000 + Math.random() * 30000; // 60-90 seconds
    setTimeout(() => {
      showPurchaseNotification(LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)]);
    }, randomDelay);
  }, 90000);
};

export const cleanup = () => {
  if (broadcastPollInterval) {
    clearInterval(broadcastPollInterval);
  }
  notificationQueue = [];
  isShowingNotification = false;
};

export default { 
  initCustomerNotifications, 
  showNotification, 
  showPurchaseNotification, 
  startSocialProofNotifications,
  checkBroadcastNotifications,
  cleanup
};
