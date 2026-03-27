import React, { useState, useEffect } from 'react';
import { CrossChainService, ChainConfig } from '../../services/crossChain/crossChainService';

interface AtomicSwapProps {
  crossChainService: CrossChainService;
  currentWallet?: any;
  className?: string;
}

interface SwapForm {
  swapId: string;
  initiatorChain: number;
  participantChain: number;
  initiatorAmount: string;
  participantAmount: string;
  initiatorToken: string;
  participantToken: string;
  participantAddress: string;
  timelock: number;
}

interface Swap {
  swapId: string;
  initiator: string;
  participant?: string;
  initiatorChain: number;
  participantChain: number;
  initiatorAsset: {
    tokenAddress: string;
    amount: string;
    decimals: number;
  };
  participantAsset: {
    tokenAddress: string;
    amount: string;
    decimals: number;
  };
  status: 'initiated' | 'deposited' | 'redeemed' | 'refunded' | 'expired' | 'cancelled';
  secretHash: string;
  timelock: number;
  createdAt: number;
  expiresAt: number;
}

export const AtomicSwap: React.FC<AtomicSwapProps> = ({
  crossChainService,
  currentWallet,
  className = ''
}) => {
  const [supportedChains, setSupportedChains] = useState<ChainConfig[]>([]);
  const [swapForm, setSwapForm] = useState<SwapForm>({
    swapId: '',
    initiatorChain: 0,
    participantChain: 0,
    initiatorAmount: '',
    participantAmount: '',
    initiatorToken: '',
    participantToken: '',
    participantAddress: '',
    timelock: 3600 // 1 hour default
  });
  const [activeSwaps, setActiveSwaps] = useState<Swap[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isParticipating, setIsParticipating] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<Swap | null>(null);
  const [secret, setSecret] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showParticipateModal, setShowParticipateModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSupportedChains();
    if (currentWallet) {
      setSwapForm(prev => ({
        ...prev,
        initiatorChain: currentWallet.chainId
      }));
      loadActiveSwaps();
    }
  }, [currentWallet]);

  const loadSupportedChains = async () => {
    try {
      const chains = crossChainService.getSupportedChains();
      setSupportedChains(chains);
    } catch (err) {
      setError('Failed to load supported chains');
      console.error('Failed to load supported chains:', err);
    }
  };

  const loadActiveSwaps = async () => {
    try {
      // Mock data - in real implementation, this would fetch from the service
      const mockSwaps: Swap[] = [
        {
          swapId: 'swap_001',
          initiator: currentWallet?.address || '',
          participant: '0x1234567890123456789012345678901234567890',
          initiatorChain: 1,
          participantChain: 137,
          initiatorAsset: {
            tokenAddress: '0x1234567890123456789012345678901234567890',
            amount: '1.5',
            decimals: 18
          },
          participantAsset: {
            tokenAddress: '0x1234567890123456789012345678901234567891',
            amount: '2500',
            decimals: 18
          },
          status: 'initiated',
          secretHash: '0xabc123...',
          timelock: 3600,
          createdAt: Date.now() - 300000,
          expiresAt: Date.now() + 3300000
        }
      ];
      setActiveSwaps(mockSwaps);
    } catch (err) {
      console.error('Failed to load active swaps:', err);
    }
  };

  const handleCreateSwap = async () => {
    if (!currentWallet) {
      setError('Please connect your wallet first');
      return;
    }

    const validation = validateSwapForm();
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // Mock swap creation - in real implementation, this would call the service
      const newSwap: Swap = {
        swapId: swapForm.swapId || `swap_${Date.now()}`,
        initiator: currentWallet.address,
        initiatorChain: swapForm.initiatorChain,
        participantChain: swapForm.participantChain,
        initiatorAsset: {
          tokenAddress: swapForm.initiatorToken,
          amount: swapForm.initiatorAmount,
          decimals: 18
        },
        participantAsset: {
          tokenAddress: swapForm.participantToken,
          amount: swapForm.participantAmount,
          decimals: 18
        },
        status: 'initiated',
        secretHash: '0x' + Math.random().toString(16).substr(2, 64),
        timelock: swapForm.timelock,
        createdAt: Date.now(),
        expiresAt: Date.now() + (swapForm.timelock * 1000)
      };

      setActiveSwaps(prev => [newSwap, ...prev]);
      setSuccess(`Atomic swap created successfully! Swap ID: ${newSwap.swapId}`);
      setSwapForm({
        swapId: '',
        initiatorChain: currentWallet.chainId,
        participantChain: 0,
        initiatorAmount: '',
        participantAmount: '',
        initiatorToken: '',
        participantToken: '',
        participantAddress: '',
        timelock: 3600
      });
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create atomic swap');
    } finally {
      setIsCreating(false);
    }
  };

  const handleParticipateSwap = async (swap: Swap) => {
    if (!currentWallet) {
      setError('Please connect your wallet first');
      return;
    }

    setIsParticipating(true);
    setError(null);
    setSuccess(null);

    try {
      // Mock participation - in real implementation, this would call the service
      setActiveSwaps(prev => prev.map(s => 
        s.swapId === swap.swapId 
          ? { ...s, participant: currentWallet.address, status: 'deposited' as const }
          : s
      ));
      
      setSuccess(`Successfully participated in swap ${swap.swapId}`);
      setShowParticipateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to participate in swap');
    } finally {
      setIsParticipating(false);
    }
  };

  const handleRedeemSwap = async () => {
    if (!currentWallet || !selectedSwap || !secret) {
      setError('Please provide a secret to redeem');
      return;
    }

    setIsRedeeming(true);
    setError(null);
    setSuccess(null);

    try {
      // Mock redemption - in real implementation, this would call the service
      setActiveSwaps(prev => prev.map(s => 
        s.swapId === selectedSwap.swapId 
          ? { ...s, status: 'redeemed' as const }
          : s
      ));
      
      setSuccess(`Successfully redeemed swap ${selectedSwap.swapId}`);
      setShowRedeemModal(false);
      setSecret('');
      setSelectedSwap(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redeem swap');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleRefundSwap = async (swap: Swap) => {
    if (!currentWallet) {
      setError('Please connect your wallet first');
      return;
    }

    if (swap.initiator !== currentWallet.address) {
      setError('Only the initiator can refund this swap');
      return;
    }

    setIsRefunding(true);
    setError(null);
    setSuccess(null);

    try {
      // Mock refund - in real implementation, this would call the service
      setActiveSwaps(prev => prev.map(s => 
        s.swapId === swap.swapId 
          ? { ...s, status: 'refunded' as const }
          : s
      ));
      
      setSuccess(`Successfully refunded swap ${swap.swapId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refund swap');
    } finally {
      setIsRefunding(false);
    }
  };

  const validateSwapForm = () => {
    const errors: string[] = [];

    if (!swapForm.initiatorChain) {
      errors.push('Initiator chain is required');
    }
    if (!swapForm.participantChain) {
      errors.push('Participant chain is required');
    }
    if (swapForm.initiatorChain === swapForm.participantChain) {
      errors.push('Initiator and participant chains must be different');
    }
    if (!swapForm.initiatorAmount || parseFloat(swapForm.initiatorAmount) <= 0) {
      errors.push('Initiator amount must be greater than 0');
    }
    if (!swapForm.participantAmount || parseFloat(swapForm.participantAmount) <= 0) {
      errors.push('Participant amount must be greater than 0');
    }
    if (!swapForm.initiatorToken) {
      errors.push('Initiator token address is required');
    }
    if (!swapForm.participantToken) {
      errors.push('Participant token address is required');
    }
    if (!swapForm.participantAddress) {
      errors.push('Participant address is required');
    }
    if (!swapForm.participantAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('Invalid participant address format');
    }
    if (swapForm.timelock < 300) {
      errors.push('Timelock must be at least 5 minutes');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  };

  const getChainIcon = (chainName: string) => {
    const icons: { [key: string]: string } = {
      'Ethereum': '🔷',
      'Polygon': '🟣',
      'Binance Smart Chain': '🟡',
      'BSC': '🟡'
    };
    return icons[chainName] || '⛓️';
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'initiated': '#f59e0b',
      'deposited': '#3b82f6',
      'redeemed': '#10b981',
      'refunded': '#8b5cf6',
      'expired': '#ef4444',
      'cancelled': '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusText = (status: string) => {
    const texts: { [key: string]: string } = {
      'initiated': 'Initiated',
      'deposited': 'Deposited',
      'redeemed': 'Redeemed',
      'refunded': 'Refunded',
      'expired': 'Expired',
      'cancelled': 'Cancelled'
    };
    return texts[status] || status;
  };

  const formatTimeRemaining = (expiresAt: number) => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className={`atomic-swap ${className}`}>
      <div className="atomic-swap__container">
        <div className="atomic-swap__header">
          <h2>Atomic Swaps</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
            disabled={!currentWallet}
          >
            Create New Swap
          </button>
        </div>

        {/* Active Swaps */}
        <div className="atomic-swap__swaps-section">
          <h3>Active Swaps</h3>
          
          {activeSwaps.length === 0 ? (
            <div className="empty-state">
              <p>No active atomic swaps found</p>
              <p>Create a new swap to get started</p>
            </div>
          ) : (
            <div className="swaps-list">
              {activeSwaps.map((swap) => (
                <div key={swap.swapId} className="swap-card">
                  <div className="swap-header">
                    <div className="swap-id">
                      <span className="label">Swap ID:</span>
                      <span className="value">{swap.swapId}</span>
                    </div>
                    <div 
                      className="swap-status"
                      style={{ color: getStatusColor(swap.status) }}
                    >
                      {getStatusText(swap.status)}
                    </div>
                  </div>

                  <div className="swap-details">
                    <div className="swap-exchange">
                      <div className="exchange-side">
                        <div className="chain-info">
                          {getChainIcon(supportedChains.find(c => c.chainId === swap.initiatorChain)?.name || '')}
                          {supportedChains.find(c => c.chainId === swap.initiatorChain)?.name || 'Unknown'}
                        </div>
                        <div className="asset-info">
                          <span className="amount">{swap.initiatorAsset.amount}</span>
                          <span className="token">Token</span>
                        </div>
                      </div>
                      
                      <div className="exchange-arrow">⇄</div>
                      
                      <div className="exchange-side">
                        <div className="chain-info">
                          {getChainIcon(supportedChains.find(c => c.chainId === swap.participantChain)?.name || '')}
                          {supportedChains.find(c => c.chainId === swap.participantChain)?.name || 'Unknown'}
                        </div>
                        <div className="asset-info">
                          <span className="amount">{swap.participantAsset.amount}</span>
                          <span className="token">Token</span>
                        </div>
                      </div>
                    </div>

                    <div className="swap-meta">
                      <div className="meta-item">
                        <span className="label">Created:</span>
                        <span className="value">{new Date(swap.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="meta-item">
                        <span className="label">Expires:</span>
                        <span className="value">{formatTimeRemaining(swap.expiresAt)}</span>
                      </div>
                      <div className="meta-item">
                        <span className="label">Initiator:</span>
                        <span className="value address">{swap.initiator.slice(0, 6)}...{swap.initiator.slice(-4)}</span>
                      </div>
                      {swap.participant && (
                        <div className="meta-item">
                          <span className="label">Participant:</span>
                          <span className="value address">{swap.participant.slice(0, 6)}...{swap.participant.slice(-4)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="swap-actions">
                    {swap.status === 'initiated' && !swap.participant && (
                      <button
                        onClick={() => {
                          setSelectedSwap(swap);
                          setShowParticipateModal(true);
                        }}
                        className="btn btn-primary"
                        disabled={isParticipating}
                      >
                        {isParticipating ? 'Participating...' : 'Participate'}
                      </button>
                    )}
                    
                    {swap.status === 'deposited' && (
                      <button
                        onClick={() => {
                          setSelectedSwap(swap);
                          setShowRedeemModal(true);
                        }}
                        className="btn btn-success"
                        disabled={isRedeeming}
                      >
                        {isRedeeming ? 'Redeeming...' : 'Redeem'}
                      </button>
                    )}
                    
                    {swap.status === 'initiated' && swap.initiator === currentWallet?.address && (
                      <button
                        onClick={() => handleRefundSwap(swap)}
                        className="btn btn-secondary"
                        disabled={isRefunding}
                      >
                        {isRefunding ? 'Refunding...' : 'Refund'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Swap Modal */}
        {showCreateForm && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Create Atomic Swap</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="swap-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="initiator-chain" className="form-label">
                        Your Chain
                      </label>
                      <select
                        id="initiator-chain"
                        value={swapForm.initiatorChain}
                        onChange={(e) => setSwapForm(prev => ({ ...prev, initiatorChain: Number(e.target.value) }))}
                        className="form-select"
                        disabled={!currentWallet}
                      >
                        {supportedChains.map((chain) => (
                          <option key={chain.chainId} value={chain.chainId}>
                            {getChainIcon(chain.name)} {chain.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="participant-chain" className="form-label">
                        Participant Chain
                      </label>
                      <select
                        id="participant-chain"
                        value={swapForm.participantChain}
                        onChange={(e) => setSwapForm(prev => ({ ...prev, participantChain: Number(e.target.value) }))}
                        className="form-select"
                      >
                        <option value="">Select chain...</option>
                        {supportedChains
                          .filter(chain => chain.chainId !== swapForm.initiatorChain)
                          .map((chain) => (
                            <option key={chain.chainId} value={chain.chainId}>
                              {getChainIcon(chain.name)} {chain.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="initiator-amount" className="form-label">
                        Your Amount
                      </label>
                      <input
                        id="initiator-amount"
                        type="number"
                        value={swapForm.initiatorAmount}
                        onChange={(e) => setSwapForm(prev => ({ ...prev, initiatorAmount: e.target.value }))}
                        placeholder="0.0"
                        className="form-input"
                        step="0.001"
                        min="0"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="participant-amount" className="form-label">
                        Participant Amount
                      </label>
                      <input
                        id="participant-amount"
                        type="number"
                        value={swapForm.participantAmount}
                        onChange={(e) => setSwapForm(prev => ({ ...prev, participantAmount: e.target.value }))}
                        placeholder="0.0"
                        className="form-input"
                        step="0.001"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="initiator-token" className="form-label">
                        Your Token Address
                      </label>
                      <input
                        id="initiator-token"
                        type="text"
                        value={swapForm.initiatorToken}
                        onChange={(e) => setSwapForm(prev => ({ ...prev, initiatorToken: e.target.value }))}
                        placeholder="0x..."
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="participant-token" className="form-label">
                        Participant Token Address
                      </label>
                      <input
                        id="participant-token"
                        type="text"
                        value={swapForm.participantToken}
                        onChange={(e) => setSwapForm(prev => ({ ...prev, participantToken: e.target.value }))}
                        placeholder="0x..."
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="participant-address" className="form-label">
                      Participant Address
                    </label>
                    <input
                      id="participant-address"
                      type="text"
                      value={swapForm.participantAddress}
                      onChange={(e) => setSwapForm(prev => ({ ...prev, participantAddress: e.target.value }))}
                      placeholder="0x..."
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="timelock" className="form-label">
                      Timelock (seconds)
                    </label>
                    <input
                      id="timelock"
                      type="number"
                      value={swapForm.timelock}
                      onChange={(e) => setSwapForm(prev => ({ ...prev, timelock: Number(e.target.value) }))}
                      placeholder="3600"
                      className="form-input"
                      min="300"
                    />
                  </div>

                  <button
                    onClick={handleCreateSwap}
                    disabled={isCreating}
                    className="btn btn-primary btn-large"
                  >
                    {isCreating ? 'Creating...' : 'Create Atomic Swap'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Participate Modal */}
        {showParticipateModal && selectedSwap && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Participate in Swap</h3>
                <button
                  onClick={() => setShowParticipateModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="swap-summary">
                  <h4>Swap Details</h4>
                  <div className="summary-item">
                    <span>Swap ID:</span>
                    <span>{selectedSwap.swapId}</span>
                  </div>
                  <div className="summary-item">
                    <span>You will receive:</span>
                    <span>{selectedSwap.initiatorAsset.amount} tokens</span>
                  </div>
                  <div className="summary-item">
                    <span>You will send:</span>
                    <span>{selectedSwap.participantAsset.amount} tokens</span>
                  </div>
                  <div className="summary-item">
                    <span>Expires in:</span>
                    <span>{formatTimeRemaining(selectedSwap.expiresAt)}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleParticipateSwap(selectedSwap)}
                  disabled={isParticipating}
                  className="btn btn-primary btn-large"
                >
                  {isParticipating ? 'Participating...' : 'Confirm Participation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Redeem Modal */}
        {showRedeemModal && selectedSwap && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Redeem Swap</h3>
                <button
                  onClick={() => setShowRedeemModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="swap-summary">
                  <h4>Redeem Swap {selectedSwap.swapId}</h4>
                  <p>To redeem this swap, please provide the secret that was shared with you.</p>
                </div>

                <div className="form-group">
                  <label htmlFor="secret" className="form-label">
                    Secret
                  </label>
                  <input
                    id="secret"
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Enter secret..."
                    className="form-input"
                  />
                </div>

                <button
                  onClick={handleRedeemSwap}
                  disabled={isRedeeming || !secret}
                  className="btn btn-success btn-large"
                >
                  {isRedeeming ? 'Redeeming...' : 'Redeem Swap'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {error && (
          <div className="notification error">
            <span className="notification-icon">⚠️</span>
            <span className="notification-message">{error}</span>
            <button
              onClick={() => setError(null)}
              className="notification-close"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="notification success">
            <span className="notification-icon">✅</span>
            <span className="notification-message">{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="notification-close"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .atomic-swap {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .atomic-swap__container {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
        }

        .atomic-swap__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .atomic-swap__header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: #111827;
        }

        .atomic-swap__swaps-section h3 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .empty-state p {
          margin: 8px 0;
        }

        .swaps-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .swap-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
        }

        .swap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .swap-id {
          display: flex;
          gap: 8px;
          font-size: 14px;
        }

        .swap-id .label {
          color: #6b7280;
        }

        .swap-id .value {
          font-weight: 500;
          color: #111827;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .swap-status {
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.05);
        }

        .swap-details {
          margin-bottom: 16px;
        }

        .swap-exchange {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding: 16px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .exchange-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-align: center;
        }

        .chain-info {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
          color: #374151;
        }

        .asset-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .amount {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .token {
          font-size: 12px;
          color: #6b7280;
        }

        .exchange-arrow {
          font-size: 24px;
          color: #6b7280;
        }

        .swap-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .meta-item {
          display: flex;
          gap: 8px;
          font-size: 12px;
        }

        .meta-item .label {
          color: #6b7280;
        }

        .meta-item .value {
          color: #111827;
        }

        .address {
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .swap-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-success {
          background: #10b981;
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background: #059669;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-large {
          padding: 16px 32px;
          font-size: 16px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .modal-close:hover {
          background: #f3f4f6;
        }

        .modal-body {
          padding: 20px;
          max-height: 60vh;
          overflow-y: auto;
        }

        .swap-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .form-input,
        .form-select {
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-input:focus,
        .form-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .swap-summary {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .swap-summary h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 500;
          color: #111827;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .notification {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
        }

        .notification.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
        }

        .notification.success {
          background: #f0fdf4;
          border: 1px solid #dcfce7;
          color: #166534;
        }

        .notification-icon {
          font-size: 16px;
        }

        .notification-message {
          flex: 1;
        }

        .notification-close {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .notification-close:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .swap-exchange {
            flex-direction: column;
            gap: 16px;
          }

          .exchange-arrow {
            transform: rotate(90deg);
          }

          .swap-meta {
            grid-template-columns: 1fr;
          }

          .swap-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};
