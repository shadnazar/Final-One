/**
 * Order Notification System
 * Plays sound and shows notification when new order is placed
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Order notification sound URL (royalty-free notification sound)
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const useOrderNotifications = (adminToken, enabled = true) => {
  const [lastOrderCount, setLastOrderCount] = useState(null);
  const [newOrders, setNewOrders] = useState([]);
  const audioRef = useRef(null);
  const checkIntervalRef = useRef(null);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
      audioRef.current.volume = 0.7;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Play notification sound
  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log('[OrderNotif] Sound play failed (user interaction required):', err.message);
      });
    }
  }, []);

  // Check for new orders
  const checkNewOrders = useCallback(async () => {
    if (!adminToken || !enabled) return;

    try {
      const res = await fetch(`${API}/admin/orders`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      if (!res.ok) return;
      
      const orders = await res.json();
      const currentCount = orders.length;

      if (lastOrderCount !== null && currentCount > lastOrderCount) {
        // New order(s) detected!
        const newCount = currentCount - lastOrderCount;
        const latestOrders = orders.slice(0, newCount);
        
        setNewOrders(latestOrders);
        playSound();
        
        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
          new Notification('🛒 New Order!', {
            body: `${newCount} new order${newCount > 1 ? 's' : ''} received!`,
            icon: '/logo192.png',
            tag: 'new-order'
          });
        }
        
        console.log(`[OrderNotif] ${newCount} new order(s) detected!`);
      }

      setLastOrderCount(currentCount);
    } catch (err) {
      console.error('[OrderNotif] Check failed:', err);
    }
  }, [adminToken, enabled, lastOrderCount, playSound]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !adminToken) return;

    // Initial check
    checkNewOrders();

    // Poll every 30 seconds
    checkIntervalRef.current = setInterval(checkNewOrders, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enabled, adminToken, checkNewOrders]);

  // Clear new orders
  const clearNewOrders = useCallback(() => {
    setNewOrders([]);
  }, []);

  // Manual sound test
  const testSound = useCallback(() => {
    playSound();
  }, [playSound]);

  return {
    newOrders,
    clearNewOrders,
    testSound,
    lastOrderCount
  };
};

export default useOrderNotifications;
