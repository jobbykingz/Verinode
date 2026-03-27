import { Request, Response } from 'express';
import { ZKProofService, ZKProofGenerationRequest, ZKProofGenerationResult } from '../services/zkp/ZKProofService';
import { ZKVerificationService, ZKVerificationRequest, ZKVerificationResult } from '../services/zkp/ZKVerificationService';
import { ZKProof, ZKProofType, ZKProofStatus } from '../models/ZKProof';
import { WinstonLogger } from '../utils/logger';

export class ZKProofController {
  private zkProofService: ZKProofService;
  private zkVerificationService: ZKVerificationService;
  private logger: WinstonLogger;

  constructor() {
    this.zkProofService = new ZKProofService();
    this.zkVerificationService = new ZKVerificationService();
    this.logger = new WinstonLogger();
  }

  /**
   * Generate a new ZK proof
   */
  async generateProof(req: Request, res: Response): Promise<void> {
    try {
      const {
        circuitId,
        proofType,
        witness,
        publicInputs,
        provingKey,
        parameters,
        userId,
        priority = 'medium'
      } = req.body;

      // Validate required fields
      if (!circuitId || !proofType || !witness || !publicInputs || !provingKey) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: circuitId, proofType, witness, publicInputs, provingKey'
        });
        return;
      }

      // Validate proof type
      if (!Object.values(ZKProofType).includes(proofType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid proof type',
          validTypes: Object.values(ZKProofType)
        });
        return;
      }

      // Validate parameters
      if (parameters) {
        if (parameters.securityLevel && (parameters.securityLevel < 80 || parameters.securityLevel > 256)) {
          res.status(400).json({
            success: false,
            error: 'Security level must be between 80 and 256'
          });
          return;
        }

        if (parameters.timeout && (parameters.timeout < 5000 || parameters.timeout > 300000)) {
          res.status(400).json({
            success: false,
            error: 'Timeout must be between 5 seconds and 5 minutes'
          });
          return;
        }
      }

      const generationRequest: ZKProofGenerationRequest = {
        id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        circuitId,
        proofType,
        witness,
        publicInputs,
        provingKey,
        parameters: parameters || {},
        userId,
        priority,
        createdAt: new Date()
      };

      const result = await this.zkProofService.generateProof(generationRequest);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            proofId: result.proofId,
            proof: result.proof,
            generationTime: result.generationTime,
            gasEstimate: result.gasEstimate
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Proof generation failed'
        });
      }

    } catch (error) {
      this.logger.error('Error in generateProof controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Generate multiple ZK proofs in batch
   */
  async generateBatchProofs(req: Request, res: Response): Promise<void> {
    try {
      const { requests } = req.body;

      // Validate requests array
      if (!Array.isArray(requests) || requests.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Requests array is required and cannot be empty'
        });
        return;
      }

      if (requests.length > 100) {
        res.status(400).json({
          success: false,
          error: 'Batch size cannot exceed 100 requests'
        });
        return;
      }

      // Validate each request
      for (const request of requests) {
        if (!request.circuitId || !request.proofType || !request.witness || !request.publicInputs) {
          res.status(400).json({
            success: false,
            error: 'All requests must include circuitId, proofType, witness, and publicInputs'
          });
          return;
        }
      }

      const results = await this.zkProofService.generateBatchProofs(requests);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.status(201).json({
        success: true,
        data: {
          totalRequests: requests.length,
          successCount,
          failureCount,
          results: results.map((r, index) => ({
            index,
            proofId: r.proofId,
            success: r.success,
            error: r.error,
            generationTime: r.generationTime
          }))
        }
      });

    } catch (error) {
      this.logger.error('Error in generateBatchProofs controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Verify a ZK proof
   */
  async verifyProof(req: Request, res: Response): Promise<void> {
    try {
      const {
        proofId,
        proofType,
        circuitId,
        proofData,
        publicInputs,
        verificationKey,
        parameters,
        requestedBy
      } = req.body;

      // Validate required fields
      if (!proofId || !proofType || !circuitId || !proofData || !publicInputs || !verificationKey) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: proofId, proofType, circuitId, proofData, publicInputs, verificationKey'
        });
        return;
      }

      const verificationRequest: ZKVerificationRequest = {
        id: `verify_${date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        proofId,
        proofType,
        circuitId,
        proofData,
        publicInputs,
        verificationKey,
        parameters: parameters || {},
        requestedBy: requestedBy || 'anonymous',
        createdAt: new Date(),
        status: 'pending'
      };

      const result = await this.zkVerificationService.verifyProof(verificationRequest);

      if (result.isValid) {
        res.status(200).json({
          success: true,
          data: {
            isValid: result.isValid,
            verificationTime: result.verificationTime,
            gasUsed: result.gasUsed,
            proofType: result.proofType,
            circuitId: result.circuitId
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.errorMessage || 'Proof verification failed',
          data: {
            isValid: result.isValid,
            verificationTime: result.verificationTime,
            gasUsed: result.gasUsed
          }
        });
      }

    } catch (error) {
      this.logger.error('Error in verifyProof controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Verify multiple ZK proofs in batch
   */
  async verifyBatchProofs(req: Request, res: Response): Promise<void> {
    try {
      const { requests } = req.body;

      // Validate requests array
      if (!Array.isArray(requests) || requests.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Requests array is required and cannot be empty'
        });
        return;
      }

      if (requests.length > 50) {
        res.status(400).json({
          success: false,
          error: 'Batch size cannot exceed 50 requests'
        });
        return;
      }

      const results = await this.zkVerificationService.verifyBatchProofs(requests);

      const validCount = results.filter(r => r.isValid).length;
      const invalidCount = results.length - validCount;

      res.status(200).json({
        success: true,
        data: {
          totalRequests: requests.length,
          validCount,
          invalidCount,
          results: results.map((r, index) => ({
            index,
            proofId: r.proofId,
            isValid: r.isValid,
            verificationTime: r.verificationTime,
            gasUsed: r.gasUsed,
            error: r.errorMessage
          }))
        }
      });

    } catch (error) {
      this.logger.error('Error in verifyBatchProofs controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get proof generation status
   */
  async getGenerationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;

      if (!requestId) {
        res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
        return;
      }

      const status = this.zkProofService.getGenerationStatus(requestId);

      if (status) {
        res.status(200).json({
          success: true,
          data: {
            requestId: status.id,
            circuitId: status.circuitId,
            proofType: status.proofType,
            priority: status.priority,
            createdAt: status.createdAt,
            userId: status.userId
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Generation request not found'
        });
      }

    } catch (error) {
      this.logger.error('Error in getGenerationStatus controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;

      if (!requestId) {
        res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
        return;
      }

      const status = this.zkVerificationService.getVerificationStatus(requestId);

      if (status) {
        res.status(200).json({
          success: true,
          data: {
            requestId: status.id,
            proofId: status.proofId,
            proofType: status.proofType,
            circuitId: status.circuitId,
            requestedBy: status.requestedBy,
            createdAt: status.createdAt,
            status: status.status
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Verification request not found'
        });
      }

    } catch (error) {
      this.logger.error('Error in getVerificationStatus controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Cancel generation request
   */
  async cancelGeneration(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      if (!requestId) {
        res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
        return;
      }

      const success = this.zkProofService.cancelGeneration(requestId);

      if (success) {
        res.status(200).json({
          success: true,
          data: {
            requestId,
            cancelled: true,
            reason: reason || 'User cancelled'
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Generation request not found'
        });
      }

    } catch (error) {
      this.logger.error('Error in cancelGeneration controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get available circuits
   */
  async getAvailableCircuits(req: Request, res: Response): Promise<void> {
    try {
      const { proofType } = req.query;

      let circuits = this.zkProofService.getAvailableCircuits();

      // Filter by proof type if specified
      if (proofType) {
        const filterType = proofType as string;
        circuits = circuits.filter(circuit => circuit.circuitType === filterType);
      }

      res.status(200).json({
        success: true,
        data: {
          circuits: circuits.map(circuit => ({
            id: circuit.id,
            circuitType: circuit.circuitType,
            description: circuit.description,
            securityLevel: circuit.securityLevel,
            isActive: circuit.isActive,
            version: circuit.version,
            createdAt: circuit.createdAt
          }))
        }
      });

    } catch (error) {
      this.logger.error('Error in getAvailableCircuits controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get service statistics
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const proofStats = this.zkProofService.getQueueStatus();
      const verificationStats = this.zkVerificationService.getStatistics();

      res.status(200).json({
        success: true,
        data: {
          proofGeneration: proofStats,
          verification: verificationStats
        }
      });

    } catch (error) {
      this.logger.error('Error in getStatistics controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Queue proof generation
   */
  async queueGeneration(req: Request, res: Response): Promise<void> {
    try {
      const {
        circuitId,
        proofType,
        witness,
        publicInputs,
        provingKey,
        parameters,
        userId,
        priority = 'medium'
      } = req.body;

      // Validate required fields
      if (!circuitId || !proofType || !witness || !publicInputs || !provingKey) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: circuitId, proofType, witness, publicInputs, provingKey'
        });
        return;
      }

      const generationRequest: ZKProofGenerationRequest = {
        id: `queue_${date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        circuitId,
        proofType,
        witness,
        publicInputs,
        provingKey,
        parameters: parameters || {},
        userId,
        priority,
        createdAt: new Date()
      };

      this.zkProofService.queueGeneration(generationRequest);

      res.status(202).json({
        success: true,
        data: {
          requestId: generationRequest.id,
          queued: true,
          message: 'Proof generation request queued successfully'
        }
      });

    } catch (error) {
      this.logger.error('Error in queueGeneration controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get active generations
   */
  async getActiveGenerations(req: Request, res: Response): Promise<void> {
    try {
      const activeGenerations = this.zkProofService.getActiveGenerations();

      res.status(200).json({
        success: true,
        data: {
          activeGenerations: activeGenerations.map(gen => ({
            id: gen.id,
            circuitId: gen.circuitId,
            proofType: gen.proofType,
            priority: gen.priority,
            createdAt: gen.createdAt,
            userId: gen.userId
          }))
        }
      });

    } catch (error) {
      this.logger.error('Error in getActiveGenerations controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}
