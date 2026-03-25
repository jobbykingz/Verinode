import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface CreateWalletRequest {
  name: string;
  description?: string;
  network: 'STELLAR' | 'ETHEREUM' | 'POLYGON';
  threshold: number;
  signers: Array<{
    address: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'SIGNER';
    weight?: number;
  }>;
  createdBy: string;
  security?: {
    dailyLimit?: number;
    singleTransactionLimit?: number;
    allowedOperations?: string[];
    timeLockPeriod?: number;
  };
  recovery?: {
    enabled?: boolean;
    method?: 'SOCIAL_RECOVERY' | 'BACKUP_SIGNATURES' | 'TIME_DELAY';
    recoverySigners?: Array<{
      address: string;
      name: string;
      trusted?: boolean;
    }>;
  };
}

export interface CreateSignatureRequest {
  walletId: string;
  type: 'PROOF_CREATION' | 'PROOF_VERIFICATION' | 'CONTRACT_INTERACTION' | 'TOKEN_TRANSFER' | 'CONFIG_CHANGE' | 'SIGNER_MANAGEMENT' | 'EMERGENCY_ACTIONS';
  title: string;
  description: string;
  payload: any;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expiresIn?: number;
  createdBy: string;
  ipAddress: string;
  userAgent: string;
  relatedProofId?: string;
  relatedContractAddress?: string;
}

export interface Wallet {
  walletId: string;
  name: string;
  description?: string;
  config: {
    threshold: number;
    signers: Array<{
      address: string;
      name: string;
      role: 'OWNER' | 'ADMIN' | 'SIGNER';
      weight: number;
      active: boolean;
      addedAt: string;
    }>;
    maxSigners: number;
  };
  state: {
    isActive: boolean;
    isFrozen: boolean;
    network: 'STELLAR' | 'ETHEREUM' | 'POLYGON';
    contractAddress?: string;
  };
  security: {
    dailyLimit: number;
    singleTransactionLimit: number;
    allowedOperations: string[];
  };
  stats: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingSignatures: number;
  };
  metadata: {
    createdBy: string;
    createdAt: string;
    lastModified: string;
  };
}

export interface SignatureRequest {
  requestId: string;
  walletId: string;
  request: {
    type: string;
    title: string;
    description: string;
    payload: any;
    priority: string;
  };
  signatures: Array<{
    signerAddress: string;
    signature: string;
    signedAt: string;
    weight: number;
  }>;
  status: string;
  timing: {
    createdAt: string;
    expiresAt: string;
    executedAt?: string;
  };
  threshold: {
    required: number;
    currentWeight: number;
    requiredWeight: number;
    isMet: boolean;
  };
  metadata: {
    createdBy: string;
    tags: string[];
  };
}

export interface SignatureStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  executedRequests: number;
  failedRequests: number;
  averageSignaturesPerRequest: number;
  averageConfirmationTime: number;
  signerParticipation: Array<{
    signerAddress: string;
    signerName: string;
    totalSignatures: number;
    participationRate: number;
    averageResponseTime: number;
  }>;
}

export interface SuspiciousPattern {
  type: 'RAPID_SIGNING' | 'UNUSUAL_TIME' | 'DUPLICATE_IP' | 'SIGNATURE_ANOMALY';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedSignatures: string[];
  recommendation: string;
}

class MultiSigService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  constructor() {
    // Add request interceptor for auth token
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Wallet Management
  async createWallet(request: CreateWalletRequest): Promise<Wallet> {
    const response = await this.api.post('/multisig/wallets', request);
    return response.data.data;
  }

  async getWallet(walletId: string): Promise<Wallet> {
    const response = await this.api.get(`/multisig/wallets/${walletId}`);
    return response.data.data;
  }

  async listWallets(userId: string, options?: {
    page?: number;
    limit?: number;
    network?: string;
  }): Promise<{
    wallets: Wallet[];
    page: number;
    limit: number;
    total: number;
    pages: number;
  }> {
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.network) params.append('network', options.network);

