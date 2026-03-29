import { useState, useEffect, useCallback } from 'react';
import freighterService, { FreighterAccount, FreighterBalance, FreighterNetwork } from '../services/freighterService';
import toast from 'react-hot-toast';

export interface UseFreighterReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  account: FreighterAccount | null;
  
  // Balance state
  balance: FreighterBalance | null;
  isLoadingBalance: boolean;
  
  // Network state
  network: FreighterNetwork | null;
  isLoadingNetwork: boolean;
  
  // Availability
  isFreighterAvailable: boolean;
  isCheckingAvailability: boolean;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  switchNetwork: (network: string) => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
  
  // Utilities
  getErrorMessage: (error: unknown) => string;
  isValidAddress: (address: string) => boolean;
}

export const useFreighter = (): UseFreighterReturn => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [account, setAccount] = useState<FreighterAccount | null>(null);
  
  // Balance state
  const [balance, setBalance] = useState<FreighterBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // Network state
  const [network, setNetwork] = useState<FreighterNetwork | null>(null);
  const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);
  
  // Availability state
  const [isFreighterAvailable, setIsFreighterAvailable] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  // Check Freighter availability
  const checkAvailability = useCallback(async () => {
    setIsCheckingAvailability(true);
    try {
      const available = await freighterService.isAvailable();
      setIsFreighterAvailable(available);
      
      if (!available) {
        toast.error('Freighter wallet is not installed. Please install Freighter to continue.');
      }
    } catch (error) {
      setIsFreighterAvailable(false);
      console.error('Error checking Freighter availability:', error);
    } finally {
      setIsCheckingAvailability(false);
    }
  }, []);

  // Connect to Freighter
  const connect = useCallback(async () => {
    if (!isFreighterAvailable) {
      toast.error('Freighter wallet is not available');
      return;
    }

    setIsConnecting(true);
    try {
      const accountData = await freighterService.connect();
      setAccount(accountData);
      setIsConnected(true);
      
      toast.success('Successfully connected to Freighter wallet');
      
      // Load initial data
      await Promise.all([
        loadBalance(accountData.publicKey),
        loadNetwork()
      ]);
    } catch (error) {
      const errorMessage = freighterService.getErrorMessage(error);
      toast.error(errorMessage);
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [isFreighterAvailable]);

  // Disconnect from Freighter
  const disconnect = useCallback(async () => {
    try {
      await freighterService.disconnect();
      setAccount(null);
      setIsConnected(false);
      setBalance(null);
      setNetwork(null);
      
      toast.success('Disconnected from Freighter wallet');
    } catch (error) {
      const errorMessage = freighterService.getErrorMessage(error);
      toast.error(errorMessage);
      console.error('Disconnection error:', error);
    }
  }, []);

  // Load balance
  const loadBalance = useCallback(async (publicKey?: string) => {
    const accountKey = publicKey || account?.publicKey;
    
    if (!accountKey) {
      console.warn('No public key available for balance check');
      return;
    }

    setIsLoadingBalance(true);
    try {
      const balanceData = await freighterService.getBalance(accountKey);
      setBalance(balanceData);
    } catch (error) {
      const errorMessage = freighterService.getErrorMessage(error);
      toast.error(errorMessage);
      console.error('Balance loading error:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [account?.publicKey]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    await loadBalance();
  }, [loadBalance]);

  // Load network
  const loadNetwork = useCallback(async () => {
    setIsLoadingNetwork(true);
    try {
      const networkData = await freighterService.getNetwork();
      setNetwork(networkData);
    } catch (error) {
      const errorMessage = freighterService.getErrorMessage(error);
      toast.error(errorMessage);
      console.error('Network loading error:', error);
    } finally {
      setIsLoadingNetwork(false);
    }
  }, []);

  // Switch network
  const switchNetwork = useCallback(async (networkName: string) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      // Map network name to Networks enum
      let networkEnum;
      switch (networkName.toLowerCase()) {
        case 'public':
          networkEnum = 'PUBLIC';
          break;
        case 'testnet':
          networkEnum = 'TESTNET';
          break;
        case 'futurenet':
          networkEnum = 'FUTURENET';
          break;
        default:
          throw new Error('Unsupported network');
      }

      await freighterService.switchNetwork(networkEnum as any);
      await loadNetwork(); // Reload network info
      toast.success(`Switched to ${networkName} network`);
    } catch (error) {
      const errorMessage = freighterService.getErrorMessage(error);
      toast.error(errorMessage);
      console.error('Network switching error:', error);
    }
  }, [isConnected, loadNetwork]);

  // Sign transaction
  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    if (!isConnected || !network) {
      throw new Error('Wallet not connected or network not available');
    }

    try {
      const signedXdr = await freighterService.signTransaction(xdr, network.network as any);
      toast.success('Transaction signed successfully');
      return signedXdr;
    } catch (error) {
      const errorMessage = freighterService.getErrorMessage(error);
      toast.error(errorMessage);
      throw error;
    }
  }, [isConnected, network]);

  // Get error message
  const getErrorMessage = useCallback((error: unknown): string => {
    return freighterService.getErrorMessage(error);
  }, []);

  // Validate address
  const isValidAddress = useCallback((address: string): boolean => {
    return freighterService.isValidStellarAddress(address);
  }, []);

  // Check connection status periodically
  const checkConnectionStatus = useCallback(async () => {
    if (!isFreighterAvailable) return;

    try {
      const connected = await freighterService.getConnectionStatus();
      if (connected !== isConnected) {
        setIsConnected(connected);
        if (!connected) {
          setAccount(null);
          setBalance(null);
          setNetwork(null);
        }
      }
    } catch (error) {
      console.error('Connection status check error:', error);
    }
  }, [isFreighterAvailable, isConnected]);

  // Initialize on mount
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Check connection status periodically
  useEffect(() => {
    if (!isFreighterAvailable) return;

    const interval = setInterval(checkConnectionStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [isFreighterAvailable, checkConnectionStatus]);

  // Auto-refresh balance periodically
  useEffect(() => {
    if (!isConnected || !account) return;

    const interval = setInterval(refreshBalance, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [isConnected, account, refreshBalance]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    account,
    
    // Balance state
    balance,
    isLoadingBalance,
    
    // Network state
    network,
    isLoadingNetwork,
    
    // Availability
    isFreighterAvailable,
    isCheckingAvailability,
    
    // Actions
    connect,
    disconnect,
    refreshBalance,
    switchNetwork,
    signTransaction,
    
    // Utilities
    getErrorMessage,
    isValidAddress,
  };
};
