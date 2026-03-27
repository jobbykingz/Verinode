# Security Implementation Documentation

## Overview

This document describes the comprehensive security enhancements implemented for the Verinode API to protect against common web vulnerabilities and attacks.

## Security Features Implemented

### 1. Rate Limiting (`src/middleware/rateLimiter.ts`)

**Purpose**: Prevent abuse and DoS attacks by limiting request rates.

**Features**:
- Multiple rate limiters for different endpoints:
  - General API: 100 requests per 15 minutes
  - Authentication: 5 attempts per 15 minutes  
  - GraphQL queries: 60 per minute
  - GraphQL mutations: 30 per minute
  - File uploads: 10 per hour
- IP-based tracking with X-Forwarded-For support
- Configurable windows and limits
- Proper 429 status responses with retry information

**Usage**:
```typescript
import { strictRateLimiter, authRateLimiter } from './middleware/rateLimiter';
app.use('/graphql', strictRateLimiter);
app.use('/auth', authRateLimiter);
```

### 2. Input Validation (`src/middleware/inputValidation.ts`)

**Purpose**: Validate and sanitize all incoming data to prevent injection attacks.

**Features**:
- Custom validation system without external dependencies
- Support for required fields, length limits, pattern matching
- Built-in validation rules for common fields (email, username, password)
- Automatic request body sanitization
- Content-Type validation
- Payload size limits (10MB default)

**Usage**:
```typescript
import { validateBody, commonValidationRules } from './middleware/inputValidation';
app.use('/api', validateBody(commonValidationRules.email));
```

### 3. CORS Configuration (`src/middleware/corsConfig.ts`)

**Purpose**: Control cross-origin requests to prevent unauthorized access.

**Features**:
- Environment-specific CORS policies
- Production mode with whitelisted origins
- Strict CORS for sensitive endpoints
- Development mode with relaxed restrictions
- Proper preflight handling

**Configuration**:
- Development: Allows localhost origins
- Production: Restricted to configured domains
- Strict mode: Limited methods and headers

### 4. Security Headers (`src/middleware/securityHeaders.ts`)

**Purpose**: Add comprehensive security headers to prevent client-side attacks.

**Headers Implemented**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: Restricts browser features
- `Content-Security-Policy`: Comprehensive CSP in production
- `Strict-Transport-Security`: HSTS in production

### 5. Request Logging (`src/middleware/requestLogger.ts`)

**Purpose**: Monitor and log all requests for security analysis.

**Features**:
- Unique request ID tracking
- Security flag detection (XSS, SQL injection, suspicious patterns)
- IP-based monitoring
- User agent analysis
- Error and attack logging
- Configurable log retention
- Security alerting for high-severity events

**Security Flags Detected**:
- SQL injection attempts
- XSS attempts
- Suspicious user agents
- Large payloads
- Authentication failures
- Rate limit violations

### 6. Input Sanitization (`src/utils/inputSanitization.ts`)

**Purpose**: Clean and sanitize input data to remove dangerous content.

**Features**:
- String sanitization (removes HTML tags, JavaScript, CSS expressions)
- HTML sanitization (removes scripts and dangerous elements)
- SQL injection prevention (removes dangerous characters)
- Recursive object sanitization
- Key sanitization to prevent injection

### 7. XSS Protection (`src/utils/xssProtection.ts`)

**Purpose**: Detect and prevent Cross-Site Scripting attacks.

**Features**:
- XSS pattern detection
- HTML tag filtering
- Event handler removal
- JavaScript URL removal
- Configurable allowed tags and attributes
- Output sanitization middleware

## Security Configuration (`config/securityConfig.js`)

Centralized security configuration with environment-specific settings:

```javascript
module.exports = {
  rateLimiting: { /* rate limit configs */ },
  cors: { /* CORS configs */ },
  securityHeaders: { /* header configs */ },
  validation: { /* validation rules */ },
  xssProtection: { /* XSS settings */ },
  logging: { /* logging configuration */ },
  // ... more security settings
};
```

## Security Audit Script (`scripts/securityAudit.js`)

Automated security auditing tool that checks:

- File permissions
- Environment variables
- Dependency vulnerabilities
- Code security patterns
- Configuration security
- Default secrets usage

**Usage**:
```bash
npm run security:audit
```

## Integration with GraphQL Server

The security middleware is integrated in a specific order in `src/graphql/server.ts`:

1. Request logging (first to capture everything)
2. Security headers
3. CORS configuration
4. Rate limiting
5. Content validation
6. XSS protection and input sanitization
7. Body parsing

## Security Endpoints

### Health Check
```
GET /health
```
Returns server health status.

### Security Status
```
GET /security-status
```
Returns current security feature status.

## Testing

Comprehensive security tests are available in `src/test/security.test.ts`:

- Rate limiting tests
- CORS validation tests
- Security header verification
- Input validation tests
- XSS protection tests
- SQL injection prevention tests

**Run security tests**:
```bash
npm run test:security
```

**Run full security check**:
```bash
npm run security:check
```

## Environment Variables

Required for production:
- `NODE_ENV=production`
- `JWT_SECRET` (strong, random secret)
- `SESSION_SECRET` (strong, random secret)
- `ALLOWED_ORIGINS` (comma-separated list of allowed domains)

Recommended:
- `LOG_LEVEL=info`
- `LOG_TO_FILE=true`
- `LOG_FILE_PATH=./logs/security.log`

## Security Best Practices Implemented

1. **Defense in Depth**: Multiple layers of security controls
2. **Principle of Least Privilege**: Minimal required permissions
3. **Fail Securely**: Secure defaults when errors occur
4. **Input Validation**: Validate all inputs at multiple layers
5. **Output Encoding**: Encode all outputs to prevent injection
6. **Logging and Monitoring**: Comprehensive security logging
7. **Regular Auditing**: Automated security audit script
8. **Environment Separation**: Different configs for dev/prod

## Monitoring and Alerting

The system automatically:
- Logs all security events
- Detects attack patterns
- Generates alerts for high-severity events
- Tracks suspicious IP addresses
- Monitors authentication failures

## Acceptance Criteria Met

✅ **Rate limiting**: Returns 429 status when limits exceeded  
✅ **Input validation**: Malicious input is sanitized and rejected  
✅ **CORS policy**: Properly enforced based on environment  
✅ **Security headers**: All recommended headers present  
✅ **Attack detection**: Logged and blocked automatically  
✅ **SQL injection prevention**: Pattern detection and sanitization  
✅ **XSS protection**: Detection and removal of XSS content  
✅ **Request logging**: Comprehensive logging with security monitoring  

## Deployment Considerations

1. Set strong secrets for JWT and session
2. Configure proper CORS origins
3. Enable production security headers
4. Set up log rotation for security logs
5. Monitor security alerts
6. Run regular security audits
7. Keep dependencies updated

## Future Enhancements

- Redis-based rate limiting for distributed systems
- Web Application Firewall (WAF) integration
- Advanced bot detection
- API key authentication
- Request signing
- IP whitelisting/blacklisting
- Advanced anomaly detection
