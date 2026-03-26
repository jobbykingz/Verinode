export enum StorageType {
  IPFS = 'ipfs',
  ARWEAVE = 'arweave',
  HYBRID = 'hybrid'
}

export interface IPFSReference {
  cid: string;
  size: number;
  hash: string;
  timestamp: number;
  pinStatus: boolean;
  replicationFactor: number;
  gatewayUrl: string;
}

export interface ArweaveReference {
  transactionId: string;
  dataHash: string;
  owner: string;
  contentType: string;
  size: number;
  timestamp: number;
  blockHeight: number;
  reward: number;
  tags: Array<{ name: string; value: string }>;
  gatewayUrl: string;
}

export interface ContentMetadata {
  name?: string;
  mimeType?: string;
  size?: number;
  [key: string]: any;
}

export interface StorageReference {
  id: string;
  storageType: StorageType;
  ipfsRef?: IPFSReference;
  arweaveRef?: ArweaveReference;
  metadata: ContentMetadata;
  redundancyLevel: number;
  createdAt: number;
  lastVerified: number;
  verificationStatus: boolean;
  size: number;
  cost: number;
  tags: string[];
  userId: string;
}

export interface StoragePolicy {
  defaultType: StorageType;
  redundancyFactor: number;
  verificationInterval: number;
  autoRepair: boolean;
  costThreshold: number;
  maxFileSize: number;
  allowedMimeTypes: string[];
}

export interface StorageMetrics {
  totalFiles: number;
  totalSize: number;
  ipfsFiles: number;
  arweaveFiles: number;
  hybridFiles: number;
  verificationRate: number;
  averageRedundancy: number;
  costEfficiency: number;
  cacheHitRate: number;
}

export interface StorageStats {
  userId: string;
  storageType: StorageType;
  fileCount: number;
  totalSize: number;
  totalCost: number;
  lastActivity: number;
  verificationRate: number;
}

export interface StorageHealth {
  healthy: boolean;
  ipfsHealthy: boolean;
  arweaveHealthy: boolean;
  cacheHealthy: boolean;
  lastCheck: number;
  details: {
    ipfs?: any;
    arweave?: any;
    cache?: any;
  };
}

export interface StorageConfig {
  ipfs: {
    apiUrl: string;
    gatewayUrl: string;
    projectSecret: string;
    projectId: string;
    timeout: number;
    retryAttempts: number;
    enablePubSub: boolean;
  };
  arweave: {
    gatewayUrl: string;
    nodeUrl: string;
    wallet: {
      jwk: any;
      address: string;
    };
    timeout: number;
    retryAttempts: number;
    currency: string;
    rewardMultiplier: number;
  };
  defaultType: StorageType;
  redundancyFactor: number;
  verificationInterval: number;
  autoRepair: boolean;
  costThreshold: number;
  enableCaching: boolean;
  cacheSize: number;
}

export interface StorageUploadOptions {
  storageType?: StorageType;
  contentType?: string;
  metadata?: ContentMetadata;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
  pin?: boolean;
  encrypt?: boolean;
  compress?: boolean;
}

export interface StorageUploadResult {
  id: string;
  storageType: StorageType;
  ipfsRef?: IPFSReference;
  arweaveRef?: ArweaveReference;
  redundancyLevel: number;
  createdAt: number;
  lastVerified: number;
  verificationStatus: boolean;
  size: number;
  cost: number;
  url?: string;
}

export interface StorageDownloadOptions {
  verify?: boolean;
  cache?: boolean;
  timeout?: number;
  range?: {
    start: number;
    end: number;
  };
}

export interface StorageDownloadResult {
  data: Buffer;
  metadata: ContentMetadata;
  verified: boolean;
  fromCache: boolean;
  size: number;
  url?: string;
}

export interface StorageVerificationResult {
  id: string;
  verified: boolean;
  timestamp: number;
  issues: string[];
  repairRequired: boolean;
}

