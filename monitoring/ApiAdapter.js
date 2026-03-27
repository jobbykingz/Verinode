const axios = require('axios');

/**
 * ApiAdapter with Retry, Timeout, and Circuit Breaker patterns
 * Solves issue #71 by providing robust error handling for API calls
 */
class ApiAdapter {
    constructor(config) {
        this.config = config;
        this.circuitBreaker = {
            failures: 0,
            state: 'CLOSED',
            lastFailure: null,
            threshold: config.network.circuit_breaker?.failure_threshold || 5,
            resetTimeout: config.network.circuit_breaker?.reset_timeout || 30000,
            enabled: config.network.circuit_breaker?.enabled !== false
        };

        const rateLimitConfig = config.security?.rate_limit;
        this.rateLimiter = {
            enabled: !!rateLimitConfig && (rateLimitConfig.requests_per_minute > 0),
            minDelay: rateLimitConfig && rateLimitConfig.requests_per_minute > 0 ? 60000 / rateLimitConfig.requests_per_minute : 1000,
            lastRequestTime: 0,
        };
    }

    /**
     * Execute request with retry logic and circuit breaker protection
     * @param {string} method - HTTP method
     * @param {string} url - Request URL
     * @param {Object} [options] - Optional request options
     * @param {Object} [options.params] - Request query parameters
     * @param {Object} [options.data] - Request body
     * @param {Object} [options.headers] - Request headers
     */
    async request(method, url, { params = {}, data = null, headers = {} } = {}) {
        this._validateAndSanitize(params);

        await this._handleRateLimiting();

        this.checkCircuitBreaker();

        const { max_attempts, delay, backoff_multiplier } = this.config.network.retry;
        const timeout = this.config.network.request_timeout;
        
        let attempt = 1;
        let currentDelay = delay;

        while (attempt <= max_attempts) {
            try {
                const response = await axios({
                    method,
                    url,
                    params,
                    data,
                    headers,
                    timeout
                });

                this.resetCircuitBreaker();
                return response.data;
            } catch (error) {
                const isLastAttempt = attempt === max_attempts;
                
                // Log the error with context
                console.error(`[ApiAdapter] Request failed (Attempt ${attempt}/${max_attempts}): ${error.message}`);

                // Update circuit breaker
                this.recordFailure();

                // Check if we should retry (e.g., network error or 5xx)
                if (isLastAttempt || !this.isRetryable(error)) {
                    throw this.enhanceError(error, attempt);
                }

                // Wait before retry with exponential backoff
                console.log(`[ApiAdapter] Retrying in ${currentDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                
                currentDelay *= backoff_multiplier;
                attempt++;
            }
        }
    }

    /**
     * Validates and sanitizes known query parameters.
     * Per issue #72, this handles `fsym` and `tsyms`.
     * @param {Object} params - The request query parameters.
     * @private
     */
    _validateAndSanitize(params) {
        const sanitize = (input) => (typeof input === 'string' ? input.toUpperCase().replace(/[^A-Z0-9,]/g, '') : input);

        if (params.fsym) {
            if (typeof params.fsym !== 'string' || params.fsym.length === 0 || params.fsym.length > 10) {
                throw new Error('Input validation failed: "fsym" parameter must be a string between 1 and 10 characters.');
            }
            params.fsym = sanitize(params.fsym);
        }

        if (params.tsyms) {
            if (typeof params.tsyms !== 'string' || params.tsyms.length === 0) {
                throw new Error('Input validation failed: "tsyms" parameter must be a non-empty string.');
            }
            params.tsyms = sanitize(params.tsyms);
            const symbols = params.tsyms.split(',');
            if (symbols.some(s => s.length === 0 || s.length > 10)) {
                throw new Error('Input validation failed: All symbols in "tsyms" must be between 1 and 10 characters.');
            }
        }
    }

    /**
     * Enforces client-side rate limiting to avoid overwhelming the API.
     * @private
     */
    async _handleRateLimiting() {
        if (!this.rateLimiter.enabled) return;

        const now = Date.now();
        const timeSinceLastRequest = now - this.rateLimiter.lastRequestTime;

        if (timeSinceLastRequest < this.rateLimiter.minDelay) {
            const waitTime = this.rateLimiter.minDelay - timeSinceLastRequest;
            console.log(`[ApiAdapter] Rate limiting: waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.rateLimiter.lastRequestTime = Date.now();
    }

    checkCircuitBreaker() {
        if (this.circuitBreaker.enabled && this.circuitBreaker.state === 'OPEN') {
            const now = Date.now();
            if (now - this.circuitBreaker.lastFailure > this.circuitBreaker.resetTimeout) {
                this.circuitBreaker.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit Breaker is OPEN: API calls are temporarily suspended due to high failure rate');
            }
        }
    }

    recordFailure() {
        if (!this.circuitBreaker.enabled) return;
        
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();
        if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
            this.circuitBreaker.state = 'OPEN';
            console.warn('[ApiAdapter] Circuit Breaker tripped to OPEN state');
        }
    }

    resetCircuitBreaker() {
        if (!this.circuitBreaker.enabled) return;

        if (this.circuitBreaker.state !== 'CLOSED') {
            console.info('[ApiAdapter] Circuit Breaker reset to CLOSED state');
        }
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.state = 'CLOSED';
    }

    isRetryable(error) {
        // Retry on network errors or 5xx server errors
        return !error.response || (error.response.status >= 500 && error.response.status < 600);
    }

    enhanceError(error, attempts) {
        error.message = `Request failed after ${attempts} attempts: ${error.message}`;
        error.isCircuitBreakerOpen = this.circuitBreaker.state === 'OPEN';
        return error;
    }
}

module.exports = ApiAdapter;