    const response = await this.api.get(`/multisig/wallets?${params}`);
    return response.data;
  }

  async updateWalletConfig(walletId: string, updates: any, userId: string): Promise<Wallet> {
    const response = await this.api.put(`/multisig/wallets/${walletId}/config`, updates, {
      headers: { 'X-User-ID': userId }
    });
    return response.data.data;
  }

  async manageSigners(walletId: string, action: 'add' | 'remove', signers: any[], userId: string): Promise<Wallet> {
    const response = await this.api.put(`/multisig/wallets/${walletId}/signers`, {
      action,
      signers
    }, {
      headers: { 'X-User-ID': userId }
    });
    return response.data.data;
  }

  async freezeWallet(walletId: string, freeze: boolean, reason?: string, userId?: string): Promise<Wallet> {
    const response = await this.api.put(`/multisig/wallets/${walletId}/freeze`, {
      freeze,
      reason
    }, {
      headers: { 'X-User-ID': userId }
    });
    return response.data.data;
  }

  // Signature Request Management
  async createSignatureRequest(request: CreateSignatureRequest): Promise<SignatureRequest> {
    const response = await this.api.post('/multisig/signature-requests', request);
    return response.data.data;
  }

  async getSignatureRequest(requestId: string): Promise<SignatureRequest> {
    const response = await this.api.get(`/multisig/signature-requests/${requestId}`);
    return response.data.data;
  }

  async listSignatureRequests(walletId: string, options?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
  }): Promise<{
    requests: SignatureRequest[];
    page: number;
    limit: number;
    total: number;
    pages: number;
  }> {
    const params = new URLSearchParams();
    params.append('walletId', walletId);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.type) params.append('type', options.type);

    const response = await this.api.get(`/multisig/wallets/${walletId}/signature-requests?${params}`);
    return response.data;
  }

  async addSignature(requestId: string, signerAddress: string, signature: string, metadata?: any): Promise<SignatureRequest> {
    const response = await this.api.post(`/multisig/signature-requests/${requestId}/signatures`, {
      signerAddress,
      signature,
      metadata
    });
    return response.data.data;
  }

  async executeRequest(requestId: string): Promise<SignatureRequest> {
    const response = await this.api.post(`/multisig/signature-requests/${requestId}/execute`);
    return response.data.data;
  }

  // Challenge Verification
  async generateSignatureChallenge(requestId: string, signerAddress: string, metadata?: any): Promise<{
    challenge: string;
    expiresAt: string;
  }> {
    const response = await this.api.post(`/multisig/signature-requests/${requestId}/challenge`, {
      signerAddress,
      metadata
    });
    return response.data.data;
  }

  async verifyChallengeSignature(requestId: string, signerAddress: string, challengeSignature: string): Promise<{
    isValid: boolean;
  }> {
    const response = await this.api.post(`/multisig/signature-requests/${requestId}/verify-challenge`, {
      signerAddress,
      challengeSignature
    });
    return response.data.data;
  }

  // Analytics and Monitoring
  async getSignatureStats(walletId: string): Promise<SignatureStats> {
    const response = await this.api.get(`/multisig/wallets/${walletId}/signature-stats`);
    return response.data.data;
  }

  async detectSuspiciousPatterns(walletId: string): Promise<SuspiciousPattern[]> {
    const response = await this.api.get(`/multisig/wallets/${walletId}/suspicious-patterns`);
    return response.data.data;
  }

  // Batch Operations
  async createBatchSignatureRequests(requests: CreateSignatureRequest[]): Promise<SignatureRequest[]> {
    const response = await this.api.post('/multisig/signature-requests/batch', { requests });
    return response.data.data;
  }

  async addBatchSignatures(requestId: string, signatures: Array<{
    signerAddress: string;
    signature: string;
    metadata?: any;
  }>): Promise<SignatureRequest> {
    const response = await this.api.post(`/multisig/signature-requests/batch-signatures`, {
      requestId,
      signatures
    });
    return response.data.data;
  }

  async executeBatchRequests(requestIds: string[]): Promise<SignatureRequest[]> {
    const response = await this.api.post('/multisig/signature-requests/batch-execute', { requestIds });
    return response.data.data;
  }

  // Recovery Operations
  async initiateRecovery(walletId: string, recoveryData: any): Promise<any> {
    const response = await this.api.post(`/multisig/wallets/${walletId}/initiate-recovery`, recoveryData);
    return response.data.data;
  }

  async completeRecovery(walletId: string, recoveryProof: any): Promise<Wallet> {
    const response = await this.api.post(`/multisig/wallets/${walletId}/complete-recovery`, recoveryProof);
    return response.data.data;
  }

  async getRecoveryStatus(walletId: string): Promise<any> {
    const response = await this.api.get(`/multisig/wallets/${walletId}/recovery-status`);
    return response.data.data;
  }

  // Notification Management
  async sendNotification(requestId: string, notificationData: any): Promise<any> {
    const response = await this.api.post(`/multisig/signature-requests/${requestId}/notify`, notificationData);
    return response.data.data;
  }

  async updateNotificationPreferences(requestId: string, preferences: any): Promise<any> {
    const response = await this.api.put(`/multisig/signature-requests/${requestId}/notification-preferences`, preferences);
    return response.data.data;
  }

  // Audit and Compliance
  async getAuditLog(walletId: string, options?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const response = await this.api.get(`/multisig/wallets/${walletId}/audit-log?${params}`);
    return response.data.data;
  }

  async getAuditTrail(requestId: string): Promise<any> {
    const response = await this.api.get(`/multisig/signature-requests/${requestId}/audit-trail`);
    return response.data.data;
  }

  async exportAuditData(walletId: string, format: 'json' | 'csv' | 'pdf' = 'json'): Promise<Blob> {
    const response = await this.api.post(`/multisig/wallets/${walletId}/export-audit`, 
      { format },
      { responseType: 'blob' }
    );
    return response.data;
  }

  // Health Check
  async healthCheck(): Promise<{
    success: boolean;
    service: string;
    status: string;
    timestamp: string;
  }> {
    const response = await this.api.get('/multisig/health/multisig');
    return response.data;
  }

  // Service Metrics
  async getServiceMetrics(): Promise<any> {
    const response = await this.api.get('/multisig/metrics/multisig');
    return response.data.data;
  }

  // Utility Methods
  async validateSignerAddress(address: string, network: 'STELLAR' | 'ETHEREUM' | 'POLYGON'): Promise<{
    isValid: boolean;
    normalizedAddress?: string;
    error?: string;
  }> {
    try {
      const response = await this.api.post('/multisig/utils/validate-address', {
        address,
        network
      });
      return response.data.data;
    } catch (error) {
      return { isValid: false, error: 'Validation failed' };
    }
  }

  async estimateTransactionFee(walletId: string, payload: any, network: 'STELLAR' | 'ETHEREUM' | 'POLYGON'): Promise<{
    estimatedFee: number;
    estimatedGas?: number;
    currency: string;
  }> {
    const response = await this.api.post('/multisig/utils/estimate-fee', {
      walletId,
      payload,
      network
    });
    return response.data.data;
  }

  async getNetworkStatus(network: 'STELLAR' | 'ETHEREUM' | 'POLYGON'): Promise<{
    status: 'online' | 'degraded' | 'offline';
    blockNumber?: number;
    gasPrice?: number;
    transactionCount?: number;
    lastUpdated: string;
  }> {
    const response = await this.api.get(`/multisig/utils/network-status/${network}`);
    return response.data.data;
  }
}

export const multiSigService = new MultiSigService();
export default multiSigService;
