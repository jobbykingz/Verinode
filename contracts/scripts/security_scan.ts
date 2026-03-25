#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { parse as parseArgs } from 'commander';

interface ScanConfig {
  enableGasAnalysis: boolean;
  enablePatternMatching: boolean;
  enableVulnerabilityDetection: boolean;
  severityThreshold: number;
  customRules?: string;
  outputPath?: string;
  format: 'json' | 'csv' | 'html';
  ciMode: boolean;
}

interface ScanResult {
  contractAddress: string;
  contractName: string;
  vulnerabilities: Vulnerability[];
  patterns: SecurityPattern[];
  gasAnalysis: GasAnalysis;
  securityScore: number;
  gasScore: number;
  scanDuration: number;
  timestamp: string;
}

interface Vulnerability {
  id: string;
  name: string;
  description: string;
  severity: number;
  lineNumber?: number;
  remediation: string;
  cweId?: string;
}

interface SecurityPattern {
  id: string;
  name: string;
  description: string;
  severity: number;
  patternType: string;
  remediation: string;
}

interface GasAnalysis {
  totalGasEstimate: number;
  highCostOperations: number;
  unoptimizedLoops: number;
  storageOperations: number;
  optimizationSuggestions: string[];
}

class SecurityScanner {
  private config: ScanConfig;

  constructor(config: ScanConfig) {
    this.config = config;
  }

