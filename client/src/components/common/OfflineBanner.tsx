import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export const OfflineBanner: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, flushQueue } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-40 bg-amber-500/90 text-slate-950 font-medium px-4 py-2 text-xs sm:text-sm flex items-center justify-between shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-2 max-w-screen-xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-slate-900" />
          <span>
            {!isOnline
              ? "You're offline. Changes are saved locally and will sync when you're back online."
              : `Connected! ${pendingCount} pending offline action${pendingCount > 1 ? 's' : ''} syncing...`}
          </span>
        </div>
        {isOnline && pendingCount > 0 && (
          <button
            onClick={flushQueue}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-900 text-amber-300 font-semibold text-xs hover:bg-slate-800 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
};
