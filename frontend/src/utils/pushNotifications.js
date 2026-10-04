/**
 * Push Notification Utility for Celesta Glow
 * Handles browser push notifications for visitors
 */

const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Convert base64 to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if push notifications are supported
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

// Check current permission status
export const getNotificationPermission = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!isPushSupported()) {
    console.log('[Push] Not supported on this browser');
    return { success: false, error: 'Push notifications not supported' };
  }
  
  try {
    const permission = await Notification.requestPermission();
    console.log('[Push] Permission:', permission);
    
    if (permission === 'granted') {
      // Register service worker and subscribe
      const subscription = await subscribeToPush();
      return { success: true, permission, subscription };
    }
    
    return { success: false, permission };
  } catch (error) {
    console.error('[Push] Permission error:', error);
    return { success: false, error: error.message };
  }
};

// Subscribe to push notifications
export const subscribeToPush = async () => {
  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[Push] Service Worker registered');
    
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    
    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    // Send subscription to backend
    const visitorId = localStorage.getItem('visitorId') || `v_${Date.now()}`;
    
    await fetch(`${API}/notifications/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: visitorId,
        subscription: subscription.toJSON()
      })
    });
    
    console.log('[Push] Subscribed successfully');
    localStorage.setItem('pushSubscribed', 'true');
    
    return subscription;
  } catch (error) {
    console.error('[Push] Subscription error:', error);
    return null;
  }
};

// Show a local notification (for testing or immediate feedback)
export const showLocalNotification = (title, options = {}) => {
  if (Notification.permission !== 'granted') {
    console.log('[Push] No permission for notifications');
    return;
  }
  
  const defaultOptions = {
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    tag: 'celesta-glow',
    requireInteraction: false,
    ...options
  };
  
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, defaultOptions);
    });
  } else {
    new Notification(title, defaultOptions);
  }
};

// Check if user is already subscribed
export const isSubscribed = () => {
  return localStorage.getItem('pushSubscribed') === 'true';
};

export default {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  showLocalNotification,
  isSubscribed
};
