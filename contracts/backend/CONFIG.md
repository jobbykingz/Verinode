# Verinode Backend — Configuration Guide

## Overview

All configuration is centralised in:

| File | Purpose |
|------|---------|
| `src/config/appConfig.js` | Single source of truth for every environment variable |
| `src/config/featureFlags.js` | Feature toggle definitions |
| `src/config/configValidator.js` | Startup validation and env-file loader |
| `.env.example` | Documented template for every variable |

Consumers **import `appConfig`** instead of reading `process.env` directly:

```js
const config = require('./config/appConfig');
// use config.auth.jwtSecret, config.stellar.horizonUrl, etc.
```

---

## Environment Files

Files are loaded in priority order (highest first):

```
.env.{NODE_ENV}.local   ← never commit (local overrides)
.env.{NODE_ENV}         ← e.g. .env.production, .env.test
.env.local              ← never commit
.env                    ← base defaults (commit the .env.example only)
```

### Setup

```bash
# Copy the template
cp .env.example .env

# Edit .env with your values
# At minimum set: JWT_SECRET, MONGODB_URI, STELLAR_SECRET_KEY
```

---

## Configuration Sections

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | TCP port the server listens on |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` \| `staging` |
| `API_PREFIX` | `/api` | URL prefix for all API routes |
| `REQUEST_SIZE_LIMIT` | `10mb` | Max request body size |
| `SHUTDOWN_TIMEOUT_MS` | `5000` | Forced exit timeout on SIGTERM |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017/verinode` | MongoDB connection string |
| `DB_MAX_POOL_SIZE` | `10` | Connection pool size |
| `DB_CONNECT_TIMEOUT_MS` | `30000` | Connection timeout |
| `DB_SOCKET_TIMEOUT_MS` | `45000` | Socket idle timeout |

### Authentication ⚠️ Required in production

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | _(empty)_ | **≥ 32 chars. Required in production.** |
| `JWT_EXPIRES_IN` | `24h` | Token lifetime (ms or zeit/ms format) |
| `JWT_ISSUER` | `verinode` | JWT `iss` claim |
| `JWT_AUDIENCE` | `verinode-users` | JWT `aud` claim |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `SESSION_SECRET` | _(empty)_ | **Required in production.** |

### Stellar / Blockchain

| Variable | Default | Description |
|----------|---------|-------------|
| `STELLAR_NETWORK` | `testnet` | `testnet` or `mainnet` |
| `STELLAR_SECRET_KEY` | _(empty)_ | Stellar account secret (Sxxx…) |
| `STELLAR_HORIZON_URL` | _(derived)_ | Override Horizon URL. Defaults to testnet/mainnet based on `STELLAR_NETWORK` |

### Redis / Cache

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_PASSWORD` | _(empty)_ | Redis password (required in production) |
| `REDIS_DB` | `0` | Redis database index |
| `REDIS_DEFAULT_TTL` | `3600` | Default cache TTL in seconds |

### IPFS

| Variable | Default | Description |
|----------|---------|-------------|
| `IPFS_HOST` | `localhost` | IPFS daemon host |
| `IPFS_PORT` | `5001` | IPFS API port |
| `IPFS_PROTOCOL` | `http` | `http` or `https` |
| `IPFS_REPO` | `./ipfs-repo` | IPFS repository path |
| `IPFS_GATEWAY_HOST` | `0.0.0.0` | Gateway bind address |
| `IPFS_GATEWAY_PORT` | `8080` | Gateway port |

### Pinning Services

Enable at least one for production resilience.

| Variable | Description |
|----------|-------------|
| `PINATA_API_KEY` / `PINATA_SECRET_API_KEY` | Pinata credentials — service auto-enables when both are set |
| `INFURA_PROJECT_ID` / `INFURA_PROJECT_SECRET` | Infura IPFS credentials |
| `FILEBASE_ACCESS_KEY` / `FILEBASE_SECRET_KEY` | Filebase S3-compatible credentials |
| `FILEBASE_BUCKET` | Filebase bucket name (default: `verinode-backup`) |

### Frontend / CORS

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | `http://localhost:3000` | Frontend origin (used in share links) |
| `API_URL` | `http://localhost:3001` | Backend API base URL |
| `ALLOWED_ORIGINS` | _(empty)_ | Comma-separated allowed CORS origins. Required in production. |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug` |
| `LOG_TO_FILE` | `false` | Write logs to file |
| `LOG_FILE_PATH` | `./logs/app.log` | Log file path |

---

## Feature Flags

Feature flags are boolean environment variables with the prefix `FEATURE_`.
Set to `true` to enable; any other value (or absent) disables.

```bash
FEATURE_AI_VALIDATION=true
FEATURE_MARKETPLACE=true
```

### Available Flags

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_AI_VALIDATION` | `false` | AI/ML proof validation |
| `FEATURE_IPFS_STORAGE` | `true` | Store proofs on IPFS |
| `FEATURE_CROSS_CHAIN` | `false` | Cross-chain bridge |
| `FEATURE_ZK_PROOFS` | `false` | Zero-knowledge proof privacy |
| `FEATURE_MARKETPLACE` | `true` | Proof marketplace |
| `FEATURE_SOCIAL_SHARING` | `true` | Social proof sharing |
| `FEATURE_GAMIFICATION` | `false` | Points and achievements |
| `FEATURE_COMPLIANCE` | `true` | GDPR/SOC2 compliance |
| `FEATURE_TEAM_ANALYTICS` | `true` | Team analytics dashboard |
| `FEATURE_RESPONSE_CACHE` | `true` | Redis response caching |
| `FEATURE_PROOF_EXPIRATION` | `false` | Proof TTL / expiration |
| `FEATURE_BATCH_OPERATIONS` | `true` | Batch proof operations |
| `FEATURE_REAL_TIME_STATS` | `false` | Real-time stats |
| `FEATURE_RATE_LIMITING` | `true` | Rate limit enforcement |
| `FEATURE_MEDIA_AUTHENTICITY` | `false` | Media fingerprinting |
| `FEATURE_VOICE_BIOMETRICS` | `false` | Voice identity |
| `FEATURE_CONFIG_ENDPOINT` | dev only | Expose `GET /api/config` |
| `FEATURE_VERBOSE_LOGGING` | `false` | Verbose request logging |

