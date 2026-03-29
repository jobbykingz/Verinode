import { getRedisClient } from '../config/redis.ts';

export class StreamProcessor {
  private static instance: StreamProcessor;
  private redis = getRedisClient();

  private constructor() {}

  public static getInstance(): StreamProcessor {
    if (!StreamProcessor.instance) {
      StreamProcessor.instance = new StreamProcessor();
    }
    return StreamProcessor.instance;
  }

  public async publishEvent(stream: string, event: { type: string; payload: any; timestamp: number }): Promise<string> {
    // 1. Emit to Redis Stream
    const messageId = await this.redis.xadd(stream, '*', 'type', event.type, 'payload', JSON.stringify(event.payload));
    
    // 2. Notify real-time listeners (Pub/Sub)
    await this.redis.publish(`stream-updates:${stream}`, JSON.stringify(event));

    return messageId || 'no-id';
  }

  public async consumeStream(stream: string, consumerGroup: string, consumerName: string, batchSize: number = 10): Promise<any[]> {
    // 3. Consume from Redis Stream (using XREADGROUP for scalable processing)
    // Mock logic for processing:
    const results = await this.redis.xread('STREAMS', stream, '0');
    if (!results || results.length === 0) return [];
    
    const messages = results[0][1];
    return messages.map((m: any) => {
      const id = m[0];
      const fields = m[1];
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }
      return { id, data };
    });
  }

  public async getStreamStats(stream: string) {
    return this.redis.xlen(stream);
  }
}
