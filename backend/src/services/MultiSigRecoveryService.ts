import crypto from 'crypto';
import { encrypt, decrypt } from '../utils/encryption';
import { sendEmail, sendSMS } from '../utils/notifications';
import { logger } from '../utils/logger';
import MultiSigWallet, { IMultiSigWallet } from '../models/MultiSigWallet';
import SignatureRequest, { ISignatureRequest } from '../models/SignatureRequest';

export interface RecoveryInitiationRequest {
  walletId: string;
  recoveryMethod: 'SOCIAL_RECOVERY' | 'BACKUP_SIGNATURES' | 'TIME_DELAY';
  initiatorAddress: string;
  reason: string;
  contactInfo?: {
    email?: string;
    phone?: string;
  };
  evidence?: {
    lostPrivateKey?: boolean;
    compromisedAccount?: boolean;
    deviceLost?: boolean;
    other?: string;
  };
}

export interface RecoveryProcess {
  recoveryId: string;
  walletId: string;
  method: 'SOCIAL_RECOVERY' | 'BACKUP_SIGNATURES' | 'TIME_DELAY';
  status: 'INITIATED' | 'PENDING_APPROVALS' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'EXPIRED';
  initiatorAddress: string;
  initiatedAt: Date;
  expiresAt: Date;
  approvals: Array<{
    signerAddress: string;
    approvedAt: Date;
    signature: string;
    weight: number;
  }>;
  requiredApprovals: number;
  currentWeight: number;
  newSigners?: Array<{
    address: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'SIGNER';
    weight: number;
  }>;
  removedSigners?: string[];
  metadata: {
    reason: string;
    contactInfo?: any;
    evidence?: any;
    ipAddress: string;
    userAgent: string;
  };
  completedAt?: Date;
  transactionHash?: string;
}

export interface BackupSignatureData {
  walletId: string;
  signerAddress: string;
  encryptedPrivateKey: string;
  backupPhrase: string;
  createdAt: Date;
  lastVerified: Date;
  verificationHash: string;
}

export interface SecurityMetrics {
  suspiciousActivities: Array<{
    type: 'FAILED_LOGIN' | 'UNUSUAL_LOCATION' | 'RAPID_SIGNATURES' | 'SIGNATURE_ANOMALY';
    timestamp: Date;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
    ipAddress: string;
    userAgent: string;
  }>;
  securityScore: number;
  recommendations: string[];
  lastAudit: Date;
}

export class MultiSigRecoveryService {
  private readonly RECOVERY_PERIOD_HOURS = 168; // 7 days
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private readonly SECURITY_SCORE_WEIGHTS = {
    successfulOperations: 0.3,
    failedOperations: -0.2,
    suspiciousActivities: -0.4,
    recoveryAttempts: -0.1
  };

