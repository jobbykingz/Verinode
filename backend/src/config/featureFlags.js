/**
 * Feature flags
 *
 * Each flag is driven by an environment variable so they can be toggled
 * per-environment without code changes.
 *
 * Convention: FEATURE_<NAME>=true  to enable, anything else (or absent) disables.
 *
 * Usage:
 *   const { flags } = require('./featureFlags');
 *   if (flags.aiValidation) { ... }
 */

'use strict';

function flag(envKey, defaultValue) {
  const val = process.env[envKey];
  if (val === undefined) return defaultValue;
  return val === 'true' || val === '1';
}

const flags = {
  // ── Core features ───────────────────────────────────────────────────────
  /** AI-powered proof validation (ML model). Requires ML service to be running. */
  aiValidation:       flag('FEATURE_AI_VALIDATION', false),

  /** IPFS content storage for proofs. Disable to store proofs in DB only. */
  ipfsStorage:        flag('FEATURE_IPFS_STORAGE', true),

  /** Cross-chain bridge (Ethereum/Polygon/BSC). */
  crossChain:         flag('FEATURE_CROSS_CHAIN', false),

  /** Zero-knowledge proof privacy features. */
  zkProofs:           flag('FEATURE_ZK_PROOFS', false),

  // ── User-facing features ────────────────────────────────────────────────
  /** Marketplace for buying/selling proofs. */
  marketplace:        flag('FEATURE_MARKETPLACE', true),

  /** Social sharing of proofs. */
  socialSharing:      flag('FEATURE_SOCIAL_SHARING', true),

  /** Gamification (points, achievements, leaderboards). */
  gamification:       flag('FEATURE_GAMIFICATION', false),

  /** Compliance reporting (GDPR, SOC2, etc.). */
  compliance:         flag('FEATURE_COMPLIANCE', true),

  /** Team analytics dashboard. */
  teamAnalytics:      flag('FEATURE_TEAM_ANALYTICS', true),

  // ── Infrastructure features ─────────────────────────────────────────────
  /** Redis response caching. Disable to bypass all cache layers. */
  responseCache:      flag('FEATURE_RESPONSE_CACHE', true),

  /** Proof expiration / TTL logic. */
  proofExpiration:    flag('FEATURE_PROOF_EXPIRATION', false),

  /** Batch proof operations endpoint. */
  batchOperations:    flag('FEATURE_BATCH_OPERATIONS', true),

  /** Real-time statistics via WebSocket or SSE. */
  realTimeStats:      flag('FEATURE_REAL_TIME_STATS', false),

  // ── Security features ────────────────────────────────────────────────────
  /** Rate-limit enforcement (disable only for load testing). */
  rateLimiting:       flag('FEATURE_RATE_LIMITING', true),

  /** Media authenticity verification (video/image fingerprinting). */
  mediaAuthenticity:  flag('FEATURE_MEDIA_AUTHENTICITY', false),

  /** Voice biometrics for identity. */
  voiceBiometrics:    flag('FEATURE_VOICE_BIOMETRICS', false),

  // ── Developer / debug flags ─────────────────────────────────────────────
  /** Expose a /api/config endpoint that returns the resolved config (dev only). */
  configEndpoint:     flag('FEATURE_CONFIG_ENDPOINT', process.env.NODE_ENV === 'development'),

  /** Verbose request/response logging. */
  verboseLogging:     flag('FEATURE_VERBOSE_LOGGING', false),
};

/**
 * Returns an array of enabled flag names — useful for health-check responses.
 * @returns {string[]}
 */
function enabledFlags() {
  return Object.entries(flags)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
}

/**
 * Returns all flags as a plain object — safe to expose in non-production
 * health/debug endpoints.
 * @returns {Record<string, boolean>}
 */
function allFlags() {
  return Object.assign({}, flags);
}

module.exports = { flags, enabledFlags, allFlags };
