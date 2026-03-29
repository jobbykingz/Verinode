import React, { useState, useEffect } from 'react';
import { CrossChainService, CrossChainTransfer, ChainConfig } from '../../services/crossChain/crossChainService';

interface BridgeInterfaceProps {
  crossChainService: CrossChainService;
  currentWallet?: any;
  className?: string;
}

interface TransferForm {
  fromChain: number;
  toChain: number;
  amount: string;
  recipient: string;
  tokenAddress: string;
}

interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  totalCost: string;
  optimizedCost: string;
}

export const BridgeInterface: React.FC<BridgeInterfaceProps> = ({
  crossChainService,
  currentWallet,
  className = ''
}) => {
  const [supportedChains, setSupportedChains] = useState<ChainConfig[]>([]);
  const [transferForm, setTransferForm] = useState<TransferForm>({
    fromChain: 0,
    toChain: 0,
    amount: '',
    recipient: '',
    tokenAddress: ''
  });
  const [transfers, setTransfers] = useState<CrossChainTransfer[]>([]);
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadSupportedChains();
    if (currentWallet) {
      setTransferForm(prev => ({
        ...prev,
        fromChain: currentWallet.chainId
      }));
      loadTransferHistory();
    }
  }, [currentWallet]);

  useEffect(() => {
    if (transferForm.fromChain && transferForm.toChain && transferForm.amount) {
      estimateGas();
    }
  }, [transferForm.fromChain, transferForm.toChain, transferForm.amount]);

  const loadSupportedChains = async () => {
    try {
      const chains = crossChainService.getSupportedChains();
      setSupportedChains(chains);
    } catch (err) {
      setError('Failed to load supported chains');
      console.error('Failed to load supported chains:', err);
    }
  };

  const loadTransferHistory = async () => {
    setIsLoading(true);
    try {
      const history = await crossChainService.getTransactionHistory(
        currentWallet?.address,
        currentWallet?.chainId
      );
      setTransfers(history.slice(0, 10)); // Show last 10 transfers
    } catch (err) {
      console.error('Failed to load transfer history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const estimateGas = async () => {
    if (!transferForm.fromChain || !transferForm.toChain || !transferForm.amount) {
      return;
    }

    try {
      const estimate = await crossChainService.estimateGasFee(
        transferForm.fromChain,
        transferForm.toChain,
        transferForm.amount,
        transferForm.tokenAddress
      );
      setGasEstimate(estimate);
    } catch (err) {
      console.error('Failed to estimate gas:', err);
    }
  };

  const handleTransfer = async () => {
    if (!currentWallet) {
      setError('Please connect your wallet first');
      return;
    }

    const validation = validateTransferForm();
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    setIsTransferring(true);
    setError(null);
    setSuccess(null);

    try {
      const transfer = await crossChainService.initiateCrossChainTransfer(
        transferForm.fromChain,
        transferForm.toChain,
        transferForm.recipient,
        transferForm.amount,
        transferForm.tokenAddress
      );

      setSuccess(`Transfer initiated successfully! Transfer ID: ${transfer.transferId}`);
      setTransferForm({
        fromChain: currentWallet.chainId,
        toChain: 0,
        amount: '',
        recipient: '',
        tokenAddress: ''
      });
      setGasEstimate(null);
      
      await loadTransferHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  const validateTransferForm = () => {
    const errors: string[] = [];

    if (!transferForm.fromChain) {
      errors.push('Source chain is required');
    }
    if (!transferForm.toChain) {
      errors.push('Target chain is required');
    }
    if (transferForm.fromChain === transferForm.toChain) {
      errors.push('Source and target chains must be different');
    }
    if (!transferForm.amount || parseFloat(transferForm.amount) <= 0) {
      errors.push('Amount must be greater than 0');
    }
    if (!transferForm.recipient) {
      errors.push('Recipient address is required');
    }
    if (!transferForm.recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('Invalid recipient address format');
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

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'pending': '#f59e0b',
      'in_progress': '#3b82f6',
      'completed': '#10b981',
      'failed': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusText = (status: string) => {
    const texts: { [key: string]: string } = {
      'pending': 'Pending',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'failed': 'Failed'
    };
    return texts[status] || status;
  };

  return (
    <div className={`bridge-interface ${className}`}>
      <div className="bridge-interface__container">
        {/* Transfer Form */}
        <div className="bridge-interface__form-section">
          <h2>Cross-Chain Bridge</h2>
          
          <div className="transfer-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="from-chain" className="form-label">
                  From Chain
                </label>
                <select
                  id="from-chain"
                  value={transferForm.fromChain}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, fromChain: Number(e.target.value) }))}
                  className="form-select"
                  disabled={!currentWallet}
                >
                  <option value="">Select source chain...</option>
                  {supportedChains.map((chain) => (
                    <option key={chain.chainId} value={chain.chainId}>
                      {getChainIcon(chain.name)} {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="chain-arrow">
                <span>→</span>
              </div>

              <div className="form-group">
                <label htmlFor="to-chain" className="form-label">
                  To Chain
                </label>
                <select
                  id="to-chain"
                  value={transferForm.toChain}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, toChain: Number(e.target.value) }))}
                  className="form-select"
                >
                  <option value="">Select target chain...</option>
                  {supportedChains
                    .filter(chain => chain.chainId !== transferForm.fromChain)
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
                <label htmlFor="amount" className="form-label">
                  Amount
                </label>
                <input
                  id="amount"
                  type="number"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.0"
                  className="form-input"
                  step="0.001"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="token-address" className="form-label">
                  Token Address
                </label>
                <input
                  id="token-address"
                  type="text"
                  value={transferForm.tokenAddress}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, tokenAddress: e.target.value }))}
                  placeholder="0x..."
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="recipient" className="form-label">
                Recipient Address
              </label>
              <input
                id="recipient"
                type="text"
                value={transferForm.recipient}
                onChange={(e) => setTransferForm(prev => ({ ...prev, recipient: e.target.value }))}
                placeholder="0x..."
                className="form-input"
              />
            </div>

            {/* Gas Estimate */}
            {gasEstimate && (
              <div className="gas-estimate">
                <div className="gas-estimate__header">
                  <h4>Gas Estimate</h4>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="btn btn-link"
                  >
                    {showAdvanced ? 'Hide' : 'Show'} Advanced
                  </button>
                </div>
                
                <div className="gas-estimate__summary">
                  <div className="gas-item">
                    <span className="label">Regular Cost:</span>
                    <span className="value">{gasEstimate.totalCost} ETH</span>
                  </div>
                  <div className="gas-item optimized">
                    <span className="label">Optimized Cost:</span>
                    <span className="value">{gasEstimate.optimizedCost} ETH</span>
                    <span className="savings">
                      Save {((parseFloat(gasEstimate.totalCost) - parseFloat(gasEstimate.optimizedCost)) / parseFloat(gasEstimate.totalCost) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {showAdvanced && (
                  <div className="gas-estimate__details">
                    <div className="gas-item">
                      <span className="label">Gas Limit:</span>
                      <span className="value">{gasEstimate.gasLimit}</span>
                    </div>
                    <div className="gas-item">
                      <span className="label">Gas Price:</span>
                      <span className="value">{gasEstimate.gasPrice} wei</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleTransfer}
              disabled={isTransferring || !currentWallet}
              className="btn btn-primary btn-large"
            >
              {isTransferring ? 'Transferring...' : 'Initiate Transfer'}
            </button>
          </div>
        </div>

        {/* Transfer History */}
        <div className="bridge-interface__history-section">
          <h3>Recent Transfers</h3>
          
          {isLoading ? (
            <div className="loading">Loading transfer history...</div>
          ) : transfers.length === 0 ? (
            <div className="empty-state">No transfers found</div>
          ) : (
            <div className="transfer-list">
              {transfers.map((transfer, index) => (
                <div key={index} className="transfer-item">
                  <div className="transfer-header">
                    <div className="transfer-chains">
                      <span className="chain">
                        {getChainIcon(supportedChains.find(c => c.chainId === transfer.fromChain)?.name || '')}
                        {supportedChains.find(c => c.chainId === transfer.fromChain)?.name || 'Unknown'}
                      </span>
                      <span className="arrow">→</span>
                      <span className="chain">
                        {getChainIcon(supportedChains.find(c => c.chainId === transfer.toChain)?.name || '')}
                        {supportedChains.find(c => c.chainId === transfer.toChain)?.name || 'Unknown'}
                      </span>
                    </div>
                    <div 
                      className="transfer-status"
                      style={{ color: getStatusColor(transfer.status) }}
                    >
                      {getStatusText(transfer.status)}
                    </div>
                  </div>
                  
                  <div className="transfer-details">
                    <div className="transfer-amount">
                      <span className="amount">{transfer.value}</span>
                      <span className="token">ETH</span>
                    </div>
                    <div className="transfer-info">
                      <div className="info-item">
                        <span className="label">To:</span>
                        <span className="value">{formatAddress(transfer.to)}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">Time:</span>
                        <span className="value">{new Date(transfer.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {transfer.hash && (
                    <div className="transfer-hash">
                      <span className="label">Transaction:</span>
                      <a 
                        href={`https://etherscan.io/tx/${transfer.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hash-link"
                      >
                        {formatAddress(transfer.hash)}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

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
        .bridge-interface {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .bridge-interface__container {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
        }

        .bridge-interface__form-section h2 {
          margin: 0 0 24px 0;
          font-size: 24px;
          font-weight: 600;
          color: #111827;
        }

        .transfer-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 16px;
          align-items: end;
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

        .chain-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #6b7280;
          padding-bottom: 12px;
        }

        .gas-estimate {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
        }

        .gas-estimate__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .gas-estimate__header h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
          color: #111827;
        }

        .btn-link {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
          text-decoration: underline;
        }

        .gas-estimate__summary {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .gas-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .gas-item.optimized {
          background: #ecfdf5;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #d1fae5;
        }

        .gas-item .label {
          font-size: 14px;
          color: #6b7280;
        }

        .gas-item .value {
          font-weight: 500;
          color: #111827;
        }

        .savings {
          background: #10b981;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          margin-left: 8px;
        }

        .gas-estimate__details {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .btn {
          padding: 12px 24px;
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

        .btn-large {
          padding: 16px 32px;
          font-size: 16px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .bridge-interface__history-section {
          margin-top: 32px;
        }

        .bridge-interface__history-section h3 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }

        .loading,
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6b7280;
          font-size: 14px;
        }

        .transfer-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transfer-item {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
        }

        .transfer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .transfer-chains {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .chain {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .arrow {
          color: #6b7280;
        }

        .transfer-status {
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .transfer-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .transfer-amount {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .amount {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .token {
          font-size: 14px;
          color: #6b7280;
        }

        .transfer-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-item {
          display: flex;
          gap: 8px;
          font-size: 12px;
        }

        .info-item .label {
          color: #6b7280;
        }

        .info-item .value {
          color: #111827;
        }

        .transfer-hash {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
        }

        .hash-link {
          color: #3b82f6;
          text-decoration: none;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .hash-link:hover {
          text-decoration: underline;
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

          .chain-arrow {
            justify-content: start;
            padding-bottom: 0;
          }

          .transfer-details {
            flex-direction: column;
            align-items: start;
            gap: 8px;
          }

          .transfer-header {
            flex-direction: column;
            align-items: start;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
};
