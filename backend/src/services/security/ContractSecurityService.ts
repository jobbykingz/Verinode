import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  SecurityScanRequest, 
  SecurityScanResponse, 
  SecurityReport, 
  Vulnerability,
  SecurityPattern,
  GasAnalysis,
  ScanConfiguration,
  SecurityMetrics,
  ComplianceStatus
} from '../interfaces/security.interface';
import { ContractEntity } from '../../entities/contract.entity';
import { SecurityScanEntity } from '../../entities/security-scan.entity';
import { VulnerabilityEntity } from '../../entities/vulnerability.entity';
import { SecurityRuleEntity } from '../../entities/security-rule.entity';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Advanced Security Features Imports
import { TimeLock, TimeLockConfig, TimeLockOperation, TimeLockStats } from '../../../contracts/src/security/TimeLock';
import { EmergencyPauseManager, EmergencyConfig, EmergencyPause, EmergencyAction } from '../../../contracts/src/security/EmergencyPause';
import { AdvancedAccessControl, AccessControlConfig, User, Role } from '../../../contracts/src/security/AdvancedAccessControl';
import { SecurityAudit, AuditConfig, AuditEntry, AuditReport } from '../../../contracts/src/security/SecurityAudit';
import { MultiSigSecurity, MultiSigConfig, MultiSigTransaction } from '../../../contracts/src/security/MultiSigSecurity';

@Injectable()
export class ContractSecurityService {
  private readonly logger = new Logger(ContractSecurityService.name);
  private readonly scanQueue: Map<string, SecurityScanRequest> = new Map();
  private readonly activeScans: Map<string, boolean> = new Map();

  // Advanced Security Components
  private timeLock: TimeLock;
  private emergencyPause: EmergencyPauseManager;
  private accessControl: AdvancedAccessControl;
  private securityAudit: SecurityAudit;
  private multiSigSecurity: MultiSigSecurity;

  constructor(
    private configService: ConfigService,
    @InjectRepository(ContractEntity)
    private contractRepository: Repository<ContractEntity>,
    @InjectRepository(SecurityScanEntity)
    private securityScanRepository: Repository<SecurityScanEntity>,
    @InjectRepository(VulnerabilityEntity)
    private vulnerabilityRepository: Repository<VulnerabilityEntity>,
    @InjectRepository(SecurityRuleEntity)
    private securityRuleRepository: Repository<SecurityRuleEntity>,
  ) {
    // Initialize advanced security components
    this.initializeAdvancedSecurity();
  }

