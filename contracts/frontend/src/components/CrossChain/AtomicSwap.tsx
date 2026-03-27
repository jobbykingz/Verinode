import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface AtomicSwap {
  swapId: string;
  initiator: string;
  participant: string;
  sourceChain: number;
  targetChain: number;
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  targetAmount: string;
  secretHash: string;
  status: 'Initiated' | 'Funded' | 'Redeemed' | 'Refunded' | 'Expired';
  timeout: number;
  createdAt: number;
  completedAt?: number;
}

interface AtomicSwapProps {
  currentChain: number;
  className?: string;
}

const AtomicSwap: React.FC<AtomicSwapProps> = ({ currentChain, className = '' }) => {
  const [swaps, setSwaps] = useState<AtomicSwap[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showRedeemModal, setShowRedeemModal] = useState<boolean>(false);
  const [selectedSwap, setSelectedSwap] = useState<AtomicSwap | null>(null);
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [userAddress, setUserAddress] = useState<string>('');

  // Form states for creating swap
  const [participant, setParticipant] = useState<string>('');
  const [targetChain, setTargetChain] = useState<number>(137);
  const [sourceAsset, setSourceAsset] = useState<string>('ETH');
  const [targetAsset, setTargetAsset] = useState<string>('MATIC');
  const [sourceAmount, setSourceAmount] = useState<string>('');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [timeoutHours, setTimeoutHours] = useState<number>(24);

  // Redeem form
  const [redeemSecret, setRedeemSecret] = useState<string>('');

  const supportedChains = [
    { id: 1, name: 'Ethereum', icon: '🔷' },
    { id: 137, name: 'Polygon', icon: '🟣' },
    { id: 56, name: 'BSC', icon: '🟡' }
  ];

  const supportedAssets = ['ETH', 'MATIC', 'BNB', 'USDC', 'USDT', 'WBTC'];

  useEffect(() => {
    checkWalletConnection();
    if (walletConnected) {
      loadSwaps();
    }
  }, [currentChain, walletConnected]);

  const checkWalletConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        const connected = accounts.length > 0;
        setWalletConnected(connected);
        if (connected) {
          setUserAddress(accounts[0]);
        }
      } catch (error) {
        console.error('Failed to check wallet connection:', error);
      }
    }
  };

  const loadSwaps = async () => {
    setIsLoading(true);
    try {
      // Simulate loading swaps from backend
      const mockSwaps: AtomicSwap[] = [
        {
          swapId: 'swap_001',
          initiator: userAddress || '0x1234...5678',
          participant: '0xabcd...efgh',
          sourceChain: currentChain,
          targetChain: 137,
          sourceAsset: 'ETH',
          targetAsset: 'MATIC',
          sourceAmount: '1.5',
          targetAmount: '2500',
          secretHash: '0xabc123...',
          status: 'Initiated',
          timeout: Date.now() + 86400000, // 24 hours from now
          createdAt: Date.now() - 300000
        },
        {
          swapId: 'swap_002',
          initiator: '0x9876...5432',
          participant: userAddress || '0x1234...5678',
          sourceChain: 1,
          targetChain: currentChain,
          sourceAsset: 'USDC',
          targetAsset: 'USDT',
          sourceAmount: '1000',
          targetAmount: '1000',
          secretHash: '0xdef456...',
          status: 'Funded',
          timeout: Date.now() + 43200000, // 12 hours from now
          createdAt: Date.now() - 600000
        }
      ];
      setSwaps(mockSwaps);
    } catch (error) {
      console.error('Failed to load swaps:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createSwap = async () => {
    if (!walletConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!participant || !sourceAmount || !targetAmount) {
      alert('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      // Generate secret hash (simplified)
      const secret = ethers.utils.formatBytes32String(Math.random().toString(36));
      const secretHash = ethers.utils.keccak256(secret);

      const newSwap: AtomicSwap = {
        swapId: `swap_${Date.now()}`,
        initiator: userAddress,
        participant,
        sourceChain: currentChain,
        targetChain,
        sourceAsset,
        targetAsset,
        sourceAmount,
        targetAmount,
        secretHash,
        status: 'Initiated',
        timeout: Date.now() + (timeoutHours * 3600000),
        createdAt: Date.now()
      };

      setSwaps(prev => [newSwap, ...prev]);
      setShowCreateModal(false);
      
      // Reset form
      setParticipant('');
      setSourceAmount('');
      setTargetAmount('');
      setTimeoutHours(24);

      alert('Atomic swap created successfully!');
    } catch (error) {
      console.error('Failed to create swap:', error);
      alert('Failed to create swap. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fundSwap = async (swapId: string) => {
    if (!walletConnected) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate funding swap
      setSwaps(prev => prev.map(swap => 
        swap.swapId === swapId 
          ? { ...swap, status: 'Funded' as const }
          : swap
      ));
      alert('Swap funded successfully!');
    } catch (error) {
      console.error('Failed to fund swap:', error);
      alert('Failed to fund swap. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const redeemSwap = async () => {
    if (!selectedSwap || !redeemSecret) {
      alert('Please provide the secret');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate redeeming swap
      setSwaps(prev => prev.map(swap => 
        swap.swapId === selectedSwap.swapId 
          ? { ...swap, status: 'Redeemed' as const, completedAt: Date.now() }
          : swap
      ));
      
      setShowRedeemModal(false);
      setSelectedSwap(null);
      setRedeemSecret('');
      alert('Swap redeemed successfully!');
    } catch (error) {
      console.error('Failed to redeem swap:', error);
      alert('Failed to redeem swap. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const refundSwap = async (swapId: string) => {
    if (!walletConnected) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate refunding swap
      setSwaps(prev => prev.map(swap => 
        swap.swapId === swapId 
          ? { ...swap, status: 'Refunded' as const, completedAt: Date.now() }
          : swap
      ));
      alert('Swap refunded successfully!');
    } catch (error) {
      console.error('Failed to refund swap:', error);
      alert('Failed to refund swap. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: AtomicSwap['status']) => {
    switch (status) {
      case 'Initiated':
        return 'bg-blue-100 text-blue-800';
      case 'Funded':
        return 'bg-yellow-100 text-yellow-800';
      case 'Redeemed':
        return 'bg-green-100 text-green-800';
      case 'Refunded':
        return 'bg-gray-100 text-gray-800';
      case 'Expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: AtomicSwap['status']) => {
    switch (status) {
      case 'Initiated':
        return '🔄';
      case 'Funded':
        return '💰';
      case 'Redeemed':
        return '✅';
      case 'Refunded':
        return '↩️';
      case 'Expired':
        return '⏰';
      default:
        return '❓';
    }
  };

  const getChainName = (chainId: number) => {
    const chain = supportedChains.find(c => c.id === chainId);
    return chain ? chain.name : `Chain ${chainId}`;
  };

  const getChainIcon = (chainId: number) => {
    const chain = supportedChains.find(c => c.id === chainId);
    return chain ? chain.icon : '⛓️';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTimeRemaining = (timeout: number) => {
    const remaining = timeout - Date.now();
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const isExpired = (timeout: number) => {
    return Date.now() > timeout;
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Atomic Swaps</h2>
            <p className="text-sm text-gray-600 mt-1">
              Trustless cross-chain token exchanges
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!walletConnected}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Swap</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : swaps.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-lg mb-2">No atomic swaps found</div>
            <p className="text-gray-500 text-sm">
              {walletConnected ? 'Create your first atomic swap' : 'Connect your wallet to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {swaps.map((swap) => (
              <div key={swap.swapId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(swap.status)}`}>
                      {getStatusIcon(swap.status)} {swap.status}
                    </span>
                    <span className="text-sm text-gray-500">ID: {swap.swapId}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatTimestamp(swap.createdAt)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getChainIcon(swap.sourceChain)}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {swap.sourceAmount} {swap.sourceAsset}
                        </div>
                        <div className="text-xs text-gray-500">{getChainName(swap.sourceChain)}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      From: {swap.initiator === userAddress ? 'You' : swap.initiator.slice(0, 10) + '...'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getChainIcon(swap.targetChain)}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {swap.targetAmount} {swap.targetAsset}
                        </div>
                        <div className="text-xs text-gray-500">{getChainName(swap.targetChain)}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      To: {swap.participant === userAddress ? 'You' : swap.participant.slice(0, 10) + '...'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-sm text-gray-500">
                    Time remaining: <span className={isExpired(swap.timeout) ? 'text-red-600' : 'text-gray-700'}>
                      {getTimeRemaining(swap.timeout)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {swap.initiator === userAddress && swap.status === 'Initiated' && (
                      <button
                        onClick={() => fundSwap(swap.swapId)}
                        disabled={isLoading}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        Fund
                      </button>
                    )}
                    
                    {swap.participant === userAddress && swap.status === 'Funded' && !isExpired(swap.timeout) && (
                      <button
                        onClick={() => {
                          setSelectedSwap(swap);
                          setShowRedeemModal(true);
                        }}
                        disabled={isLoading}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        Redeem
                      </button>
                    )}
                    
                    {swap.initiator === userAddress && swap.status === 'Funded' && isExpired(swap.timeout) && (
                      <button
                        onClick={() => refundSwap(swap.swapId)}
                        disabled={isLoading}
                        className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Swap Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Create Atomic Swap</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Participant Address
                </label>
                <input
                  type="text"
                  value={participant}
                  onChange={(e) => setParticipant(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Chain
                </label>
                <select
                  value={targetChain}
                  onChange={(e) => setTargetChain(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {supportedChains
                    .filter(chain => chain.id !== currentChain)
                    .map(chain => (
                      <option key={chain.id} value={chain.id}>
                        {chain.icon} {chain.name}
                      </option>
                    ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Asset
                  </label>
                  <select
                    value={sourceAsset}
                    onChange={(e) => setSourceAsset(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {supportedAssets.map(asset => (
                      <option key={asset} value={asset}>{asset}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Asset
                  </label>
                  <select
                    value={targetAsset}
                    onChange={(e) => setTargetAsset(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {supportedAssets.map(asset => (
                      <option key={asset} value={asset}>{asset}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Amount
                  </label>
                  <input
                    type="text"
                    value={sourceAmount}
                    onChange={(e) => setSourceAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Amount
                  </label>
                  <input
                    type="text"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timeout (hours)
                </label>
                <input
                  type="number"
                  value={timeoutHours}
                  onChange={(e) => setTimeoutHours(Number(e.target.value))}
                  min="1"
                  max="168"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createSwap}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Swap'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Modal */}
      {showRedeemModal && selectedSwap && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Redeem Atomic Swap</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">Swap Details:</div>
                <div className="text-sm">
                  <div>Receive: {selectedSwap.targetAmount} {selectedSwap.targetAsset}</div>
                  <div>From: {selectedSwap.sourceChain}</div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secret
                </label>
                <input
                  type="password"
                  value={redeemSecret}
                  onChange={(e) => setRedeemSecret(e.target.value)}
                  placeholder="Enter the secret to redeem"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRedeemModal(false);
                  setSelectedSwap(null);
                  setRedeemSecret('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={redeemSwap}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Redeeming...' : 'Redeem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtomicSwap;
