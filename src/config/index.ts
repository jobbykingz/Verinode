import dotenv from 'dotenv';
import { ConfigSchema, Config } from './schema';

// Load environment variables from .env file
dotenv.config();

const parseConfig = (): Config => {
    const rawConfig = {
        server: {
            port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
            nodeEnv: process.env.NODE_ENV,
            allowedOrigins: process.env.ALLOWED_ORIGINS?.split(','),
            requestSizeLimit: process.env.REQUEST_SIZE_LIMIT,
        },
        blockchain: {
            ethereum: {
                rpcUrl: process.env.ETHEREUM_RPC_URL,
                bridgeAddress: process.env.ETHEREUM_BRIDGE_ADDRESS,
            },
            polygon: {
                rpcUrl: process.env.POLYGON_RPC_URL,
                bridgeAddress: process.env.POLYGON_BRIDGE_ADDRESS,
            },
            bsc: {
                rpcUrl: process.env.BSC_RPC_URL,
                bridgeAddress: process.env.BSC_BRIDGE_ADDRESS,
            },
        },
        rateLimits: {
            strict: process.env.RATE_LIMIT_STRICT ? parseInt(process.env.RATE_LIMIT_STRICT, 10) : undefined,
            auth: process.env.RATE_LIMIT_AUTH ? parseInt(process.env.RATE_LIMIT_AUTH, 10) : undefined,
            api: process.env.RATE_LIMIT_API ? parseInt(process.env.RATE_LIMIT_API, 10) : undefined,
            upload: process.env.RATE_LIMIT_UPLOAD ? parseInt(process.env.RATE_LIMIT_UPLOAD, 10) : undefined,
        },
        features: {
            enablePlayground: process.env.FEATURE_GRAPHQL_PLAYGROUND === undefined ? undefined : process.env.FEATURE_GRAPHQL_PLAYGROUND === 'true',
            enableIntrospection: process.env.FEATURE_GRAPHQL_INTROSPECTION === undefined ? undefined : process.env.FEATURE_GRAPHQL_INTROSPECTION === 'true',
            enableSubscriptions: process.env.FEATURE_REAL_TIME_SUBSCRIPTIONS === undefined ? undefined : process.env.FEATURE_REAL_TIME_SUBSCRIPTIONS === 'true',
            enableCrossChainBridge: process.env.FEATURE_CROSS_CHAIN_BRIDGE === undefined ? undefined : process.env.FEATURE_CROSS_CHAIN_BRIDGE === 'true',
        },
    };

    const result = ConfigSchema.safeParse(rawConfig);

    if (!result.success) {
        console.error('❌ Invalid configuration:', result.error.format());
        process.exit(1);
    }

    return result.data;
};

export const config = parseConfig();

// Export as default for convenience
export default config;
