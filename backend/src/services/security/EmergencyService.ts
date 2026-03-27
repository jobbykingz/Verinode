import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  EmergencyPauseManager, 
  EmergencyConfig, 
  EmergencyPause, 
  EmergencyAction,
  EmergencyActionType,
  EmergencyLevel
} from '../../../contracts/src/security/EmergencyPause';
import { SecurityAudit, AuditEventType, SeverityLevel } from '../../../contracts/src/security/SecurityAudit';
import { AdvancedAccessControl, Permission } from '../../../contracts/src/security/AdvancedAccessControl';
import { MultiSigSecurity, TransactionType } from '../../../contracts/src/security/MultiSigSecurity';
import { TimeLock, OperationType } from '../../../contracts/src/security/TimeLock';
import { EventEmitter } from 'events';

export interface EmergencyRequest {
  id: string;
  type: EmergencyType;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  requestedBy: string;
  contractAddress?: string;
  metadata: { [key: string]: any };
  createdAt: Date;
  status: EmergencyStatus;
  approvedBy?: string[];
  executedAt?: Date;
  executedBy?: string;
}

export enum EmergencyType {
  PAUSE_ALL = 'PAUSE_ALL',
  PAUSE_CONTRACT = 'PAUSE_CONTRACT',
  EMERGENCY_WITHDRAW = 'EMERGENCY_WITHDRAW',
  ACCOUNT_FREEZE = 'ACCOUNT_FREEZE',
  TOKEN_FREEZE = 'TOKEN_FREEZE',
  UPGRADE_EMERGENCY = 'UPGRADE_EMERGENCY',
  VULNERABILITY_RESPONSE = 'VULNERABILITY_RESPONSE'
}

export enum EmergencyStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
  EXPIRED = 'EXPIRED'
}

export interface EmergencyResponse {
  success: boolean;
  requestId: string;
  message: string;
  executedAt?: Date;
  transactionHash?: string;
  blockNumber?: number;
}

export interface EmergencyConfigUpdate {
  emergencyAddresses?: string[];
  adminAddresses?: string[];
  guardianAddresses?: string[];
  maxPauseDuration?: number;
  defaultPauseDuration?: number;
  autoResumeEnabled?: boolean;
  criticalActionThreshold?: number;
}

@Injectable()
export class EmergencyService extends EventEmitter {
  private readonly logger = new Logger(EmergencyService.name);
  private emergencyPause: EmergencyPauseManager;
  private securityAudit: SecurityAudit;
  private accessControl: AdvancedAccessControl;
  private multiSigSecurity: MultiSigSecurity;
  private timeLock: TimeLock;
  
  private emergencyRequests: Map<string, EmergencyRequest> = new Map();
  private activeEmergencyActions: Map<string, EmergencyAction> = new Map();

  constructor(private configService: ConfigService) {
    super();
    this.initializeEmergencyServices();
  }

