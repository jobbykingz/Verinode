import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, AlertCircle, DollarSign, Coins } from 'lucide-react';
import { useFreighter } from '../../hooks/useFreighter';
import toast from 'react-hot-toast';

interface BalanceDisplayProps {
  className?: string;
  showTokens?: boolean;
  showPercentageChange?: boolean;
  refreshInterval?: number;
  compact?: boolean;
  large?: boolean;
}

interface TokenBalance {
  code: string;
  balance: string;
  usdValue?: number;
  change24h?: number;
}

interface HistoricalBalance {
  timestamp: number;
  balance: number;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  className = '',
  showTokens = true,
  showPercentageChange = false,
  refreshInterval = 30000, // 30 seconds
  compact = false,
  large = false
}) => {
  const {
    isConnected,
    account,
    balance,
    isLoadingBalance,
    refreshBalance
  } = useFreighter();

  const [historicalBalances, setHistoricalBalances] = useState<HistoricalBalance[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});

  // Mock price data - in a real app, this would come from a price API
  const mockPrices: Record<string, number> = {
    'XLM': 0.089,
    'USD': 1.0,
    'EUR': 1.08,
    'BTC': 43250.0,
    'ETH': 2280.0
  };

  useEffect(() => {
    // Initialize token prices
    setTokenPrices(mockPrices);
  }, []);

  useEffect(() => {
    if (!isConnected || !balance) return;

    // Add current balance to history
    const currentBalance = parseFloat(balance.native) || 0;
    const newEntry: HistoricalBalance = {
      timestamp: Date.now(),
      balance: currentBalance
    };

    setHistoricalBalances(prev => {
      const updated = [...prev, newEntry];
      // Keep only last 100 entries
      return updated.slice(-100);
    });

    setLastRefresh(new Date());
  }, [balance, isConnected]);

  useEffect(() => {
    if (!isConnected || refreshInterval <= 0) return;

    const interval = setInterval(async () => {
      await handleRefresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isConnected, refreshInterval]);

  const handleRefresh = async () => {
    if (!isConnected) return;

    setIsRefreshing(true);
    try {
      await refreshBalance();
    } catch (error) {
      toast.error('Failed to refresh balance');
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatBalance = (balance: string, decimals: number = 7): string => {
    try {
      const num = parseFloat(balance);
      if (isNaN(num)) return '0';
      
      if (num === 0) return '0';
      
      // For very small numbers, show more decimals
      if (num < 0.001) {
        return num.toFixed(7);
      }
      
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      });
    } catch {
      return '0';
    }
  };

  const formatUSDValue = (balance: string, price: number): string => {
    try {
      const num = parseFloat(balance) * price;
      if (isNaN(num)) return '$0.00';
      
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    } catch {
      return '$0.00';
    }
  };

  const getPercentageChange = (): number | null => {
    if (historicalBalances.length < 2) return null;
    
    const current = historicalBalances[historicalBalances.length - 1].balance;
    const previous = historicalBalances[historicalBalances.length - 2].balance;
    
    if (previous === 0) return null;
    
    return ((current - previous) / previous) * 100;
  };

  const getTokenBalances = (): TokenBalance[] => {
    if (!balance) return [];

    const tokens: TokenBalance[] = [];

    // Native XLM balance
    tokens.push({
      code: 'XLM',
      balance: balance.native,
      usdValue: tokenPrices['XLM'] ? parseFloat(balance.native) * tokenPrices['XLM'] : undefined
    });

    // Token balances
    if (balance.tokens) {
      Object.entries(balance.tokens).forEach(([code, bal]) => {
        tokens.push({
          code,
          balance: bal,
          usdValue: tokenPrices[code] ? parseFloat(bal) * tokenPrices[code] : undefined
        });
      });
    }

    return tokens;
  };

  const getTotalUSDValue = (): number => {
    return getTokenBalances().reduce((total, token) => {
      return total + (token.usdValue || 0);
    }, 0);
  };

  const percentageChange = getPercentageChange();

  if (!isConnected) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <Wallet className="w-5 h-5 text-gray-600" />
          <span className="text-sm text-gray-700">Connect wallet to view balance</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Coins className="w-5 h-5 text-blue-600" />
            <div>
              <p className={`font-medium text-gray-900 ${large ? 'text-lg' : 'text-sm'}`}>
                {balance ? formatBalance(balance.native) : '0'} XLM
              </p>
              {tokenPrices['XLM'] && balance && (
                <p className="text-xs text-gray-600">
                  {formatUSDValue(balance.native, tokenPrices['XLM'])}
                </p>
              )}
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoadingBalance}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  const tokens = getTokenBalances();
  const totalUSD = getTotalUSDValue();

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Balance</h3>
              {lastRefresh && (
                <p className="text-xs text-gray-600">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoadingBalance}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Total Value */}
      <div className="p-6 border-b border-gray-200">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Total Value</p>
          <p className={`font-bold text-gray-900 ${large ? 'text-3xl' : 'text-2xl'}`}>
            {totalUSD > 0 ? formatUSDValue(totalUSD.toString(), 1) : '$0.00'}
          </p>
          
          {showPercentageChange && percentageChange !== null && (
            <div className="flex items-center justify-center mt-2 space-x-1">
              {percentageChange >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${
                percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Balance Details */}
      <div className="p-6">
        {isLoadingBalance ? (
          <div className="space-y-3">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-300 rounded w-1/2"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-300 rounded w-1/3"></div>
            </div>
          </div>
        ) : tokens.length > 0 ? (
          <div className="space-y-4">
            {tokens.map((token) => (
              <div key={token.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    token.code === 'XLM' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Coins className={`w-4 h-4 ${
                      token.code === 'XLM' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{token.code}</p>
                    {token.usdValue && (
                      <p className="text-xs text-gray-600">
                        {formatUSDValue(token.balance, token.usdValue / parseFloat(token.balance))}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={`font-medium text-gray-900 ${large ? 'text-lg' : ''}`}>
                    {formatBalance(token.balance)}
                  </p>
                  {token.usdValue && (
                    <p className="text-xs text-gray-600">
                      {formatUSDValue(token.balance, token.usdValue / parseFloat(token.balance))}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No balance available</p>
          </div>
        )}

        {/* Account Info */}
        {account && (
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Account:</strong> {account.publicKey.slice(0, 10)}...{account.publicKey.slice(-10)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceDisplay;
