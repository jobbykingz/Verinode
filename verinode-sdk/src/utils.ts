import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import Joi from 'joi';

/**
 * Configuration class for Verinode SDK
 */
export class Config {
  private options: Required<VerinodeOptions>;

  constructor(options: VerinodeOptions = {}) {
    this.options = this.mergeWithDefaults(options);
  }

  /**
   * Merge user options with default values
   */
  private mergeWithDefaults(options: VerinodeOptions): Required<VerinodeOptions> {
    return {
      apiEndpoint: options.apiEndpoint || 'https://api.verinode.com',
      network: options.network || 'mainnet',
      apiKey: options.apiKey || '',
      timeout: options.timeout || 10000,
      retry: {
        maxAttempts: options.retry?.maxAttempts || 3,
        delay: options.retry?.delay || 1000,
        backoffMultiplier: options.retry?.backoffMultiplier || 2
      },
      wallet: {
        autoConnect: options.wallet?.autoConnect || false,
        supportedWallets: options.wallet?.supportedWallets || ['freighter', 'rabby', 'metamask']
      },
      logging: {
        enabled: options.logging?.enabled || false,
        level: options.logging?.level || 'info'
      }
    };
  }

  /**
   * Validate configuration
   */
  public validate(): boolean {
    const schema = Joi.object({
      apiEndpoint: Joi.string().uri().required(),
      network: Joi.string().valid('mainnet', 'testnet').required(),
      apiKey: Joi.string().allow(''),
      timeout: Joi.number().min(1000).max(30000).required(),
      retry: Joi.object({
        maxAttempts: Joi.number().min(1).max(10).required(),
        delay: Joi.number().min(100).max(10000).required(),
        backoffMultiplier: Joi.number().min(1).max(5).required()
      }).required(),
      wallet: Joi.object({
        autoConnect: Joi.boolean().required(),
        supportedWallets: Joi.array().items(Joi.string()).required()
      }).required(),
      logging: Joi.object({
        enabled: Joi.boolean().required(),
        level: Joi.string().valid('debug', 'info', 'warn', 'error').required()
      }).required()
    });

    const { error } = schema.validate(this.options);
    if (error) {
      throw new Error(`Invalid configuration: ${error.message}`);
    }

    return true;
  }

  /**
   * Get current options
   */
  public getOptions(): VerinodeOptions {
    return { ...this.options };
  }

  /**
   * Update configuration
   */
  public update(options: Partial<VerinodeOptions>): void {
    this.options = { ...this.options, ...options };
    this.validate();
  }

  /**
   * Get API endpoint
   */
  public getApiEndpoint(): string {
    return this.options.apiEndpoint;
  }

  /**
   * Get network type
   */
  public getNetwork(): 'mainnet' | 'testnet' {
    return this.options.network;
  }

  /**
   * Get API key
   */
  public getApiKey(): string {
    return this.options.apiKey;
  }

  /**
   * Get timeout
   */
  public getTimeout(): number {
    return this.options.timeout;
  }

  /**
   * Get retry configuration
   */
  public getRetryConfig(): Required<VerinodeOptions>['retry'] {
    return this.options.retry;
  }

  /**
   * Get wallet configuration
   */
  public getWalletConfig(): Required<VerinodeOptions>['wallet'] {
    return this.options.wallet;
  }

  /**
   * Check if logging is enabled
   */
  public isLoggingEnabled(): boolean {
    return this.options.logging?.enabled ?? false;
  }

  /**
   * Get log level
   */
  public getLogLevel(): string {
    return this.options.logging?.level ?? 'info';
  }
}

/**
 * HTTP client for making API requests
 */
export class HttpClient {
  private client: AxiosInstance;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.getApiEndpoint(),
      timeout: config.getTimeout(),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.getApiKey(),
        'X-Verinode-SDK': '1.0.0'
      }
    });

    // Add request interceptor for logging
    if (config.isLoggingEnabled()) {
      this.client.interceptors.request.use(
        (request) => {
          console.log(`[Verinode SDK] ${request.method?.toUpperCase()} ${request.url}`);
          return request;
        },
        (error) => {
          console.error('[Verinode SDK] Request error:', error);
          return Promise.reject(error);
        }
      );

      // Add response interceptor for logging
      this.client.interceptors.response.use(
        (response) => {
          console.log(`[Verinode SDK] Response: ${response.status} ${response.config.url}`);
          return response;
        },
        (error) => {
          console.error('[Verinode SDK] Response error:', error.response?.status, error.message);
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Make GET request
   */
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.makeRequest(() => this.client.get<T>(url, config));
  }

  /**
   * Make POST request
   */
  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.makeRequest(() => this.client.post<T>(url, data, config));
  }

  /**
   * Make PUT request
   */
  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.makeRequest(() => this.client.put<T>(url, data, config));
  }

  /**
   * Make DELETE request
   */
  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.makeRequest(() => this.client.delete<T>(url, config));
  }

  /**
   * Make request with retry logic
   */
  private async makeRequest<T>(requestFn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    const retryConfig = this.config.getRetryConfig();
    let lastError: Error;

    const maxAttempts = retryConfig.maxAttempts ?? 3;
    const delay = retryConfig.delay ?? 1000;
    const backoffMultiplier = retryConfig.backoffMultiplier ?? 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          const retryDelay = delay * Math.pow(backoffMultiplier, attempt - 1);
          await this.sleep(retryDelay);
          
          if (this.config.isLoggingEnabled()) {
            console.log(`[Verinode SDK] Retry attempt ${attempt}/${maxAttempts} in ${retryDelay}ms`);
          }
        }
      }
    }

    throw lastError!;
  }

  /**
   * Sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Utility functions
 */
export class Utils {
  /**
   * Generate random ID
   */
  public static generateId(length: number = 16): string {
    return Array.from({ length }, () => 
      Math.floor(Math.random() * 36).toString(36)
    ).join('');
  }

  /**
   * Validate Stellar address
   */
  public static isValidStellarAddress(address: string): boolean {
    // Basic Stellar address validation
    return /^G[A-Z2-7]{55}$/.test(address);
  }

  /**
   * Validate proof hash
   */
  public static isValidProofHash(hash: string): boolean {
    // SHA-256 hash validation
    return /^[a-fA-F0-9]{64}$/.test(hash);
  }

  /**
   * Format date to ISO string
   */
  public static formatDate(date: Date): string {
    return date.toISOString();
  }

  /**
   * Deep merge objects
   */
  public static deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target } as T;
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key] as Record<string, any>);
      } else {
        result[key] = source[key] as any;
      }
    }
    
    return result;
  }
}

// Export interfaces
export interface VerinodeOptions {
  apiEndpoint?: string;
  network?: 'mainnet' | 'testnet';
  apiKey?: string;
  timeout?: number;
  retry?: {
    maxAttempts?: number;
    delay?: number;
    backoffMultiplier?: number;
  };
  wallet?: {
    autoConnect?: boolean;
    supportedWallets?: string[];
  };
  logging?: {
    enabled?: boolean;
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
}