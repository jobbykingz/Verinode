const ComplianceService = require('../services/complianceService');
const RegulatoryComplianceChecks = require('./regulatoryChecks');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ComplianceReportGenerator {
  constructor() {
    this.regulatoryChecks = new RegulatoryComplianceChecks();
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(reportConfig) {
    const {
      reportType,
      period,
      standards,
      scope,
      format = 'PDF',
      userId,
      userName
    } = reportConfig;

    try {
      // Generate base report data
      const baseReport = await ComplianceService.generateComplianceReport({
        reportType,
        period,
        scope,
        standards,
        userId,
        userName,
        format
      });

      // Add regulatory compliance checks
      const regulatoryResults = await this.runRegulatoryChecks(standards, scope);
      
      // Add detailed findings and metrics
      const detailedReport = await this.enhanceReport(baseReport, regulatoryResults, period);

      // Generate report in requested format
      const generatedReport = await this.generateFormattedReport(detailedReport, format);

      return {
        reportId: detailedReport.reportId,
        report: generatedReport,
        metadata: {
          generatedAt: new Date().toISOString(),
          format,
          size: generatedReport.length
        }
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Run regulatory compliance checks
   */
  async runRegulatoryChecks(standards, scope) {
    const results = {};

    for (const standard of standards) {
      try {
        const checkResult = await this.regulatoryChecks.runComplianceCheck(standard, scope);
        results[standard] = checkResult;
      } catch (error) {
        console.error(`Failed to run ${standard} compliance check:`, error);
        results[standard] = {
          regulation: standard,
          overallCompliance: 'CHECK_FAILED',
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * Enhance base report with detailed information
   */
  async enhanceReport(baseReport, regulatoryResults, period) {
    // Add regulatory findings
    const allFindings = [];
    const requirements = [];

    for (const [standard, result] of Object.entries(regulatoryResults)) {
      if (result.findings) {
        result.findings.forEach(finding => {
          allFindings.push({
            standard,
            requirementId: finding.requirementId,
            title: finding.title,
            status: finding.status,
            severity: this.getFindingSeverity(finding),
            description: finding.findings.map(f => f.description).join('; '),
            evidence: finding.evidence,
            recommendations: finding.recommendations
          });
        });
      }

      if (result.requirements) {
        result.requirements.forEach(req => {
          requirements.push({
            standard,
            requirementId: req.id,
            description: req.description,
            status: req.status,
            evidence: req.evidence,
            lastAssessed: new Date()
          });
        });
      }
    }

    // Update report with enhanced data
    const enhancedReport = {
      ...baseReport.toObject(),
      status: {
        ...baseReport.status,
        findings: allFindings,
        overall: this.calculateOverallCompliance(allFindings)
      },
      requirements: [
        ...(baseReport.requirements || []),
        ...requirements
      ],
      regulatoryResults,
      executiveSummary: await this.generateExecutiveSummary(allFindings, period),
      detailedAnalysis: await this.generateDetailedAnalysis(regulatoryResults, period)
    };

    return enhancedReport;
  }

  /**
   * Get finding severity
   */
  getFindingSeverity(finding) {
    const criticalFindings = finding.findings.filter(f => f.severity === 'CRITICAL');
    const highFindings = finding.findings.filter(f => f.severity === 'HIGH');
    
    if (criticalFindings.length > 0) return 'CRITICAL';
    if (highFindings.length > 0) return 'HIGH';
    if (finding.findings.some(f => f.severity === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate overall compliance status
   */
  calculateOverallCompliance(findings) {
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
    const highFindings = findings.filter(f => f.severity === 'HIGH');
    const openFindings = findings.filter(f => f.status !== 'COMPLIANT');

    if (criticalFindings.length > 0 || highFindings.length > 3) {
      return 'NON_COMPLIANT';
    } else if (openFindings.length > 0) {
      return 'PARTIALLY_COMPLIANT';
    } else {
      return 'COMPLIANT';
    }
  }

  /**
   * Generate executive summary
   */
  async generateExecutiveSummary(findings, period) {
    const totalFindings = findings.length;
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL').length;
    const highFindings = findings.filter(f => f.severity === 'HIGH').length;
    const openFindings = findings.filter(f => f.status !== 'COMPLIANT').length;

    const complianceRate = totalFindings > 0 ? 
      Math.round(((totalFindings - openFindings) / totalFindings) * 100) : 100;

    return {
      period: `${period.startDate} to ${period.endDate}`,
      complianceRate: `${complianceRate}%`,
      totalFindings,
      criticalFindings,
      highFindings,
      openFindings,
      riskLevel: this.calculateRiskLevel(criticalFindings, highFindings),
      keyRecommendations: this.extractKeyRecommendations(findings)
    };
  }

  /**
   * Calculate risk level
   */
  calculateRiskLevel(criticalFindings, highFindings) {
    if (criticalFindings > 0) return 'HIGH';
    if (highFindings > 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Extract key recommendations
   */
  extractKeyRecommendations(findings) {
    const recommendations = new Set();
    
    findings.forEach(finding => {
      if (finding.recommendations) {
        finding.recommendations.forEach(rec => recommendations.add(rec));
      }
    });

    return Array.from(recommendations).slice(0, 5); // Top 5 recommendations
  }

  /**
   * Generate detailed analysis
   */
  async generateDetailedAnalysis(regulatoryResults, period) {
    const analysis = {};

    for (const [standard, result] of Object.entries(regulatoryResults)) {
      analysis[standard] = {
        overallStatus: result.overallCompliance,
        compliantRequirements: result.compliantRequirements || 0,
        totalRequirements: result.totalRequirements || 0,
        complianceRate: result.totalRequirements > 0 ? 
          Math.round((result.compliantRequirements / result.totalRequirements) * 100) : 0,
        keyFindings: this.extractKeyFindings(result.findings || []),
        timeline: await this.generateComplianceTimeline(standard, period)
      };
    }

    return analysis;
  }

  /**
   * Extract key findings
   */
  extractKeyFindings(findings) {
    return findings
      .filter(f => f.status !== 'COMPLIANT')
      .slice(0, 10)
      .map(f => ({
        requirement: f.title,
        status: f.status,
        severity: f.severity,
        description: f.findings?.[0]?.description || 'No description available'
      }));
  }

  /**
   * Generate compliance timeline
   */
  async generateComplianceTimeline(standard, period) {
    // This would query historical compliance data
    // For now, returning placeholder data
    return [
      { date: period.startDate, status: 'ASSESSED', notes: 'Initial compliance assessment' },
      { date: new Date(period.startDate.getTime() + (period.endDate.getTime() - period.startDate.getTime()) / 2), 
        status: 'MONITORED', notes: 'Ongoing compliance monitoring' },
      { date: period.endDate, status: 'REASSESS', notes: 'Periodic reassessment scheduled' }
    ];
  }

  /**
   * Generate report in requested format
   */
  async generateFormattedReport(reportData, format) {
    switch (format.toUpperCase()) {
      case 'PDF':
        return await this.generatePDFReport(reportData);
      case 'JSON':
        return JSON.stringify(reportData, null, 2);
      case 'CSV':
        return await this.generateCSVReport(reportData);
      case 'HTML':
        return await this.generateHTMLReport(reportData);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Generate PDF report
   */
  async generatePDFReport(reportData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Title
        doc.fontSize(20).text('Compliance Report', { align: 'center' });
        doc.moveDown();

        // Executive Summary
        doc.fontSize(14).text('Executive Summary');
        doc.fontSize(10).text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`);
        doc.text(`Overall Compliance: ${reportData.status.overall}`);
        doc.text(`Compliance Rate: ${reportData.executiveSummary?.complianceRate || 'N/A'}`);
        doc.text(`Total Findings: ${reportData.executiveSummary?.totalFindings || 0}`);
        doc.moveDown();

        // Findings Summary
        doc.fontSize(14).text('Findings Summary');
        const findings = reportData.status.findings || [];
        findings.forEach((finding, index) => {
          doc.fontSize(10).text(`${index + 1}. ${finding.title} (${finding.severity})`);
          doc.text(`   Status: ${finding.status}`);
          doc.text(`   Description: ${finding.description.substring(0, 100)}...`);
          doc.moveDown();
        });

        // Regulatory Analysis
        doc.fontSize(14).text('Regulatory Analysis');
        Object.entries(reportData.detailedAnalysis || {}).forEach(([standard, analysis]) => {
          doc.fontSize(12).text(`${standard} Compliance`);
          doc.fontSize(10).text(`Status: ${analysis.overallStatus}`);
          doc.text(`Compliance Rate: ${analysis.complianceRate}%`);
          doc.moveDown();
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate CSV report
   */
  async generateCSVReport(reportData) {
    const findings = reportData.status.findings || [];
    
    const headers = [
      'Standard', 'Requirement', 'Status', 'Severity', 'Description', 'Recommendations'
    ];

    const rows = findings.map(finding => [
      finding.standard,
      finding.title,
      finding.status,
      finding.severity,
      `"${finding.description.replace(/"/g, '""')}"`,
      `"${(finding.recommendations || []).join('; ').replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(reportData) {
    const findings = reportData.status.findings || [];
    const analysis = reportData.detailedAnalysis || {};

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .finding { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
        .critical { border-left: 5px solid #dc3545; }
        .high { border-left: 5px solid #ffc107; }
        .medium { border-left: 5px solid #17a2b8; }
        .low { border-left: 5px solid #28a745; }
        .status-compliant { color: green; }
        .status-non_compliant { color: red; }
        .status-partially_compliant { color: orange; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Compliance Report</h1>
        <p>Period: ${reportData.period.startDate} to ${reportData.period.endDate}</p>
        <p>Overall Status: <span class="status-${reportData.status.overall.toLowerCase()}">${reportData.status.overall}</span></p>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <p>Compliance Rate: ${reportData.executiveSummary?.complianceRate || 'N/A'}</p>
        <p>Total Findings: ${reportData.executiveSummary?.totalFindings || 0}</p>
        <p>Critical Findings: ${reportData.executiveSummary?.criticalFindings || 0}</p>
    </div>

    <div class="section">
        <h2>Findings</h2>
        ${findings.map(finding => `
            <div class="finding ${finding.severity.toLowerCase()}">
                <h3>${finding.title} (${finding.standard})</h3>
                <p><strong>Status:</strong> ${finding.status}</p>
                <p><strong>Severity:</strong> ${finding.severity}</p>
                <p><strong>Description:</strong> ${finding.description}</p>
                ${finding.recommendations && finding.recommendations.length > 0 ? 
                  `<p><strong>Recommendations:</strong> ${finding.recommendations.join(', ')}</p>` : ''}
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Regulatory Analysis</h2>
        ${Object.entries(analysis).map(([standard, data]) => `
            <div>
                <h3>${standard}</h3>
                <p>Status: ${data.overallStatus}</p>
                <p>Compliance Rate: ${data.complianceRate}%</p>
            </div>
        `).join('')}
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Schedule automated report generation
   */
  async scheduleAutomatedReports(scheduleConfig) {
    // This would integrate with a job scheduler
    // For now, returning configuration
    return {
      scheduleId: `sched_${Date.now()}`,
      ...scheduleConfig,
      nextRun: this.calculateNextRun(scheduleConfig.frequency)
    };
  }

  /**
   * Calculate next run time
   */
  calculateNextRun(frequency) {
    const now = new Date();
    switch (frequency) {
      case 'DAILY':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'WEEKLY':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'MONTHLY':
        return new Date(now.setMonth(now.getMonth() + 1));
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }
}

module.exports = ComplianceReportGenerator;