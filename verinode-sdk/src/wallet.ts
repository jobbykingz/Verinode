import { Config, HttpClient, Utils } from './utils';
import { WalletError, ErrorHandler } from './errors';

/**
 * Wallet interface for different wallet providers
 */
export interface Wallet {
  /**
   * Connect to wallet
   */
  connect(): Promise<WalletConnection>;

  /**
   * Disconnect from wallet
   */
  disconnect(): Promise<void>;

  /**
   * Sign a transaction
   */
  signTransaction(transaction: any): Promise<string>;

  /**
   * Sign a message
   */
  signMessage(message: string): Promise<string>;

  /**
   * Get public key
   */
  getPublicKey(): Promise<string>;

  /**
   * Get wallet address
   */
  getAddress(): Promise<string>;

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean;

  /**
   * Get wallet name
   */
  getName(): string;
}

/**
 * Wallet connection information
 */
export interface WalletConnection {
  address: string;
  publicKey: string;
  network: string;
  walletName: string;
}

/**
 * Freighter wallet implementation
 */
export class FreighterWallet implements Wallet {
  private connected: boolean = false;
  private address: string = '';
  private publicKey: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      // Check if Freighter is available
      if (!(window as any).freighter) {
        throw new WalletError('Freighter wallet not found. Please install the Freighter extension.');
      }
    }
  }

  public async connect(): Promise<WalletConnection> {
    try {
      const freighter = (window as any).freighter;
      
      // Check if Freighter is connected to the right network
      const network = await freighter.getNetwork();
      const allowedNetworks = ['mainnet', 'testnet'];
      
      if (!allowedNetworks.includes(network)) {
        throw new WalletError(`Unsupported network: ${network}`);
      }

      // Connect to wallet
      const isConnected = await freighter.isConnected();
      if (!isConnected) {
        await freighter.connect();
      }

      // Get account information
      this.address = await freighter.getPublicKey();
      this.publicKey = await freighter.getPublicKey();
      this.connected = true;

      return {
        address: this.address,
        publicKey: this.publicKey,
        network,
        walletName: 'Freighter'
      };
    } catch (error) {
      throw ErrorHandler.handleAxiosError(error);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      const freighter = (window as any).freighter;
      await freighter.disconnect();
      this.connected = false;
      this.address = '';
      this.publicKey = '';
    } catch (error) {
      throw ErrorHandler.handleAxiosError(error);
    }
  }

  public async signTransaction(transaction: any): Promise<string> {
    if (!this.connected) {
      throw new WalletError('Wallet not connected');
    }

    try {
      const freighter = (window as any).freighter;
      return await freighter.signTransaction(transaction);
    } catch (error) {
      throw ErrorHandler.handleAxiosError(error);
    }
  }

  public async signMessage(message: string): Promise<string> {
    if (!this.connected) {
      throw new WalletError('Wallet not connected');
    }

    try {
      const freighter = (window as any).freighter;
      return await freighter.signMessage(message);
    } catch (error) {
      throw ErrorHandler.handleAxiosError(error);
    }
  }

  public async getPublicKey(): Promise<string> {
    if (!this.connected) {
      throw new WalletError('Wallet not connected');
    }
    return this.publicKey;
  }

  public async getAddress(): Promise<string> {
    if (!this.connected) {
      throw new WalletError('Wallet not connected');
    }
    return this.address;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getName(): string {
    return 'Freighter';
  }
}

/**
 * Wallet service for managing wallet connections
 */
export class WalletService {
  private config: Config;
  private httpClient: HttpClient;
  private currentWallet: Wallet | null = null;
  private connection: WalletConnection | null = null;

  constructor(config: Config) {
    this.config = config;
    this.httpClient = new HttpClient(config);
  }

  /**
   * Connect to a wallet
   */
  public async connect(walletType: 'freighter' | 'rabby' | 'metamask' = 'freighter'): Promise<WalletConnection> {
    try {
      let wallet: Wallet;

      switch (walletType) {
        case 'freighter':
          wallet = new FreighterWallet();
          break;
        case 'rabby':
        case 'metamask':
          throw new WalletError(`${walletType} wallet support coming soon`);
        default:
          throw new WalletError(`Unsupported wallet type: ${walletType}`);
      }

      this.currentWallet = wallet;
      this.connection = await wallet.connect();

      // Store connection info
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('verinode-wallet-connection', JSON.stringify({
          ...this.connection,
          timestamp: Date.now()
        }));
      }

      return this.connection;
    } catch (error) {
      throw ErrorHandler.wrap(async () => { throw error; });
    }
  }

  /**
   * Disconnect from current wallet
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.currentWallet) {
        await this.currentWallet.disconnect();
        this.currentWallet = null;
        this.connection = null;
        
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('verinode-wallet-connection');
        }
      }
    } catch (error) {
      throw ErrorHandler.wrap(async () => { throw error; });
    }
  }

  /**
   * Sign a transaction
   */
  public async signTransaction(transaction: any): Promise<string> {
    if (!this.currentWallet) {
      throw new WalletError('No wallet connected');
    }

    try {
      return await this.currentWallet.signTransaction(transaction);
    } catch (error) {
      throw ErrorHandler.wrap(async () => { throw error; });
    }
  }

  /**
   * Sign a message
   */
  public async signMessage(message: string): Promise<string> {
    if (!this.currentWallet) {
      throw new WalletError('No wallet connected');
    }

    try {
      return await this.currentWallet.signMessage(message);
    } catch (error) {
      throw ErrorHandler.wrap(async () => { throw error; });
    }
  }

  /**
   * Get current wallet address
   */
  public async getAddress(): Promise<string> {
    if (!this.currentWallet) {
      throw new WalletError('No wallet connected');
    }

    try {
      return await this.currentWallet.getAddress();
    } catch (error) {
      throw ErrorHandler.wrap(async () => { throw error; });
    }
  }

  /**
   * Get current public key
   */
  public async getPublicKey(): Promise<string> {
    if (!this.currentWallet) {
      throw new WalletError('No wallet connected');
    }

    try {
      return await this.currentWallet.getPublicKey();
    } catch (error) {
      throw ErrorHandler.wrap(async () => { throw error; });
    }
  }

  /**
   * Check if wallet is connected
   */
  public isConnected(): boolean {
    return this.currentWallet !== null && this.currentWallet.isConnected();
  }

  /**
   * Get current wallet connection info
   */
  public getConnection(): WalletConnection | null {
    return this.connection;
  }

  /**
   * Get supported wallet types
   */
  public getSupportedWallets(): string[] {
    return this.config.getWalletConfig().supportedWallets || ['freighter'];
  }

  /**
   * Auto-connect to previously connected wallet
   */
  public async autoConnect(): Promise<WalletConnection | null> {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }

      const storedConnection = localStorage.getItem('verinode-wallet-connection');
      if (!storedConnection) {
        return null;
      }

      const connectionData = JSON.parse(storedConnection);
      
      // Check if connection is still valid (within 24 hours)
      const oneDay = 24 * 60 * 60 * 1000;
      if (Date.now() - connectionData.timestamp > oneDay) {
        localStorage.removeItem('verinode-wallet-connection');
        return null;
      }

      // Try to reconnect
      const connection = await this.connect(connectionData.walletName.toLowerCase() as any);
      return connection;
    } catch (error) {
      // Clear invalid connection data
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('verinode-wallet-connection');
      }
      return null;
    }
  }
}