import React, { useState, useEffect } from 'react';
import { 
  Alert, 
  AlertTitle, 
  Button, 
  Box, 
  Collapse, 
  IconButton,
  Typography,
  LinearProgress
} from '@mui/material';
import { 
  WifiOff, 
  Refresh, 
  Close, 
  Sync, 
  CloudSync,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';

interface SyncQueueStatus {
  pending: number;
  failed: number;
}

const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncQueueStatus>({ pending: 0, failed: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
      setDismissed(false);
      // Trigger sync when coming back online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
    };

    const handleSyncStatus = (event: CustomEvent) => {
      setSyncStatus(event.detail);
    };

    const handleSyncSuccess = () => {
      setLastSyncTime(new Date());
      setIsSyncing(false);
    };

    const handleSyncFailed = () => {
      setIsSyncing(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('background-sync-status', handleSyncStatus as EventListener);
    window.addEventListener('background-sync-success', handleSyncSuccess as EventListener);
    window.addEventListener('background-sync-failed', handleSyncFailed as EventListener);

    // Initialize sync status
    updateSyncStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('background-sync-status', handleSyncStatus as EventListener);
      window.removeEventListener('background-sync-success', handleSyncSuccess as EventListener);
      window.removeEventListener('background-sync-failed', handleSyncFailed as EventListener);
    };
  }, []);

  const updateSyncStatus = async () => {
    try {
      // This would integrate with your BackgroundSyncManager
      const status = await getSyncQueueStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  };

  const getSyncQueueStatus = (): Promise<SyncQueueStatus> => {
    return new Promise((resolve) => {
      // Mock implementation - replace with actual BackgroundSyncManager call
      resolve({ pending: 0, failed: 0 });
    });
  };

  const triggerSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      await updateSyncStatus();
      // Trigger background sync process
      window.dispatchEvent(new CustomEvent('trigger-background-sync'));
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      setIsSyncing(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowOfflineBanner(false);
  };

  const handleRetry = () => {
    if (isOnline) {
      triggerSync();
    } else {
      window.location.reload();
    }
  };

  const hasPendingSync = syncStatus.pending > 0 || syncStatus.failed > 0;

  // Don't show anything if online and no pending sync
  if (isOnline && !hasPendingSync && !showOfflineBanner) {
    return null;
  }

  // Offline banner
  if (!isOnline) {
    return (
      <Collapse in={showOfflineBanner && !dismissed}>
        <Alert
          severity="warning"
          icon={<WifiOff />}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={handleDismiss}
            >
              <Close fontSize="inherit" />
            </IconButton>
          }
          sx={{
            borderRadius: 0,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <AlertTitle>You're offline</AlertTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="body2">
              Some features may be unavailable. Your actions will be synced when you're back online.
            </Typography>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={handleRetry}
              sx={{ ml: 2 }}
            >
              Retry
            </Button>
          </Box>
        </Alert>
      </Collapse>
    );
  }

  // Online but with pending sync
  if (hasPendingSync) {
    return (
      <Collapse in={!dismissed}>
        <Alert
          severity={syncStatus.failed > 0 ? "error" : "info"}
          icon={syncStatus.failed > 0 ? <ErrorIcon /> : <CloudSync />}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={handleDismiss}
            >
              <Close fontSize="inherit" />
            </IconButton>
          }
          sx={{
            borderRadius: 0,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <AlertTitle>
            {syncStatus.failed > 0 ? 'Sync Issues Detected' : 'Syncing in Progress'}
          </AlertTitle>
          
          {isSyncing && <LinearProgress sx={{ mb: 1 }} />}
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="body2">
              {syncStatus.pending > 0 && `${syncStatus.pending} pending item${syncStatus.pending > 1 ? 's' : ''}`}
              {syncStatus.pending > 0 && syncStatus.failed > 0 && ', '}
              {syncStatus.failed > 0 && `${syncStatus.failed} failed item${syncStatus.failed > 1 ? 's' : ''}`}
              {lastSyncTime && ` • Last sync: ${lastSyncTime.toLocaleTimeString()}`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {syncStatus.failed > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ErrorIcon />}
                  onClick={() => {/* Show error details */}}
                >
                  View Errors
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                startIcon={isSyncing ? <Sync sx={{ animation: 'spin 1s linear infinite' }} /> : <Refresh />}
                onClick={triggerSync}
                disabled={isSyncing}
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </Box>
          </Box>
        </Alert>
      </Collapse>
    );
  }

  // Online and fully synced - show success briefly
  if (lastSyncTime && Date.now() - lastSyncTime.getTime() < 5000) {
    return (
      <Collapse in={true}>
        <Alert
          severity="success"
          icon={<CheckCircle />}
          sx={{
            borderRadius: 0,
          }}
        >
          <AlertTitle>All synced!</AlertTitle>
          <Typography variant="body2">
            Your data is up to date.
          </Typography>
        </Alert>
      </Collapse>
    );
  }

  return null;
};

// Add keyframes for spinning animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default OfflineBanner;
