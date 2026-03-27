import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface BridgeMessage {
  messageId: string;
  sourceChain: number;
  targetChain: number;
  sender: string;
  recipient: string;
  messageType: 'ProofVerification' | 'AssetTransfer' | 'AtomicSwap' | 'Generic';
  payload: string;
  status: 'Pending' | 'InTransit' | 'Delivered' | 'Failed' | 'Expired';
  createdAt: number;
  gasUsed: number;
}

interface BridgeInterfaceProps {
  currentChain: number;
  className?: string;
}

const BridgeInterface: React.FC<BridgeInterfaceProps> = ({ currentChain, className = '' }) => {
  const [messages, setMessages] = useState<BridgeMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [selectedTargetChain, setSelectedTargetChain] = useState<number>(137);
  const [recipient, setRecipient] = useState<string>('');
  const [messageType, setMessageType] = useState<BridgeMessage['messageType']>('Generic');
  const [payload, setPayload] = useState<string>('');
  const [walletConnected, setWalletConnected] = useState<boolean>(false);

  const supportedChains = [
    { id: 1, name: 'Ethereum', icon: '🔷' },
    { id: 137, name: 'Polygon', icon: '🟣' },
    { id: 56, name: 'BSC', icon: '🟡' }
  ];

  const messageTypes: BridgeMessage['messageType'][] = [
    'ProofVerification',
    'AssetTransfer',
    'AtomicSwap',
    'Generic'
  ];

  useEffect(() => {
    checkWalletConnection();
    if (walletConnected) {
      loadMessages();
    }
  }, [currentChain, walletConnected]);

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

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      // Simulate loading messages from backend
      const mockMessages: BridgeMessage[] = [
        {
          messageId: 'msg_001',
          sourceChain: currentChain,
          targetChain: 137,
          sender: '0x1234...5678',
          recipient: '0xabcd...efgh',
          messageType: 'ProofVerification',
          payload: 'Proof data...',
          status: 'Pending',
          createdAt: Date.now() - 300000,
          gasUsed: 0
        },
        {
          messageId: 'msg_002',
          sourceChain: 1,
          targetChain: currentChain,
          sender: '0x9876...5432',
          recipient: '0xwxyz...1234',
          messageType: 'AssetTransfer',
          payload: 'Asset transfer data...',
          status: 'Delivered',
          createdAt: Date.now() - 600000,
          gasUsed: 85000
        }
      ];
      setMessages(mockMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!walletConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!recipient || !payload) {
      alert('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate sending message
      const newMessage: BridgeMessage = {
        messageId: `msg_${Date.now()}`,
        sourceChain: currentChain,
        targetChain: selectedTargetChain,
        sender: '0x1234...5678', // Would get from wallet
        recipient,
        messageType,
        payload,
        status: 'Pending',
        createdAt: Date.now(),
        gasUsed: 0
      };

      setMessages(prev => [newMessage, ...prev]);
      setShowSendModal(false);
      
      // Reset form
      setRecipient('');
      setPayload('');
      setMessageType('Generic');

      alert('Message sent successfully!');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: BridgeMessage['status']) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'InTransit':
        return 'bg-blue-100 text-blue-800';
      case 'Delivered':
        return 'bg-green-100 text-green-800';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      case 'Expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: BridgeMessage['status']) => {
    switch (status) {
      case 'Pending':
        return '⏳';
      case 'InTransit':
        return '🚚';
      case 'Delivered':
        return '✅';
      case 'Failed':
        return '❌';
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

  const formatGasUsed = (gasUsed: number) => {
    return gasUsed.toLocaleString();
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cross-Chain Bridge</h2>
            <p className="text-sm text-gray-600 mt-1">
              Send and receive messages across multiple blockchains
            </p>
          </div>
          <button
            onClick={() => setShowSendModal(true)}
            disabled={!walletConnected}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Send Message</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-lg mb-2">No messages found</div>
            <p className="text-gray-500 text-sm">
              {walletConnected ? 'Send your first cross-chain message' : 'Connect your wallet to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.messageId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getChainIcon(message.sourceChain)}</span>
                        <span className="text-sm text-gray-600">{getChainName(message.sourceChain)}</span>
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getChainIcon(message.targetChain)}</span>
                        <span className="text-sm text-gray-600">{getChainName(message.targetChain)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(message.status)}`}>
                        {getStatusIcon(message.status)} {message.status}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                        {message.messageType}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <div className="flex items-center space-x-2">
                        <span>From:</span>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {message.sender}
                        </span>
                        <span>To:</span>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {message.recipient}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      <div className="flex items-center justify-between">
                        <span>ID: {message.messageId}</span>
                        <span>{formatTimestamp(message.createdAt)}</span>
                      </div>
                      {message.gasUsed > 0 && (
                        <div className="mt-1">
                          Gas Used: {formatGasUsed(message.gasUsed)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Message Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Send Cross-Chain Message</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Chain
                </label>
                <select
                  value={selectedTargetChain}
                  onChange={(e) => setSelectedTargetChain(Number(e.target.value))}
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
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Type
                </label>
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as BridgeMessage['messageType'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {messageTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Payload
                </label>
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  placeholder="Enter your message data..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendMessage}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BridgeInterface;
