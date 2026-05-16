import React, { createContext, useContext, useEffect, useState } from 'react';
import { offlineStorage } from '../lib/offlineStorage';
import { syncManager } from '../lib/syncManager';
import { useAuth } from './AuthContext';

interface OfflineContextType {
  isOnline: boolean;
  queuedActionsCount: number;
  initOfflineStorage: () => Promise<void>;
  queueAction: (type: string, data: any) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedActionsCount, setQueuedActionsCount] = useState(0);
  const { profile } = useAuth();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (profile) {
      initOfflineStorage().catch(err => {
        console.warn('Offline storage initialization failed, continuing without offline support:', err);
      });
      syncManager.startAutoSync();
    }

    return () => {
      syncManager.stopAutoSync();
    };
  }, [profile]);

  useEffect(() => {
    updateQueuedActionsCount();
    const interval = setInterval(updateQueuedActionsCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const initOfflineStorage = async () => {
    try {
      await offlineStorage.init();
      if (profile && isOnline) {
        await syncManager.cacheEssentialData(profile.id, profile.company_id).catch(err => {
          console.warn('Failed to cache essential data:', err);
        });
      }
    } catch (error) {
      console.error('Error initializing offline storage:', error);
    }
  };

  const updateQueuedActionsCount = async () => {
    try {
      const actions = await offlineStorage.getQueuedActions();
      setQueuedActionsCount(actions.length);
    } catch (error) {
      console.error('Error getting queued actions count:', error);
      setQueuedActionsCount(0);
    }
  };

  const queueAction = async (type: string, data: any) => {
    try {
      await offlineStorage.queueAction({ type: type as any, data });
      await updateQueuedActionsCount();

      if (isOnline) {
        syncManager.syncQueuedActions();
      }
    } catch (error) {
      console.error('Error queuing action:', error);
    }
  };

  return (
    <OfflineContext.Provider value={{ isOnline, queuedActionsCount, initOfflineStorage, queueAction }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};
