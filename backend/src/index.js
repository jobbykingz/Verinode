// ── Load env file FIRST, before any other require ────────────────────────────
const { loadEnvFile, validateAndSummarise } = require("./config/configValidator");
const dotenv = require("dotenv");

const envFile = loadEnvFile();
if (envFile) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config(); // fallback to default .env in cwd
}

// ── Central config and feature flags ─────────────────────────────────────────
const config      = require("./config/appConfig");
const { flags, allFlags } = require("./config/featureFlags");

// Validate configuration — throws in production on missing required vars
try {
  validateAndSummarise(config, console);
} catch (err) {
  console.error("[config] FATAL:", err.message);
  if (config.isProduction) process.exit(1);
  // In dev/test, log and continue so the server still starts
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

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
const { redisService } = require("./services/redisService");

const proofRoutes      = require("./routes/proofs");
const authRoutes       = require("./routes/auth");
const stellarRoutes    = require("./routes/stellar");
const marketplaceRoutes = require("./routes/marketplace");
const searchRoutes     = require("./routes/search");
const securityRoutes   = require("./routes/security");
const sharingRoutes    = require("./routes/sharing");
const complianceRoutes = require("./routes/compliance");
const analyticsRoutes  = require("./routes/analytics");
const ipfsRoutes       = require("./routes/ipfs");
const performanceRoutes = require("./routes/performance");
const cacheRoutes      = require("./routes/cache");

const app  = express();
const PORT = config.server.port;

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
app.use(express.json({ limit: config.server.requestSizeLimit }));
app.use(express.urlencoded({ extended: true, limit: config.server.requestSizeLimit }));
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
if (flags.rateLimiting) {
  app.use(dynamicLimiter());
}

// 8. Additional security headers for API endpoints
app.use(conditionalSecurityHeaders());

// ============================================================================
// ROUTE-SPECIFIC SECURITY
// ============================================================================

// Apply stricter rate limiting to sensitive endpoints
if (flags.rateLimiting) {
  app.use("/api/auth",  authLimiter());
  app.use("/api/user",  authLimiter());
  app.use("/api/admin", authLimiter());
  app.use("/api/proofs", sensitiveLimiter());
  app.use("/api/upload", uploadLimiter());
  app.use("/api/ipfs",   uploadLimiter());
}

// ============================================================================
// ROUTES
// ============================================================================

app.use("/api/proofs",      proofRoutes);
app.use("/api/auth",        authRoutes);
app.use("/api/stellar",     stellarRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/search",      searchRoutes);
app.use("/api/security",    securityRoutes);
app.use("/api/sharing",     sharingRoutes);
app.use("/api/compliance",  complianceRoutes);
app.use("/api/analytics",   analyticsRoutes);
app.use("/api/ipfs",        ipfsRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/cache",       cacheRoutes);

// ── Developer: expose resolved config (non-secret) when flag is enabled ───────
if (flags.configEndpoint) {
  app.get("/api/config", (req, res) => {
    res.json({
      server:   config.server,
      database: { ...config.database, uri: config.database.uri.replace(/:[^:@/]+@/, ':***@') },
      stellar:  { network: config.stellar.network, horizonUrl: config.stellar.horizonUrl },
      redis:    { host: config.redis.host, port: config.redis.port, db: config.redis.db },
      ipfs:     config.ipfs,
      urls:     config.urls,
      logging:  config.logging,
      features: allFlags(),
      pinning: {
        pinata:   { enabled: config.pinning.pinata.enabled },
        infura:   { enabled: config.pinning.infura.enabled },
        filebase: { enabled: config.pinning.filebase.enabled },
      },
    });
  });
}

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
    status:    "OK",
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    env:       config.server.env,
    cache: {
      redis:          redisConnected ? "connected" : "disconnected",
      metricsEndpoint: "/api/cache/metrics",
    },
    features: allFlags(),
    security: {
      rateLimiting:  flags.rateLimiting ? "active" : "disabled",
      cors:          "active",
      headers:       "active",
      sanitization:  "active",
      xssProtection: "active",
    },
  });
});

// Security status endpoint
app.get("/security-status", (req, res) => {
  res.json({
    status:    "Security Active",
    timestamp: new Date().toISOString(),
    features: {
      rateLimiting:       flags.rateLimiting ? "enabled" : "disabled",
      cors:               "enabled",
      securityHeaders:    "enabled",
      inputValidation:    "enabled",
      xssProtection:      "enabled",
      requestLogging:     "enabled",
      attackDetection:    "enabled",
      geoLocationTracking: "enabled",
    },
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use(errorLogger());

app.use((req, res) => {
  res.status(404).json({
    error:  "Route not found",
    path:   req.path,
    method: req.method,
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    ...(config.isDevelopment && { details: err.message, stack: err.stack }),
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const server = app.listen(PORT, () => {
  console.log(`Verinode backend running on port ${PORT} [${config.server.env}]`);
  console.log(`Metrics at http://localhost:${PORT}/metrics`);
  console.log(`Health  at http://localhost:${PORT}/health`);
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

  // Force exit after timeout
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, config.server.shutdownTimeout).unref();
};

process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

module.exports = app;
