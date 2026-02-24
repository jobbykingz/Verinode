import Redis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
}

export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

export const createRedisClient = (): Redis => {
  return new Redis(redisConfig);
};

export const redis = createRedisClient();

redis.on('connect', () => {
  console.log('Redis client connected');
});

redis.on('error', (err) => {
  console.error('Redis client error:', err);
});

redis.on('close', () => {
  console.log('Redis client disconnected');
});

export default redis;
