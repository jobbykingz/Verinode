const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const ApiAdapter = require('../ApiAdapter');

// Mock console logs to prevent cluttering test output
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
};

describe('ApiAdapter', () => {
    let mock;
    let config;

    beforeEach(() => {
        mock = new MockAdapter(axios);
        config = {
            network: {
                retry: { max_attempts: 3, delay: 100, backoff_multiplier: 2 },
                request_timeout: 1000,
                circuit_breaker: { enabled: true, failure_threshold: 2, reset_timeout: 500 },
            },
            security: {
                rate_limit: { requests_per_minute: 600 } // 10 requests/sec -> 100ms delay
            }
        };
        jest.useFakeTimers();
    });

    afterEach(() => {
        mock.reset();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('Input Validation', () => {
        it('should sanitize and allow valid parameters', async () => {
            const adapter = new ApiAdapter(config);
            mock.onGet().reply(200, {});
            const params = { fsym: 'eth', tsyms: 'usd,btc' };
            await adapter.request('GET', 'test-url', { params });
            expect(params.fsym).toBe('ETH');
            expect(params.tsyms).toBe('USD,BTC');
        });

        it('should throw an error for invalid fsym', () => {
            const adapter = new ApiAdapter(config);
            const params = { fsym: 'ETHEREUM_TOO_LONG' };
            expect(() => adapter._validateAndSanitize(params)).toThrow('Input validation failed: "fsym" parameter must be a string between 1 and 10 characters.');
        });

        it('should throw an error for invalid tsyms', () => {
            const adapter = new ApiAdapter(config);
            const params = { tsyms: 'USD,BITCOIN_TOO_LONG' };
            expect(() => adapter._validateAndSanitize(params)).toThrow('Input validation failed: All symbols in "tsyms" must be between 1 and 10 characters.');
        });
    });

    describe('Retry Logic', () => {
        it('should not retry on success', async () => {
            const adapter = new ApiAdapter(config);
            mock.onGet('test-url').reply(200, { success: true });
            await adapter.request('GET', 'test-url');
            expect(mock.history.get.length).toBe(1);
        });

        it('should retry on 5xx server errors and eventually succeed', async () => {
            const adapter = new ApiAdapter(config);
            mock.onGet('test-url').replyOnce(500).onGet('test-url').reply(200, { success: true });
            
            const requestPromise = adapter.request('GET', 'test-url');
            await jest.advanceTimersByTimeAsync(100); // First retry delay
            await requestPromise;

            expect(mock.history.get.length).toBe(2);
            expect(console.log).toHaveBeenCalledWith('[ApiAdapter] Retrying in 100ms...');
        });

        it('should fail after max attempts on persistent 5xx errors', async () => {
            const adapter = new ApiAdapter(config);
            mock.onGet('test-url').reply(503);

            const requestPromise = adapter.request('GET', 'test-url');
            
            await jest.advanceTimersByTimeAsync(100); // 1st retry
            await jest.advanceTimersByTimeAsync(200); // 2nd retry

            await expect(requestPromise).rejects.toThrow('Request failed after 3 attempts: Request failed with status code 503');
            expect(mock.history.get.length).toBe(3);
        });

        it('should not retry on 4xx client errors', async () => {
            const adapter = new ApiAdapter(config);
            mock.onGet('test-url').reply(404);
            await expect(adapter.request('GET', 'test-url')).rejects.toThrow('Request failed after 1 attempts: Request failed with status code 404');
            expect(mock.history.get.length).toBe(1);
        });
    });

    describe('Circuit Breaker', () => {
        it('should trip to OPEN state after reaching failure threshold', async () => {
            const adapter = new ApiAdapter(config);
            mock.onGet('test-url').reply(500);

            await expect(adapter.request('GET', 'test-url')).rejects.toThrow();
            await expect(adapter.request('GET', 'test-url')).rejects.toThrow();

            expect(adapter.circuitBreaker.failures).toBe(2);
            expect(adapter.circuitBreaker.state).toBe('OPEN');
            expect(console.warn).toHaveBeenCalledWith('[ApiAdapter] Circuit Breaker tripped to OPEN state');
        });

        it('should block requests when circuit is OPEN', async () => {
            const adapter = new ApiAdapter(config);
            adapter.circuitBreaker.state = 'OPEN';
            adapter.circuitBreaker.lastFailure = Date.now();

            await expect(adapter.request('GET', 'test-url')).rejects.toThrow('Circuit Breaker is OPEN');
            expect(mock.history.get.length).toBe(0);
        });

        it('should reset to CLOSED on success in HALF_OPEN state', async () => {
            const adapter = new ApiAdapter(config);
            adapter.circuitBreaker.state = 'OPEN';
            adapter.circuitBreaker.lastFailure = Date.now();

            await jest.advanceTimersByTimeAsync(config.network.circuit_breaker.reset_timeout + 1);
            
            mock.onGet('test-url').reply(200, { success: true });
            await adapter.request('GET', 'test-url');
            
            expect(adapter.circuitBreaker.state).toBe('CLOSED');
            expect(console.info).toHaveBeenCalledWith('[ApiAdapter] Circuit Breaker reset to CLOSED state');
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce delay between requests', async () => {
            const adapter = new ApiAdapter(config);
            mock.onGet('test-url').reply(200);

            const startTime = Date.now();
            
            const p1 = adapter.request('GET', 'test-url');
            await jest.advanceTimersByTimeAsync(0);
            await p1;
            
            const p2 = adapter.request('GET', 'test-url');
            await jest.advanceTimersByTimeAsync(100); // minDelay is 100ms
            await p2;

            const endTime = Date.now();

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[ApiAdapter] Rate limiting: waiting'));
            expect(endTime - startTime).toBeGreaterThanOrEqual(100);
            expect(mock.history.get.length).toBe(2);
        });
    });
});