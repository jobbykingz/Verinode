import React, { useState, useEffect } from 'react';
import { Button, Modal, Typography, Box, Card, CardContent, CardActions } from '@mui/material';
import { Download, Close, CheckCircle } from '@mui/icons-material';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isInWebAppiOS);
    };

    // Check if it's iOS
    const checkIfIOS = () => {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
      setIsIOS(isIOSDevice);
    };

    checkIfInstalled();
    checkIfIOS();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Only show modal if not dismissed and not installed
      const wasDismissed = localStorage.getItem('install-prompt-dismissed');
      if (!wasDismissed && !isInstalled) {
        setTimeout(() => setShowInstallModal(true), 3000); // Show after 3 seconds
      }
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallModal(false);
      setDeferredPrompt(null);
      localStorage.setItem('app-installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowInstallModal(false);
    } catch (error) {
      console.error('Error during install prompt:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallModal(false);
    setDismissed(true);
    localStorage.setItem('install-prompt-dismissed', 'true');
  };

  const handleDontShowAgain = () => {
    handleDismiss();
    localStorage.setItem('install-prompt-never-show', 'true');
  };

  // Don't show if already installed, dismissed, or never show again
  if (isInstalled || dismissed || localStorage.getItem('install-prompt-never-show')) {
    return null;
  }

  // iOS install instructions
  if (isIOS) {
    return (
      <Modal
        open={showInstallModal}
        onClose={handleDismiss}
        aria-labelledby="ios-install-modal-title"
        aria-describedby="ios-install-modal-description"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
          }}
        >
          <Typography id="ios-install-modal-title" variant="h6" component="h2" gutterBottom>
            Install Verinode App
          </Typography>
          <Typography id="ios-install-modal-description" sx={{ mt: 2 }}>
            To install Verinode on your iOS device:
          </Typography>
          <Typography component="ol" sx={{ mt: 2, pl: 2 }}>
            <Typography component="li" sx={{ mb: 1 }}>
              Tap the Share button <strong>⎋</strong> at the bottom of the screen
            </Typography>
            <Typography component="li" sx={{ mb: 1 }}>
              Scroll down and tap <strong>"Add to Home Screen"</strong>
            </Typography>
            <Typography component="li" sx={{ mb: 1 }}>
              Tap <strong>"Add"</strong> to install the app
            </Typography>
          </Typography>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={handleDontShowAgain} color="inherit">
              Don't show again
            </Button>
            <Button onClick={handleDismiss} variant="contained">
              Got it
            </Button>
          </Box>
        </Box>
      </Modal>
    );
  }

  // Android/Desktop install prompt
  return (
    <>
      {/* Floating install button */}
      {deferredPrompt && !showInstallModal && (
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={() => setShowInstallModal(true)}
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            borderRadius: 28,
            px: 2,
            py: 1,
            boxShadow: 3,
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1976D2 30%, #02A6F0 90%)',
            }
          }}
        >
          Install App
        </Button>
      )}

      {/* Install modal */}
      <Modal
        open={showInstallModal}
        onClose={handleDismiss}
        aria-labelledby="install-modal-title"
        aria-describedby="install-modal-description"
      >
        <Card
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            outline: 'none',
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircle color="primary" sx={{ mr: 1, fontSize: 28 }} />
              <Typography id="install-modal-title" variant="h6" component="h2">
                Install Verinode App
              </Typography>
            </Box>
            
            <Typography id="install-modal-description" color="text.secondary" sx={{ mb: 3 }}>
              Install Verinode on your device for quick access, offline capabilities, and a native app experience.
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Features:
              </Typography>
              <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
                <Typography component="li">Offline access</Typography>
                <Typography component="li">Push notifications</Typography>
                <Typography component="li">Faster loading</Typography>
                <Typography component="li">App icon on home screen</Typography>
              </Typography>
            </Box>
          </CardContent>
          
          <CardActions sx={{ px: 2, pb: 2, justifyContent: 'space-between' }}>
            <Box>
              <Button size="small" onClick={handleDontShowAgain} color="inherit">
                Never show
              </Button>
              <Button size="small" onClick={handleDismiss} color="inherit">
                Maybe later
              </Button>
            </Box>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={handleInstallClick}
              disabled={!deferredPrompt}
            >
              Install Now
            </Button>
          </CardActions>
        </Card>
      </Modal>
    </>
  );
};

export default InstallPrompt;