### Checking a flag in code

```js
const { flags } = require('./config/featureFlags');

if (flags.aiValidation) {
  // run ML validation
}
```

### Listing enabled flags

```js
const { enabledFlags } = require('./config/featureFlags');
console.log(enabledFlags()); // ['ipfsStorage', 'marketplace', ...]
```

---

## Startup Validation

`configValidator.validateAndSummarise()` is called automatically when the server
starts. It:

1. Logs the resolved config summary (no secrets).
2. Emits `WARNING` lines for soft issues (e.g. missing `ALLOWED_ORIGINS`).
3. **Throws** in production if hard requirements are missing (e.g. `JWT_SECRET`).

In development and test environments the server continues even if validation
fails, so you can run with minimal configuration.

### Hard requirements (production only)

- `JWT_SECRET` — must be ≥ 32 characters
- `SESSION_SECRET`
- `STELLAR_SECRET_KEY`

### Soft warnings (all environments)

- `JWT_SECRET` not set
- `ALLOWED_ORIGINS` not set (CORS will block cross-origin requests)
- `REDIS_PASSWORD` not set in production

---

## Environment-specific Recipes

### Development (.env)

```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/verinode-dev
JWT_SECRET=dev-only-secret-at-least-32-characters-long
STELLAR_NETWORK=testnet
FEATURE_CONFIG_ENDPOINT=true
FEATURE_VERBOSE_LOGGING=true
```

### Test (.env.test)

```env
NODE_ENV=test
PORT=3002
MONGODB_URI=mongodb://localhost:27017/verinode-test
JWT_SECRET=test-only-secret-at-least-32-characters-long
STELLAR_NETWORK=testnet
FEATURE_RATE_LIMITING=false
FEATURE_RESPONSE_CACHE=false
```

### Production (.env.production)

```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/verinode
JWT_SECRET=<generated-256-bit-secret>
SESSION_SECRET=<generated-256-bit-secret>
STELLAR_NETWORK=mainnet
STELLAR_SECRET_KEY=<production-stellar-key>
REDIS_HOST=redis.internal
REDIS_PASSWORD=<strong-password>
ALLOWED_ORIGINS=https://verinode.app,https://www.verinode.app
LOG_LEVEL=warn
LOG_TO_FILE=true
FEATURE_CONFIG_ENDPOINT=false
```

---

## Adding a New Configuration Value

1. Add the variable to `src/config/appConfig.js` with a default and a call to
   `str()`/`num()`/`bool()`/`list()`.
2. Document it in `.env.example` with a comment.
3. Add it to this file under the appropriate section.
4. If it's required in production, add a check in `appConfig.validate()`.

## Adding a New Feature Flag

1. Add a line to `src/config/featureFlags.js`:
   ```js
   myFeature: flag('FEATURE_MY_FEATURE', false),
   ```
2. Document it in `.env.example` and in the flags table above.
3. Guard the feature in code with `if (flags.myFeature) { ... }`.