  /**
   * Initialize recovery process for a compromised wallet
   */
  async initiateRecovery(request: RecoveryInitiationRequest): Promise<RecoveryProcess> {
    try {
      // Validate wallet exists
      const wallet = await MultiSigWallet.findOne({ walletId: request.walletId });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Check if recovery is enabled
      if (!wallet.recovery.enabled) {
        throw new Error('Recovery not enabled for this wallet');
      }

      // Check for existing active recovery processes
      const existingRecovery = await this.getActiveRecoveryProcess(request.walletId);
      if (existingRecovery) {
        throw new Error('Recovery process already active for this wallet');
      }

      // Validate initiator is a signer
      const initiator = wallet.config.signers.find(s => s.address === request.initiatorAddress);
      if (!initiator) {
        throw new Error('Initiator is not an authorized signer');
      }

      // Generate recovery ID and set expiration
      const recoveryId = this.generateRecoveryId();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.RECOVERY_PERIOD_HOURS);

      // Create recovery process
      const recoveryProcess: RecoveryProcess = {
        recoveryId,
        walletId: request.walletId,
        method: request.recoveryMethod,
        status: 'INITIATED',
        initiatorAddress: request.initiatorAddress,
        initiatedAt: new Date(),
        expiresAt,
        approvals: [],
        requiredApprovals: wallet.recovery.recoveryThreshold,
        currentWeight: 0,
        metadata: {
          reason: request.reason,
          contactInfo: request.contactInfo,
          evidence: request.evidence,
          ipAddress: '127.0.0.1', // Should be extracted from request
          userAgent: 'Recovery Service'
        }
      };

      // Store recovery process (in production, use secure storage)
      await this.storeRecoveryProcess(recoveryProcess);

      // Send notifications to recovery signers
      await this.notifyRecoverySigners(wallet, recoveryProcess);

      logger.info(`Recovery process initiated: ${recoveryId} for wallet: ${request.walletId}`);

      return recoveryProcess;

    } catch (error) {
      logger.error('Error initiating recovery:', error);
      throw error;
    }
  }

  /**
   * Approve recovery process
   */
  async approveRecovery(
    recoveryId: string,
    signerAddress: string,
    signature: string,
    metadata?: any
  ): Promise<RecoveryProcess> {
    try {
      const recoveryProcess = await this.getRecoveryProcess(recoveryId);
      if (!recoveryProcess) {
        throw new Error('Recovery process not found');
      }

      // Validate status
      if (recoveryProcess.status !== 'PENDING_APPROVALS') {
        throw new Error('Recovery process not in approval stage');
      }

      // Check if expired
      if (new Date() > recoveryProcess.expiresAt) {
        recoveryProcess.status = 'EXPIRED';
        await this.storeRecoveryProcess(recoveryProcess);
        throw new Error('Recovery process has expired');
      }

      // Check if already approved
      if (recoveryProcess.approvals.some(a => a.signerAddress === signerAddress)) {
        throw new Error('Signer has already approved this recovery');
      }

      // Validate signer is authorized for recovery
      const wallet = await MultiSigWallet.findOne({ walletId: recoveryProcess.walletId });
      if (!wallet) {
        throw new Error('Associated wallet not found');
      }

      const recoverySigner = wallet.recovery.recoverySigners.find(s => s.address === signerAddress);
      if (!recoverySigner) {
        throw new Error('Signer not authorized for recovery');
      }

      // Verify signature
      const isValidSignature = await this.verifyRecoverySignature(
        recoveryProcess,
        signature,
        signerAddress
      );

      if (!isValidSignature) {
        throw new Error('Invalid signature');
      }

      // Add approval
      recoveryProcess.approvals.push({
        signerAddress,
        approvedAt: new Date(),
        signature,
        weight: 1 // Recovery signers typically have equal weight
      });

      recoveryProcess.currentWeight += 1;

      // Check if threshold is met
      if (recoveryProcess.currentWeight >= recoveryProcess.requiredApprovals) {
        recoveryProcess.status = 'APPROVED';
        await this.executeRecovery(recoveryProcess);
      }

      // Update recovery process
      await this.storeRecoveryProcess(recoveryProcess);

      logger.info(`Recovery approved by ${signerAddress} for ${recoveryId}`);

      return recoveryProcess;

    } catch (error) {
      logger.error('Error approving recovery:', error);
      throw error;
    }
  }

  /**
   * Complete recovery process with new signer configuration
   */
  async completeRecovery(
    recoveryId: string,
    newSigners: Array<{
      address: string;
      name: string;
      role: 'OWNER' | 'ADMIN' | 'SIGNER';
      weight: number;
    }>,
    removedSigners: string[] = []
  ): Promise<IMultiSigWallet> {
    try {
      const recoveryProcess = await this.getRecoveryProcess(recoveryId);
      if (!recoveryProcess) {
        throw new Error('Recovery process not found');
      }

      if (recoveryProcess.status !== 'APPROVED') {
        throw new Error('Recovery process not approved');
      }

      const wallet = await MultiSigWallet.findOne({ walletId: recoveryProcess.walletId });
      if (!wallet) {
        throw new Error('Associated wallet not found');
      }

      // Update wallet signers
      const updatedSigners = wallet.config.signers.filter(signer => 
        !removedSigners.includes(signer.address)
      );

      // Add new signers
      for (const newSigner of newSigners) {
        if (updatedSigners.length >= wallet.config.maxSigners) {
          throw new Error('Maximum signers limit reached');
        }

        updatedSigners.push({
          ...newSigner,
          active: true,
          addedAt: new Date()
        });
      }

      // Validate new configuration
      const activeSigners = updatedSigners.filter(s => s.active);
      if (activeSigners.length < wallet.config.threshold) {
        throw new Error('Insufficient active signers for threshold');
      }

      // Update wallet
      wallet.config.signers = updatedSigners;
      wallet.metadata.lastModified = new Date();
      wallet.metadata.lastModifiedBy = recoveryProcess.initiatorAddress;
      wallet.metadata.version += 1;

      // Reset wallet stats for security
      wallet.stats.pendingSignatures = 0;

      await wallet.save();

      // Update recovery process
      recoveryProcess.status = 'COMPLETED';
      recoveryProcess.completedAt = new Date();
      recoveryProcess.newSigners = newSigners;
      recoveryProcess.removedSigners = removedSigners;
      await this.storeRecoveryProcess(recoveryProcess);

      // Send completion notifications
      await this.notifyRecoveryCompletion(wallet, recoveryProcess);

      logger.info(`Recovery completed: ${recoveryId} for wallet: ${recoveryProcess.walletId}`);

      return wallet;

    } catch (error) {
      logger.error('Error completing recovery:', error);
      throw error;
    }
  }

  /**
   * Create backup signatures for emergency recovery
   */
  async createBackupSignatures(
    walletId: string,
    signerAddress: string,
    privateKey: string,
    backupPhrase: string
  ): Promise<BackupSignatureData> {
    try {
      const wallet = await MultiSigWallet.findOne({ walletId });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Validate signer
      const signer = wallet.config.signers.find(s => s.address === signerAddress);
      if (!signer) {
        throw new Error('Signer not found');
      }

      // Encrypt private key
      const encryptedPrivateKey = encrypt(privateKey, backupPhrase);

      // Create verification hash
      const verificationData = `${walletId}:${signerAddress}:${backupPhrase}`;
      const verificationHash = crypto.createHash('sha256').update(verificationData).digest('hex');

      const backupData: BackupSignatureData = {
        walletId,
        signerAddress,
        encryptedPrivateKey,
        backupPhrase,
        createdAt: new Date(),
        lastVerified: new Date(),
        verificationHash
      };

      // Store backup data securely (in production, use encrypted storage)
      await this.storeBackupSignature(backupData);

      logger.info(`Backup signature created for ${signerAddress} in wallet ${walletId}`);

      return backupData;

    } catch (error) {
      logger.error('Error creating backup signatures:', error);
      throw error;
    }
  }

  /**
   * Verify and restore from backup signatures
   */
  async restoreFromBackup(
    walletId: string,
    signerAddress: string,
    backupPhrase: string
  ): Promise<string> {
    try {
      const backupData = await this.getBackupSignature(walletId, signerAddress);
      if (!backupData) {
        throw new Error('Backup data not found');
      }

      // Verify backup phrase
      const verificationData = `${walletId}:${signerAddress}:${backupPhrase}`;
      const verificationHash = crypto.createHash('sha256').update(verificationData).digest('hex');

      if (verificationHash !== backupData.verificationHash) {
        throw new Error('Invalid backup phrase');
      }

      // Decrypt private key
      const privateKey = decrypt(backupData.encryptedPrivateKey, backupPhrase);

      // Update last verified timestamp
      backupData.lastVerified = new Date();
      await this.storeBackupSignature(backupData);

      logger.info(`Backup restored for ${signerAddress} in wallet ${walletId}`);

      return privateKey;

    } catch (error) {
      logger.error('Error restoring from backup:', error);
      throw error;
    }
  }

  /**
   * Calculate security metrics for a wallet
   */
  async calculateSecurityMetrics(walletId: string): Promise<SecurityMetrics> {
    try {
      const wallet = await MultiSigWallet.findOne({ walletId });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Get recent signature requests for analysis
      const recentRequests = await SignatureRequest.find({
        walletId,
        'timing.createdAt': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      // Analyze suspicious activities
      const suspiciousActivities = await this.detectSuspiciousActivities(recentRequests);

      // Calculate security score
      const securityScore = this.calculateSecurityScore(wallet, recentRequests, suspiciousActivities);

      // Generate recommendations
      const recommendations = this.generateSecurityRecommendations(
        wallet,
        suspiciousActivities,
        securityScore
      );

      const metrics: SecurityMetrics = {
        suspiciousActivities,
        securityScore,
        recommendations,
        lastAudit: new Date()
      };

      return metrics;

    } catch (error) {
      logger.error('Error calculating security metrics:', error);
      throw error;
    }
  }

  /**
   * Optimize wallet security settings
   */
  async optimizeSecuritySettings(
    walletId: string,
    optimizationLevel: 'CONSERVATIVE' | 'BALANCED' | 'PERFORMANCE'
  ): Promise<IMultiSigWallet> {
    try {
      const wallet = await MultiSigWallet.findOne({ walletId });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Get security metrics
      const metrics = await this.calculateSecurityMetrics(walletId);

      // Apply optimizations based on level
      switch (optimizationLevel) {
        case 'CONSERVATIVE':
          wallet.security.dailyLimit = Math.floor(wallet.security.dailyLimit * 0.5);
          wallet.security.singleTransactionLimit = Math.floor(wallet.security.singleTransactionLimit * 0.5);
          wallet.security.timeLockPeriod = Math.max(wallet.security.timeLockPeriod * 2, 7200); // Min 2 hours
          wallet.config.requireAllForCritical = true;
          break;

        case 'BALANCED':
          // Keep current settings but enable additional security features
          wallet.security.autoRecoveryEnabled = true;
          wallet.recovery.enabled = true;
          if (wallet.recovery.recoveryThreshold < 3) {
            wallet.recovery.recoveryThreshold = 3;
          }
          break;

        case 'PERFORMANCE':
          wallet.security.dailyLimit = Math.floor(wallet.security.dailyLimit * 1.5);
          wallet.security.singleTransactionLimit = Math.floor(wallet.security.singleTransactionLimit * 1.5);
          wallet.security.timeLockPeriod = Math.max(wallet.security.timeLockPeriod * 0.5, 900); // Min 15 minutes
          break;
      }

      // Update wallet
      wallet.metadata.lastModified = new Date();
      wallet.metadata.version += 1;
      await wallet.save();

      logger.info(`Security settings optimized for wallet ${walletId} with level ${optimizationLevel}`);

      return wallet;

    } catch (error) {
      logger.error('Error optimizing security settings:', error);
      throw error;
    }
  }

  // Private helper methods

  private generateRecoveryId(): string {
    return `recovery_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private async getActiveRecoveryProcess(walletId: string): Promise<RecoveryProcess | null> {
    // In production, query from database
    return null;
  }

  private async storeRecoveryProcess(recoveryProcess: RecoveryProcess): Promise<void> {
    // In production, store in secure database
    logger.info(`Storing recovery process: ${recoveryProcess.recoveryId}`);
  }

  private async getRecoveryProcess(recoveryId: string): Promise<RecoveryProcess | null> {
    // In production, retrieve from database
    return null;
  }

  private async notifyRecoverySigners(wallet: IMultiSigWallet, recoveryProcess: RecoveryProcess): Promise<void> {
    try {
      for (const recoverySigner of wallet.recovery.recoverySigners) {
        // Send email notification
        if (recoveryProcess.metadata.contactInfo?.email) {
          await sendEmail({
            to: recoveryProcess.metadata.contactInfo.email,
            subject: `Recovery Process Initiated for Wallet ${wallet.walletId}`,
            body: `A recovery process has been initiated for wallet ${wallet.walletId}. Please review and approve if necessary.`
          });
        }

        // Send SMS notification
        if (recoveryProcess.metadata.contactInfo?.phone) {
          await sendSMS({
            to: recoveryProcess.metadata.contactInfo.phone,
            body: `Recovery initiated for wallet ${wallet.walletId}. Please check your email for details.`
          });
        }
      }
    } catch (error) {
      logger.error('Error sending recovery notifications:', error);
    }
  }

  private async notifyRecoveryCompletion(wallet: IMultiSigWallet, recoveryProcess: RecoveryProcess): Promise<void> {
    try {
      // Notify all signers about completion
      for (const signer of wallet.config.signers) {
        await sendEmail({
          to: signer.address, // In production, get actual email
          subject: `Recovery Completed for Wallet ${wallet.walletId}`,
          body: `The recovery process for wallet ${wallet.walletId} has been completed. The signer configuration has been updated.`
        });
      }
    } catch (error) {
      logger.error('Error sending recovery completion notifications:', error);
    }
  }

  private async verifyRecoverySignature(
    recoveryProcess: RecoveryProcess,
    signature: string,
    signerAddress: string
  ): Promise<boolean> {
    // Placeholder for signature verification
    // In production, implement proper cryptographic verification
    return true;
  }

  private async executeRecovery(recoveryProcess: RecoveryProcess): Promise<void> {
    // Placeholder for recovery execution
    // This would handle the actual recovery logic based on the method
    logger.info(`Executing recovery: ${recoveryProcess.recoveryId}`);
  }

  private async storeBackupSignature(backupData: BackupSignatureData): Promise<void> {
    // In production, store in encrypted database
    logger.info(`Storing backup signature for ${backupData.signerAddress}`);
  }

  private async getBackupSignature(walletId: string, signerAddress: string): Promise<BackupSignatureData | null> {
    // In production, retrieve from encrypted database
    return null;
  }

  private async detectSuspiciousActivities(requests: ISignatureRequest[]): Promise<any[]> {
    const activities = [];

    // Detect rapid signatures
    const rapidSignatures = this.detectRapidSignatures(requests);
    activities.push(...rapidSignatures);

    // Detect unusual locations
    const unusualLocations = this.detectUnusualLocations(requests);
    activities.push(...unusualLocations);

    // Detect signature anomalies
    const signatureAnomalies = this.detectSignatureAnomalies(requests);
    activities.push(...signatureAnomalies);

    return activities;
  }

  private detectRapidSignatures(requests: ISignatureRequest[]): any[] {
    const activities = [];
    const timeThreshold = 5 * 60 * 1000; // 5 minutes

    requests.forEach(request => {
      request.signatures.forEach(signature => {
        const rapidSignatures = request.signatures.filter(s =>
          Math.abs(s.signedAt.getTime() - signature.signedAt.getTime()) < timeThreshold
        );

        if (rapidSignatures.length > 3) {
          activities.push({
            type: 'RAPID_SIGNATURES',
            timestamp: signature.signedAt,
            severity: 'MEDIUM',
            description: 'Multiple signatures detected in short time period',
            ipAddress: signature.metadata?.ipAddress || 'unknown',
            userAgent: signature.metadata?.userAgent || 'unknown'
          });
        }
      });
    });

    return activities;
  }

  private detectUnusualLocations(requests: ISignatureRequest[]): any[] {
    const activities = [];
    const ipMap = new Map<string, number>();

    requests.forEach(request => {
      request.signatures.forEach(signature => {
        const ip = signature.metadata?.ipAddress;
        if (ip) {
          ipMap.set(ip, (ipMap.get(ip) || 0) + 1);
        }
      });
    });

    // Flag IPs with unusual activity patterns
    ipMap.forEach((count, ip) => {
      if (count > 10) { // Arbitrary threshold
        activities.push({
          type: 'UNUSUAL_LOCATION',
          timestamp: new Date(),
          severity: 'LOW',
          description: `High activity from IP address: ${ip}`,
          ipAddress: ip,
          userAgent: 'unknown'
        });
      }
    });

    return activities;
  }

  private detectSignatureAnomalies(requests: ISignatureRequest[]): any[] {
    const activities = [];

    requests.forEach(request => {
      // Check for signatures with unusual timing patterns
      const signatureTimes = request.signatures.map(s => s.signedAt.getTime()).sort();
      
      for (let i = 1; i < signatureTimes.length; i++) {
        const timeDiff = signatureTimes[i] - signatureTimes[i - 1];
        if (timeDiff < 1000) { // Less than 1 second between signatures
          activities.push({
            type: 'SIGNATURE_ANOMALY',
            timestamp: new Date(signatureTimes[i]),
            severity: 'HIGH',
            description: 'Unusually rapid signature sequence detected',
            ipAddress: 'unknown',
            userAgent: 'unknown'
          });
        }
      }
    });

    return activities;
  }

  private calculateSecurityScore(
    wallet: IMultiSigWallet,
    requests: ISignatureRequest[],
    activities: any[]
  ): number {
    let score = 100; // Start with perfect score

    // Successful operations
    const successRate = wallet.stats.totalTransactions > 0 
      ? wallet.stats.successfulTransactions / wallet.stats.totalTransactions 
      : 1;
    score += (successRate - 0.9) * 20; // Bonus for high success rate

    // Failed operations
    const failureRate = wallet.stats.totalTransactions > 0 
      ? wallet.stats.failedTransactions / wallet.stats.totalTransactions 
      : 0;
    score -= failureRate * 30; // Penalty for failures

    // Suspicious activities
    const highSeverityCount = activities.filter(a => a.severity === 'HIGH').length;
    const mediumSeverityCount = activities.filter(a => a.severity === 'MEDIUM').length;
    score -= highSeverityCount * 15 + mediumSeverityCount * 5;

    // Recovery attempts
    score -= 0; // Placeholder for recovery attempt penalty

    return Math.max(0, Math.min(100, score));
  }

  private generateSecurityRecommendations(
    wallet: IMultiSigWallet,
    activities: any[],
    securityScore: number
  ): string[] {
    const recommendations = [];

    if (securityScore < 70) {
      recommendations.push('Consider increasing signature thresholds for critical operations');
    }

    if (activities.some(a => a.type === 'RAPID_SIGNATURES')) {
      recommendations.push('Enable additional verification for rapid signature sequences');
    }

    if (activities.some(a => a.type === 'UNUSUAL_LOCATION')) {
      recommendations.push('Implement IP-based access controls and location verification');
    }

    if (!wallet.recovery.enabled) {
      recommendations.push('Enable recovery mechanisms for wallet security');
    }

    if (wallet.security.timeLockPeriod < 3600) {
      recommendations.push('Consider increasing time-lock period for enhanced security');
    }

    return recommendations;
  }
}