export interface StorageRepairResult {
  id: string;
  repaired: boolean;
  timestamp: number;
  actions: string[];
  cost: number;
}

export interface StorageSearchOptions {
  type?: StorageType;
  tags?: string[];
  contentType?: string;
  dateRange?: {
    start: number;
    end: number;
  };
  sizeRange?: {
    min: number;
    max: number;
  };
  verified?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'size' | 'cost' | 'lastVerified';
  sortOrder?: 'asc' | 'desc';
}

export interface StorageSearchResult {
  references: StorageReference[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

export interface StorageEvent {
  type: 'uploaded' | 'downloaded' | 'verified' | 'repaired' | 'deleted' | 'error';
  storageId: string;
  userId: string;
  timestamp: number;
  details: any;
}

export interface StorageCostEstimate {
  storageType: StorageType;
  size: number;
  costPerByte: number;
  estimatedReward: number;
  totalCost: number;
  currency: string;
  breakdown: {
    storage: number;
    bandwidth: number;
    transaction: number;
    reward: number;
  };
}

export interface StorageBackup {
  id: string;
  name: string;
  description?: string;
  storageIds: string[];
  createdAt: number;
  size: number;
  cost: number;
  encrypted: boolean;
  compression: boolean;
}

export interface StorageRestoreResult {
  backupId: string;
  restoredIds: string[];
  failedIds: string[];
  timestamp: number;
  cost: number;
}

// Validation schemas
export const StorageReferenceSchema = {
  id: 'string',
  storageType: ['ipfs', 'arweave', 'hybrid'],
  metadata: 'object',
  redundancyLevel: 'number',
  createdAt: 'number',
  lastVerified: 'number',
  verificationStatus: 'boolean',
  size: 'number',
  cost: 'number',
  tags: 'array',
  userId: 'string'
};

export const StoragePolicySchema = {
  defaultType: ['ipfs', 'arweave', 'hybrid'],
  redundancyFactor: 'number',
  verificationInterval: 'number',
  autoRepair: 'boolean',
  costThreshold: 'number',
  maxFileSize: 'number',
  allowedMimeTypes: 'array'
};

// Error types
export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public storageId?: string,
    public storageType?: StorageType
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageValidationError extends StorageError {
  constructor(message: string, public field: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'StorageValidationError';
  }
}

export class StorageNotFoundError extends StorageError {
  constructor(storageId: string) {
    super(`Storage reference not found: ${storageId}`, 'NOT_FOUND', storageId);
    this.name = 'StorageNotFoundError';
  }
}

export class StorageVerificationError extends StorageError {
  constructor(storageId: string, public issues: string[]) {
    super(`Storage verification failed: ${storageId}`, 'VERIFICATION_ERROR', storageId);
    this.name = 'StorageVerificationError';
  }
}

export class StorageCostError extends StorageError {
  constructor(message: string, public estimatedCost?: number) {
    super(message, 'COST_ERROR');
    this.name = 'StorageCostError';
  }
}

// Utility functions
export function isValidStorageType(type: string): type is StorageType {
  return Object.values(StorageType).includes(type as StorageType);
}

export function calculateStorageCost(size: number, type: StorageType, config: StorageConfig): number {
  switch (type) {
    case StorageType.IPFS:
      // IPFS is typically free, but pinning services have costs
      return 0;
    case StorageType.ARWEAVE:
      // Arweave costs based on data size
      return size * 1000000000; // 1 AR per GB as example
    case StorageType.HYBRID:
      // Hybrid includes both costs
      return calculateStorageCost(size, StorageType.IPFS, config) + 
             calculateStorageCost(size, StorageType.ARWEAVE, config);
    default:
      return 0;
  }
}

export function generateStorageId(): string {
  return `storage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatCost(cost: number, currency: string = 'AR'): string {
  return `${cost.toFixed(6)} ${currency}`;
}

export function validateStorageReference(reference: Partial<StorageReference>): StorageValidationError[] {
  const errors: StorageValidationError[] = [];

  if (!reference.id || typeof reference.id !== 'string') {
    errors.push(new StorageValidationError('Storage ID is required', 'id'));
  }

  if (!reference.storageType || !isValidStorageType(reference.storageType)) {
    errors.push(new StorageValidationError('Valid storage type is required', 'storageType'));
  }

  if (typeof reference.size !== 'number' || reference.size < 0) {
    errors.push(new StorageValidationError('Valid size is required', 'size'));
  }

  if (typeof reference.cost !== 'number' || reference.cost < 0) {
    errors.push(new StorageValidationError('Valid cost is required', 'cost'));
  }

  if (!reference.userId || typeof reference.userId !== 'string') {
    errors.push(new StorageValidationError('User ID is required', 'userId'));
  }

  return errors;
}

export function validateStoragePolicy(policy: Partial<StoragePolicy>): StorageValidationError[] {
  const errors: StorageValidationError[] = [];

  if (!policy.defaultType || !isValidStorageType(policy.defaultType)) {
    errors.push(new StorageValidationError('Valid default storage type is required', 'defaultType'));
  }

  if (typeof policy.redundancyFactor !== 'number' || policy.redundancyFactor < 1) {
    errors.push(new StorageValidationError('Redundancy factor must be at least 1', 'redundancyFactor'));
  }

  if (typeof policy.verificationInterval !== 'number' || policy.verificationInterval < 0) {
    errors.push(new StorageValidationError('Verification interval must be positive', 'verificationInterval'));
  }

  if (typeof policy.maxFileSize !== 'number' || policy.maxFileSize < 0) {
    errors.push(new StorageValidationError('Max file size must be positive', 'maxFileSize'));
  }

  if (!Array.isArray(policy.allowedMimeTypes)) {
    errors.push(new StorageValidationError('Allowed MIME types must be an array', 'allowedMimeTypes'));
  }

  return errors;
}

export class StorageReferenceModel {
  static create(data: Partial<StorageReference>): StorageReference {
    const errors = validateStorageReference(data);
    if (errors.length > 0) {
      throw errors[0];
    }

    return {
      id: data.id || generateStorageId(),
      storageType: data.storageType || StorageType.IPFS,
      metadata: data.metadata || {},
      redundancyLevel: data.redundancyLevel || 3,
      createdAt: data.createdAt || Date.now(),
      lastVerified: data.lastVerified || Date.now(),
      verificationStatus: data.verificationStatus ?? true,
      size: data.size || 0,
      cost: data.cost || 0,
      tags: data.tags || [],
      userId: data.userId || '',
      ipfsRef: data.ipfsRef,
      arweaveRef: data.arweaveRef
    };
  }

  static update(reference: StorageReference, updates: Partial<StorageReference>): StorageReference {
    const errors = validateStorageReference(updates);
    if (errors.length > 0) {
      throw errors[0];
    }

    return {
      ...reference,
      ...updates,
      lastVerified: updates.lastVerified || reference.lastVerified,
      updatedAt: Date.now()
    };
  }

  static clone(reference: StorageReference): StorageReference {
    return JSON.parse(JSON.stringify(reference));
  }

  static toJSON(reference: StorageReference): string {
    return JSON.stringify(reference);
  }

  static fromJSON(json: string): StorageReference {
    return StorageReferenceModel.create(JSON.parse(json));
  }

  static getPublicData(reference: StorageReference): Partial<StorageReference> {
    const { userId, ...publicData } = reference;
    return publicData;
  }

  static getSearchIndex(reference: StorageReference): string {
    return [
      reference.id,
      reference.storageType,
      reference.metadata.name || '',
      reference.metadata.mimeType || '',
      ...reference.tags
    ].join(' ').toLowerCase();
  }
}