  async scanContract(contractPath: string, contractName: string): Promise<ScanResult> {
    console.log(`🔍 Scanning contract: ${contractName}`);
    
    const startTime = Date.now();
    
    try {
      // Read contract source code
      const sourceCode = readFileSync(contractPath, 'utf8');
      
      // Compile contract to get bytecode
      const bytecode = await this.compileContract(contractPath);
      
      // Perform security analysis
      const vulnerabilities = this.config.enableVulnerabilityDetection 
        ? await this.detectVulnerabilities(sourceCode, bytecode)
        : [];
      
      const patterns = this.config.enablePatternMatching
        ? await this.matchSecurityPatterns(sourceCode, bytecode)
        : [];
      
      const gasAnalysis = this.config.enableGasAnalysis
        ? await this.analyzeGasUsage(sourceCode, bytecode)
        : this.getDefaultGasAnalysis();
      
      // Calculate scores
      const securityScore = this.calculateSecurityScore(vulnerabilities, patterns);
      const gasScore = this.calculateGasScore(gasAnalysis);
      
      const scanDuration = Date.now() - startTime;
      
      const result: ScanResult = {
        contractAddress: this.generateContractAddress(bytecode),
        contractName,
        vulnerabilities,
        patterns,
        gasAnalysis,
        securityScore,
        gasScore,
        scanDuration,
        timestamp: new Date().toISOString(),
      };
      
      console.log(`✅ Scan completed for ${contractName} in ${scanDuration}ms`);
      console.log(`📊 Security Score: ${securityScore}/100, Gas Score: ${gasScore}/100`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to scan ${contractName}:`, error);
      throw error;
    }
  }

  async scanMultipleContracts(contractPaths: string[]): Promise<ScanResult[]> {
    console.log(`🔍 Scanning ${contractPaths.length} contracts...`);
    
    const results: ScanResult[] = [];
    
    for (const contractPath of contractPaths) {
      try {
        const contractName = this.extractContractName(contractPath);
        const result = await this.scanContract(contractPath, contractName);
        results.push(result);
        
        // CI mode: fail fast on critical vulnerabilities
        if (this.config.ciMode && this.hasCriticalVulnerabilities(result)) {
          console.error(`🚨 Critical vulnerabilities found in ${contractName}`);
          throw new Error(`CI/CD pipeline failed: Critical security issues in ${contractName}`);
        }
        
      } catch (error) {
        if (this.config.ciMode) {
          throw error;
        } else {
          console.warn(`⚠️  Skipping ${contractPath} due to error:`, error);
        }
      }
    }
    
    return results;
  }

  private async compileContract(contractPath: string): Promise<string> {
    try {
      console.log(`🔨 Compiling ${contractPath}...`);
      
      // Use soroban CLI to compile the contract
      const output = execSync(`soroban contract build ${dirname(contractPath)}`, {
        encoding: 'utf8',
        cwd: dirname(contractPath),
      });
      
      // Find the compiled WASM file
      const wasmPath = join(dirname(contractPath), 'target', 'wasm32-unknown-unknown', 'release', 
        `${this.extractContractName(contractPath)}.wasm`);
      
      if (!existsSync(wasmPath)) {
        throw new Error(`Compiled WASM file not found at ${wasmPath}`);
      }
      
      return readFileSync(wasmPath, 'base64');
      
    } catch (error) {
      console.error(`❌ Compilation failed for ${contractPath}:`, error);
      throw error;
    }
  }

  private async detectVulnerabilities(sourceCode: string, bytecode: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    // Reentrancy detection
    if (this.hasReentrancyPattern(sourceCode)) {
      vulnerabilities.push({
        id: 'REENT-001',
        name: 'Reentrancy Vulnerability',
        description: 'External call followed by state change creates reentrancy risk',
        severity: 8,
        remediation: 'Use checks-effects-interactions pattern. Implement reentrancy guards.',
        cweId: 'CWE-841',
      });
    }
    
    // Integer overflow detection
    if (this.hasOverflowPattern(sourceCode)) {
      vulnerabilities.push({
        id: 'OVERFLOW-001',
        name: 'Integer Overflow/Underflow',
        description: 'Arithmetic operation without overflow protection',
        severity: 7,
        remediation: 'Use SafeMath or built-in overflow protection in Soroban',
        cweId: 'CWE-190',
      });
    }
    
    // Access control issues
    if (this.hasAccessControlIssue(sourceCode)) {
      vulnerabilities.push({
        id: 'ACCESS-001',
        name: 'Missing Access Control',
        description: 'Sensitive function lacks proper access control',
        severity: 9,
        remediation: 'Implement proper access control mechanisms',
        cweId: 'CWE-862',
      });
    }
    
    // Unchecked external calls
    if (this.hasUncheckedCall(sourceCode)) {
      vulnerabilities.push({
        id: 'UNCHECKED-001',
        name: 'Unchecked External Call',
        description: 'External call return value not checked',
        severity: 6,
        remediation: 'Always check return values of external calls',
        cweId: 'CWE-252',
      });
    }
    
    // Timestamp dependency
    if (this.hasTimestampDependency(sourceCode)) {
      vulnerabilities.push({
        id: 'TIME-001',
        name: 'Timestamp Dependency',
        description: 'Critical logic depends on block timestamp',
        severity: 5,
        remediation: 'Avoid timestamp dependencies or use large time windows',
        cweId: 'CWE-839',
      });
    }
    
    return vulnerabilities.filter(v => v.severity >= this.config.severityThreshold);
  }

  private async matchSecurityPatterns(sourceCode: string, bytecode: string): Promise<SecurityPattern[]> {
    const patterns: SecurityPattern[] = [];
    
    // Magic numbers
    if (this.hasMagicNumbers(sourceCode)) {
      patterns.push({
        id: 'ANTI-001',
        name: 'Magic Numbers',
        description: 'Using magic numbers instead of constants',
        severity: 3,
        patternType: 'AntiPattern',
        remediation: 'Define constants for magic numbers',
      });
    }
    
    // Complex functions
    if (this.hasComplexFunctions(sourceCode)) {
      patterns.push({
        id: 'ANTI-002',
        name: 'Complex Function',
        description: 'Function is too complex and hard to audit',
        severity: 4,
        patternType: 'AntiPattern',
        remediation: 'Break down complex functions into smaller ones',
      });
    }
    
    // Gas inefficiencies
    if (this.hasGasInefficiencies(sourceCode)) {
      patterns.push({
        id: 'GAS-001',
        name: 'Gas Inefficiency',
        description: 'Code could be optimized for better gas efficiency',
        severity: 5,
        patternType: 'GasInefficiency',
        remediation: 'Optimize loops and storage operations',
      });
    }
    
    // Missing documentation
    if (this.hasMissingDocumentation(sourceCode)) {
      patterns.push({
        id: 'BP-001',
        name: 'Missing Documentation',
        description: 'Functions lack proper documentation',
        severity: 2,
        patternType: 'BestPracticeViolation',
        remediation: 'Add comprehensive documentation',
      });
    }
    
    return patterns.filter(p => p.severity >= this.config.severityThreshold);
  }

  private async analyzeGasUsage(sourceCode: string, bytecode: string): Promise<GasAnalysis> {
    const analysis: GasAnalysis = {
      totalGasEstimate: this.estimateGasUsage(sourceCode),
      highCostOperations: this.countHighCostOperations(sourceCode),
      unoptimizedLoops: this.countUnoptimizedLoops(sourceCode),
      storageOperations: this.countStorageOperations(sourceCode),
      optimizationSuggestions: this.generateOptimizationSuggestions(sourceCode),
    };
    
    return analysis;
  }

  private calculateSecurityScore(vulnerabilities: Vulnerability[], patterns: SecurityPattern[]): number {
    let score = 100;
    
    // Deduct points for vulnerabilities based on severity
    for (const vuln of vulnerabilities) {
      score -= vuln.severity * 5;
    }
    
    // Deduct points for patterns based on severity
    for (const pattern of patterns) {
      score -= pattern.severity * 3;
    }
    
    return Math.max(0, score);
  }

  private calculateGasScore(gasAnalysis: GasAnalysis): number {
    let score = 100;
    
    if (gasAnalysis.highCostOperations > 0) score -= 10;
    if (gasAnalysis.unoptimizedLoops > 0) score -= 15;
    if (gasAnalysis.storageOperations > 100) score -= 20;
    
    return Math.max(0, score);
  }

  private hasCriticalVulnerabilities(result: ScanResult): boolean {
    return result.vulnerabilities.some(v => v.severity >= 8) || result.securityScore < 50;
  }

  // Pattern detection methods
  private hasReentrancyPattern(sourceCode: string): boolean {
    const reentrancyPatterns = [
      /call\([^)]*\)\s*;/,
      /send\([^)]*\)\s*;/,
      /transfer\([^)]*\)\s*;/,
      /delegatecall\([^)]*\)\s*;/,
    ];
    
    return reentrancyPatterns.some(pattern => pattern.test(sourceCode)) &&
           this.hasStateChangeAfterCall(sourceCode);
  }

  private hasOverflowPattern(sourceCode: string): boolean {
    const arithmeticOps = [
      /\+\s*[a-zA-Z_][a-zA-Z0-9_]*/,
      /-\s*[a-zA-Z_][a-zA-Z0-9_]*/,
      /\*\s*[a-zA-Z_][a-zA-Z0-9_]*/,
    ];
    
    return arithmeticOps.some(op => op.test(sourceCode)) &&
           !sourceCode.includes('safe') && !sourceCode.includes('overflow');
  }

  private hasAccessControlIssue(sourceCode: string): boolean {
    const sensitiveOps = [
      'owner', 'admin', 'mint', 'burn', 'transfer_ownership', 'pause', 'unpause'
    ];
    
    return sensitiveOps.some(op => sourceCode.includes(op)) &&
           !sourceCode.includes('require') && !sourceCode.includes('only');
  }

  private hasUncheckedCall(sourceCode: string): boolean {
    return /call\(/.test(sourceCode) && !/try\s+/.test(sourceCode);
  }

  private hasTimestampDependency(sourceCode: string): boolean {
    return /timestamp/.test(sourceCode) && /require/.test(sourceCode);
  }

  private hasStateChangeAfterCall(sourceCode: string): boolean {
    // Simplified check - in reality would need AST analysis
    return /call\([^)]*\)[^;]*;/.test(sourceCode) &&
           (/sto/.test(sourceCode) || /set/.test(sourceCode) || /inc/.test(sourceCode));
  }

  private hasMagicNumbers(sourceCode: string): boolean {
    const magicNumberPattern = /\b(123|456|789|999|1000)\b/;
    return magicNumberPattern.test(sourceCode);
  }

  private hasComplexFunctions(sourceCode: string): boolean {
    const complexityIndicators = ['if', 'for', 'while', 'switch'];
    let complexityScore = 0;
    
    for (const indicator of complexityIndicators) {
      const matches = sourceCode.match(new RegExp(indicator, 'g'));
      if (matches) complexityScore += matches.length;
    }
    
    return complexityScore > 10;
  }

  private hasGasInefficiencies(sourceCode: string): boolean {
    return (/for\s*\(/.test(sourceCode) || /while\s*\(/.test(sourceCode)) &&
           /sto/.test(sourceCode);
  }

  private hasMissingDocumentation(sourceCode: string): boolean {
    return /function/.test(sourceCode) &&
           !/\/\*\*/.test(sourceCode) &&
           !/\/\/\//.test(sourceCode);
  }

  private estimateGasUsage(sourceCode: string): number {
    // Simplified gas estimation
    let gas = 21000; // Base transaction cost
    
    // Add costs for different operations
    gas += (sourceCode.match(/sto/g) || []).length * 20000; // Storage operations
    gas += (sourceCode.match(/call\(/g) || []).length * 700;  // External calls
    gas += (sourceCode.match(/for\s*\(/g) || []).length * 3000; // Loops
    
    return gas;
  }

  private countHighCostOperations(sourceCode: string): number {
    const highCostOps = ['ecrecover', 'sha256', 'keccak256'];
    return highCostOps.reduce((count, op) => 
      count + (sourceCode.match(new RegExp(op, 'g')) || []).length, 0);
  }

  private countUnoptimizedLoops(sourceCode: string): number {
    return (sourceCode.match(/for\s*\(/g) || []).length +
           (sourceCode.match(/while\s*\(/g) || []).length;
  }

  private countStorageOperations(sourceCode: string): number {
    return (sourceCode.match(/sto/g) || []).length;
  }

  private generateOptimizationSuggestions(sourceCode: string): string[] {
    const suggestions: string[] = [];
    
    if (this.countStorageOperations(sourceCode) > 50) {
      suggestions.push('Consider reducing storage operations');
    }
    
    if (this.countUnoptimizedLoops(sourceCode) > 0) {
      suggestions.push('Optimize loops and avoid storage operations inside');
    }
    
    if (this.countHighCostOperations(sourceCode) > 0) {
      suggestions.push('Consider caching results of expensive operations');
    }
    
    return suggestions;
  }

  private getDefaultGasAnalysis(): GasAnalysis {
    return {
      totalGasEstimate: 0,
      highCostOperations: 0,
      unoptimizedLoops: 0,
      storageOperations: 0,
      optimizationSuggestions: [],
    };
  }

  private generateContractAddress(bytecode: string): string {
    // Generate a mock contract address from bytecode
    const hash = require('crypto').createHash('sha256').update(bytecode).digest('hex');
    return `0x${hash.slice(0, 40)}`;
  }

  private extractContractName(contractPath: string): string {
    const basename = contractPath.split('/').pop() || contractPath;
    return basename.replace(/\.(rs|sol)$/, '');
  }

  // Output methods
  generateReport(results: ScanResult[]): void {
    const outputPath = this.config.outputPath || 'security_report';
    
    switch (this.config.format) {
      case 'json':
        this.generateJsonReport(results, `${outputPath}.json`);
        break;
      case 'csv':
        this.generateCsvReport(results, `${outputPath}.csv`);
        break;
      case 'html':
        this.generateHtmlReport(results, `${outputPath}.html`);
        break;
    }
    
    this.printSummary(results);
  }

  private generateJsonReport(results: ScanResult[], outputPath: string): void {
    const report = {
      scanDate: new Date().toISOString(),
      config: this.config,
      summary: this.generateSummary(results),
      contracts: results,
    };
    
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 JSON report generated: ${outputPath}`);
  }

  private generateCsvReport(results: ScanResult[], outputPath: string): void {
    const header = 'Contract Name,Security Score,Gas Score,Vulnerabilities,Patterns,Scan Duration\n';
    const rows = results.map(r => 
      `${r.contractName},${r.securityScore},${r.gasScore},${r.vulnerabilities.length},${r.patterns.length},${r.scanDuration}`
    ).join('\n');
    
    writeFileSync(outputPath, header + rows);
    console.log(`📄 CSV report generated: ${outputPath}`);
  }

  private generateHtmlReport(results: ScanResult[], outputPath: string): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .contract { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .high-risk { border-left: 5px solid #d32f2f; }
        .medium-risk { border-left: 5px solid #f57c00; }
        .low-risk { border-left: 5px solid #388e3c; }
        .score { font-size: 24px; font-weight: bold; }
        .vulnerability { background: #ffebee; padding: 10px; margin: 5px 0; border-radius: 3px; }
        .pattern { background: #fff3e0; padding: 10px; margin: 5px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🔒 Security Scan Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Scan Date: ${new Date().toISOString()}</p>
        <p>Total Contracts: ${results.length}</p>
        <p>Average Security Score: ${this.calculateAverageScore(results, 'security')}/100</p>
        <p>Average Gas Score: ${this.calculateAverageScore(results, 'gas')}/100</p>
    </div>
    
    ${results.map(result => this.generateContractHtml(result)).join('')}
</body>
</html>`;
    
    writeFileSync(outputPath, html);
    console.log(`📄 HTML report generated: ${outputPath}`);
  }

  private generateContractHtml(result: ScanResult): string {
    const riskClass = result.securityScore < 50 ? 'high-risk' : 
                     result.securityScore < 75 ? 'medium-risk' : 'low-risk';
    
    return `
    <div class="contract ${riskClass}">
        <h3>${result.contractName}</h3>
        <div class="score">Security: ${result.securityScore}/100 | Gas: ${result.gasScore}/100</div>
        <p><strong>Address:</strong> ${result.contractAddress}</p>
        <p><strong>Scan Duration:</strong> ${result.scanDuration}ms</p>
        
        ${result.vulnerabilities.length > 0 ? `
        <h4>🚨 Vulnerabilities (${result.vulnerabilities.length})</h4>
        ${result.vulnerabilities.map(v => `
            <div class="vulnerability">
                <strong>${v.name}</strong> (Severity: ${v.severity}/10)<br>
                ${v.description}<br>
                <em>Remediation: ${v.remediation}</em>
            </div>
        `).join('')}
        ` : '<p>✅ No vulnerabilities detected</p>'}
        
        ${result.patterns.length > 0 ? `
        <h4>⚠️  Security Patterns (${result.patterns.length})</h4>
        ${result.patterns.map(p => `
            <div class="pattern">
                <strong>${p.name}</strong> (${p.patternType})<br>
                ${p.description}<br>
                <em>Remediation: ${p.remediation}</em>
            </div>
        `).join('')}
        ` : ''}
    </div>`;
  }

  private generateSummary(results: ScanResult[]) {
    const totalVulnerabilities = results.reduce((sum, r) => sum + r.vulnerabilities.length, 0);
    const totalPatterns = results.reduce((sum, r) => sum + r.patterns.length, 0);
    const criticalIssues = results.reduce((sum, r) => 
      sum + r.vulnerabilities.filter(v => v.severity >= 8).length, 0);
    
    return {
      totalContracts: results.length,
      totalVulnerabilities,
      totalPatterns,
      criticalIssues,
      averageSecurityScore: this.calculateAverageScore(results, 'security'),
      averageGasScore: this.calculateAverageScore(results, 'gas'),
    };
  }

  private calculateAverageScore(results: ScanResult[], type: 'security' | 'gas'): number {
    const scores = results.map(r => type === 'security' ? r.securityScore : r.gasScore);
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  private printSummary(results: ScanResult[]): void {
    console.log('\n📊 Scan Summary:');
    console.log('='.repeat(50));
    
    const summary = this.generateSummary(results);
    
    console.log(`Total Contracts: ${summary.totalContracts}`);
    console.log(`Total Vulnerabilities: ${summary.totalVulnerabilities}`);
    console.log(`Total Patterns: ${summary.totalPatterns}`);
    console.log(`Critical Issues: ${summary.criticalIssues}`);
    console.log(`Average Security Score: ${summary.averageSecurityScore}/100`);
    console.log(`Average Gas Score: ${summary.averageGasScore}/100`);
    
    if (summary.criticalIssues > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND - IMMEDIATE ATTENTION REQUIRED');
    } else if (summary.totalVulnerabilities > 0) {
      console.log('\n⚠️  Vulnerabilities detected - Review recommended');
    } else {
      console.log('\n✅ All contracts passed security checks');
    }
    
    console.log('='.repeat(50));
  }
}

// CLI interface
const program = parseArgs();
program
  .name('security-scan')
  .description('Security scanner for Soroban smart contracts')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan contracts for security vulnerabilities')
  .argument('<paths...>', 'Contract file paths to scan')
  .option('-g, --gas-analysis', 'Enable gas analysis', true)
  .option('-p, --pattern-matching', 'Enable pattern matching', true)
  .option('-v, --vulnerability-detection', 'Enable vulnerability detection', true)
  .option('-s, --severity-threshold <number>', 'Minimum severity threshold (0-10)', '5')
  .option('-f, --format <format>', 'Output format (json|csv|html)', 'json')
  .option('-o, --output <path>', 'Output file path')
  .option('--ci', 'CI/CD mode (fail on critical issues)', false)
  .action(async (paths: string[], options) => {
    const config: ScanConfig = {
      enableGasAnalysis: options.gasAnalysis,
      enablePatternMatching: options.patternMatching,
      enableVulnerabilityDetection: options.vulnerabilityDetection,
      severityThreshold: parseInt(options.severityThreshold),
      format: options.format,
      outputPath: options.output,
      ciMode: options.ci,
    };
    
    try {
      const scanner = new SecurityScanner(config);
      const results = await scanner.scanMultipleContracts(paths);
      scanner.generateReport(results);
      
      if (config.ciMode) {
        const criticalIssues = results.reduce((sum, r) => 
          sum + r.vulnerabilities.filter(v => v.severity >= 8).length, 0);
        
        if (criticalIssues > 0) {
          process.exit(1); // Fail CI/CD pipeline
        }
      }
      
    } catch (error) {
      console.error('❌ Scan failed:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize security scanner configuration')
  .option('-d, --directory <path>', 'Directory to initialize', '.')
  .action((options) => {
    const configDir = join(options.directory, '.security');
    
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    
    const defaultConfig = {
      enableGasAnalysis: true,
      enablePatternMatching: true,
      enableVulnerabilityDetection: true,
      severityThreshold: 5,
      format: 'json',
      ciMode: false,
    };
    
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify(defaultConfig, null, 2)
    );
    
    console.log('✅ Security scanner initialized in', configDir);
  });

// Run CLI if called directly
if (require.main === module) {
  program.parse();
}

export { SecurityScanner, ScanConfig, ScanResult };
