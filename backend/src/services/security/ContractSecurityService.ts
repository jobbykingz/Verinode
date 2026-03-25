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

@Injectable()
export class ContractSecurityService {
  private readonly logger = new Logger(ContractSecurityService.name);
  private readonly scanQueue: Map<string, SecurityScanRequest> = new Map();
  private readonly activeScans: Map<string, boolean> = new Map();

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
  ) {}

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
}
