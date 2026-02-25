const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import monitoring components
const { monitoringService } = require("./services/monitoringService");
const { metricsCollector } = require("./utils/metricsCollector");
const {
  requestLogger,
  errorLogger,
  securityLogger,
  performanceLogger,
  complianceLogger,
} = require("./middleware/logging");

// Import new security middleware
const {
  dynamicLimiter,
  authLimiter,
  sensitiveLimiter,
  uploadLimiter
} = require("./middleware/rateLimiter");
const {
  conditionalCors,
  corsErrorHandler
} = require("./middleware/corsConfig");
const {
  securityHeaders,
  conditionalSecurityHeaders,
  securityHeadersValidator
} = require("./middleware/securityHeaders");
const {
  securityRequestLogger,
  attackPatternLogger,
  geoLocationLogger
} = require("./middleware/requestLogger");
const {
  sanitizeInput
} = require("./middleware/inputValidation");
const {
  xssProtectionMiddleware
} = require("./utils/xssProtection");

const proofRoutes = require("./routes/proofs");
const authRoutes = require("./routes/auth");
const stellarRoutes = require("./routes/stellar");
const marketplaceRoutes = require("./routes/marketplace");
const searchRoutes = require("./routes/search");
const securityRoutes = require("./routes/security");
const sharingRoutes = require("./routes/sharing");
const complianceRoutes = require("./routes/compliance");
const analyticsRoutes = require("./routes/analytics");
const ipfsRoutes = require("./routes/ipfs");
const performanceRoutes = require("./routes/performance");
const cacheRoutes = require("./routes/cache");
const { redisService } = require("./services/redisService");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// SECURITY MIDDLEWARE STACK
// ============================================================================

// 1. Security headers and validation (first line of defense)
app.use(securityHeaders());
app.use(securityHeadersValidator());

// 2. CORS configuration
app.use(conditionalCors());
app.use(corsErrorHandler());

// 3. Request parsing and sanitization
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput());

// 4. XSS protection
app.use(xssProtectionMiddleware());

// 5. Security logging and monitoring
app.use(securityRequestLogger());
app.use(attackPatternLogger());
app.use(geoLocationLogger());

// 6. Legacy logging middleware (for compatibility)
app.use(requestLogger());
app.use(securityLogger());
app.use(performanceLogger(1000)); // Log requests taking > 1 second
app.use(complianceLogger());

// 7. Rate limiting (apply after initial security checks)
app.use(dynamicLimiter());

// 8. Additional security headers for API endpoints
app.use(conditionalSecurityHeaders());

// ============================================================================
// ROUTE-SPECIFIC SECURITY
// ============================================================================

// Apply stricter rate limiting to sensitive endpoints
app.use("/api/auth", authLimiter());
app.use("/api/user", authLimiter());
app.use("/api/admin", authLimiter());

// Apply sensitive operation rate limiting
app.use("/api/proofs", sensitiveLimiter());
app.use("/api/upload", uploadLimiter());
app.use("/api/ipfs", uploadLimiter());

// ============================================================================
// ROUTES
// ============================================================================

app.use("/api/proofs", proofRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/stellar", stellarRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/sharing", sharingRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ipfs", ipfsRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/cache", cacheRoutes);

// ============================================================================
// SYSTEM ENDPOINTS
// ============================================================================

// Metrics endpoint for Prometheus
app.get("/metrics", async (req, res) => {
  try {
    const metrics = await metricsCollector.getMetrics();
    res.set("Content-Type", metricsCollector.getRegistry().contentType);
    res.end(metrics);
  } catch (error) {
    console.error("Error collecting metrics:", error);
    res.status(500).send("Error collecting metrics");
  }
});

// Health check
app.get("/health", async (req, res) => {
  const redisConnected = await redisService.healthCheck().catch(() => false);
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: {
      redis: redisConnected ? "connected" : "disconnected",
      metricsEndpoint: "/api/cache/metrics"
    },
    security: {
      rateLimiting: "active",
      cors: "active",
      headers: "active",
      sanitization: "active",
      xssProtection: "active"
    }
  });
});

// Security status endpoint
app.get("/security-status", (req, res) => {
  res.json({
    status: "Security Active",
    timestamp: new Date().toISOString(),
    features: {
      rateLimiting: "enabled",
      cors: "enabled",
      securityHeaders: "enabled",
      inputValidation: "enabled",
      xssProtection: "enabled",
      requestLogging: "enabled",
      attackDetection: "enabled",
      geoLocationTracking: "enabled"
    }
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Error handling middleware
app.use(errorLogger());

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Route not found",
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  
  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({ 
    error: "Internal server error",
    ...(isDevelopment && { details: err.message, stack: err.stack })
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Verinode backend running on port ${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`💚 Health check at http://localhost:${PORT}/health`);
  console.log(`🔒 Security status at http://localhost:${PORT}/security-status`);
  console.log(`🛡️ Security middleware stack is active`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("Shutting down gracefully...");
  server.close(async () => {
    monitoringService.shutdown();
    await redisService.disconnect().catch(() => {});
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = app;
