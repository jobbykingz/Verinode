import React, { useState } from 'react';
import { Wallet, Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { useFreighter } from '../../hooks/useFreighter';
import toast from 'react-hot-toast';

interface FreighterConnectProps {
  onConnect?: (publicKey: string) => void;
  onDisconnect?: () => void;
  className?: string;
  showStatus?: boolean;
  compact?: boolean;
}

const FreighterConnect: React.FC<FreighterConnectProps> = ({
  onConnect,
  onDisconnect,
  className = '',
  showStatus = true,
  compact = false
}) => {
  const {
    isConnected,
    isConnecting,
    isFreighterAvailable,
    isCheckingAvailability,
    account,
    connect,
    disconnect,
    getErrorMessage
  } = useFreighter();

  const [isHovered, setIsHovered] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      if (account?.publicKey && onConnect) {
        onConnect(account.publicKey);
      }
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      if (onDisconnect) {
        onDisconnect();
      }
    } catch (error) {
      console.error('Disconnection failed:', error);
    }
  };

  const handleInstallFreighter = () => {
    window.open('https://freighter.app/', '_blank');
  };

  const formatAddress = (address: string) => {
    if (compact) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  };

  const copyAddress = async () => {
    if (account?.publicKey) {
      try {
        await navigator.clipboard.writeText(account.publicKey);
        toast.success('Address copied to clipboard');
      } catch (error) {
        toast.error('Failed to copy address');
      }
    }
  };

  if (isCheckingAvailability) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-600">Checking wallet availability...</span>
      </div>
    );
  }

  if (!isFreighterAvailable) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              Freighter Wallet Not Found
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              Install Freighter wallet to connect to the Stellar network.
            </p>
            <button
              onClick={handleInstallFreighter}
              className="mt-2 inline-flex items-center text-sm text-yellow-800 hover:text-yellow-900 font-medium"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Install Freighter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isConnected && account) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">
                {compact ? 'Connected' : 'Freighter Wallet Connected'}
              </p>
              {!compact && (
                <p className="text-xs text-green-700 mt-1">
                  Network: {account.network || 'Unknown'}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {showStatus && (
              <button
                onClick={copyAddress}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="text-xs text-green-700 hover:text-green-900 font-mono bg-green-100 px-2 py-1 rounded transition-colors"
                title={isHovered ? 'Click to copy' : account.publicKey}
              >
                {formatAddress(account.publicKey)}
              </button>
            )}
            
            <button
              onClick={handleDisconnect}
              disabled={isConnecting}
              className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Wallet className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">
              {compact ? 'Connect Wallet' : 'Connect Freighter Wallet'}
            </h3>
            {!compact && (
              <p className="text-xs text-blue-700 mt-1">
                Connect your Freighter wallet to interact with the Stellar network
              </p>
            )}
          </div>
        </div>
        
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4 mr-2" />
              Connect
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FreighterConnect;
