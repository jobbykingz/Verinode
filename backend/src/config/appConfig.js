/**
 * Central application configuration.
 *
 * All environment variables are resolved here with documented defaults.
 * Consumers import this module instead of reading process.env directly,
 * so the entire surface area of the configuration is visible in one place.
 *
 * Call config.validate() at startup to fail fast on missing required vars.
 */

'use strict';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const env = process.env;

function str(key, fallback) {
  return env[key] !== undefined ? env[key] : fallback;
}

function num(key, fallback) {
  const val = env[key];
  if (val === undefined || val === '') return fallback;
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key, fallback) {
  const val = env[key];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

function list(key, fallback) {
  const val = env[key];
  if (!val) return fallback;
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

// ─── Config object ────────────────────────────────────────────────────────────

const config = {
  // ── Server ────────────────────────────────────────────────────────────────
  server: {
    port:        num('PORT', 3000),
    host:        str('HOST', '0.0.0.0'),
    env:         str('NODE_ENV', 'development'),
    apiPrefix:   str('API_PREFIX', '/api'),
    requestSizeLimit: str('REQUEST_SIZE_LIMIT', '10mb'),
    shutdownTimeout: num('SHUTDOWN_TIMEOUT_MS', 5000),
  },

  // ── Database ──────────────────────────────────────────────────────────────
  database: {
    uri:              str('MONGODB_URI', 'mongodb://localhost:27017/verinode'),
    maxPoolSize:      num('DB_MAX_POOL_SIZE', 10),
    connectTimeout:   num('DB_CONNECT_TIMEOUT_MS', 30000),
    socketTimeout:    num('DB_SOCKET_TIMEOUT_MS', 45000),
  },

  // ── Authentication ────────────────────────────────────────────────────────
  auth: {
    jwtSecret:    str('JWT_SECRET', ''),
    jwtExpiresIn: str('JWT_EXPIRES_IN', '24h'),
    jwtIssuer:    str('JWT_ISSUER', 'verinode'),
    jwtAudience:  str('JWT_AUDIENCE', 'verinode-users'),
    bcryptRounds: num('BCRYPT_ROUNDS', 12),
    sessionSecret: str('SESSION_SECRET', ''),
  },

  // ── Stellar / Blockchain ──────────────────────────────────────────────────
  stellar: {
    network:    str('STELLAR_NETWORK', 'testnet'),
    secretKey:  str('STELLAR_SECRET_KEY', ''),
    // Horizon URL derived from network unless explicitly set
    get horizonUrl() {
      return str('STELLAR_HORIZON_URL',
        this.network === 'mainnet'
          ? 'https://horizon.stellar.org'
          : 'https://horizon-testnet.stellar.org'
      );
    },
  },

  // ── Cross-chain / EVM ─────────────────────────────────────────────────────
  evm: {
    ethereum: {
      rpcUrl:        str('ETHEREUM_RPC_URL', 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID'),
      bridgeAddress: str('ETHEREUM_BRIDGE_ADDRESS', ''),
    },
    polygon: {
      rpcUrl:        str('POLYGON_RPC_URL', 'https://polygon-rpc.com'),
      bridgeAddress: str('POLYGON_BRIDGE_ADDRESS', ''),
    },
    bsc: {
      rpcUrl:        str('BSC_RPC_URL', 'https://bsc-dataseed1.binance.org'),
      bridgeAddress: str('BSC_BRIDGE_ADDRESS', ''),
    },
  },

  // ── Redis / Cache ─────────────────────────────────────────────────────────
  redis: {
    host:     str('REDIS_HOST', 'localhost'),
    port:     num('REDIS_PORT', 6379),
    password: str('REDIS_PASSWORD', ''),
    db:       num('REDIS_DB', 0),
    defaultTtl: num('REDIS_DEFAULT_TTL', 3600),
  },

  // ── IPFS ──────────────────────────────────────────────────────────────────
  ipfs: {
    host:     str('IPFS_HOST', 'localhost'),
    port:     num('IPFS_PORT', 5001),
    protocol: str('IPFS_PROTOCOL', 'http'),
    repo:     str('IPFS_REPO', './ipfs-repo'),
    gateway: {
      host: str('IPFS_GATEWAY_HOST', '0.0.0.0'),
      port: num('IPFS_GATEWAY_PORT', 8080),
    },
  },

  // ── Pinning services ──────────────────────────────────────────────────────
  pinning: {
    pinata: {
      apiKey:       str('PINATA_API_KEY', ''),
      secretApiKey: str('PINATA_SECRET_API_KEY', ''),
      endpoint:     str('PINATA_ENDPOINT', 'https://api.pinata.cloud'),
      timeout:      num('PINATA_TIMEOUT', 30000),
      get enabled() { return !!(config.pinning.pinata.apiKey && config.pinning.pinata.secretApiKey); },
    },
    infura: {
      projectId:     str('INFURA_PROJECT_ID', ''),
      projectSecret: str('INFURA_PROJECT_SECRET', ''),
      endpoint:      str('INFURA_IPFS_ENDPOINT', 'https://ipfs.infura.io:5001'),
      timeout:       num('INFURA_TIMEOUT', 30000),
      get enabled() { return !!(config.pinning.infura.projectId && config.pinning.infura.projectSecret); },
    },
    filebase: {
      accessKey: str('FILEBASE_ACCESS_KEY', ''),
      secretKey: str('FILEBASE_SECRET_KEY', ''),
      bucket:    str('FILEBASE_BUCKET', 'verinode-backup'),
      endpoint:  str('FILEBASE_ENDPOINT', 'https://s3.filebase.com'),
      timeout:   num('FILEBASE_TIMEOUT', 30000),
      get enabled() { return !!(config.pinning.filebase.accessKey && config.pinning.filebase.secretKey); },
    },
    maxRetries: num('PINNING_MAX_RETRIES', 3),
    retryDelay: num('PINNING_RETRY_DELAY', 5000),
  },

  // ── Frontend / URLs ───────────────────────────────────────────────────────
  urls: {
    frontend:   str('FRONTEND_URL', 'http://localhost:3000'),
    api:        str('API_URL', 'http://localhost:3001'),
    allowedOrigins: list('ALLOWED_ORIGINS', []),
  },

  // ── Logging ───────────────────────────────────────────────────────────────
  logging: {
    level:      str('LOG_LEVEL', 'info'),
    toFile:     bool('LOG_TO_FILE', false),
    filePath:   str('LOG_FILE_PATH', './logs/app.log'),
    maxSize:    str('LOG_MAX_SIZE', '100MB'),
    maxFiles:   num('LOG_MAX_FILES', 5),
  },

  // ── Media / Signing ───────────────────────────────────────────────────────
  media: {
    signingKey:           str('MEDIA_SIGNING_KEY', ''),
    verificationPublicKey: str('MEDIA_VERIFICATION_PUBLIC_KEY', ''),
  },

  // ── Webhooks / Alerts ─────────────────────────────────────────────────────
  alerts: {
    slackWebhookUrl:   str('SLACK_WEBHOOK_URL', ''),
    securityWebhookUrl: str('SECURITY_WEBHOOK_URL', ''),
    webhookAuthToken:  str('WEBHOOK_AUTH_TOKEN', ''),
    adminEmail:        str('ADMIN_EMAIL', ''),
  },

  // ── Feature Flags (delegated to featureFlags.js) ──────────────────────────
  // Populated by featureFlags.js after load

  // ─────────────────────────────────────────────────────────────────────────
  // Derived helpers
  // ─────────────────────────────────────────────────────────────────────────

  get isProduction()  { return config.server.env === 'production'; },
  get isDevelopment() { return config.server.env === 'development'; },
  get isTest()        { return config.server.env === 'test'; },

  /**
   * Validate required environment variables.
   * Throws (or logs warnings) depending on environment.
   * Call this once at application startup.
   *
   * @returns {{ errors: string[], warnings: string[] }}
   */
  validate() {
    const errors   = [];
    const warnings = [];

    // Required in all environments
    if (!config.database.uri) {
      errors.push('MONGODB_URI is required');
    }

    // Required in production
    if (config.isProduction) {
      if (!config.auth.jwtSecret) {
        errors.push('JWT_SECRET must be set in production');
      } else if (config.auth.jwtSecret.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters in production');
      }

      if (!config.auth.sessionSecret) {
        errors.push('SESSION_SECRET must be set in production');
      }

      if (!config.stellar.secretKey) {
        errors.push('STELLAR_SECRET_KEY must be set in production');
      }

      if (config.urls.allowedOrigins.length === 0) {
        warnings.push('ALLOWED_ORIGINS is not set; CORS will block all cross-origin requests in production');
      }

      if (!config.media.signingKey) {
        warnings.push('MEDIA_SIGNING_KEY is not set; media signing will use an insecure default');
      }
    }

    // Warn about insecure defaults in any non-test environment
    if (!config.isTest) {
      if (!config.auth.jwtSecret) {
        warnings.push('JWT_SECRET not set; using empty string (insecure — set before going to production)');
      }
      if (!config.redis.password && config.isProduction) {
        warnings.push('REDIS_PASSWORD is not set; Redis connection is unauthenticated');
      }
    }

    // Type / range checks
    if (config.server.port < 1 || config.server.port > 65535) {
      errors.push(`PORT must be 1–65535 (got ${config.server.port})`);
    }

    if (!['development', 'production', 'test', 'staging'].includes(config.server.env)) {
      warnings.push(`NODE_ENV "${config.server.env}" is not a recognised value`);
    }

    return { errors, warnings };
  },

  /**
   * Run validate() and throw on errors, log warnings.
   * Suitable for calling at startup.
   */
  validateOrThrow() {
    const { errors, warnings } = config.validate();

    warnings.forEach(w => console.warn(`[config] WARNING: ${w}`));

    if (errors.length > 0) {
      const msg = `Configuration errors:\n  - ${errors.join('\n  - ')}`;
      throw new Error(msg);
    }
  },
};

module.exports = config;
