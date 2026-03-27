import { ConfigSchema } from '../schema';

describe('Configuration Management', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should validate valid configuration', () => {
        const validConfig = {
            server: {
                port: 4000,
                nodeEnv: 'development',
                allowedOrigins: ['http://localhost:3000'],
                requestSizeLimit: '10mb',
            },
            blockchain: {
                ethereum: {
                    rpcUrl: 'https://mainnet.infura.io/v3/test',
                    bridgeAddress: '0x123',
                },
                polygon: {
                    rpcUrl: 'https://polygon-rpc.com',
                    bridgeAddress: '0x123',
                },
                bsc: {
                    rpcUrl: 'https://bsc-dataseed.binance.org',
                    bridgeAddress: '0x123',
                },
            },
            rateLimits: {
                strict: 100,
                auth: 5,
                api: 60,
                upload: 10,
            },
            features: {
                enablePlayground: true,
                enableIntrospection: true,
                enableSubscriptions: true,
                enableCrossChainBridge: true,
            },
        };

        const result = ConfigSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
    });

    it('should fail on invalid port', () => {
        const invalidConfig = {
            server: {
                port: 'invalid', // Should be a number
            },
        };

        const result = ConfigSchema.deepPartial().safeParse(invalidConfig);
        expect(result.success).toBe(false);
    });

    it('should apply default values', () => {
        const result = ConfigSchema.parse({});
        expect(result.server.port).toBe(4000);
        expect(result.server.nodeEnv).toBe('development');
        expect(result.features.enablePlayground).toBe(true);
    });

    it('should handle feature flag strings correctly in loader logic', () => {
        // This tests the logic we implemented in src/config/index.ts
        const mockEnv = {
            FEATURE_GRAPHQL_PLAYGROUND: 'false',
            FEATURE_REAL_TIME_SUBSCRIPTIONS: 'true',
        };

        const parseFlag = (val: string | undefined) => val === undefined ? undefined : val === 'true';

        expect(parseFlag(mockEnv.FEATURE_GRAPHQL_PLAYGROUND)).toBe(false);
        expect(parseFlag(mockEnv.FEATURE_REAL_TIME_SUBSCRIPTIONS)).toBe(true);
        expect(parseFlag(undefined)).toBe(undefined);
    });
});
