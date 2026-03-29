import React, { useState } from 'react';
import { User, Settings, Copy, ExternalLink, RefreshCw, Shield, Globe, LogOut, ChevronDown } from 'lucide-react';
import { useFreighter } from '../../hooks/useFreighter';
import toast from 'react-hot-toast';

interface AccountManagerProps {
  onAccountChange?: (publicKey: string) => void;
  onNetworkChange?: (network: string) => void;
  className?: string;
  showNetworkSelector?: boolean;
  compact?: boolean;
}

interface NetworkOption {
  name: string;
  value: string;
  passphrase: string;
  color: string;
}

const AccountManager: React.FC<AccountManagerProps> = ({
  onAccountChange,
  onNetworkChange,
  className = '',
  showNetworkSelector = true,
  compact = false
}) => {
  const {
    isConnected,
    account,
    balance,
    network,
    isLoadingBalance,
    isLoadingNetwork,
    disconnect,
    refreshBalance,
    switchNetwork
  } = useFreighter();

  const [showDropdown, setShowDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const networks: NetworkOption[] = [
    {
      name: 'Public',
      value: 'PUBLIC',
      passphrase: 'Public Global Stellar Network ; September 2015',
      color: 'green'
    },
    {
      name: 'Testnet',
      value: 'TESTNET',
      passphrase: 'Test SDF Network ; September 2015',
      color: 'blue'
    },
    {
      name: 'Futurenet',
      value: 'FUTURENET',
      passphrase: 'Test SDF Future Network ; October 2022',
      color: 'purple'
    }
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshBalance();
      toast.success('Account information refreshed');
    } catch (error) {
      toast.error('Failed to refresh account information');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleNetworkSwitch = async (networkValue: string) => {
    try {
      await switchNetwork(networkValue);
      setShowDropdown(false);
      if (onNetworkChange) {
        onNetworkChange(networkValue);
      }
    } catch (error) {
      console.error('Network switch failed:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowDropdown(false);
      if (onAccountChange) {
        onAccountChange('');
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
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

  const viewOnExplorer = () => {
    if (account?.publicKey) {
      const networkType = network?.network === 'PUBLIC' ? 'public' : 'testnet';
      window.open(`https://stellar.expert/explorer/${networkType}/account/${account.publicKey}`, '_blank');
    }
  };

  const formatBalance = (balance: string) => {
    try {
      const num = parseFloat(balance);
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 7
      });
    } catch {
      return '0.00';
    }
  };

  const getCurrentNetwork = () => {
    return networks.find(n => n.value === network?.network) || networks[0];
  };

  if (!isConnected || !account) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <User className="w-5 h-5 text-gray-600" />
          <span className="text-sm text-gray-700">No account connected</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {account.publicKey.slice(0, 6)}...{account.publicKey.slice(-4)}
              </p>
              <p className="text-xs text-gray-600">
                {balance ? `${formatBalance(balance.native)} XLM` : 'Loading...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showDropdown && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
            <button
              onClick={copyAddress}
              className="w-full text-left text-sm text-gray-700 hover:text-gray-900 px-2 py-1 rounded"
            >
              Copy Address
            </button>
            <button
              onClick={viewOnExplorer}
              className="w-full text-left text-sm text-gray-700 hover:text-gray-900 px-2 py-1 rounded"
            >
              View on Explorer
            </button>
            <button
              onClick={handleDisconnect}
              className="w-full text-left text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Account Manager</h3>
              <p className="text-sm text-gray-600">
                {account.network || 'Unknown Network'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="p-6 space-y-4">
        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Public Key
          </label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 p-3 bg-gray-50 rounded-lg font-mono text-sm text-gray-900">
              {account.publicKey}
            </div>
            <button
              onClick={copyAddress}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={viewOnExplorer}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Balance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Balance
          </label>
          {isLoadingBalance ? (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 h-4 bg-gray-300 rounded"></div>
              </div>
            </div>
          ) : balance ? (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-medium text-gray-900">
                {formatBalance(balance.native)} XLM
              </div>
              {Object.keys(balance.tokens).length > 0 && (
                <div className="mt-2 space-y-1">
                  {Object.entries(balance.tokens).map(([asset, amount]) => (
                    <div key={asset} className="text-sm text-gray-600">
                      {formatBalance(amount)} {asset}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              Balance unavailable
            </div>
          )}
        </div>

        {/* Network Selector */}
        {showNetworkSelector && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Network
            </label>
            {isLoadingNetwork ? (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 h-4 bg-gray-300 rounded"></div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full p-3 bg-gray-50 rounded-lg text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Globe className={`w-5 h-5 text-${getCurrentNetwork().color}-600`} />
                    <span className="font-medium text-gray-900">
                      {getCurrentNetwork().name}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {showDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                    {networks.map((net) => (
                      <button
                        key={net.value}
                        onClick={() => handleNetworkSwitch(net.value)}
                        className={`w-full p-3 text-left flex items-center space-x-3 hover:bg-gray-50 transition-colors ${
                          net.value === network?.network ? 'bg-blue-50' : ''
                        }`}
                      >
                        <Globe className={`w-5 h-5 text-${net.color}-600`} />
                        <div>
                          <div className="font-medium text-gray-900">{net.name}</div>
                          <div className="text-xs text-gray-600">{net.value}</div>
                        </div>
                        {net.value === network?.network && (
                          <div className="ml-auto">
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Security Info */}
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Security Notice</h4>
              <p className="text-xs text-blue-700 mt-1">
                Your private keys are securely stored in Freighter wallet. Never share your private key or recovery phrase.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-gray-200">
        <button
          onClick={handleDisconnect}
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect Wallet
        </button>
      </div>
    </div>
  );
};

export default AccountManager;
