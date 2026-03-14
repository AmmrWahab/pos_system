// src/hooks/useNetwork.js
import { useState, useEffect, useRef } from 'react';

export const useNetwork = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(null);
  const onlineTimer = useRef(null);
  const offlineTimer = useRef(null);

  // ✅ Verify actual connectivity with ping
  const verifyRealConnection = async () => {
    try {
      // Ping your API endpoint with short timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      
      await fetch('/api/health', { 
        method: 'HEAD', 
        cache: 'no-store',
        signal: controller.signal 
      });
      
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      clearTimeout(offlineTimer.current);
      
      // ✅ Debounce + verify before marking online
      onlineTimer.current = setTimeout(async () => {
        const hasRealNet = await verifyRealConnection();
        if (hasRealNet) {
          setIsOnline(true);
          window.dispatchEvent(new CustomEvent('app:online'));
        }
      }, 1500); // Wait 1.5s to confirm it's not DevTools quirk
    };
    
    const handleOffline = () => {
      clearTimeout(onlineTimer.current);
      
      // ✅ Debounce offline too (avoid flicker)
      offlineTimer.current = setTimeout(() => {
        setIsOnline(false);
        window.dispatchEvent(new CustomEvent('app:offline'));
      }, 500);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(onlineTimer.current);
      clearTimeout(offlineTimer.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateLastSync = () => setLastSync(new Date().toISOString());

  return { isOnline, lastSync, updateLastSync };
};