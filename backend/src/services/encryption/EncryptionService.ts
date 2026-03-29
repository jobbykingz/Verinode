import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HomomorphicEncryption, EncryptedData, EncryptionKeys } from './HomomorphicEncryption';
import { MonitoringService } from '../monitoringService';
import { RedisService } from '../redisService';

export interface EncryptedProof {
  id: string;
  originalProofId: string;
  encryptedData: EncryptedData;
  metadata: {
    algorithm: string;
    keyVersion: string;
    createdAt: Date;
    expiresAt?: Date;
  };
  accessControl: {
    owner: string;
    authorizedParties: string[];
    permissions: string[];
  };
}

export interface ComputationRequest {
  operation: 'add' | 'multiply' | 'rotate';
  operands: EncryptedData[];
  parameters?: any;
}

export interface ComputationResult {
  result: EncryptedData;
  computationTime: number;
  noiseBudget: number;
  success: boolean;
  error?: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private keyRotationInterval: NodeJS.Timeout;

  constructor(
    @InjectModel('EncryptedProof') private encryptedProofModel: Model<EncryptedProof>,
    private he: HomomorphicEncryption,
    private monitoringService: MonitoringService,
    private redisService: RedisService,
  ) {}

  async onModuleInit() {
    // Start key rotation schedule
    this.scheduleKeyRotation();
  }

