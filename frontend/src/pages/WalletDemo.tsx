import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { FreighterConnect, TransactionSigner, AccountManager, BalanceDisplay } from '../components/Wallet';
import { useFreighter } from '../hooks/useFreighter';
import toast from 'react-hot-toast';

const WalletDemo: React.FC = () => {
  const [signedTransaction, setSignedTransaction] = useState<string>('');
  const [showTransactionSigner, setShowTransactionSigner] = useState(false);
  const { isConnected, account } = useFreighter();

  const handleTransactionSigned = (signedXdr: string) => {
    setSignedTransaction(signedXdr);
    toast.success('Transaction signed successfully!');
  };

  const handleTransactionFailed = (error: Error) => {
    toast.error(`Transaction failed: ${error.message}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Freighter Wallet Integration Demo
          </h1>
          <p className="text-gray-600">
            Complete demonstration of Freighter wallet integration for Stellar blockchain authentication and transaction signing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connection Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Wallet Connection</CardTitle>
              </CardHeader>
              <CardContent>
                <FreighterConnect
                  onConnect={(publicKey) => {
                    toast.success(`Connected: ${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`);
                  }}
                  onDisconnect={() => {
                    toast.success('Wallet disconnected');
                    setSignedTransaction('');
                  }}
                />
              </CardContent>
            </Card>

            {/* Balance Display */}
            <Card>
              <CardHeader>
                <CardTitle>Account Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <BalanceDisplay
                  showTokens={true}
                  showPercentageChange={true}
                  refreshInterval={30000}
                />
              </CardContent>
            </Card>

            {/* Account Management */}
            <Card>
              <CardHeader>
                <CardTitle>Account Management</CardTitle>
              </CardHeader>
              <CardContent>
                <AccountManager
                  onAccountChange={(publicKey) => {
                    console.log('Account changed:', publicKey);
                  }}
                  onNetworkChange={(network) => {
                    toast.success(`Switched to ${network} network`);
                  }}
                  showNetworkSelector={true}
                />
              </CardContent>
            </Card>
          </div>

          {/* Transaction Section */}
          <div className="space-y-6">
            {/* Transaction Signer */}
            <Card>
              <CardHeader>
                <CardTitle>Transaction Signing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <button
                    onClick={() => setShowTransactionSigner(!showTransactionSigner)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {showTransactionSigner ? 'Hide' : 'Show'} Transaction Signer
                  </button>
                </div>

                {showTransactionSigner && (
                  <TransactionSigner
                    onTransactionSigned={handleTransactionSigned}
                    onTransactionFailed={handleTransactionFailed}
                    showPreview={true}
                    allowCustomXDR={true}
                  />
                )}
              </CardContent>
            </Card>

            {/* Signed Transaction Result */}
            {signedTransaction && (
              <Card>
                <CardHeader>
                  <CardTitle>Signed Transaction</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Signed XDR
                      </label>
                      <textarea
                        value={signedTransaction}
                        readOnly
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                      />
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(signedTransaction);
                        toast.success('XDR copied to clipboard');
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Copy XDR
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Connected:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {isConnected ? 'Yes' : 'No'}
                    </span>
                  </div>
                  
                  {account && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Public Key:</span>
                        <span className="text-xs font-mono text-gray-600">
                          {account.publicKey.slice(0, 10)}...{account.publicKey.slice(-10)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Network:</span>
                        <span className="text-xs text-gray-600">
                          {account.network || 'Unknown'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <div>
                    <strong>1. Install Freighter:</strong> Download and install the Freighter wallet browser extension.
                  </div>
                  <div>
                    <strong>2. Connect Wallet:</strong> Click "Connect" to authorize the application.
                  </div>
                  <div>
                    <strong>3. View Balance:</strong> Your XLM and token balances will appear automatically.
                  </div>
                  <div>
                    <strong>4. Sign Transactions:</strong> Create and sign transactions using the transaction signer.
                  </div>
                  <div>
                    <strong>5. Manage Account:</strong> Switch networks and manage your account settings.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletDemo;
