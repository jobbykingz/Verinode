import { z } from 'zod';

export const ConfigSchema = z.object({
  server: z.object({
    port: z.number().default(4000),
    nodeEnv: z.enum(['development', 'production', 'test', 'staging']).default('development'),
    allowedOrigins: z.array(z.string()).default(['http://localhost:3000', 'http://localhost:3001', 'http://localhost:4000']),
    requestSizeLimit: z.string().default('10mb'),
  }),
  blockchain: z.object({
    ethereum: z.object({
      rpcUrl: z.string().url().default('https://mainnet.infura.io/v3/YOUR_PROJECT_ID'),
      bridgeAddress: z.string().default('0x1234567890123456789012345678901234567890'),
    }),
    polygon: z.object({
      rpcUrl: z.string().url().default('https://polygon-rpc.com'),
      bridgeAddress: z.string().default('0x1234567890123456789012345678901234567890'),
    }),
    bsc: z.object({
      rpcUrl: z.string().url().default('https://bsc-dataseed.binance.org'),
      bridgeAddress: z.string().default('0x1234567890123456789012345678901234567890'),
    }),
  }),
  rateLimits: z.object({
    strict: z.number().default(100),
    auth: z.number().default(5),
    api: z.number().default(60),
    upload: z.number().default(10),
  }),
  features: z.object({
    enablePlayground: z.boolean().default(true),
    enableIntrospection: z.boolean().default(true),
    enableSubscriptions: z.boolean().default(true),
    enableCrossChainBridge: z.boolean().default(true),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
