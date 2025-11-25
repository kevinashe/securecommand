import React from 'react';
import { WifiOff, Wifi, CloudOff } from 'lucide-react';
import { useOffline } from '../contexts/OfflineContext';

export const OfflineBanner: React.FC = () => {
  const { isOnline, queuedActionsCount } = useOffline();

  if (isOnline && queuedActionsCount === 0) return null;

  return (
    <div className={`${isOnline ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} border-b px-4 py-2`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <CloudOff className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Syncing {queuedActionsCount} pending {queuedActionsCount === 1 ? 'action' : 'actions'}...
              </span>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                You're offline. Changes will sync when you're back online.
              </span>
              {queuedActionsCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                  {queuedActionsCount} pending
                </span>
              )}
            </>
          )}
        </div>
        {isOnline && queuedActionsCount === 0 && (
          <Wifi className="h-5 w-5 text-green-600" />
        )}
      </div>
    </div>
  );
};
