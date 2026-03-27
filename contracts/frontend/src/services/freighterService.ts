import { Networks, TransactionBuilder, Account, BASE_FEE } from '@stellar/stellar-sdk';

export interface FreighterAccount {
  publicKey: string;
  network: string;
  isConnected: boolean;
}

export interface FreighterBalance {
  native: string;
  tokens: { [key: string]: string };
}

export interface FreighterTransaction {
  to: string;
  amount: string;
  asset?: string;
  memo?: string;
}

export interface FreighterNetwork {
  network: Networks;
  networkPassphrase: string;
}

class FreighterService {
  private isFreighterInstalled(): boolean {
    return !!(window as any).freighter;
  }

  private async getFreighterApi() {
    if (!this.isFreighterInstalled()) {
      throw new Error('Freighter wallet is not installed. Please install Freighter to continue.');
    }
    return (window as any).freighter;
  }

  /**
   * Check if Freighter is installed and available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const freighter = await this.getFreighterApi();
      return !!freighter;
    } catch {
      return false;
    }
  }

  /**
   * Connect to Freighter wallet and get user's public key
   */
  async connect(): Promise<FreighterAccount> {
    try {
      const freighter = await this.getFreighterApi();
      
      // Request user's public key
      const publicKey = await freighter.getPublicKey();
      
      // Get current network
      const network = await freighter.getNetwork();
      
      if (!publicKey) {
        throw new Error('Failed to get public key from Freighter');
      }

      return {
        publicKey,
        network: network.networkPassphrase,
        isConnected: true
      };
    } catch (error) {
      throw new Error(`Failed to connect to Freighter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from Freighter wallet
   */
  async disconnect(): Promise<void> {
    try {
      const freighter = await this.getFreighterApi();
      
      // Freighter doesn't have a direct disconnect method
      // We'll clear the connection state on our side
      // In a real app, you might want to clear local storage or state
      
      return Promise.resolve();
    } catch (error) {
      throw new Error(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(publicKey: string): Promise<FreighterBalance> {
    try {
      const freighter = await this.getFreighterApi();
      
      // Get balance from Freighter
      const balance = await freighter.getBalance();
      
      return {
        native: balance.native || '0',
        tokens: balance.tokens || {}
      };
    } catch (error) {
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current network configuration
   */
  async getNetwork(): Promise<FreighterNetwork> {
    try {
      const freighter = await this.getFreighterApi();
      const network = await freighter.getNetwork();
      
      return {
        network: network.network,
        networkPassphrase: network.networkPassphrase
      };
    } catch (error) {
      throw new Error(`Failed to get network: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(network: Networks): Promise<void> {
    try {
      const freighter = await this.getFreighterApi();
      
      let networkConfig;
      switch (network) {
        case Networks.PUBLIC:
          networkConfig = {
            network: Networks.PUBLIC,
            networkPassphrase: Networks.PUBLIC
          };
          break;
        case Networks.TESTNET:
          networkConfig = {
            network: Networks.TESTNET,
            networkPassphrase: Networks.TESTNET
          };
          break;
        case Networks.FUTURENET:
          networkConfig = {
            network: Networks.FUTURENET,
            networkPassphrase: Networks.FUTURENET
          };
          break;
        default:
          throw new Error('Unsupported network');
      }
      
      await freighter.setNetwork(networkConfig);
    } catch (error) {
      throw new Error(`Failed to switch network: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(xdr: string, network: Networks): Promise<string> {
    try {
      const freighter = await this.getFreighterApi();
      
      // Ensure we're on the correct network
      await this.switchNetwork(network);
      
      // Sign the transaction
      const signedXdr = await freighter.signTransaction(xdr, {
        network,
        networkPassphrase: network
      });
      
      return signedXdr;
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create and sign a simple payment transaction
   */
  async createAndSignPayment(
    fromPublicKey: string,
    transaction: FreighterTransaction,
    network: Networks
  ): Promise<string> {
    try {
      const freighter = await this.getFreighterApi();
      
      // Get account details
      const accountDetails = await freighter.getAccountDetails(fromPublicKey);
      const account = new Account(fromPublicKey, accountDetails.sequenceNumber);
      
      // Build transaction
      const txBuilder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: network
      });
      
      // Add payment operation
      if (transaction.asset) {
        // For custom assets, you'd need to create the asset object
        // This is a simplified version for native XLM
        txBuilder.addOperation({
          type: 'payment',
          destination: transaction.to,
          asset: 'native',
          amount: transaction.amount
        });
      } else {
        txBuilder.addOperation({
          type: 'payment',
          destination: transaction.to,
          asset: 'native',
          amount: transaction.amount
        });
      }
      
      // Add memo if provided
      if (transaction.memo) {
        txBuilder.addMemo(transaction.memo);
      }
      
      // Build transaction
      const builtTx = txBuilder.setTimeout(30).build();
      
      // Convert to XDR
      const xdr = builtTx.toXDR();
      
      // Sign transaction
      return await this.signTransaction(xdr, network);
    } catch (error) {
      throw new Error(`Failed to create and sign payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<boolean> {
    try {
      const freighter = await this.getFreighterApi();
      const publicKey = await freighter.getPublicKey();
      return !!publicKey;
    } catch {
      return false;
    }
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Handle common Freighter errors
      if (error.message.includes('User rejected')) {
        return 'Transaction was rejected by the user';
      }
      if (error.message.includes('No public key')) {
        return 'Please unlock your Freighter wallet';
      }
      if (error.message.includes('Network')) {
        return 'Network error. Please check your connection';
      }
      return error.message;
    }
    return 'An unknown error occurred';
  }

  /**
   * Validate Stellar address
   */
  isValidStellarAddress(address: string): boolean {
    try {
      // Basic validation - Stellar addresses start with 'G' and are 56 characters long
      return /^G[A-Z0-9]{55}$/.test(address);
    } catch {
      return false;
    }
  }

  /**
   * Format balance for display
   */
  formatBalance(balance: string, decimals: number = 7): string {
    try {
      const num = parseFloat(balance);
    if (isNaN(num)) return '0';
    
    return num.toFixed(decimals);
    } catch {
      return '0';
    }
  }

  /**
   * Get transaction fee estimate
   */
  async getTransactionFeeEstimate(): Promise<string> {
    try {
      // Base fee is 100 stroops (0.00001 XLM)
      // This is a simplified estimate
      return BASE_FEE;
    } catch {
      return BASE_FEE;
    }
  }
}

// Create singleton instance
const freighterService = new FreighterService();

export default freighterService;
