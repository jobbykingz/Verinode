import React, { useState } from 'react';
import { PenTool, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Copy, ExternalLink } from 'lucide-react';
import { useFreighter } from '../../hooks/useFreighter';
import freighterService, { FreighterTransaction } from '../../services/freighterService';
import toast from 'react-hot-toast';

interface TransactionSignerProps {
  onTransactionSigned?: (signedXdr: string) => void;
  onTransactionFailed?: (error: Error) => void;
  className?: string;
  showPreview?: boolean;
  allowCustomXDR?: boolean;
}

interface TransactionPreview {
  to: string;
  amount: string;
  asset?: string;
  memo?: string;
  fee?: string;
}

const TransactionSigner: React.FC<TransactionSignerProps> = ({
  onTransactionSigned,
  onTransactionFailed,
  className = '',
  showPreview = true,
  allowCustomXDR = false
}) => {
  const {
    isConnected,
    account,
    network,
    signTransaction,
    getErrorMessage,
    isValidAddress
  } = useFreighter();

  const [isSigning, setIsSigning] = useState(false);
  const [transactionXdr, setTransactionXdr] = useState('');
  const [showXdr, setShowXdr] = useState(false);
  const [transactionPreview, setTransactionPreview] = useState<TransactionPreview | null>(null);
  const [customTransaction, setCustomTransaction] = useState<Partial<FreighterTransaction>>({
    to: '',
    amount: '',
    asset: '',
    memo: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateCustomTransaction = () => {
    const newErrors: Record<string, string> = {};

    if (!customTransaction.to?.trim()) {
      newErrors.to = 'Recipient address is required';
    } else if (!isValidAddress(customTransaction.to)) {
      newErrors.to = 'Invalid Stellar address';
    }

    if (!customTransaction.amount?.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(customTransaction.amount)) || parseFloat(customTransaction.amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number';
    }

    if (customTransaction.asset && customTransaction.asset.trim() && !/^[A-Z0-9]{12}$/.test(customTransaction.asset)) {
      newErrors.asset = 'Invalid asset code (must be 12 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignTransaction = async () => {
    if (!isConnected || !account) {
      toast.error('Please connect your wallet first');
      return;
    }

    let xdrToSign = transactionXdr;

    // If custom transaction is enabled and no XDR is provided, create one
    if (allowCustomXDR && !xdrToSign.trim() && validateCustomTransaction()) {
      try {
        const tx: FreighterTransaction = {
          to: customTransaction.to!,
          amount: customTransaction.amount!,
          asset: customTransaction.asset,
          memo: customTransaction.memo
        };

        // This would typically involve creating a proper transaction
        // For now, we'll show an error that this feature requires backend support
        throw new Error('Custom transaction creation requires backend integration');
      } catch (error) {
        toast.error(getErrorMessage(error));
        return;
      }
    }

    if (!xdrToSign.trim()) {
      toast.error('Please provide a transaction XDR');
      return;
    }

    setIsSigning(true);
    try {
      const signedXdr = await signTransaction(xdrToSign);
      
      setTransactionXdr(signedXdr);
      toast.success('Transaction signed successfully!');
      
      if (onTransactionSigned) {
        onTransactionSigned(signedXdr);
      }

      // Update preview if possible
      try {
        // This is a simplified preview - in a real app, you'd parse the XDR
        setTransactionPreview({
          to: 'Unknown',
          amount: 'Unknown',
          fee: 'Unknown'
        });
      } catch (error) {
        console.error('Failed to preview transaction:', error);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
      
      if (onTransactionFailed) {
        onTransactionFailed(error instanceof Error ? error : new Error(errorMessage));
      }
    } finally {
      setIsSigning(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${type} copied to clipboard`);
    } catch (error) {
      toast.error(`Failed to copy ${type}`);
    }
  };

  const viewOnStellarExpert = () => {
    if (transactionXdr) {
      const encoded = encodeURIComponent(transactionXdr);
      window.open(`https://stellar.expert/explorer/${network?.network === 'TESTNET' ? 'testnet' : 'public'}/tx/${encoded}`, '_blank');
    }
  };

  const resetForm = () => {
    setTransactionXdr('');
    setTransactionPreview(null);
    setCustomTransaction({ to: '', amount: '', asset: '', memo: '' });
    setErrors({});
    setShowXdr(false);
  };

  if (!isConnected) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-gray-600" />
          <p className="text-sm text-gray-700">
            Connect your wallet to sign transactions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <PenTool className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">Transaction Signer</h3>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>Network:</span>
          <span className="font-medium text-gray-900">
            {network?.network || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Custom Transaction Form */}
      {allowCustomXDR && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Create Transaction</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Address
              </label>
              <input
                type="text"
                value={customTransaction.to}
                onChange={(e) => setCustomTransaction(prev => ({ ...prev, to: e.target.value }))}
                placeholder="G..."
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.to ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.to && (
                <p className="text-xs text-red-600 mt-1">{errors.to}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (XLM)
              </label>
              <input
                type="text"
                value={customTransaction.amount}
                onChange={(e) => setCustomTransaction(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.1"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.amount && (
                <p className="text-xs text-red-600 mt-1">{errors.amount}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asset Code (Optional)
              </label>
              <input
                type="text"
                value={customTransaction.asset}
                onChange={(e) => setCustomTransaction(prev => ({ ...prev, asset: e.target.value }))}
                placeholder="USD"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.asset ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.asset && (
                <p className="text-xs text-red-600 mt-1">{errors.asset}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Memo (Optional)
              </label>
              <input
                type="text"
                value={customTransaction.memo}
                onChange={(e) => setCustomTransaction(prev => ({ ...prev, memo: e.target.value }))}
                placeholder="Payment memo"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* XDR Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Transaction XDR
        </label>
        <div className="relative">
          <textarea
            value={transactionXdr}
            onChange={(e) => setTransactionXdr(e.target.value)}
            placeholder="Paste transaction XDR here..."
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          {transactionXdr && (
            <button
              onClick={() => setShowXdr(!showXdr)}
              className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700"
            >
              {showXdr ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Transaction Preview */}
      {showPreview && transactionPreview && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Transaction Preview</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">To:</span>
              <p className="font-mono text-blue-900">{transactionPreview.to}</p>
            </div>
            <div>
              <span className="text-blue-700">Amount:</span>
              <p className="font-medium text-blue-900">{transactionPreview.amount}</p>
            </div>
            <div>
              <span className="text-blue-700">Fee:</span>
              <p className="font-medium text-blue-900">{transactionPreview.fee}</p>
            </div>
            <div>
              <span className="text-blue-700">From:</span>
              <p className="font-mono text-blue-900">{account?.publicKey?.slice(0, 10)}...</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSignTransaction}
            disabled={isSigning || !transactionXdr.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSigning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <PenTool className="w-4 h-4 mr-2" />
                Sign Transaction
              </>
            )}
          </button>

          <button
            onClick={resetForm}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Reset
          </button>
        </div>

        {transactionXdr && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => copyToClipboard(transactionXdr, 'Transaction XDR')}
              className="inline-flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy XDR
            </button>

            <button
              onClick={viewOnStellarExpert}
              className="inline-flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              View on Explorer
            </button>
          </div>
        )}
      </div>

      {/* Success Indicator */}
      {transactionXdr && !isSigning && (
        <div className="mt-4 flex items-center space-x-2 text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">Transaction is ready to be submitted</span>
        </div>
      )}
    </div>
  );
};

export default TransactionSigner;
