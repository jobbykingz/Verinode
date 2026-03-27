import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface ChainConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

interface ChainSwitcherProps {
  onChainChange?: (chainId: number) => void;
  className?: string;
}

const ChainSwitcher: React.FC<ChainSwitcherProps> = ({ onChainChange, className = '' }) => {
  const [currentChain, setCurrentChain] = useState<number>(1);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const supportedChains: ChainConfig[] = [
    {
      chainId: 1,
      chainName: 'Ethereum',
      rpcUrl: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
      blockExplorer: 'https://etherscan.io',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    },
    {
      chainId: 137,
      chainName: 'Polygon',
      rpcUrl: 'https://polygon-rpc.com',
      blockExplorer: 'https://polygonscan.com',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      }
    },
    {
      chainId: 56,
      chainName: 'BSC',
      rpcUrl: 'https://bsc-dataseed1.binance.org',
      blockExplorer: 'https://bscscan.com',
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
      }
    }
  ];

  useEffect(() => {
    checkWalletConnection();
    getCurrentChain();
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        setWalletConnected(accounts.length > 0);
      } catch (error) {
        console.error('Failed to check wallet connection:', error);
      }
    }
  };

  const getCurrentChain = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();
        setCurrentChain(network.chainId);
      } catch (error) {
        console.error('Failed to get current chain:', error);
      }
    }
  };

  const switchChain = async (chainId: number) => {
    if (!walletConnected) {
      await connectWallet();
    }

    setIsSwitching(true);
    setShowDropdown(false);

    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const chainConfig = supportedChains.find(chain => chain.chainId === chainId);
        if (!chainConfig) {
          throw new Error('Chain not supported');
        }

        // Check if chain is already added to MetaMask
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chainId.toString(16)}` }]
          });
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${chainId.toString(16)}`,
                  chainName: chainConfig.chainName,
                  rpcUrls: [chainConfig.rpcUrl],
                  blockExplorerUrls: [chainConfig.blockExplorer],
                  nativeCurrency: chainConfig.nativeCurrency
                }
              ]
            });
          } else {
            throw switchError;
          }
        }

        setCurrentChain(chainId);
        onChainChange?.(chainId);
      }
    } catch (error) {
      console.error('Failed to switch chain:', error);
      alert('Failed to switch chain. Please try again.');
    } finally {
      setIsSwitching(false);
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletConnected(true);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        alert('Failed to connect wallet. Please try again.');
      }
    }
  };

  const getCurrentChainConfig = () => {
    return supportedChains.find(chain => chain.chainId === currentChain);
  };

  const getChainIcon = (chainId: number) => {
    switch (chainId) {
      case 1:
        return '🔷'; // Ethereum
      case 137:
        return '🟣'; // Polygon
      case 56:
        return '🟡'; // BSC
      default:
        return '⛓️';
    }
  };

  const getChainColor = (chainId: number) => {
    switch (chainId) {
      case 1:
        return 'bg-blue-500';
      case 137:
        return 'bg-purple-500';
      case 56:
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center space-x-2">
        {!walletConnected && (
          <button
            onClick={connectWallet}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Connect Wallet
          </button>
        )}
        
        {walletConnected && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={isSwitching}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-lg">{getChainIcon(currentChain)}</span>
              <span className="font-medium">
                {getCurrentChainConfig()?.chainName || 'Unknown'}
              </span>
              <span className="text-xs text-gray-400">
                {getCurrentChainConfig()?.nativeCurrency.symbol}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Select Network
                  </div>
                  {supportedChains.map((chain) => (
                    <button
                      key={chain.chainId}
                      onClick={() => switchChain(chain.chainId)}
                      disabled={chain.chainId === currentChain || isSwitching}
                      className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                        chain.chainId === currentChain
                          ? 'bg-gray-100 cursor-not-allowed'
                          : 'hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      <div className={`w-8 h-8 ${getChainColor(chain.chainId)} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                        {chain.nativeCurrency.symbol}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">{chain.chainName}</div>
                        <div className="text-xs text-gray-500">
                          {chain.nativeCurrency.name} ({chain.nativeCurrency.symbol})
                        </div>
                      </div>
                      {chain.chainId === currentChain && (
                        <div className="text-green-500">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                <div className="border-t border-gray-200 p-3">
                  <div className="text-xs text-gray-500">
                    <div className="flex items-center justify-between mb-1">
                      <span>Current Chain ID:</span>
                      <span className="font-mono">{currentChain}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Status:</span>
                      <span className={`font-medium ${walletConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {walletConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isSwitching && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-yellow-50 border border-yellow-200 rounded-lg p-3 z-50">
          <div className="flex items-center space-x-2 text-yellow-800">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
            <span className="text-sm">Switching chain...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChainSwitcher;
