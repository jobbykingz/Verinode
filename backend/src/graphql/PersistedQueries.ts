import { createHash } from 'crypto';
import { getRedisClient } from '../config/redis.ts';

export class PersistedQueries {
  private static instance: PersistedQueries;
  private redis = getRedisClient();

  private constructor() {}

  public static getInstance(): PersistedQueries {
    if (!PersistedQueries.instance) {
      PersistedQueries.instance = new PersistedQueries();
    }
    return PersistedQueries.instance;
  }

  public async getQuery(hash: string): Promise<string | null> {
    return this.redis.get(`pq:${hash}`);
  }

  public async saveQuery(query: string): Promise<string> {
    const hash = createHash('sha256').update(query).digest('hex');
    await this.redis.set(`pq:${hash}`, query, 'EX', 3600 * 24); // Persistent for 24 hours
    return hash;
  }

  public async validateHash(hash: string, query: string): Promise<boolean> {
    const calculatedHash = createHash('sha256').update(query).digest('hex');
    return hash === calculatedHash;
  }
}
