# Verinode Configuration Guide

This document explains how to configure the Verinode backend and GraphQL server.

## Overview

Verinode uses a centralized configuration system built with `dotenv` for environment variable loading and `zod` for type-safe validation. All configurations are located in `src/config/`.

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` with your specific settings.

## Configuration Options

### Server Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | The port the server listens on | `4000` |
| `NODE_ENV` | Environment (`development`, `production`, `test`, `staging`) | `development` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | Localhost defaults |
| `REQUEST_SIZE_LIMIT` | Maximum request body size | `10mb` |

### Blockchain Settings (EVM)

Provide RPC URLs and Bridge contract addresses for supported chains:

- `ETHEREUM_RPC_URL` / `ETHEREUM_BRIDGE_ADDRESS`
- `POLYGON_RPC_URL` / `POLYGON_BRIDGE_ADDRESS`
- `BSC_RPC_URL` / `BSC_BRIDGE_ADDRESS`

### Rate Limits

Configure the maximum number of requests allowed per window (e.g., 15 minutes for strict/auth):

- `RATE_LIMIT_STRICT`: Used for sensitive endpoints (default: 100)
- `RATE_LIMIT_AUTH`: Used for authentication (default: 5)
- `RATE_LIMIT_API`: Used for general API calls (default: 60)
- `RATE_LIMIT_UPLOAD`: Used for file uploads (default: 10)

### Feature Flags

Toggle specific functionalities without changing code:

- `FEATURE_GRAPHQL_PLAYGROUND`: Enable/disable GraphQL Playground (default: `true`)
- `FEATURE_GRAPHQL_INTROSPECTION`: Enable/disable Schema Introspection (default: `true`)
- `FEATURE_REAL_TIME_SUBSCRIPTIONS`: Enable/disable Subscription server (default: `true`)
- `FEATURE_CROSS_CHAIN_BRIDGE`: Enable/disable Bridge initialization (default: `true`)

## Validation

The application will fail to start if required environment variables are missing or invalid in `production` mode. This ensures that configuration errors are caught early.

```bash
❌ Invalid configuration: {
  "server": {
    "port": {
      "_errors": ["Expected number, received string"]
    }
  }
}
```

## Adding New Configs

1. Update `src/config/schema.ts` to include the new field in the `ConfigSchema`.
2. Update `src/config/index.ts` to map the environment variable to the schema field.
3. Add the new variable to `.env.example`.
