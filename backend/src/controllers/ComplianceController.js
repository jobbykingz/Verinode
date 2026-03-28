const { body, param, query } = require('express-validator');
const GDPRDataSubjectHandler = require('../services/compliance/GDPRHandler');
const KYCAMLService = require('../services/compliance/KYCAMLService');
const DataResidencyController = require('../services/compliance/DataResidencyController');
const ComplianceAnalyticsService = require('../services/compliance/ComplianceAnalyticsService');

class ComplianceController {
  constructor() {
    this.gdprHandler = new GDPRDataSubjectHandler();
    this.kycAmlService = new KYCAMLService();
    this.residencyController = new DataResidencyController();
    this.analyticsService = new ComplianceAnalyticsService();
  }

  /**
   * Create a GDPR data subject request
   */
  async createDataSubjectRequest(req, res) {
    try {
      const { requestType, requestData } = req.body;
      const userId = req.user.id;

      const request = await this.gdprHandler.createDataSubjectRequest(
        userId,
        requestType,
        requestData
      );

      res.status(201).json({
        success: true,
        data: request,
        message: 'Data subject request created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get status of a data subject request
   */
  async getDataSubjectRequestStatus(req, res) {
    try {
      const { requestId } = req.params;
      const userId = req.user.id;

      const status = await this.gdprHandler.getRequestStatus(requestId, userId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Initiate KYC verification process
   */
  async initiateKYC(req, res) {
    try {
      const { level = 'BASIC', provider = 'ONFIDO' } = req.body;
      const userId = req.user.id;

      const kycSession = await this.kycAmlService.initiateKYC(userId, level, provider);

      res.status(201).json({
        success: true,
        data: kycSession,
        message: 'KYC verification initiated'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get KYC status for current user
   */
  async getKYCStatus(req, res) {
    try {
      const userId = req.user.id;

      const status = await this.kycAmlService.getKYCStatus(userId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Submit KYC documents
   */
  async submitKYCDocuments(req, res) {
    try {
      const { documentType, documentImages } = req.body;
      const userId = req.user.id;

      const result = await this.kycAmlService.verifyIdentityDocument(
        userId,
        documentType,
        documentImages
      );

      res.json({
        success: true,
        data: result,
        message: 'Documents submitted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Perform AML screening
   */
  async performAMLScreening(req, res) {
    try {
      const { personalData } = req.body;
      const userId = req.user.id;

      const result = await this.kycAmlService.performAMLScreening(
        userId,
        personalData
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get data residency information
   */
  async getDataResidencyInfo(req, res) {
    try {
      const userId = req.user.id;

      const residencyInfo = await this.residencyController.getUserResidencyInfo(userId);

      res.json({
        success: true,
        data: residencyInfo
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Request data migration for residency compliance
   */
  async requestDataMigration(req, res) {
    try {
      const { targetRegion } = req.body;
      const userId = req.user.id;

      const migrationPlan = await this.residencyController.migrateDataForCompliance(
        userId,
        targetRegion
      );

      res.json({
        success: true,
        data: migrationPlan,
        message: 'Migration plan generated. Review and confirm to proceed.'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get compliance dashboard data
   */
  async getComplianceDashboard(req, res) {
    try {
      const { timeRange = '24h', includeDetails = false } = req.query;

      const dashboard = await this.analyticsService.getComplianceDashboard({
        timeRange,
        includeDetails
      });

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(req, res) {
    try {
      const { reportType, period, scope = 'ALL' } = req.body;
      const userId = req.user.id;

      const report = await this.analyticsService.generateComplianceReport(
        reportType,
        period,
        scope
      );

      res.status(201).json({
        success: true,
        data: report,
        message: 'Compliance report generated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Export compliance data
   */
  async exportComplianceData(req, res) {
    try {
      const { format = 'JSON', period, options = {} } = req.body;

      const exportData = await this.analyticsService.exportComplianceData(
        format,
        period,
        options
      );

      res.json({
        success: true,
        data: exportData,
        message: 'Export prepared successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Record user consent
   */
  async recordConsent(req, res) {
    try {
      const { purpose, explicit = false, expirationDate } = req.body;
      const userId = req.user.id;
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const consent = await this.gdprHandler.recordConsent(userId, purpose, {
        explicit,
        expirationDate,
        ipAddress,
        userAgent
      });

      res.status(201).json({
        success: true,
        data: consent,
        message: 'Consent recorded successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Withdraw user consent
   */
  async withdrawConsent(req, res) {
    try {
      const { purpose } = req.params;
      const userId = req.user.id;

      const result = await this.gdprHandler.withdrawConsent(userId, purpose);

      res.json({
        success: true,
        data: result,
        message: 'Consent withdrawn successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get consent status
   */
  async getConsentStatus(req, res) {
    try {
      const { purpose } = req.params;
      const userId = req.user.id;

      const status = await this.gdprHandler.verifyConsent(userId, purpose);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Monitor real-time compliance alerts
   */
  async monitorComplianceAlerts(req, res) {
    try {
      const alerts = await this.analyticsService.monitorComplianceRealTime();

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get compliance KPIs
   */
  async getComplianceKPIs(req, res) {
    try {
      const kpis = await this.analyticsService.trackComplianceKPIs();

      res.json({
        success: true,
        data: kpis
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Prepare regulatory filing
   */
  async prepareRegulatoryFiling(req, res) {
    try {
      const { regulation, period } = req.body;

      const filing = await this.analyticsService.prepareRegulatoryFiling(
        regulation,
        period
      );

      res.status(201).json({
        success: true,
        data: filing,
        message: 'Regulatory filing prepared successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = ComplianceController;
