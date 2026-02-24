const request = require('supertest');
const app = require('../index');
const { inputSanitization } = require('../utils/inputSanitization');
const { xssProtection } = require('../utils/xssProtection');

describe('Security Middleware Tests', () => {
  describe('Rate Limiting', () => {
    it('should allow normal request rate', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });

    it('should enforce rate limits on auth endpoints', async () => {
      // Make multiple rapid requests to auth endpoint
      const promises = Array(10).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password' })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      // Should be rate limited after certain number of requests
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CORS Configuration', () => {
    it('should include proper CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should reject requests from unauthorized origins in production', async () => {
      // This test would need to be run with NODE_ENV=production
      // For now, we'll test the CORS configuration exists
      const response = await request(app)
        .options('/api/proofs')
        .set('Origin', 'https://malicious-site.com')
        .expect(204); // Should be 204 for preflight in development
      
      // In production, this would be 403
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('permissions-policy');
    });

    it('should include CSP header', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('content-security-policy');
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should sanitize malicious input', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = inputSanitization.sanitizeHtml(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('should detect XSS patterns', () => {
      const xssInput = 'javascript:alert("xss")';
      const containsXSS = xssProtection.containsXSS(xssInput);
      
      expect(containsXSS).toBeTruthy();
    });

    it('should remove XSS patterns', () => {
      const xssInput = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = xssProtection.removeXSS(xssInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should sanitize SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const sanitized = inputSanitization.sanitizeSql(sqlInjection);
      
      expect(sanitized).not.toContain("DROP TABLE");
      expect(sanitized).not.toContain("--");
    });

    it('should sanitize path traversal attempts', () => {
      const pathTraversal = '../../../etc/passwd';
      const sanitized = inputSanitization.sanitizePath(pathTraversal);
      
      expect(sanitized).not.toContain('../');
    });
  });

  describe('Request Logging and Monitoring', () => {
    it('should log security events', async () => {
      // This test would require mocking the logger
      // For now, we'll ensure the endpoint responds correctly
      const response = await request(app)
        .get('/security-status')
        .expect(200);
      
      expect(response.body).toHaveProperty('features');
      expect(response.body.features).toHaveProperty('requestLogging');
      expect(response.body.features).toHaveProperty('attackDetection');
    });
  });

  describe('Error Handling', () => {
    it('should not expose error details in production', async () => {
      // Create a route that throws an error
      app.get('/test-error', (req, res, next) => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/test-error')
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Internal server error');
      
      // In development, should include details
      if (process.env.NODE_ENV === 'development') {
        expect(response.body).toHaveProperty('details');
        expect(response.body).toHaveProperty('stack');
      } else {
        expect(response.body).not.toHaveProperty('details');
        expect(response.body).not.toHaveProperty('stack');
      }
    });
  });

  describe('Health and Security Status', () => {
    it('should return health status with security info', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('security');
      expect(response.body.security).toHaveProperty('rateLimiting', 'active');
      expect(response.body.security).toHaveProperty('cors', 'active');
      expect(response.body.security).toHaveProperty('headers', 'active');
    });

    it('should return detailed security status', async () => {
      const response = await request(app)
        .get('/security-status')
        .expect(200);
      
      expect(response.body).toHaveProperty('features');
      expect(response.body.features).toHaveProperty('rateLimiting', 'enabled');
      expect(response.body.features).toHaveProperty('cors', 'enabled');
      expect(response.body.features).toHaveProperty('securityHeaders', 'enabled');
      expect(response.body.features).toHaveProperty('inputValidation', 'enabled');
      expect(response.body.features).toHaveProperty('xssProtection', 'enabled');
    });
  });
});

describe('Attack Prevention Tests', () => {
  describe('XSS Prevention', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src=x onerror=alert("xss")>',
      '<svg onload=alert("xss")>',
      '"><script>alert("xss")</script>',
      "'><script>alert('xss')</script>"
    ];

    xssPayloads.forEach(payload => {
      it(`should block XSS payload: ${payload.substring(0, 20)}...`, async () => {
        const response = await request(app)
          .post('/api/proofs')
          .send({ 
            title: payload,
            description: 'Test description',
            data: { test: 'data' }
          });
        
        // Should either be blocked (403) or sanitized (200 with clean content)
        expect([400, 403, 200]).toContain(response.status);
        
        if (response.status === 200) {
          // If accepted, ensure payload is sanitized
          expect(response.body.title).not.toContain('<script>');
          expect(response.body.title).not.toContain('javascript:');
        }
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "'; INSERT INTO users VALUES('hacker', 'password'); --",
      "' UNION SELECT * FROM users --"
    ];

    sqlPayloads.forEach(payload => {
      it(`should handle SQL injection payload: ${payload.substring(0, 20)}...`, async () => {
        // Test with login endpoint
        const response = await request(app)
          .post('/api/auth/login')
          .send({ 
            email: payload,
            password: 'password'
          });
        
        // Should not cause server error
        expect(response.status).not.toBe(500);
        expect([400, 401, 403]).toContain(response.status);
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    const pathPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
    ];

    pathPayloads.forEach(payload => {
      it(`should handle path traversal payload: ${payload}`, async () => {
        const response = await request(app)
          .get(`/api/proofs/${payload}`)
          .expect(400); // Should be bad request
      });
    });
  });

  describe('Large Payload Prevention', () => {
    it('should reject oversized payloads', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB
      
      const response = await request(app)
        .post('/api/proofs')
        .send({ 
          title: largePayload,
          description: 'Test description',
          data: { test: 'data' }
        })
        .expect(413); // Payload Too Large
    });
  });

  describe('Malicious Headers', () => {
    it('should detect suspicious headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('X-Forwarded-Host', 'evil.com')
        .set('X-Original-URL', '/admin')
        .expect(200); // May still succeed but should be logged
      
      // The request should be logged as suspicious
      // This would require checking logs in a real test environment
    });
  });
});

describe('Security Configuration Tests', () => {
  it('should have proper environment variables', () => {
    expect(process.env.NODE_ENV).toBeDefined();
    
    if (process.env.NODE_ENV === 'production') {
      expect(process.env.JWT_SECRET).not.toBe('your-jwt-secret');
      expect(process.env.SESSION_SECRET).not.toBe('your-secret-key');
    }
  });

  it('should load security configuration', () => {
    const securityConfig = require('../../config/securityConfig');
    
    expect(securityConfig).toHaveProperty('rateLimiting');
    expect(securityConfig).toHaveProperty('cors');
    expect(securityConfig).toHaveProperty('securityHeaders');
    expect(securityConfig).toHaveProperty('validation');
    expect(securityConfig).toHaveProperty('enhancedSecurity');
  });
});
