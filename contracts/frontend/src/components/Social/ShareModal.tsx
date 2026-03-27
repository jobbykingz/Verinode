import React, { useState } from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  proofId: string;
  proofTitle: string;
  proofDescription: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  proofId,
  proofTitle,
  proofDescription
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [sharing, setSharing] = useState(false);

  const platforms = [
    { id: 'twitter', name: 'Twitter/X', icon: '🐦', color: 'bg-blue-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'bg-blue-700' },
    { id: 'facebook', name: 'Facebook', icon: '📘', color: 'bg-blue-600' },
    { id: 'reddit', name: 'Reddit', icon: '🤖', color: 'bg-orange-500' },
    { id: 'telegram', name: 'Telegram', icon: '✈️', color: 'bg-blue-400' },
    { id: 'whatsapp', name: 'WhatsApp', icon: '📱', color: 'bg-green-500' },
    { id: 'email', name: 'Email', icon: '📧', color: 'bg-gray-500' }
  ];

  const generateShareUrl = (platform: string): string => {
    const baseUrl = window.location.origin;
    const proofUrl = `${baseUrl}/proof/${proofId}`;
    
    const message = customMessage || `Check out this verified proof: ${proofTitle}`;
    const encodedMessage = encodeURIComponent(message);
    const encodedUrl = encodeURIComponent(proofUrl);

    switch (platform) {
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encodedMessage}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`;
      case 'reddit':
        return `https://reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent(proofTitle)}`;
      case 'telegram':
        return `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`;
      case 'whatsapp':
        return `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`;
      case 'email':
        return `mailto:?subject=${encodeURIComponent(proofTitle)}&body=${encodedMessage}%20${encodedUrl}`;
      default:
        return proofUrl;
    }
  };

  const handleShare = async (platform: string) => {
    setSharing(true);
    
    try {
      const shareUrl = generateShareUrl(platform);
      
      if (platform === 'email') {
        window.location.href = shareUrl;
      } else {
        window.open(shareUrl, '_blank', 'width=600,height=400');
      }

      // Track share event
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'proof_shared',
          platform,
          proofId,
          timestamp: new Date().toISOString()
        })
      });

      onClose();
    } catch (error) {
      console.error('Error sharing proof:', error);
    } finally {
      setSharing(false);
    }
  };

  const copyToClipboard = async () => {
    const shareUrl = `${window.location.origin}/proof/${proofId}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      
      // Show success feedback
      const button = document.getElementById('copy-link-btn');
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('bg-green-600');
        
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('bg-green-600');
        }, 2000);
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Share Proof</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">{proofTitle}</p>
          <p className="text-xs text-gray-500">{proofDescription}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Message (Optional)
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add a personal message..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Share via
          </label>
          <div className="grid grid-cols-2 gap-2">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handleShare(platform.id)}
                disabled={sharing}
                className={`flex items-center justify-center p-3 rounded-md text-white ${platform.color} hover:opacity-90 disabled:opacity-50 transition-opacity`}
              >
                <span className="mr-2">{platform.icon}</span>
                <span className="text-sm font-medium">{platform.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">Or copy link</span>
            <button
              id="copy-link-btn"
              onClick={copyToClipboard}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              Copy Link
            </button>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-xs text-gray-600 font-mono break-all">
              {window.location.origin}/proof/{proofId}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
