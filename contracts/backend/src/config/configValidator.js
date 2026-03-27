/**
 * Configuration validator — called once at application startup.
 *
 * Responsibilities:
 *  1. Load the environment-specific .env file if present (e.g. .env.development).
 *  2. Run appConfig.validateOrThrow() to catch missing/invalid values early.
 *  3. Log a startup summary of resolved config (non-secret values only).
 */

'use strict';

const path = require('path');
const fs   = require('fs');

/**
 * Attempt to load an environment-specific .env file.
 * e.g. NODE_ENV=production → tries .env.production, then .env.
 * Falls back to the base .env silently if the env-specific file is absent.
 *
 * @param {string} rootDir - Directory to search (default: process.cwd())
 */
function loadEnvFile(rootDir) {
  const nodeEnv = process.env.NODE_ENV || 'development';
  rootDir = rootDir || path.resolve(__dirname, '../../');

  // Priority order: .env.{env}.local > .env.{env} > .env.local > .env
  const candidates = [
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
    '.env.local',
    '.env',
  ];

  for (const name of candidates) {
    const filePath = path.join(rootDir, name);
    if (fs.existsSync(filePath)) {
      // dotenv is loaded by the caller (index.js); we just report which file.
      return filePath;
    }
  }

  return null;
}

/**
 * Validate the resolved configuration and print a startup summary.
 * Throws on hard errors; logs warnings for soft issues.
 *
 * @param {object} config - The appConfig singleton
 * @param {object} [logger] - Optional logger (defaults to console)
 */
function validateAndSummarise(config, logger) {
  logger = logger || console;

  // Hard validation — throws if required vars are missing in production
  config.validateOrThrow();

  // Print non-secret startup summary
  logger.info('[config] Configuration loaded:');
  logger.info(`[config]   NODE_ENV          = ${config.server.env}`);
  logger.info(`[config]   PORT              = ${config.server.port}`);
  logger.info(`[config]   DATABASE          = ${redactUri(config.database.uri)}`);
  logger.info(`[config]   STELLAR_NETWORK   = ${config.stellar.network}`);
  logger.info(`[config]   STELLAR_HORIZON   = ${config.stellar.horizonUrl}`);
  logger.info(`[config]   REDIS             = ${config.redis.host}:${config.redis.port}/${config.redis.db}`);
  logger.info(`[config]   LOG_LEVEL         = ${config.logging.level}`);
  logger.info(`[config]   PINATA            = ${config.pinning.pinata.enabled ? 'enabled' : 'disabled'}`);
  logger.info(`[config]   INFURA            = ${config.pinning.infura.enabled ? 'enabled' : 'disabled'}`);
  logger.info(`[config]   FILEBASE          = ${config.pinning.filebase.enabled ? 'enabled' : 'disabled'}`);
  logger.info(`[config]   FRONTEND_URL      = ${config.urls.frontend}`);
}

/**
 * Redact credentials from a URI for safe logging.
 * e.g. mongodb://user:secret@host:27017/db → mongodb://user:***@host:27017/db
 *
 * @param {string} uri
 * @returns {string}
 */
function redactUri(uri) {
  if (!uri) return '(not set)';
  try {
    const u = new URL(uri);
    if (u.password) u.password = '***';
    return u.toString();
  } catch (_) {
    // Not a valid URL (e.g. a bare connection string)
    return uri.replace(/:[^:@/]+@/, ':***@');
  }
}

module.exports = { loadEnvFile, validateAndSummarise, redactUri };
