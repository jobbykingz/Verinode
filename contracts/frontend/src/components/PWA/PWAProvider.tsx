import React, { createContext, useContext, ReactNode } from 'react';
import useServiceWorker from '../../hooks/useServiceWorker';
import useOfflineSync from '../../hooks/useOfflineSync';
import InstallPrompt from './InstallPrompt';
import OfflineIndicator from './OfflineIndicator';
import SyncStatus from './SyncStatus';

interface PWAContextType {
  serviceWorker: ReturnType<typeof useServiceWorker>;
  offlineSync: ReturnType<typeof useOfflineSync>;
  isPWAInstalled: boolean;
}

const PWAContext = createContext<PWAContextType | null>(null);

interface PWAProviderProps {
  children: ReactNode;
}

const PWAProvider: React.FC<PWAProviderProps> = ({ children }) => {
  const serviceWorker = useServiceWorker();
  const offlineSync = useOfflineSync();

  // Check if app is installed as PWA
  const isPWAInstalled = React.useMemo(() => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://')
    );
  }, []);

  const contextValue: PWAContextType = {
    serviceWorker,
    offlineSync,
    isPWAInstalled
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}
      
      {/* PWA UI Components */}
      <InstallPrompt />
      
      {/* Status indicators - positioned at the top of the app */}
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <OfflineIndicator />
        </div>
      </div>
      
      {/* Sync status - positioned in the corner */}
      <div className="fixed bottom-4 right-4 z-40">
        <SyncStatus showDetails={false} />
      </div>
    </PWAContext.Provider>
  );
};

// Hook to use PWA context
export const usePWA = (): PWAContextType => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};

export default PWAProvider;