  async onModuleDestroy() {
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
    }
  }

  async encryptProof(proofId: string, proofData: any, owner: string): Promise<EncryptedProof> {
    const startTime = Date.now();

    try {
      // Convert proof data to numerical array for encryption
      const numericalData = this.proofDataToNumerical(proofData);

      // Encrypt the data
      const encryptedData = await this.he.encrypt(numericalData);

      // Create encrypted proof record
      const encryptedProof = new this.encryptedProofModel({
        originalProofId: proofId,
        encryptedData,
        metadata: {
          algorithm: 'CKKS',
          keyVersion: this.getCurrentKeyVersion(),
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
        accessControl: {
          owner,
          authorizedParties: [owner],
          permissions: ['read', 'compute'],
        },
      });

      await encryptedProof.save();

      const encryptionTime = Date.now() - startTime;
      await this.monitoringService.recordMetric('encryption.proof.success', 1, {
        proofId,
        encryptionTime: encryptionTime.toString(),
      });

      this.logger.log(`Proof ${proofId} encrypted successfully in ${encryptionTime}ms`);
      return encryptedProof;
    } catch (error) {
      this.logger.error(`Failed to encrypt proof ${proofId}:`, error);
      await this.monitoringService.recordMetric('encryption.proof.failure', 1, { proofId });
      throw error;
    }
  }

  async decryptProof(encryptedProofId: string, requester: string): Promise<any> {
    const startTime = Date.now();

    try {
      // Find encrypted proof
      const encryptedProof = await this.encryptedProofModel.findById(encryptedProofId);
      if (!encryptedProof) {
        throw new Error('Encrypted proof not found');
      }

      // Check access permissions
      if (!this.hasAccess(encryptedProof, requester)) {
        throw new Error('Access denied');
      }

      // Decrypt the data
      const numericalData = await this.he.decrypt(encryptedProof.encryptedData);

      // Convert back to proof data
      const proofData = this.numericalToProofData(numericalData);

      const decryptionTime = Date.now() - startTime;
      await this.monitoringService.recordMetric('decryption.proof.success', 1, {
        encryptedProofId,
        decryptionTime: decryptionTime.toString(),
      });

      this.logger.log(`Proof ${encryptedProofId} decrypted successfully in ${decryptionTime}ms`);
      return proofData;
    } catch (error) {
      this.logger.error(`Failed to decrypt proof ${encryptedProofId}:`, error);
      await this.monitoringService.recordMetric('decryption.proof.failure', 1, { encryptedProofId });
      throw error;
    }
  }

  async performComputation(
    encryptedProofId: string,
    request: ComputationRequest,
    requester: string
  ): Promise<ComputationResult> {
    const startTime = Date.now();

    try {
      // Find encrypted proof
      const encryptedProof = await this.encryptedProofModel.findById(encryptedProofId);
      if (!encryptedProof) {
        throw new Error('Encrypted proof not found');
      }

      // Check computation permissions
      if (!this.hasComputeAccess(encryptedProof, requester)) {
        throw new Error('Computation access denied');
      }

      let result;

      switch (request.operation) {
        case 'add':
          if (request.operands.length < 2) {
            throw new Error('Addition requires at least 2 operands');
          }
          result = await this.he.add(request.operands[0], request.operands[1]);
          break;

        case 'multiply':
          if (request.operands.length < 2) {
            throw new Error('Multiplication requires at least 2 operands');
          }
          result = await this.he.multiply(request.operands[0], request.operands[1]);
          break;

        case 'rotate':
          if (request.operands.length < 1) {
            throw new Error('Rotation requires at least 1 operand');
          }
          const steps = request.parameters?.steps || 1;
          result = await this.he.rotate(request.operands[0], steps);
          break;

        default:
          throw new Error(`Unsupported operation: ${request.operation}`);
      }

      const computationTime = Date.now() - startTime;

      await this.monitoringService.recordMetric('computation.success', 1, {
        operation: request.operation,
        computationTime: computationTime.toString(),
      });

      this.logger.log(`Computation ${request.operation} completed in ${computationTime}ms`);

      return {
        result: result.result,
        computationTime,
        noiseBudget: result.noiseBudget,
        success: true,
      };
    } catch (error) {
      const computationTime = Date.now() - startTime;

      this.logger.error(`Computation failed:`, error);
      await this.monitoringService.recordMetric('computation.failure', 1, {
        operation: request.operation,
      });

      return {
        result: null,
        computationTime,
        noiseBudget: 0,
        success: false,
        error: error.message,
      };
    }
  }

  async grantAccess(encryptedProofId: string, grantee: string, permissions: string[], granter: string): Promise<void> {
    try {
      const encryptedProof = await this.encryptedProofModel.findById(encryptedProofId);
      if (!encryptedProof) {
        throw new Error('Encrypted proof not found');
      }

      // Check if granter is the owner
      if (encryptedProof.accessControl.owner !== granter) {
        throw new Error('Only owner can grant access');
      }

      // Add grantee to authorized parties
      if (!encryptedProof.accessControl.authorizedParties.includes(grantee)) {
        encryptedProof.accessControl.authorizedParties.push(grantee);
      }

      // Add permissions
      for (const permission of permissions) {
        if (!encryptedProof.accessControl.permissions.includes(permission)) {
          encryptedProof.accessControl.permissions.push(permission);
        }
      }

      await encryptedProof.save();

      this.logger.log(`Access granted to ${grantee} for proof ${encryptedProofId}`);
    } catch (error) {
      this.logger.error(`Failed to grant access:`, error);
      throw error;
    }
  }

  async revokeAccess(encryptedProofId: string, revokee: string, revoker: string): Promise<void> {
    try {
      const encryptedProof = await this.encryptedProofModel.findById(encryptedProofId);
      if (!encryptedProof) {
        throw new Error('Encrypted proof not found');
      }

      // Check if revoker is the owner
      if (encryptedProof.accessControl.owner !== revoker) {
        throw new Error('Only owner can revoke access');
      }

      // Remove revokee from authorized parties
      const index = encryptedProof.accessControl.authorizedParties.indexOf(revokee);
      if (index > -1) {
        encryptedProof.accessControl.authorizedParties.splice(index, 1);
      }

      await encryptedProof.save();

      this.logger.log(`Access revoked from ${revokee} for proof ${encryptedProofId}`);
    } catch (error) {
      this.logger.error(`Failed to revoke access:`, error);
      throw error;
    }
  }

  async getProofMetadata(encryptedProofId: string, requester: string): Promise<Partial<EncryptedProof>> {
    try {
      const encryptedProof = await this.encryptedProofModel.findById(encryptedProofId);
      if (!encryptedProof) {
        throw new Error('Encrypted proof not found');
      }

      // Check access permissions
      if (!this.hasAccess(encryptedProof, requester)) {
        throw new Error('Access denied');
      }

      // Return metadata without encrypted data
      return {
        id: encryptedProof.id,
        originalProofId: encryptedProof.originalProofId,
        metadata: encryptedProof.metadata,
        accessControl: encryptedProof.accessControl,
      };
    } catch (error) {
      this.logger.error(`Failed to get proof metadata:`, error);
      throw error;
    }
  }

  private proofDataToNumerical(proofData: any): number[] {
    // Convert proof data to numerical array for homomorphic encryption
    // This is a simplified conversion - in practice, you'd need more sophisticated
    // data serialization based on your proof structure

    const data = [];

    if (proofData.id) data.push(parseInt(proofData.id, 16) || 0);
    if (proofData.timestamp) data.push(proofData.timestamp);
    if (proofData.verified !== undefined) data.push(proofData.verified ? 1 : 0);

    // Add hash as numerical representation
    if (proofData.hash) {
      const hashNumbers = proofData.hash.match(/.{1,8}/g)?.map(h => parseInt(h, 16)) || [];
      data.push(...hashNumbers);
    }

    // Pad to ensure consistent array length
    while (data.length < 10) {
      data.push(0);
    }

    return data.slice(0, 10);
  }

  private numericalToProofData(numericalData: number[]): any {
    // Convert numerical array back to proof data
    // This is the reverse of proofDataToNumerical

    return {
      id: numericalData[0]?.toString(16),
      timestamp: numericalData[1],
      verified: numericalData[2] === 1,
      hash: numericalData.slice(3, 7).map(n => n.toString(16).padStart(8, '0')).join(''),
    };
  }

  private hasAccess(encryptedProof: EncryptedProof, requester: string): boolean {
    return encryptedProof.accessControl.owner === requester ||
           encryptedProof.accessControl.authorizedParties.includes(requester);
  }

  private hasComputeAccess(encryptedProof: EncryptedProof, requester: string): boolean {
    return this.hasAccess(encryptedProof, requester) &&
           encryptedProof.accessControl.permissions.includes('compute');
  }

  private getCurrentKeyVersion(): string {
    // In a real implementation, you'd track key versions
    return 'v1.0';
  }

  private scheduleKeyRotation() {
    // Rotate keys every 30 days
    const rotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    this.keyRotationInterval = setInterval(async () => {
      try {
        await this.he.rotateKeys();
        await this.monitoringService.recordMetric('encryption.key_rotation', 1);
        this.logger.log('Encryption keys rotated successfully');
      } catch (error) {
        this.logger.error('Key rotation failed:', error);
        await this.monitoringService.recordMetric('encryption.key_rotation_failure', 1);
      }
    }, rotationInterval);
  }

  async getEncryptionStats(): Promise<any> {
    try {
      const totalEncryptedProofs = await this.encryptedProofModel.countDocuments();
      const contextInfo = this.he.getContextInfo();

      return {
        totalEncryptedProofs,
        encryptionContext: contextInfo,
        keyVersion: this.getCurrentKeyVersion(),
      };
    } catch (error) {
      this.logger.error('Failed to get encryption stats:', error);
      throw error;
    }
  }

  async benchmarkEncryption(iterations: number = 100): Promise<any> {
    const results = {
      encrypt: await this.he.benchmark('encrypt', iterations),
      decrypt: await this.he.benchmark('decrypt', iterations),
      add: await this.he.benchmark('add', iterations),
      multiply: await this.he.benchmark('multiply', iterations),
    };

    this.logger.log('Encryption benchmark completed:', results);
    return results;
  }
}