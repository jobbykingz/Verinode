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

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Logging middleware
app.use(requestLogger());
app.use(securityLogger());
app.use(performanceLogger(1000)); // Log requests taking > 1 second
app.use(complianceLogger());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

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

// Routes
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

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use(errorLogger());

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Verinode backend running on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`Health check at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  server.close(() => {
    monitoringService.shutdown();
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  server.close(() => {
    monitoringService.shutdown();
    console.log("Server closed");
    process.exit(0);
  });
});

module.exports = app;
