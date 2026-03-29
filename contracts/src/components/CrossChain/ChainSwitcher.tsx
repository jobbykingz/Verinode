import React, { useState, useEffect } from 'react';
import { CrossChainService, ChainConfig, WalletInfo } from '../../services/crossChain/crossChainService';

interface ChainSwitcherProps {
  crossChainService: CrossChainService;
  onChainChanged?: (chainId: number) => void;
  onWalletConnected?: (wallet: WalletInfo) => void;
  className?: string;
}

export const ChainSwitcher: React.FC<ChainSwitcherProps> = ({
  crossChainService,
  onChainChanged,
  onWalletConnected,
  className = ''
}) => {
  const [supportedChains, setSupportedChains] = useState<ChainConfig[]>([]);
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [currentWallet, setCurrentWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [showChainModal, setShowChainModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSupportedChains();
    loadCurrentWallet();
  }, []);

  const loadSupportedChains = async () => {
    try {
      const chains = crossChainService.getSupportedChains();
      setSupportedChains(chains);
    } catch (err) {
      setError('Failed to load supported chains');
      console.error('Failed to load supported chains:', err);
    }
  };

  const loadCurrentWallet = async () => {
    try {
      const wallet = crossChainService.getCurrentWallet();
      if (wallet) {
        setCurrentWallet(wallet);
        setSelectedChain(wallet.chainId);
        setWalletAddress(wallet.address);
      }
    } catch (err) {
      console.error('Failed to load current wallet:', err);
    }
  };

  const handleConnectWallet = async () => {
    if (!walletAddress.trim()) {
      setError('Please enter a valid wallet address');
      return;
    }

    if (!selectedChain) {
      setError('Please select a chain first');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const wallet = await crossChainService.connectWallet(walletAddress.trim(), selectedChain);
      setCurrentWallet(wallet);
      onWalletConnected?.(wallet);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSwitchChain = async (chainId: number) => {
    if (!currentWallet) {
      setError('Please connect a wallet first');
      return;
    }

    if (chainId === currentWallet.chainId) {
      setShowChainModal(false);
      return;
    }

    setIsSwitching(true);
    setError(null);

    try {
      const updatedWallet = await crossChainService.switchChain(chainId);
      setCurrentWallet(updatedWallet);
      setSelectedChain(chainId);
      onChainChanged?.(chainId);
      setShowChainModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch chain');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await crossChainService.disconnectWallet();
      setCurrentWallet(null);
      setSelectedChain(null);
      setWalletAddress('');
      onWalletConnected?.(null as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect wallet');
    }
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

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num < 0.001) return '< 0.001';
    return num.toFixed(4);
  };

  return (
    <div className={`chain-switcher ${className}`}>
      <div className="chain-switcher__container">
        {/* Wallet Connection Section */}
        <div className="chain-switcher__wallet-section">
          {!currentWallet ? (
            <div className="chain-switcher__connect-form">
              <div className="form-group">
                <label htmlFor="wallet-address" className="form-label">
                  Wallet Address
                </label>
                <input
                  id="wallet-address"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="chain-select" className="form-label">
                  Select Chain
                </label>
                <select
                  id="chain-select"
                  value={selectedChain || ''}
                  onChange={(e) => setSelectedChain(Number(e.target.value))}
                  className="form-select"
                >
                  <option value="">Choose a chain...</option>
                  {supportedChains.map((chain) => (
                    <option key={chain.chainId} value={chain.chainId}>
                      {getChainIcon(chain.name)} {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleConnectWallet}
                disabled={isConnecting || !walletAddress.trim() || !selectedChain}
                className="btn btn-primary"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          ) : (
            <div className="chain-switcher__connected">
              <div className="wallet-info">
                <div className="wallet-address">
                  <span className="label">Address:</span>
                  <span className="value">{formatAddress(currentWallet.address)}</span>
                </div>
                <div className="wallet-balance">
                  <span className="label">Balance:</span>
                  <span className="value">
                    {formatBalance(currentWallet.balance)}{' '}
                    {supportedChains.find(c => c.chainId === currentWallet.chainId)?.nativeCurrency.symbol}
                  </span>
                </div>
              </div>

              <div className="chain-selector">
                <button
                  onClick={() => setShowChainModal(true)}
                  className="chain-button"
                  disabled={isSwitching}
                >
                  {getChainIcon(supportedChains.find(c => c.chainId === currentWallet.chainId)?.name || '')}
                  {supportedChains.find(c => c.chainId === currentWallet.chainId)?.name || 'Unknown'}
                  <span className="arrow">▼</span>
                </button>
              </div>

              <button
                onClick={handleDisconnect}
                className="btn btn-secondary btn-sm"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="chain-switcher__error">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button
              onClick={() => setError(null)}
              className="error-close"
            >
              ×
            </button>
          </div>
        )}

        {/* Chain Selection Modal */}
        {showChainModal && (
          <div className="chain-switcher__modal-overlay">
            <div className="chain-switcher__modal">
              <div className="modal-header">
                <h3>Select Chain</h3>
                <button
                  onClick={() => setShowChainModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="chain-list">
                  {supportedChains.map((chain) => {
                    const isSelected = chain.chainId === currentWallet?.chainId;
                    const isLoading = isSwitching && isSelected;

                    return (
                      <button
                        key={chain.chainId}
                        onClick={() => handleSwitchChain(chain.chainId)}
                        disabled={isSelected || isLoading}
                        className={`chain-option ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="chain-option__icon">
                          {getChainIcon(chain.name)}
                        </div>
                        <div className="chain-option__info">
                          <div className="chain-name">{chain.name}</div>
                          <div className="chain-details">
                            {chain.nativeCurrency.symbol} • {chain.blockTime}ms block time
                          </div>
                        </div>
                        <div className="chain-option__status">
                          {isSelected && <span className="current-badge">Current</span>}
                          {isLoading && <span className="loading-spinner">⟳</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .chain-switcher {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .chain-switcher__container {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
        }

        .chain-switcher__connect-form {
          display: flex;
          flex-direction: column;
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
          padding: 10px 12px;
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

        .chain-switcher__connected {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .wallet-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .wallet-address,
        .wallet-balance {
          display: flex;
          gap: 8px;
          font-size: 14px;
        }

        .label {
          color: #6b7280;
          font-weight: 500;
        }

        .value {
          color: #111827;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .chain-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .chain-button:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .chain-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .arrow {
          font-size: 12px;
          transition: transform 0.2s;
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

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chain-switcher__error {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 14px;
        }

        .error-icon {
          font-size: 16px;
        }

        .error-message {
          flex: 1;
        }

        .error-close {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chain-switcher__modal-overlay {
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

        .chain-switcher__modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 480px;
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

        .chain-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .chain-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }

        .chain-option:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .chain-option.selected {
          background: #eff6ff;
          border-color: #3b82f6;
        }

        .chain-option:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chain-option__icon {
          font-size: 24px;
        }

        .chain-option__info {
          flex: 1;
          text-align: left;
        }

        .chain-name {
          font-weight: 500;
          color: #111827;
          margin-bottom: 2px;
        }

        .chain-details {
          font-size: 12px;
          color: #6b7280;
        }

        .chain-option__status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .current-badge {
          background: #3b82f6;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .loading-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
