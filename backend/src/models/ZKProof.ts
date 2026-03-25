export enum ZKProofType {
  RangeProof = 'range_proof',
  MembershipProof = 'membership_proof',
  EqualityProof = 'equality_proof',
  KnowledgeProof = 'knowledge_proof',
  SetMembershipProof = 'set_membership_proof',
  RingSignature = 'ring_signature',
  Bulletproofs = 'bulletproofs',
  SchnorrProof = 'schnorr_proof',
  PedersenCommitment = 'pedersen_commitment',
}

export enum ZKProofStatus {
  Active = 'active',
  Expired = 'expired',
  Revoked = 'revoked',
  Invalid = 'invalid',
  Pending = 'pending',
}

export interface ZKProofMetadata {
  originalProofId?: string;
  statement: string;
  witnessCommitment: string;
  salt: string;
  nonce: string;
  securityLevel: number;
  circuitParameters: Record<string, string>;
}

export interface ZKProof {
  id: string;
  proofType: ZKProofType;
  circuitId: string;
  circuitHash: string;
  proofData: string;
  publicInputs: string;
  verificationKey: string;
  proverAddress: string;
  createdAt: Date;
  expiresAt: Date;
  status: ZKProofStatus;
  metadata: ZKProofMetadata;
}

export interface ZKProofGenerationRequest {
  id: string;
  circuitId: string;
  proofType: ZKProofType;
  witness: any;
  publicInputs: any;
  provingKey: string;
  parameters: ZKGenerationParameters;
  userId?: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}

export interface ZKGenerationParameters {
  securityLevel: number;
  optimizationLevel: number;
  compressionEnabled: boolean;
  batchSize?: number;
  timeout: number;
  customParams?: Record<string, any>;
}

export interface ZKProofGenerationResult {
  success: boolean;
  proofId?: string;
  proof?: ZKProof;
  proofData?: string;
  publicInputs?: string;
  verificationKey?: string;
  generationTime: number;
  gasEstimate?: number;
  error?: string;
}

export interface ZKVerificationRequest {
  id: string;
  proofId: string;
  proofType: ZKProofType;
  circuitId: string;
  proofData: string;
  publicInputs: string;
  verificationKey: string;
  parameters: Record<string, string>;
  requestedBy: string;
  createdAt: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
}

export interface ZKVerificationResult {
  isValid: boolean;
  verificationTime: Date;
  errorMessage?: string;
  gasUsed: number;
  proofType: ZKProofType;
  circuitId: string;
}

export interface ZKCircuit {
  id: string;
  circuitType: ZKProofType;
  circuitHash: string;
  provingKey: string;
  verificationKey: string;
  description: string;
  publicInputSpec: string[];
  witnessSpec: string[];
  constraintSystem: string;
  securityLevel: number;
  createdAt: Date;
  updatedAt: Date;
  version: string;
  isActive: boolean;
  parameters: ZKCircuitParameters;
}

export interface ZKCircuitParameters {
  fieldSize: number;
  curveType: string;
  hashFunction: string;
  securityBits: number;
  optimizationLevel: number;
  customParameters: Record<string, string>;
}

export interface ZKConstraint {
  id: string;
  circuitId: string;
  constraintType: ZKConstraintType;
  leftExpression: string;
  rightExpression: string;
  description: string;
  isActive: boolean;
}

export enum ZKConstraintType {
  Linear = 'linear',
  Quadratic = 'quadratic',
  Multiplication = 'multiplication',
  Boolean = 'boolean',
  Range = 'range',
  Equality = 'equality',
}

export interface ZKCircuitTemplate {
  id: string;
  templateName: string;
  templateType: ZKProofType;
  description: string;
  circuitCode: string;
  inputTemplate: string;
  outputTemplate: string;
  parameters: Record<string, string>;
  createdAt: Date;
  isPublic: boolean;
  usageCount: number;
}

export interface ZKProofValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  gasEstimate: number;
  securityLevel: number;
}

export interface ZKProofConfig {
  defaultTimeout: number;
  maxConcurrentGenerations: number;
  enableCaching: boolean;
  cacheTimeout: number;
  performanceOptimization: boolean;
  securityLevel: number;
  enableBatchProcessing: boolean;
  maxBatchSize: number;
}

export interface ZKProofStatistics {
  totalProofs: number;
  activeProofs: number;
  expiredProofs: number;
  revokedProofs: number;
  proofsByType: Record<ZKProofType, number>;
  averageGenerationTime: number;
  totalGasUsed: number;
  successRate: number;
}

export interface ZKProofBatch {
  id: string;
  requests: ZKProofGenerationRequest[];
  createdAt: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partially_completed';
  results: ZKProofGenerationResult[];
  errorCount: number;
}

export interface ZKProofExport {
  format: 'json' | 'binary' | 'protobuf';
  data: string | Buffer;
  metadata: {
    exportedAt: Date;
    proofCount: number;
    version: string;
    checksum?: string;
  };
}
