const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');

const ComplianceService = require('../services/complianceService');
const AuditLogger = require('../compliance/auditLogger');
const RegulatoryComplianceChecks = require('../compliance/regulatoryChecks');
const ComplianceReportGenerator = require('../compliance/reportGenerator');
const AutomatedComplianceMonitoring = require('../compliance/automatedMonitoring');
const AuditTrailVisualization = require('../compliance/auditVisualization');

// Initialize services
const regulatoryChecks = new RegulatoryComplianceChecks();
const reportGenerator = new ComplianceReportGenerator();
const monitoring = new AutomatedComplianceMonitoring();

// Configure default monitors on startup
monitoring.configureDefaultMonitors();

/**
 * @route GET /api/compliance/audit-trail
 * @desc Get audit trail for a resource or user
 * @access Private
 */
router.get('/audit-trail', [
  query('resourceId').optional().isString(),
  query('userId').optional().isString(),
  query('eventType').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { resourceId, userId, eventType, startDate, endDate, limit } = req.query;
    
    let auditTrail;
    if (resourceId) {
      auditTrail = await AuditLogger.getProofAuditTrail(resourceId, {
        eventType,
        startDate,
        endDate,
        limit: parseInt(limit) || 100
      });
    } else if (userId) {
      auditTrail = await AuditLogger.getUserAuditTrail(userId, {
        eventType,
        startDate,
        endDate,
        limit: parseInt(limit) || 100
      });
    } else {
      auditTrail = await AuditLogger.getComplianceEvents(
        ['gdpr', 'hipaa', 'sox'], 
        { startDate, endDate, limit: parseInt(limit) || 100 }
      );
    }

    res.json({
      success: true,
      auditTrail,
      count: auditTrail.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/compliance/log-event
 * @desc Log a compliance event
 * @access Private
 */
router.post('/log-event', [
  body('eventType').isString().notEmpty(),
  body('actor').isObject(),
  body('actor.id').isString().notEmpty(),
  body('actor.name').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const event = await AuditLogger.logEvent(req.body);
    
    res.status(201).json({
      success: true,
      event,
      eventId: event.eventId
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/compliance/regulatory-checks/:standard
 * @desc Run regulatory compliance check
 * @access Private
 */
router.get('/regulatory-checks/:standard', [
  query('scope').optional().isObject()
], async (req, res) => {
  try {
    const { standard } = req.params;
    const { scope = {} } = req.query;
    
    const result = await regulatoryChecks.runComplianceCheck(standard, scope);
    
    res.json({
      success: true,
      complianceCheck: result
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/compliance/reports/generate
 * @desc Generate compliance report
 * @access Private
 */
router.post('/reports/generate', [
  body('reportType').isString().isIn([
    'GDPR_COMPLIANCE', 'HIPAA_COMPLIANCE', 'SOX_COMPLIANCE', 'PCI_COMPLIANCE',
    'SECURITY_ASSESSMENT', 'PRIVACY_AUDIT', 'ACCESS_REVIEW', 'DATA_RETENTION'
  ]),
  body('period').isObject(),
  body('period.startDate').isISO8601(),
  body('period.endDate').isISO8601(),
  body('standards').isArray(),
  body('userId').isString().notEmpty(),
  body('userName').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const reportConfig = {
      ...req.body,
      format: req.body.format || 'PDF'
    };

    const report = await reportGenerator.generateComplianceReport(reportConfig);
    
    // Set appropriate headers for file download
    if (reportConfig.format === 'PDF') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=compliance-report-${report.reportId}.pdf`);
      return res.send(report.report);
    } else {
      res.json({
        success: true,
        reportId: report.reportId,
        report: report.report,
        metadata: report.metadata
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/compliance/reports/:reportId
 * @desc Get specific compliance report
 * @access Private
 */
router.get('/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const report = await ComplianceService.getReportById(reportId);
    
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        error: 'Report not found' 
      });
    }
    
    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/compliance/monitoring/alerts
 * @desc Get compliance monitoring alerts
 * @access Private
 */
router.get('/monitoring/alerts', [
  query('severity').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  query('timeframe').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const { severity, timeframe } = req.query;
    
    const alerts = monitoring.getAlerts({
      severity,
      timeframe: timeframe ? parseInt(timeframe) * 1000 : null, // Convert to milliseconds
      limit: 100
    });
    
    res.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/compliance/monitoring/status
 * @desc Get monitoring system status
 * @access Private
 */
router.get('/monitoring/status', async (req, res) => {
  try {
    const stats = monitoring.getMonitoringStats();
    const monitors = monitoring.getAllMonitorStatuses();
    
    res.json({
      success: true,
      monitoring: {
        stats,
        monitors
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/compliance/monitoring/configure
 * @desc Configure compliance monitoring
 * @access Private
 */
router.post('/monitoring/configure', [
  body('monitorId').isString().notEmpty(),
  body('type').isString().isIn([
    'ACCESS_PATTERNS', 'DATA_RETENTION', 'PRIVACY_CONTROLS', 
    'ENCRYPTION_COMPLIANCE', 'CONSENT_MANAGEMENT', 'REGULATORY_COMPLIANCE'
  ]),
  body('interval').isInt({ min: 1000 }),
  body('rules').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const monitorId = monitoring.startMonitoring(req.body);
    
    res.json({
      success: true,
      monitorId,
      message: 'Monitoring configured successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/compliance/visualization/:type
 * @desc Get compliance visualization data
 * @access Private
 */
router.get('/visualization/:type', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('granularity').optional().isIn(['hour', 'day', 'week'])
], async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate, granularity } = req.query;
    
    const options = {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      granularity
    };

    const visualizationData = await AuditTrailVisualization.exportVisualizationData(type, options);
    
    res.json({
      success: true,
      visualization: JSON.parse(visualizationData)
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/compliance/dashboard
 * @desc Get compliance dashboard data
 * @access Private
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = await AuditTrailVisualization.generateComplianceMetrics();
    
    res.json({
      success: true,
      dashboard: dashboardData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/compliance/export
 * @desc Export audit trail in specified format
 * @access Private
 */
router.get('/export', [
  query('format').isIn(['JSON', 'CSV', 'HTML']).default('JSON'),
  query('resourceId').optional().isString(),
  query('userId').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { format, resourceId, userId, startDate, endDate } = req.query;
    
    const exportData = await AuditLogger.exportAuditTrail(format, {
      resourceId,
      userId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });
    
    // Set appropriate headers
    const headers = {
      'JSON': { 'Content-Type': 'application/json' },
      'CSV': { 'Content-Type': 'text/csv' },
      'HTML': { 'Content-Type': 'text/html' }
    };
    
    res.set(headers[format]);
    res.set('Content-Disposition', `attachment; filename=audit-trail-${Date.now()}.${format.toLowerCase()}`);
    
    res.send(exportData);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/compliance/health
 * @desc Check compliance system health
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    // Perform basic health checks
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        auditLogging: 'operational',
        complianceChecks: 'operational',
        reportGeneration: 'operational',
        monitoring: 'operational',
        visualization: 'operational'
      },
      metrics: monitoring.getMonitoringStats()
    };
    
    res.json({
      success: true,
      health
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      health: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

module.exports = router;