  /**
   * Initialize emergency services components
   */
  private initializeEmergencyServices(): void {
    try {
      // Initialize Emergency Pause Manager
      const emergencyConfig: EmergencyConfig = {
        emergencyAddresses: this.configService.get<string[]>('EMERGENCY_ADDRESSES') || [],
        adminAddresses: this.configService.get<string[]>('ADMIN_ADDRESSES') || [],
        guardianAddresses: this.configService.get<string[]>('GUARDIAN_ADDRESSES') || [],
        maxPauseDuration: this.configService.get<number>('EMERGENCY_MAX_PAUSE_DURATION') || 7 * 24 * 3600,
        defaultPauseDuration: this.configService.get<number>('EMERGENCY_DEFAULT_PAUSE_DURATION') || 24 * 3600,
        autoResumeEnabled: this.configService.get<boolean>('EMERGENCY_AUTO_RESUME') || false,
        notificationAddresses: this.configService.get<string[]>('EMERGENCY_NOTIFICATION_ADDRESSES') || [],
        criticalActionThreshold: this.configService.get<number>('EMERGENCY_CRITICAL_THRESHOLD') || 3,
      };

      this.emergencyPause = new EmergencyPauseManager(emergencyConfig);

      // Initialize other components (simplified for demonstration)
      this.securityAudit = new SecurityAudit({
        maxEntries: 100000,
        retentionPeriod: 90 * 24 * 3600,
        autoCleanup: true,
        compressionEnabled: true,
        encryptionEnabled: true,
        backupEnabled: true,
        realTimeMonitoring: true,
        alertThresholds: {
          criticalEventsPerHour: 5,
          failedAttemptsPerHour: 10,
          unusualActivityThreshold: 2.0,
          concurrentSessionsPerUser: 3,
        },
      });

      this.logger.log('Emergency services initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize emergency services: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create emergency pause request
   */
  async createEmergencyPauseRequest(
    type: EmergencyType,
    severity: 'Low' | 'Medium' | 'High' | 'Critical',
    description: string,
    requestedBy: string,
    contractAddress?: string,
    metadata?: { [key: string]: any }
  ): Promise<EmergencyRequest> {
    try {
      // Validate permissions
      const hasPermission = await this.checkEmergencyPermission(requestedBy, severity);
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions for emergency request');
      }

      const requestId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const emergencyRequest: EmergencyRequest = {
        id: requestId,
        type,
        severity,
        description,
        requestedBy,
        contractAddress,
        metadata: metadata || {},
        createdAt: new Date(),
        status: EmergencyStatus.PENDING,
        approvedBy: [],
      };

      this.emergencyRequests.set(requestId, emergencyRequest);

      // Log the emergency request
      await this.securityAudit.log_event(
        AuditEventType::EmergencyAction,
        this.mapSeverity(severity),
        `Emergency request created: ${type}`,
        requestedBy,
        contractAddress,
        new Map([
          ['requestId', requestId],
          ['type', type],
          ['description', description],
          ['severity', severity]
        ]),
        true,
        null
      );

      // Emit event for real-time monitoring
      this.emit('emergencyRequestCreated', emergencyRequest);

      this.logger.warn(`Emergency request created: ${requestId} by ${requestedBy}`);
      return emergencyRequest;
    } catch (error) {
      this.logger.error(`Failed to create emergency pause request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Approve emergency request
   */
  async approveEmergencyRequest(
    requestId: string,
    approvedBy: string
  ): Promise<EmergencyRequest> {
    try {
      const request = this.emergencyRequests.get(requestId);
      if (!request) {
        throw new NotFoundException(`Emergency request not found: ${requestId}`);
      }

      if (request.status !== EmergencyStatus.PENDING) {
        throw new BadRequestException(`Request is not in pending status: ${request.status}`);
      }

      // Check if approver has sufficient permissions
      const hasPermission = await this.checkEmergencyPermission(approvedBy, request.severity);
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions to approve emergency request');
      }

      // Check if already approved by this person
      if (request.approvedBy?.includes(approvedBy)) {
        throw new BadRequestException('Request already approved by this user');
      }

      // Add approval
      if (!request.approvedBy) {
        request.approvedBy = [];
      }
      request.approvedBy.push(approvedBy);

      // Check if sufficient approvals are met
      const requiredApprovals = this.getRequiredApprovals(request.severity);
      if (request.approvedBy.length >= requiredApprovals) {
        request.status = EmergencyStatus.APPROVED;
        
        // Auto-execute for critical emergencies
        if (request.severity === 'Critical') {
          await this.executeEmergencyRequest(requestId, approvedBy);
        }
      }

      // Log the approval
      await this.securityAudit.log_event(
        AuditEventType::EmergencyAction,
        SeverityLevel::High,
        `Emergency request approved: ${requestId}`,
        approvedBy,
        request.contractAddress,
        new Map([
          ['requestId', requestId],
          ['approver', approvedBy],
          ['totalApprovals', request.approvedBy.length.toString()]
        ]),
        true,
        null
      );

      this.emit('emergencyRequestApproved', request);
      return request;
    } catch (error) {
      this.logger.error(`Failed to approve emergency request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute emergency request
   */
  async executeEmergencyRequest(
    requestId: string,
    executor: string
  ): Promise<EmergencyResponse> {
    try {
      const request = this.emergencyRequests.get(requestId);
      if (!request) {
        throw new NotFoundException(`Emergency request not found: ${requestId}`);
      }

      if (request.status !== EmergencyStatus.APPROVED) {
        throw new BadRequestException(`Request is not approved: ${request.status}`);
      }

      // Check execution permissions
      const hasPermission = await this.checkEmergencyPermission(executor, request.severity);
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions to execute emergency request');
      }

      let response: EmergencyResponse;

      switch (request.type) {
        case EmergencyType.PAUSE_ALL:
          response = await this.executeGlobalPause(request, executor);
          break;
        case EmergencyType.PAUSE_CONTRACT:
          response = await this.executeContractPause(request, executor);
          break;
        case EmergencyType.EMERGENCY_WITHDRAW:
          response = await this.executeEmergencyWithdraw(request, executor);
          break;
        case EmergencyType.ACCOUNT_FREEZE:
          response = await this.executeAccountFreeze(request, executor);
          break;
        case EmergencyType.TOKEN_FREEZE:
          response = await this.executeTokenFreeze(request, executor);
          break;
        case EmergencyType.UPGRADE_EMERGENCY:
          response = await this.executeEmergencyUpgrade(request, executor);
          break;
        case EmergencyType.VULNERABILITY_RESPONSE:
          response = await this.executeVulnerabilityResponse(request, executor);
          break;
        default:
          throw new BadRequestException(`Unknown emergency type: ${request.type}`);
      }

      // Update request status
      request.status = EmergencyStatus.EXECUTED;
      request.executedAt = new Date();
      request.executedBy = executor;

      // Log the execution
      await this.securityAudit.log_event(
        AuditEventType::EmergencyAction,
        SeverityLevel::Critical,
        `Emergency request executed: ${requestId}`,
        executor,
        request.contractAddress,
        new Map([
          ['requestId', requestId],
          ['type', request.type],
          ['success', response.success.toString()]
        ]),
        response.success,
        response.success ? null : 'Execution failed'
      );

      this.emit('emergencyRequestExecuted', { request, response });
      
      this.logger.warn(`Emergency request executed: ${requestId} by ${executor}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to execute emergency request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute global pause
   */
  private async executeGlobalPause(
    request: EmergencyRequest,
    executor: string
  ): Promise<EmergencyResponse> {
    try {
      const emergencyLevel = this.mapEmergencyLevel(request.severity);
      const duration = request.metadata.duration || this.emergencyPause.get_config().default_pause_duration;

      this.emergencyPause.emergency_pause(
        request.description,
        emergencyLevel,
        duration,
        executor
      );

      return {
        success: true,
        requestId: request.id,
        message: 'Global pause executed successfully',
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        requestId: request.id,
        message: `Failed to execute global pause: ${error.message}`,
      };
    }
  }

  /**
   * Execute contract pause
   */
  private async executeContractPause(
    request: EmergencyRequest,
    executor: string
  ): Promise<EmergencyResponse> {
    try {
      if (!request.contractAddress) {
        throw new Error('Contract address is required for contract pause');
      }

      // Create emergency action for contract pause
      const actionId = `pause_${request.contractAddress}_${Date.now()}`;
      
      await this.emergencyPause.create_emergency_action(
        actionId,
        EmergencyActionType::ContractUpgrade, // Using as contract pause
        request.contractAddress,
        Buffer.from('pause'), // Simplified pause data
        executor,
        true // Requires approval
      );

      // For critical emergencies, auto-approve and execute
      if (request.severity === 'Critical') {
        await this.emergencyPause.approve_emergency_action(&actionId, executor);
        const action = this.emergencyPause.execute_emergency_action(&actionId, executor);
        this.activeEmergencyActions.set(actionId, action);
      }

      return {
        success: true,
        requestId: request.id,
        message: `Contract pause initiated for ${request.contractAddress}`,
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        requestId: request.id,
        message: `Failed to execute contract pause: ${error.message}`,
      };
    }
  }

  /**
   * Execute emergency withdraw
   */
  private async executeEmergencyWithdraw(
    request: EmergencyRequest,
    executor: string
  ): Promise<EmergencyResponse> {
    try {
      const targetAddress = request.metadata.targetAddress;
      const amount = request.metadata.amount;

      if (!targetAddress || !amount) {
        throw new Error('Target address and amount are required for emergency withdraw');
      }

      // Create multi-sig transaction for emergency withdraw
      const txId = await this.multiSigSecurity.create_transaction(
        targetAddress,
        BigInt(amount),
        Buffer.from('emergency_withdraw'),
        TransactionType::EmergencyWithdraw,
        undefined,
        undefined,
        new Map(Object.entries(request.metadata)),
        executor
      );

      // Auto-sign for critical emergencies
      if (request.severity === 'Critical') {
        await this.multiSigSecurity.sign_transaction(
          txId,
          executor,
          Buffer.from('signature'), // Simplified signature
          Buffer.from('message_hash') // Simplified message hash
        );
      }

      return {
        success: true,
        requestId: request.id,
        message: `Emergency withdraw transaction created: ${txId}`,
        executedAt: new Date(),
        transactionHash: txId,
      };
    } catch (error) {
      return {
        success: false,
        requestId: request.id,
        message: `Failed to execute emergency withdraw: ${error.message}`,
      };
    }
  }

  /**
   * Execute account freeze
   */
  private async executeAccountFreeze(
    request: EmergencyRequest,
    executor: string
  ): Promise<EmergencyResponse> {
    try {
      const targetAccount = request.metadata.targetAccount;

      if (!targetAccount) {
        throw new Error('Target account is required for account freeze');
      }

      // Create emergency action for account freeze
      const actionId = `freeze_${targetAccount}_${Date.now()}`;
      
      await this.emergencyPause.create_emergency_action(
        actionId,
        EmergencyActionType::AccountFreeze,
        targetAccount,
        Buffer.from('freeze'),
        executor,
        true
      );

      return {
        success: true,
        requestId: request.id,
        message: `Account freeze initiated for ${targetAccount}`,
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        requestId: request.id,
        message: `Failed to execute account freeze: ${error.message}`,
      };
    }
  }

  /**
   * Execute token freeze
   */
  private async executeTokenFreeze(
    request: EmergencyRequest,
    executor: string
  ): Promise<EmergencyResponse> {
    try {
      const tokenAddress = request.metadata.tokenAddress;

      if (!tokenAddress) {
        throw new Error('Token address is required for token freeze');
      }

      // Create emergency action for token freeze
      const actionId = `token_freeze_${tokenAddress}_${Date.now()}`;
      
      await this.emergencyPause.create_emergency_action(
        actionId,
        EmergencyActionType::TokenFreeze,
        tokenAddress,
        Buffer.from('token_freeze'),
        executor,
        true
      );

      return {
        success: true,
        requestId: request.id,
        message: `Token freeze initiated for ${tokenAddress}`,
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        requestId: request.id,
        message: `Failed to execute token freeze: ${error.message}`,
      };
    }
  }

  /**
   * Execute emergency upgrade
   */
  private async executeEmergencyUpgrade(
    request: EmergencyRequest,
    executor: string
  ): Promise<EmergencyResponse> {
    try {
      const contractAddress = request.contractAddress;
      const newImplementation = request.metadata.newImplementation;

      if (!contractAddress || !newImplementation) {
        throw new Error('Contract address and new implementation are required for emergency upgrade');
      }

      // Create time-locked operation for emergency upgrade
      const operationId = `upgrade_${contractAddress}_${Date.now()}`;
      
      await this.timeLock.create_time_lock(
        operationId,
        OperationType::ContractUpgrade,
        contractAddress,
        Buffer.from(newImplementation),
        executor,
        Some({ secs: 300, nanos: 0 }), // 5 minutes for emergency
        None,
        10 // Highest priority
      );

      return {
        success: true,
        requestId: request.id,
        message: `Emergency upgrade time-locked: ${operationId}`,
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        requestId: request.id,
        message: `Failed to execute emergency upgrade: ${error.message}`,
      };
    }
  }

  /**
   * Execute vulnerability response
   */
  private async executeVulnerabilityResponse(
    request: EmergencyRequest,
    executor: string
  ): Promise<EmergencyResponse> {
    try {
      const vulnerabilityId = request.metadata.vulnerabilityId;
      const responseAction = request.metadata.responseAction;

      if (!vulnerabilityId || !responseAction) {
        throw new Error('Vulnerability ID and response action are required');
      }

      // Create emergency action based on response type
      const actionId = `vuln_response_${vulnerabilityId}_${Date.now()}`;
      let actionType: EmergencyActionType;

      switch (responseAction) {
        case 'pause':
          actionType = EmergencyActionType::ContractUpgrade;
          break;
        case 'freeze':
          actionType = EmergencyActionType::TokenFreeze;
          break;
        case 'withdraw':
          actionType = EmergencyActionType::EmergencyWithdraw;
          break;
        default:
          actionType = EmergencyActionType::Custom(responseAction);
      }

      await this.emergencyPause.create_emergency_action(
        actionId,
        actionType,
        request.contractAddress || 'system',
        Buffer.from(responseAction),
        executor,
        true
      );

      return {
        success: true,
        requestId: request.id,
        message: `Vulnerability response initiated: ${responseAction}`,
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        requestId: request.id,
        message: `Failed to execute vulnerability response: ${error.message}`,
      };
    }
  }

  /**
   * Get emergency request by ID
   */
  getEmergencyRequest(requestId: string): EmergencyRequest | undefined {
    return this.emergencyRequests.get(requestId);
  }

  /**
   * Get all emergency requests
   */
  getAllEmergencyRequests(): EmergencyRequest[] {
    return Array.from(this.emergencyRequests.values());
  }

  /**
   * Get pending emergency requests
   */
  getPendingEmergencyRequests(): EmergencyRequest[] {
    return Array.from(this.emergencyRequests.values())
      .filter(request => request.status === EmergencyStatus.PENDING);
  }

  /**
   * Get emergency pause status
   */
  getEmergencyPauseStatus(): EmergencyPause {
    return this.emergencyPause.get_pause_state().clone();
  }

  /**
   * Resume from emergency pause
   */
  async resumeFromEmergencyPause(executor: string): Promise<void> {
    try {
      const hasPermission = await this.checkEmergencyPermission(executor, 'High');
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions to resume from emergency pause');
      }

      this.emergencyPause.resume(executor);

      await this.securityAudit.log_event(
        AuditEventType::EmergencyAction,
        SeverityLevel::High,
        'Emergency resume executed',
        executor,
        null,
        new Map([]),
        true,
        null
      );

      this.emit('emergencyResumed', { executor, timestamp: new Date() });
      this.logger.info(`Emergency resumed by ${executor}`);
    } catch (error) {
      this.logger.error(`Failed to resume from emergency pause: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update emergency configuration
   */
  async updateEmergencyConfig(
    configUpdate: EmergencyConfigUpdate,
    updater: string
  ): Promise<void> {
    try {
      const hasPermission = await this.checkEmergencyPermission(updater, 'Critical');
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions to update emergency configuration');
      }

      const currentConfig = this.emergencyPause.get_config();
      const newConfig = { ...currentConfig, ...configUpdate };

      this.emergencyPause.update_config(newConfig, updater);

      await this.securityAudit.log_event(
        AuditEventType::ConfigurationChange,
        SeverityLevel::High,
        'Emergency configuration updated',
        updater,
        null,
        new Map(Object.entries(configUpdate)),
        true,
        null
      );

      this.logger.info(`Emergency configuration updated by ${updater}`);
    } catch (error) {
      this.logger.error(`Failed to update emergency configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get emergency statistics
   */
  getEmergencyStats(): any {
    const requests = Array.from(this.emergencyRequests.values());
    const pending = requests.filter(r => r.status === EmergencyStatus.PENDING);
    const approved = requests.filter(r => r.status === EmergencyStatus.APPROVED);
    const executed = requests.filter(r => r.status === EmergencyStatus.EXECUTED);
    const rejected = requests.filter(r => r.status === EmergencyStatus.REJECTED);

    const pauseStatus = this.emergencyPause.get_pause_state();
    const multiSigStats = this.multiSigSecurity.get_stats();

    return {
      totalRequests: requests.length,
      pendingRequests: pending.length,
      approvedRequests: approved.length,
      executedRequests: executed.length,
      rejectedRequests: rejected.length,
      isPaused: pauseStatus.is_paused,
      pauseLevel: pauseStatus.emergency_level,
      pausedAt: pauseStatus.paused_at,
      pausedBy: pauseStatus.paused_by,
      pauseReason: pauseStatus.pause_reason,
      multiSigStats,
      recentActivity: requests
        .filter(r => r.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000))
        .length,
    };
  }

  /**
   * Helper methods
   */
  private async checkEmergencyPermission(
    address: string, 
    severity: 'Low' | 'Medium' | 'High' | 'Critical'
  ): Promise<boolean> {
    // Simplified permission check - in production, integrate with actual access control
    const emergencyAddresses = this.configService.get<string[]>('EMERGENCY_ADDRESSES') || [];
    const adminAddresses = this.configService.get<string[]>('ADMIN_ADDRESSES') || [];
    
    if (severity === 'Critical') {
      return adminAddresses.includes(address);
    } else {
      return emergencyAddresses.includes(address) || adminAddresses.includes(address);
    }
  }

  private mapSeverity(severity: 'Low' | 'Medium' | 'High' | 'Critical'): SeverityLevel {
    switch (severity) {
      case 'Low': return SeverityLevel::Low;
      case 'Medium': return SeverityLevel::Medium;
      case 'High': return SeverityLevel::High;
      case 'Critical': return SeverityLevel::Critical;
    }
  }

  private mapEmergencyLevel(severity: 'Low' | 'Medium' | 'High' | 'Critical'): EmergencyLevel {
    switch (severity) {
      case 'Low': return EmergencyLevel::Low;
      case 'Medium': return EmergencyLevel::Medium;
      case 'High': return EmergencyLevel::High;
      case 'Critical': return EmergencyLevel::Critical;
    }
  }

  private getRequiredApprovals(severity: 'Low' | 'Medium' | 'High' | 'Critical'): number {
    switch (severity) {
      case 'Low': return 1;
      case 'Medium': return 2;
      case 'High': return 3;
      case 'Critical': return 1; // Critical can be executed immediately by admin
    }
  }
}
