import cors from 'cors';
import { Request, Response } from 'express';
import { config } from '../config';

interface CorsOptions {
  origin: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

const isProduction = config.server.nodeEnv === 'production';

const allowedOrigins = config.server.allowedOrigins;

export const corsConfig: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS violation:', {
        origin,
        timestamp: new Date().toISOString(),
        ip: origin
      });

      callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

export const corsMiddleware = cors(corsConfig);

// Strict CORS configuration for sensitive endpoints
export const strictCorsConfig: CorsOptions = {
  ...corsConfig,
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(new Error('Origin required'), false);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('Strict CORS violation:', {
        origin,
        timestamp: new Date().toISOString(),
        ip: origin
      });

      callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  methods: ['GET', 'POST'], // More restrictive methods
  allowedHeaders: [
    'Origin',
    'Content-Type',
    'Accept',
    'Authorization'
  ]
};

export const strictCorsMiddleware = cors(strictCorsConfig);

// Development-only CORS configuration
export const devCorsConfig: CorsOptions = {
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: true
};

export const devCorsMiddleware = !isProduction ? cors(devCorsConfig) : corsMiddleware;

export const getCorsMiddleware = (isStrict: boolean = false) => {
  return isStrict ? strictCorsMiddleware : corsMiddleware;
};