  /**
   * Initialize advanced security components
   */
  private initializeAdvancedSecurity(): void {
    try {
      // Initialize TimeLock with default configuration
      const timeLockConfig: TimeLockConfig = {
        minDelay: { secs: 3600, nanos: 0 }, // 1 hour
        maxDelay: { secs: 30 * 24 * 3600, nanos: 0 }, // 30 days
        defaultDelay: { secs: 24 * 3600, nanos: 0 }, // 24 hours
        adminAddresses: this.configService.get<string[]>('SECURITY_ADMIN_ADDRESSES') || [],
        emergencyAddresses: this.configService.get<string[]>('SECURITY_EMERGENCY_ADDRESSES') || [],
      };
      this.timeLock = new TimeLock(timeLockConfig);

      // Initialize Emergency Pause Manager
      const emergencyConfig: EmergencyConfig = {
        emergencyAddresses: this.configService.get<string[]>('SECURITY_EMERGENCY_ADDRESSES') || [],
        adminAddresses: this.configService.get<string[]>('SECURITY_ADMIN_ADDRESSES') || [],
        guardianAddresses: this.configService.get<string[]>('SECURITY_GUARDIAN_ADDRESSES') || [],
        maxPauseDuration: 7 * 24 * 3600, // 7 days
        defaultPauseDuration: 24 * 3600, // 24 hours
        autoResumeEnabled: this.configService.get<boolean>('SECURITY_AUTO_RESUME') || false,
        notificationAddresses: this.configService.get<string[]>('SECURITY_NOTIFICATION_ADDRESSES') || [],
        criticalActionThreshold: this.configService.get<number>('SECURITY_CRITICAL_THRESHOLD') || 3,
      };
      this.emergencyPause = new EmergencyPauseManager(emergencyConfig);

      // Initialize Access Control
      const accessControlConfig: AccessControlConfig = {
        adminAddress: this.configService.get<string>('SECURITY_ADMIN_ADDRESS') || '',
        defaultSessionDuration: this.configService.get<number>('SESSION_DEFAULT_DURATION') || 3600,
        maxSessionDuration: this.configService.get<number>('SESSION_MAX_DURATION') || 24 * 3600,
        requireMultiAdmin: this.configService.get<boolean>('REQUIRE_MULTI_ADMIN') || false,
        auditAccess: true,
        ipWhitelistEnabled: this.configService.get<boolean>('IP_WHITELIST_ENABLED') || false,
        sessionTimeoutEnabled: this.configService.get<boolean>('SESSION_TIMEOUT_ENABLED') || true,
      };
      this.accessControl = new AdvancedAccessControl(accessControlConfig);

      // Initialize Security Audit
      const auditConfig: AuditConfig = {
        maxEntries: this.configService.get<number>('AUDIT_MAX_ENTRIES') || 100000,
        retentionPeriod: this.configService.get<number>('AUDIT_RETENTION_PERIOD') || 90 * 24 * 3600,
        autoCleanup: this.configService.get<boolean>('AUDIT_AUTO_CLEANUP') || true,
        compressionEnabled: this.configService.get<boolean>('AUDIT_COMPRESSION_ENABLED') || true,
        encryptionEnabled: this.configService.get<boolean>('AUDIT_ENCRYPTION_ENABLED') || true,
        backupEnabled: this.configService.get<boolean>('AUDIT_BACKUP_ENABLED') || true,
        realTimeMonitoring: this.configService.get<boolean>('AUDIT_REAL_TIME_MONITORING') || true,
        alertThresholds: {
          criticalEventsPerHour: this.configService.get<number>('ALERT_CRITICAL_PER_HOUR') || 5,
          failedAttemptsPerHour: this.configService.get<number>('ALERT_FAILED_ATTEMPTS_PER_HOUR') || 10,
          unusualActivityThreshold: this.configService.get<number>('ALERT_UNUSUAL_ACTIVITY_THRESHOLD') || 2.0,
          concurrentSessionsPerUser: this.configService.get<number>('ALERT_CONCURRENT_SESSIONS') || 3,
        },
      };
      this.securityAudit = new SecurityAudit(auditConfig);

      // Initialize Multi-Signature Security
      const multiSigConfig: MultiSigConfig = {
        signers: new Map(), // Will be populated from database
        threshold: this.configService.get<number>('MULTISIG_THRESHOLD') || 2,
        nonce: 0,
        transactionTimeout: this.configService.get<number>('MULTISIG_TRANSACTION_TIMEOUT') || 7 * 24 * 3600,
        maxSigners: this.configService.get<number>('MULTISIG_MAX_SIGNERS') || 10,
        requireAllForEmergency: this.configService.get<boolean>('MULTISIG_REQUIRE_ALL_EMERGENCY') || true,
        autoCleanup: this.configService.get<boolean>('MULTISIG_AUTO_CLEANUP') || true,
        maxTransactionValue: this.configService.get<number>('MULTISIG_MAX_TRANSACTION_VALUE') ? 
          BigInt(this.configService.get<number>('MULTISIG_MAX_TRANSACTION_VALUE')) : undefined,
      };
      this.multiSigSecurity = new MultiSigSecurity(multiSigConfig);

      this.logger.log('Advanced security components initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize advanced security components: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initiates a security scan for a smart contract
   */
  async initiateSecurityScan(request: SecurityScanRequest): Promise<SecurityScanResponse> {
    this.logger.log(`Initiating security scan for contract: ${request.contractAddress}`);
    
    try {
      // Validate contract exists
      const contract = await this.contractRepository.findOne({
        where: { address: request.contractAddress }
      });
      
      if (!contract) {
        throw new NotFoundException(`Contract not found: ${request.contractAddress}`);
      }

      // Generate scan ID
      const scanId = uuidv4();
      
      // Create scan request
      const scanRequest: SecurityScanRequest = {
        ...request,
        scanId,
        status: 'pending',
        createdAt: new Date(),
        configuration: this.getDefaultScanConfiguration(request.configuration),
      };

      // Store scan request
      this.scanQueue.set(scanId, scanRequest);

      // Start async scan
      this.performSecurityScan(scanRequest);

      return {
        scanId,
        status: 'pending',
        estimatedDuration: this.estimateScanDuration(contract),
        message: 'Security scan initiated successfully',
      };

    } catch (error) {
      this.logger.error(`Failed to initiate security scan: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets the status of a security scan
   */
  async getScanStatus(scanId: string): Promise<SecurityScanResponse> {
    const scan = await this.securityScanRepository.findOne({
      where: { scanId },
      relations: ['vulnerabilities', 'patterns'],
    });

    if (!scan) {
      throw new NotFoundException(`Scan not found: ${scanId}`);
    }

    return {
      scanId: scan.scanId,
      status: scan.status,
      progress: scan.progress,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      securityScore: scan.securityScore,
      gasScore: scan.gasScore,
      vulnerabilitiesFound: scan.vulnerabilitiesFound,
      message: scan.statusMessage,
    };
  }

  /**
   * Gets detailed security report for a scan
   */
  async getSecurityReport(scanId: string): Promise<SecurityReport> {
    const scan = await this.securityScanRepository.findOne({
      where: { scanId },
      relations: ['contract', 'vulnerabilities', 'patterns'],
    });

    if (!scan) {
      throw new NotFoundException(`Scan not found: ${scanId}`);
    }

    if (scan.status !== 'completed') {
      throw new BadRequestException(`Scan not completed: ${scanId}`);
    }

    // Generate comprehensive report
    const report = await this.generateSecurityReport(scan);

    return report;
  }

  /**
   * Gets security metrics for a contract
   */
  async getSecurityMetrics(contractAddress: string): Promise<SecurityMetrics> {
    const contract = await this.contractRepository.findOne({
      where: { address: contractAddress },
      relations: ['scans', 'scans.vulnerabilities'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract not found: ${contractAddress}`);
    }

    const scans = contract.scans || [];
    const completedScans = scans.filter(scan => scan.status === 'completed');
    
    // Calculate metrics
    const totalScans = completedScans.length;
    const averageSecurityScore = totalScans > 0 
      ? completedScans.reduce((sum, scan) => sum + scan.securityScore, 0) / totalScans
      : 0;
    
    const averageGasScore = totalScans > 0
      ? completedScans.reduce((sum, scan) => sum + scan.gasScore, 0) / totalScans
      : 0;

    const totalVulnerabilities = completedScans.reduce(
      (sum, scan) => sum + scan.vulnerabilitiesFound, 0
    );

    const criticalVulnerabilities = completedScans.reduce(
      (sum, scan) => sum + scan.vulnerabilities.filter(v => v.severity >= 8).length, 0
    );

    const lastScanDate = completedScans.length > 0
      ? new Date(Math.max(...completedScans.map(scan => scan.completedAt.getTime())))
      : null;

    return {
      contractAddress,
      totalScans,
      averageSecurityScore,
      averageGasScore,
      totalVulnerabilities,
      criticalVulnerabilities,
      lastScanDate,
      securityTrend: this.calculateSecurityTrend(completedScans),
      riskLevel: this.calculateRiskLevel(averageSecurityScore, criticalVulnerabilities),
    };
  }

  /**
   * Gets compliance status for a contract
   */
  async getComplianceStatus(contractAddress: string): Promise<ComplianceStatus> {
    const latestScan = await this.securityScanRepository.findOne({
      where: { contract: { address: contractAddress } },
      relations: ['vulnerabilities', 'patterns'],
      order: { completedAt: 'DESC' },
    });

    if (!latestScan) {
      throw new NotFoundException(`No security scans found for contract: ${contractAddress}`);
    }

    return this.evaluateCompliance(latestScan);
  }

  /**
   * Performs batch security scan on multiple contracts
   */
  async batchSecurityScan(contractAddresses: string[], configuration?: ScanConfiguration): Promise<SecurityScanResponse[]> {
    const results: SecurityScanResponse[] = [];

    for (const address of contractAddresses) {
      try {
        const result = await this.initiateSecurityScan({
          contractAddress: address,
          configuration,
        });
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to initiate scan for ${address}: ${error.message}`);
        results.push({
          scanId: '',
          status: 'failed',
          message: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Updates security rules configuration
   */
  async updateSecurityRules(rules: any[]): Promise<void> {
    try {
      // Clear existing rules
      await this.securityRuleRepository.clear();

      // Add new rules
      for (const ruleData of rules) {
        const rule = this.securityRuleRepository.create(ruleData);
        await this.securityRuleRepository.save(rule);
      }

      this.logger.log(`Updated ${rules.length} security rules`);
    } catch (error) {
      this.logger.error(`Failed to update security rules: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets vulnerability statistics
   */
  async getVulnerabilityStatistics(): Promise<any> {
    const totalScans = await this.securityScanRepository.count();
    const totalVulnerabilities = await this.vulnerabilityRepository.count();
    
    const criticalVulns = await this.vulnerabilityRepository.count({
      where: { severity: 9 }
    });

    const highVulns = await this.vulnerabilityRepository.count({
      where: { severity: 7 }
    });

    const mostCommonVuln = await this.vulnerabilityRepository
      .createQueryBuilder('vuln')
      .select('vuln.name', 'name')
      .addSelect('COUNT(*)', 'count')
      .groupBy('vuln.name')
      .orderBy('COUNT(*)', 'DESC')
      .limit(1)
      .getRawOne();

    return {
      totalScans,
      totalVulnerabilities,
      criticalVulnerabilities: criticalVulns,
      highVulnerabilities: highVulns,
      mostCommonVulnerability: mostCommonVuln?.name || 'None',
    };
  }

  /**
   * Performs the actual security scan
   */
  private async performSecurityScan(request: SecurityScanRequest): Promise<void> {
    const scanId = request.scanId;
    this.activeScans.set(scanId, true);

    try {
      // Update scan status to running
      await this.updateScanStatus(scanId, 'running', 0);

      // Get contract details
      const contract = await this.contractRepository.findOne({
        where: { address: request.contractAddress }
      });

      // Create security scan entity
      const scanEntity = this.securityScanRepository.create({
        scanId,
        contract,
        status: 'running',
        startedAt: new Date(),
        configuration: request.configuration,
      });
      
      await this.securityScanRepository.save(scanEntity);

      // Execute security scan using TypeScript script
      const scanResult = await this.executeSecurityScanScript(
        request.contractAddress,
        contract.sourceCodePath,
        request.configuration
      );

      // Process scan results
      await this.processScanResults(scanId, scanResult);

      // Update scan status to completed
      await this.updateScanStatus(scanId, 'completed', 100);

    } catch (error) {
      this.logger.error(`Security scan failed for ${scanId}: ${error.message}`);
      await this.updateScanStatus(scanId, 'failed', 0, error.message);
    } finally {
      this.activeScans.delete(scanId);
      this.scanQueue.delete(scanId);
    }
  }

  /**
   * Executes the security scan TypeScript script
   */
  private async executeSecurityScanScript(
    contractAddress: string,
    sourceCodePath: string,
    configuration: ScanConfiguration
  ): Promise<any> {
    try {
      // Build command to run security scan script
      const scriptPath = join(process.cwd(), 'contracts', 'scripts', 'security_scan.ts');
      const outputPath = join(process.cwd(), 'temp', `scan_${contractAddress}.json`);
      
      // Ensure temp directory exists
      const tempDir = dirname(outputPath);
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }

      // Build command arguments
      const args = [
        'scan',
        sourceCodePath,
        '--format', 'json',
        '--output', outputPath,
        '--severity-threshold', configuration.severityThreshold?.toString() || '5',
      ];

      if (configuration.enableGasAnalysis) {
        args.push('--gas-analysis');
      }

      if (configuration.enablePatternMatching) {
        args.push('--pattern-matching');
      }

      if (configuration.enableVulnerabilityDetection) {
        args.push('--vulnerability-detection');
      }

      // Execute the script
      const command = `npx ts-node ${scriptPath} ${args.join(' ')}`;
      
      this.logger.log(`Executing security scan: ${command}`);
      
      execSync(command, {
        cwd: process.cwd(),
        timeout: 300000, // 5 minutes timeout
      });

      // Read results
      if (existsSync(outputPath)) {
        const results = JSON.parse(readFileSync(outputPath, 'utf8'));
        
        // Clean up temporary file
        try {
          require('fs').unlinkSync(outputPath);
        } catch (cleanupError) {
          this.logger.warn(`Failed to clean up temporary file: ${cleanupError.message}`);
        }

        return results;
      } else {
        throw new Error('Security scan script did not produce output file');
      }

    } catch (error) {
      this.logger.error(`Failed to execute security scan script: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processes scan results and stores them in database
   */
  private async processScanResults(scanId: string, results: any): Promise<void> {
    try {
      const scan = await this.securityScanRepository.findOne({
        where: { scanId },
        relations: ['contract'],
      });

      if (!scan) {
        throw new Error(`Scan not found: ${scanId}`);
      }

      // Update scan with results
      scan.securityScore = results.summary?.averageSecurityScore || 0;
      scan.gasScore = results.summary?.averageGasScore || 0;
      scan.vulnerabilitiesFound = results.summary?.totalVulnerabilities || 0;
      scan.completedAt = new Date();
      scan.status = 'completed';

      await this.securityScanRepository.save(scan);

      // Process vulnerabilities
      if (results.contracts && results.contracts.length > 0) {
        const contractResults = results.contracts[0]; // Assuming single contract scan
        
        // Store vulnerabilities
        if (contractResults.vulnerabilities) {
          for (const vulnData of contractResults.vulnerabilities) {
            const vulnerability = this.vulnerabilityRepository.create({
              scan,
              name: vulnData.name,
              description: vulnData.description,
              severity: vulnData.severity,
              lineNumber: vulnData.lineNumber,
              remediation: vulnData.remediation,
              cweId: vulnData.cweId,
            });
            await this.vulnerabilityRepository.save(vulnerability);
          }
        }

        // Store patterns
        if (contractResults.patterns) {
          for (const patternData of contractResults.patterns) {
            const pattern = this.vulnerabilityRepository.create({
              scan,
              name: patternData.name,
              description: patternData.description,
              severity: patternData.severity,
              lineNumber: null,
              remediation: patternData.remediation,
              cweId: null,
              isPattern: true,
            });
            await this.vulnerabilityRepository.save(pattern);
          }
        }
      }

    } catch (error) {
      this.logger.error(`Failed to process scan results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates scan status in database
   */
  private async updateScanStatus(
    scanId: string, 
    status: string, 
    progress: number, 
    message?: string
  ): Promise<void> {
    try {
      await this.securityScanRepository.update(
        { scanId },
        { 
          status,
          progress,
          statusMessage: message,
          ...(status === 'completed' && { completedAt: new Date() }),
          ...(status === 'running' && !progress && { startedAt: new Date() }),
        }
      );
    } catch (error) {
      this.logger.error(`Failed to update scan status: ${error.message}`);
    }
  }

  /**
   * Generates comprehensive security report
   */
  private async generateSecurityReport(scan: SecurityScanEntity): Promise<SecurityReport> {
    const vulnerabilities = scan.vulnerabilities?.filter(v => !v.isPattern) || [];
    const patterns = scan.vulnerabilities?.filter(v => v.isPattern) || [];

    return {
      scanId: scan.scanId,
      contractAddress: scan.contract.address,
      scanTimestamp: scan.completedAt,
      overallScore: scan.securityScore,
      gasScore: scan.gasScore,
      vulnerabilitySummary: {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity >= 9).length,
        high: vulnerabilities.filter(v => v.severity >= 7 && v.severity < 9).length,
        medium: vulnerabilities.filter(v => v.severity >= 5 && v.severity < 7).length,
        low: vulnerabilities.filter(v => v.severity >= 3 && v.severity < 5).length,
        info: vulnerabilities.filter(v => v.severity < 3).length,
      },
      patternSummary: {
        total: patterns.length,
        antiPatterns: patterns.filter(p => p.name.includes('Anti')).length,
        bestPracticeViolations: patterns.filter(p => p.name.includes('Best')).length,
        gasInefficiencies: patterns.filter(p => p.name.includes('Gas')).length,
        securityRisks: patterns.filter(p => p.name.includes('Risk')).length,
      },
      gasAnalysis: {
        totalGasEstimate: 0, // Would be populated from scan results
        highCostOperations: 0,
        unoptimizedLoops: 0,
        storageOperations: 0,
        optimizationSuggestions: [],
      },
      recommendations: this.generateRecommendations(vulnerabilities, patterns),
      detailedFindings: {
        vulnerabilities: vulnerabilities.map(v => ({
          id: v.id,
          name: v.name,
          description: v.description,
          severity: v.severity,
          lineNumber: v.lineNumber,
          remediation: v.remediation,
          cweId: v.cweId,
        })),
        patterns: patterns.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          severity: p.severity,
          patternType: 'SecurityRisk',
          remediation: p.remediation,
        })),
      },
      complianceStatus: await this.evaluateCompliance(scan),
      riskAssessment: this.assessRisk(scan.securityScore, vulnerabilities),
    };
  }

  /**
   * Generates recommendations based on findings
   */
  private generateRecommendations(vulnerabilities: VulnerabilityEntity[], patterns: VulnerabilityEntity[]): any[] {
    const recommendations = [];

    // Generate recommendations for critical vulnerabilities
    const criticalVulns = vulnerabilities.filter(v => v.severity >= 8);
    for (const vuln of criticalVulns) {
      recommendations.push({
        id: `REC-VULN-${vuln.id}`,
        title: `Fix ${vuln.name}`,
        description: vuln.remediation,
        priority: 'Critical',
        category: 'Security',
        effort: 'High',
        impact: 'Critical',
      });
    }

    // Generate recommendations for high-severity patterns
    const severePatterns = patterns.filter(p => p.severity >= 6);
    for (const pattern of severePatterns) {
      recommendations.push({
        id: `REC-PAT-${pattern.id}`,
        title: `Address ${pattern.name}`,
        description: pattern.remediation,
        priority: 'High',
        category: 'BestPractice',
        effort: 'Medium',
        impact: 'Medium',
      });
    }

    return recommendations;
  }

  /**
   * Evaluates compliance status
   */
  private async evaluateCompliance(scan: SecurityScanEntity): Promise<ComplianceStatus> {
    const criticalVulns = scan.vulnerabilities?.filter(v => v.severity >= 8).length || 0;
    const totalVulns = scan.vulnerabilities?.length || 0;
    
    const overallCompliant = criticalVulns === 0 && totalVulns < 5;
    const complianceScore = overallCompliant ? 95 : Math.max(60, 100 - (criticalVulns * 20) - (totalVulns * 5));

    return {
      overallCompliant,
      complianceScore,
      frameworkCompliance: {
        'ISO-27001': criticalVulns === 0,
        'SOC2': criticalVulns === 0 && totalVulns < 10,
        'PCI-DSS': criticalVulns === 0,
      },
      missingRequirements: [],
      complianceGaps: [],
    };
  }

  /**
   * Assesses risk level
   */
  private assessRisk(securityScore: number, vulnerabilities: VulnerabilityEntity[]): any {
    const criticalCount = vulnerabilities.filter(v => v.severity >= 8).length;
    const highCount = vulnerabilities.filter(v => v.severity >= 7 && v.severity < 8).length;
    
    const securityRiskScore = Math.min(100, (criticalCount * 25 + highCount * 15));
    const overallRiskScore = (securityRiskScore + (100 - securityScore)) / 2;
    
    let riskLevel = 'Low';
    if (overallRiskScore >= 80) riskLevel = 'Critical';
    else if (overallRiskScore >= 60) riskLevel = 'High';
    else if (overallRiskScore >= 30) riskLevel = 'Medium';

    return {
      overallRiskLevel: riskLevel,
      securityRiskScore,
      gasRiskScore: 30, // Simplified
      operationalRiskScore: 25, // Simplified
      riskFactors: [],
      mitigationStrategies: [
        'Implement comprehensive security testing',
        'Add access controls and validation',
        'Optimize gas usage patterns',
      ],
    };
  }

  /**
   * Gets default scan configuration
   */
  private getDefaultScanConfiguration(customConfig?: ScanConfiguration): ScanConfiguration {
    return {
      enableGasAnalysis: customConfig?.enableGasAnalysis ?? true,
      enablePatternMatching: customConfig?.enablePatternMatching ?? true,
      enableVulnerabilityDetection: customConfig?.enableVulnerabilityDetection ?? true,
      severityThreshold: customConfig?.severityThreshold ?? 5,
      customRules: customConfig?.customRules,
    };
  }

  /**
   * Estimates scan duration based on contract complexity
   */
  private estimateScanDuration(contract: ContractEntity): number {
    // Simple estimation based on contract size
    const baseTime = 30000; // 30 seconds base
    const sizeMultiplier = Math.max(1, contract.bytecodeSize / 10000);
    return Math.round(baseTime * sizeMultiplier);
  }

  /**
   * Calculates security trend from historical scans
   */
  private calculateSecurityTrend(scans: SecurityScanEntity[]): 'improving' | 'stable' | 'degrading' {
    if (scans.length < 2) return 'stable';
    
    const recentScans = scans.slice(-5).sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
    const scores = recentScans.map(scan => scan.securityScore);
    
    if (scores[scores.length - 1] > scores[0] + 5) return 'improving';
    if (scores[scores.length - 1] < scores[0] - 5) return 'degrading';
    return 'stable';
  }

  /**
   * Calculates risk level based on scores and vulnerabilities
   */
  private calculateRiskLevel(securityScore: number, criticalVulns: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (criticalVulns > 0 || securityScore < 50) return 'Critical';
    if (securityScore < 70) return 'High';
    if (securityScore < 85) return 'Medium';
    return 'Low';
  }

  // ==================== ADVANCED SECURITY FEATURES ====================

  /**
   * TimeLock Operations
   */
  async createTimeLockOperation(
    id: string,
    operationType: string,
    targetAddress: string,
    data: Buffer,
    executor: string,
    delay?: number,
    expiresAt?: number,
    priority?: number
  ): Promise<{ operationId: string; unlockTime: number }> {
    try {
      // Check access control
      const hasPermission = await this.accessControl.has_permission(executor, { ContractExecute: null });
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions for time lock operation');
      }

      // Log the attempt
      await this.securityAudit.log_event(
        { UserAction: null },
        { Medium: null },
        `Create time lock operation: ${id}`,
        executor,
        targetAddress,
        new Map([['operationType', operationType]]),
        true,
        null
      );

      const operationId = this.timeLock.create_time_lock(
        id,
        { Custom: operationType },
        targetAddress,
        Array.from(data),
        executor,
        delay ? { secs: delay, nanos: 0 } : undefined,
        expiresAt,
        priority || 1
      );

      const operation = this.timeLock.get_operation(&operationId);
      return {
        operationId,
        unlockTime: operation?.unlock_time || 0
      };
    } catch (error) {
      this.logger.error(`Failed to create time lock operation: ${error.message}`);
      throw error;
    }
  }

  async executeTimeLockOperation(operationId: string, executor: string): Promise<TimeLockOperation> {
    try {
      // Check access control
      const hasPermission = await this.accessControl.has_permission(executor, { ContractExecute: null });
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions to execute time lock operation');
      }

      const result = this.timeLock.execute_operation(&operationId, executor);

      // Log the execution
      await this.securityAudit.log_event(
        { UserAction: null },
        { High: null },
        `Execute time lock operation: ${operationId}`,
        executor,
        null,
        new Map([['operationId', operationId]]),
        true,
        null
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to execute time lock operation: ${error.message}`);
      throw error;
    }
  }

  getTimeLockStats(): TimeLockStats {
    return this.timeLock.get_stats();
  }

  /**
   * Emergency Pause Operations
   */
  async emergencyPause(
    reason: string,
    emergencyLevel: 'Low' | 'Medium' | 'High' | 'Critical',
    duration?: number,
    executor: string
  ): Promise<void> {
    try {
      // Check access control
      const hasPermission = await this.accessControl.has_permission(executor, { EmergencyPause: null });
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions for emergency pause');
      }

      const level = emergencyLevel === 'Low' ? { Low: null } :
                   emergencyLevel === 'Medium' ? { Medium: null } :
                   emergencyLevel === 'High' ? { High: null } :
                   { Critical: null };

      this.emergencyPause.emergency_pause(
        reason,
        level,
        duration,
        executor
      );

      // Log the emergency pause
      await this.securityAudit.log_event(
        { EmergencyAction: null },
        { Critical: null },
        `Emergency pause: ${reason}`,
        executor,
        null,
        new Map([
          ['reason', reason],
          ['level', emergencyLevel],
          ['duration', duration?.toString() || '']
        ]),
        true,
        null
      );

      this.logger.warn(`Emergency pause activated by ${executor}: ${reason}`);
    } catch (error) {
      this.logger.error(`Failed to execute emergency pause: ${error.message}`);
      throw error;
    }
  }

  async emergencyResume(executor: string): Promise<void> {
    try {
      // Check access control
      const hasPermission = await this.accessControl.has_permission(executor, { EmergencyResume: null });
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions for emergency resume');
      }

      this.emergencyPause.resume(executor);

      // Log the resume
      await this.securityAudit.log_event(
        { EmergencyAction: null },
        { High: null },
        'Emergency resume',
        executor,
        null,
        new Map([]),
        true,
        null
      );

      this.logger.info(`Emergency resumed by ${executor}`);
    } catch (error) {
      this.logger.error(`Failed to execute emergency resume: ${error.message}`);
      throw error;
    }
  }

  getEmergencyPauseStatus(): EmergencyPause {
    return this.emergencyPause.get_pause_state().clone();
  }

  /**
   * Access Control Operations
   */
  async createUser(userId: string, address: string, executor: string): Promise<void> {
    try {
      const hasPermission = await this.accessControl.has_permission(executor, { UserManagement: null });
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions for user management');
      }

      this.accessControl.create_user(userId, address, executor);

      await this.securityAudit.log_event(
        { UserAction: null },
        { Medium: null },
        `Create user: ${userId}`,
        executor,
        userId,
        new Map([['address', address]]),
        true,
        null
      );
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }

  async assignRoleToUser(userId: string, roleId: string, executor: string): Promise<void> {
    try {
      const hasPermission = await this.accessControl.has_permission(executor, { RoleManagement: null });
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions for role management');
      }

      this.accessControl.assign_role_to_user(userId, roleId, executor);

      await this.securityAudit.log_event(
        { AccessControl: null },
        { Medium: null },
        `Assign role ${roleId} to user ${userId}`,
        executor,
        userId,
        new Map([['roleId', roleId]]),
        true,
        null
      );
    } catch (error) {
      this.logger.error(`Failed to assign role to user: ${error.message}`);
      throw error;
    }
  }

  async createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
    try {
      const sessionToken = this.accessControl.create_session(userId, ipAddress, userAgent, undefined);

      await this.securityAudit.log_event(
        { UserAction: null },
        { Low: null },
        `Create session for user: ${userId}`,
        userId,
        null,
        new Map([
          ['ipAddress', ipAddress || ''],
          ['userAgent', userAgent || '']
        ]),
        true,
        null
      );

      return sessionToken;
    } catch (error) {
      this.logger.error(`Failed to create session: ${error.message}`);
      throw error;
    }
  }

  async checkAccess(sessionToken: string, permission: string, resource: string, ipAddress?: string): Promise<boolean> {
    try {
      const permissionEnum = this.mapPermissionString(permission);
      const hasAccess = this.accessControl.check_access(sessionToken, permissionEnum, resource, ipAddress);

      // Log access check
      await this.securityAudit.log_event(
        { AccessControl: null },
        { Low: null },
        `Access check for permission: ${permission}`,
        null,
        resource,
        new Map([
          ['permission', permission],
          ['granted', hasAccess.toString()]
        ]),
        true,
        null
      );

      return hasAccess;
    } catch (error) {
      this.logger.error(`Failed to check access: ${error.message}`);
      return false;
    }
  }

  private mapPermissionString(permission: string): any {
    const permissionMap: { [key: string]: any } = {
      'contract_deploy': { ContractDeploy: null },
      'contract_upgrade': { ContractUpgrade: null },
      'contract_pause': { ContractPause: null },
      'contract_execute': { ContractExecute: null },
      'transfer': { Transfer: null },
      'approve_transfer': { ApproveTransfer: null },
      'mint': { Mint: null },
      'burn': { Burn: null },
      'user_management': { UserManagement: null },
      'role_management': { RoleManagement: null },
      'permission_management': { PermissionManagement: null },
      'emergency_pause': { EmergencyPause: null },
      'emergency_resume': { EmergencyResume: null },
      'security_audit': { SecurityAudit: null },
      'vulnerability_report': { VulnerabilityReport: null },
      'system_config': { SystemConfig: null },
      'system_monitor': { SystemMonitor: null },
      'system_backup': { SystemBackup: null },
    };

    return permissionMap[permission] || { Custom: permission };
  }

  /**
   * Security Audit Operations
   */
  async generateAuditReport(
    filters: any,
    generatedBy: string
  ): Promise<AuditReport> {
    try {
      const auditFilter = {
        start_time: filters.startTime,
        end_time: filters.endTime,
        event_types: filters.eventTypes,
        severity_levels: filters.severityLevels,
        user_ids: filters.userIds,
        resources: filters.resources,
        success_only: filters.successOnly,
        ip_addresses: filters.ipAddresses,
        contract_addresses: filters.contractAddresses,
        limit: filters.limit,
        offset: filters.offset,
      };

      const report = this.securityAudit.generate_report(auditFilter, generatedBy);

      await this.securityAudit.log_event(
        { SecurityAudit: null },
        { Medium: null },
        'Generate audit report',
        generatedBy,
        null,
        new Map([
          ['reportId', report.id],
          ['totalEntries', report.total_entries.toString()]
        ]),
        true,
        null
      );

      return report;
    } catch (error) {
      this.logger.error(`Failed to generate audit report: ${error.message}`);
      throw error;
    }
  }

  getSecurityMetrics(): any {
    return this.securityAudit.get_metrics();
  }

  async exportAuditLog(filters: any, format: 'JSON' | 'CSV'): Promise<string> {
    try {
      const auditFilter = {
        start_time: filters.startTime,
        end_time: filters.endTime,
        event_types: filters.eventTypes,
        severity_levels: filters.severityLevels,
        user_ids: filters.userIds,
        resources: filters.resources,
        success_only: filters.successOnly,
        ip_addresses: filters.ipAddresses,
        contract_addresses: filters.contractAddresses,
        limit: filters.limit,
        offset: filters.offset,
      };

      const exportFormat = format === 'JSON' ? { JSON: null } : { CSV: null };
      return this.securityAudit.export_audit_log(auditFilter, exportFormat);
    } catch (error) {
      this.logger.error(`Failed to export audit log: ${error.message}`);
      throw error;
    }
  }

  /**
   * Multi-Signature Operations
   */
  async createMultiSigTransaction(
    destination: string,
    value: number,
    data: Buffer,
    transactionType: string,
    requiredSignatures?: number,
    expiresIn?: number,
    metadata?: { [key: string]: string },
    creator: string
  ): Promise<string> {
    try {
      const txType = transactionType === 'Transfer' ? { Transfer: null } :
                    transactionType === 'ContractCall' ? { ContractCall: null } :
                    transactionType === 'ContractDeployment' ? { ContractDeployment: null } :
                    transactionType === 'ParameterChange' ? { ParameterChange: null } :
                    transactionType === 'EmergencyAction' ? { EmergencyAction: null } :
                    { Custom: transactionType };

      const metadataMap = new Map(Object.entries(metadata || {}));

      const transactionId = this.multiSigSecurity.create_transaction(
        destination,
        BigInt(value),
        Array.from(data),
        txType,
        requiredSignatures,
        expiresIn,
        metadataMap,
        creator
      );

      await this.securityAudit.log_event(
        { UserAction: null },
        { High: null },
        `Create multi-sig transaction: ${transactionId}`,
        creator,
        destination,
        new Map([
          ['transactionId', transactionId],
          ['value', value.toString()],
          ['type', transactionType]
        ]),
        true,
        null
      );

      return transactionId;
    } catch (error) {
      this.logger.error(`Failed to create multi-sig transaction: ${error.message}`);
      throw error;
    }
  }

  async signMultiSigTransaction(
    transactionId: string,
    signer: string,
    signature: Buffer,
    messageHash: Buffer
  ): Promise<void> {
    try {
      this.multiSigSecurity.sign_transaction(
        transactionId,
        signer,
        Array.from(signature),
        Array.from(messageHash)
      );

      await this.securityAudit.log_event(
        { UserAction: null },
        { Medium: null },
        `Sign multi-sig transaction: ${transactionId}`,
        signer,
        null,
        new Map([['transactionId', transactionId]]),
        true,
        null
      );
    } catch (error) {
      this.logger.error(`Failed to sign multi-sig transaction: ${error.message}`);
      throw error;
    }
  }

  async executeMultiSigTransaction(transactionId: string, executor: string): Promise<MultiSigTransaction> {
    try {
      const result = this.multiSigSecurity.execute_transaction(transactionId, executor);

      await this.securityAudit.log_event(
        { UserAction: null },
        { High: null },
        `Execute multi-sig transaction: ${transactionId}`,
        executor,
        result.destination,
        new Map([
          ['transactionId', transactionId],
          ['value', result.value.toString()]
        ]),
        true,
        null
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to execute multi-sig transaction: ${error.message}`);
      throw error;
    }
  }

  getMultiSigStats(): any {
    return this.multiSigSecurity.get_stats();
  }

  /**
   * Integrated Security Operations
   */
  async performComprehensiveSecurityCheck(
    contractAddress: string,
    executor: string
  ): Promise<{
    securityScore: number;
    vulnerabilities: any[];
    recommendations: string[];
    auditTrail: any[];
    complianceStatus: any;
  }> {
    try {
      // Check if system is paused
      if (this.emergencyPause.is_paused()) {
        throw new BadRequestException('System is currently under emergency pause');
      }

      // Perform security scan
      const securityMetrics = await this.getSecurityMetrics(contractAddress);
      
      // Get audit trail
      const auditReport = await this.generateAuditReport(
        {
          contractAddresses: [contractAddress],
          limit: 100
        },
        executor
      );

      // Get compliance status
      const complianceStatus = await this.getComplianceStatus(contractAddress);

      // Generate comprehensive recommendations
      const recommendations = this.generateIntegratedRecommendations(
        securityMetrics,
        auditReport,
        complianceStatus
      );

      return {
        securityScore: securityMetrics.averageSecurityScore,
        vulnerabilities: [], // Would be populated from detailed scan
        recommendations,
        auditTrail: auditReport.entries,
        complianceStatus,
      };
    } catch (error) {
      this.logger.error(`Failed to perform comprehensive security check: ${error.message}`);
      throw error;
    }
  }

  private generateIntegratedRecommendations(
    securityMetrics: any,
    auditReport: any,
    complianceStatus: any
  ): string[] {
    const recommendations: string[] = [];

    // Security score based recommendations
    if (securityMetrics.averageSecurityScore < 70) {
      recommendations.push('Security score is below optimal levels - consider comprehensive security review');
    }

    // Audit based recommendations
    if (auditReport.summary.critical_events > 0) {
      recommendations.push('Critical security events detected - immediate investigation required');
    }

    // Compliance based recommendations
    if (!complianceStatus.overallCompliant) {
      recommendations.push('Compliance issues found - address missing requirements');
    }

    return recommendations;
  }
}
