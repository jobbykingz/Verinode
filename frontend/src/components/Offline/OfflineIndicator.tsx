import React from 'react';
import { useOffline } from '../../hooks/useOffline';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = useOffline();

  if (isOnline) return null;

  return (
    <div 
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg"
      role="alert"
    >
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
      </span>
      <span className="text-sm font-medium">You are currently offline</span>
    </div>
  );
};
export default OfflineIndicator;