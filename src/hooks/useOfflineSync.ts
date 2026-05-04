import { useState, useEffect, useCallback } from 'react';
import { offlineStorage } from '../lib/offline-storage';

export interface OfflineSyncState {
  isOnline: boolean;
  pendingSync: number;
  lastSyncTime: number | null;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    offlineStorage.getAllEvaluations().then(evals => {
      setPendingSync(evals.length);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline) return;

    const evaluations = await offlineStorage.getAllEvaluations();
    setPendingSync(evaluations.length);
    setLastSyncTime(Date.now());
  }, [isOnline]);

  const clearOfflineData = useCallback(async () => {
    await offlineStorage.clearAll();
    setPendingSync(0);
  }, []);

  return {
    isOnline,
    pendingSync,
    lastSyncTime,
    syncNow,
    clearOfflineData,
  };
}
