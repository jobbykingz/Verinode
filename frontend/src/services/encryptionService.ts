import axios from 'axios';
import { ethers } from 'ethers';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

export interface EncryptedProofData {
  proofId: string;
  owner: string;
  encryptedData: string;
  metadata: {
    algorithm: string;
    keyVersion: string;
    dataSize: number;
    compressionUsed: boolean;
    checksum: string;
  };
  accessControl: {
    authorizedAddresses: string[];
    permissions: string[];
    maxAccessCount: number;
    accessCount: number;
    expirationTime?: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface VerificationResult {
  proofId: string;
  verifier: string;
  result: boolean;
  confidenceScore: number;
  verifiedAt: number;
  gasUsed: number;
}

export interface ComputationRequest {
  proofId: string;
  operation: 'add' | 'multiply' | 'rotate' | 'verify';
  parameters: any;
  priority?: 'low' | 'normal' | 'high';
}

export interface ComputationResult {
  requestId: string;
  proofId: string;
  operation: string;
  result: any;
  gasUsed: number;
  processingTime: number;
  completedAt: number;
}

class EncryptionService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  constructor() {
    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

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

  // Proof Management
  async createEncryptedProof(
    encryptedData: string,
    algorithm: string,
    keyVersion: string,
    authorizedAddresses: string[],
    permissions: string[],
    maxAccessCount: number,
    expirationTime?: number
  ): Promise<EncryptedProofData> {
    const response = await this.api.post('/api/encryption/proofs', {
      encryptedData,
      algorithm,
      keyVersion,
      authorizedAddresses,
      permissions,
      maxAccessCount,
      expirationTime,
    });
    return response.data;
  }

  async getEncryptedProof(proofId: string): Promise<EncryptedProofData> {
    const response = await this.api.get(`/api/encryption/proofs/${proofId}`);
    return response.data;
  }

  async getProofMetadata(proofId: string): Promise<{
    metadata: EncryptedProofData['metadata'];
    accessControl: EncryptedProofData['accessControl'];
    createdAt: number;
    updatedAt: number;
  }> {
    const response = await this.api.get(`/api/encryption/proofs/${proofId}/metadata`);
    return response.data;
  }

  async updateAccessControl(
    proofId: string,
    authorizedAddresses: string[],
    permissions: string[],
    maxAccessCount: number,
    expirationTime?: number
  ): Promise<void> {
    await this.api.put(`/api/encryption/proofs/${proofId}/access`, {
      authorizedAddresses,
      permissions,
      maxAccessCount,
      expirationTime,
    });
  }

  async grantAccess(
    proofId: string,
    address: string,
    permissions: string[]
  ): Promise<void> {
    await this.api.post(`/api/encryption/proofs/${proofId}/access/grant`, {
      address,
      permissions,
    });
  }

  async revokeAccess(proofId: string, address: string): Promise<void> {
    await this.api.post(`/api/encryption/proofs/${proofId}/access/revoke`, {
      address,
    });
  }

  async deleteProof(proofId: string): Promise<void> {
    await this.api.delete(`/api/encryption/proofs/${proofId}`);
  }

  async getOwnerProofs(ownerAddress: string): Promise<string[]> {
    const response = await this.api.get(`/api/encryption/proofs/owner/${ownerAddress}`);
    return response.data.proofIds;
  }

  // Encryption/Decryption
  async encryptProof(proofData: any, algorithm?: string): Promise<string> {
    const response = await this.api.post('/api/encryption/encrypt', {
      data: proofData,
      algorithm,
    });
    return response.data.encryptedData;
  }

  async decryptProof(proofId: string): Promise<any> {
    const response = await this.api.post(`/api/encryption/proofs/${proofId}/decrypt`);
    return response.data.decryptedData;
  }

  // Verification
  async verifyProof(proofId: string, verificationData?: string): Promise<VerificationResult> {
    const response = await this.api.post(`/api/encryption/proofs/${proofId}/verify`, {
      verificationData,
    });
    return response.data;
  }

  async getProofVerifications(proofId: string): Promise<VerificationResult[]> {
    const response = await this.api.get(`/api/encryption/proofs/${proofId}/verifications`);
    return response.data.verifications;
  }

  // Homomorphic Computations
  async requestComputation(request: ComputationRequest): Promise<string> {
    const response = await this.api.post('/api/encryption/compute', request);
    return response.data.requestId;
  }

  async getComputationResult(requestId: string): Promise<ComputationResult> {
    const response = await this.api.get(`/api/encryption/compute/${requestId}`);
    return response.data;
  }

  async getComputationStatus(requestId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    const response = await this.api.get(`/api/encryption/compute/${requestId}/status`);
    return response.data;
  }

  async cancelComputation(requestId: string): Promise<void> {
    await this.api.post(`/api/encryption/compute/${requestId}/cancel`);
  }

  // Batch Operations
  async batchVerifyProofs(proofIds: string[], verificationData: string): Promise<VerificationResult[]> {
    const response = await this.api.post('/api/encryption/batch/verify', {
      proofIds,
      verificationData,
    });
    return response.data.results;
  }

  async batchEncryptProofs(proofs: any[]): Promise<string[]> {
    const response = await this.api.post('/api/encryption/batch/encrypt', {
      proofs,
    });
    return response.data.encryptedProofs;
  }

  // Key Management
  async rotateKeys(proofId?: string): Promise<void> {
    const endpoint = proofId
      ? `/api/encryption/keys/rotate/${proofId}`
      : '/api/encryption/keys/rotate';
    await this.api.post(endpoint);
  }

  async getKeyVersions(): Promise<{ version: string; createdAt: number; active: boolean }[]> {
    const response = await this.api.get('/api/encryption/keys/versions');
    return response.data.versions;
  }

  async backupKeys(): Promise<string> {
    const response = await this.api.post('/api/encryption/keys/backup');
    return response.data.backupId;
  }

  async restoreKeys(backupId: string): Promise<void> {
    await this.api.post('/api/encryption/keys/restore', { backupId });
  }

  // Security & Compliance
  async getSecurityAudit(): Promise<{
    lastAudit: number;
    vulnerabilities: string[];
    complianceStatus: { [key: string]: boolean };
    recommendations: string[];
  }> {
    const response = await this.api.get('/api/encryption/security/audit');
    return response.data;
  }

  async runSecurityCheck(): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const response = await this.api.post('/api/encryption/security/check');
    return response.data;
  }

  // Performance & Monitoring
  async getPerformanceMetrics(): Promise<{
    averageEncryptionTime: number;
    averageDecryptionTime: number;
    averageVerificationTime: number;
    totalProofsProcessed: number;
    cacheHitRate: number;
    errorRate: number;
  }> {
    const response = await this.api.get('/api/encryption/metrics');
    return response.data;
  }

  async benchmarkOperation(operation: string, iterations: number = 100): Promise<{
    operation: string;
    averageTime: number;
    minTime: number;
    maxTime: number;
    throughput: number;
  }> {
    const response = await this.api.post('/api/encryption/benchmark', {
      operation,
      iterations,
    });
    return response.data;
  }

  // Utility Methods
  async validateEncryptedData(encryptedData: string): Promise<boolean> {
    try {
      const response = await this.api.post('/api/encryption/validate', {
        encryptedData,
      });
      return response.data.valid;
    } catch {
      return false;
    }
  }

  async getEncryptionInfo(): Promise<{
    supportedAlgorithms: string[];
    defaultAlgorithm: string;
    keyRotationInterval: number;
    maxProofSize: number;
    rateLimits: { [key: string]: number };
  }> {
    const response = await this.api.get('/api/encryption/info');
    return response.data;
  }

  // Web3 Integration Helpers
  async signProof(proofId: string, signer: ethers.Signer): Promise<string> {
    const proof = await this.getEncryptedProof(proofId);
    const message = `Verify proof ${proofId} with checksum ${proof.metadata.checksum}`;
    return await signer.signMessage(message);
  }

  async verifySignature(proofId: string, signature: string, expectedSigner: string): Promise<boolean> {
    const proof = await this.getEncryptedProof(proofId);
    const message = `Verify proof ${proofId} with checksum ${proof.metadata.checksum}`;

    try {
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
    } catch {
      return false;
    }
  }
}

export const encryptionService = new EncryptionService();