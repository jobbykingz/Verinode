import { getRedisClient } from '../config/redis.ts';

export class EventAggregator {
  private static instance: EventAggregator;
  private redis = getRedisClient();

  private constructor() {}

  public static getInstance(): EventAggregator {
    if (!EventAggregator.instance) {
      EventAggregator.instance = new EventAggregator();
    }
    return EventAggregator.instance;
  }

  public async aggregateWindow(key: string, value: number, windowSeconds: number = 60): Promise<void> {
    // 1. Sliding window aggregation using Redis Sorted Sets
    const timestamp = Date.now();
    const cutoff = timestamp - windowSeconds * 1000;

    const multi = this.redis.multi();
    multi.zadd(`agg:${key}`, timestamp, `${timestamp}:${value}:${Math.random().toString(36).substr(2, 5)}`);
    multi.zremrangebyscore(`agg:${key}`, '-inf', cutoff);
    await multi.exec();
  }

  public async getAggregatedValue(key: string, windowSeconds: number = 60): Promise<{ count: number; sum: number; avg: number }> {
    const timestamp = Date.now();
    const cutoff = timestamp - windowSeconds * 1000;
    const entries = await this.redis.zrangebyscore(`agg:${key}`, cutoff, '+inf');

    let sum = 0;
    entries.forEach((e: string) => {
      const parts = e.split(':');
      sum += parseFloat(parts[1]);
    });

    return {
      count: entries.length,
      sum,
      avg: entries.length > 0 ? sum / entries.length : 0
    };
  }

  public async trackEventFrequency(eventName: string): Promise<number> {
    // 2. Real-time counter logic
    const minute = Math.floor(Date.now() / 60000);
    const key = `freq:${eventName}:${minute}`;
    
    const count = await this.redis.incr(key);
    await this.redis.expire(key, 3600); // 1-hour retention for per-minute stats
    
    return count;
  }
}
