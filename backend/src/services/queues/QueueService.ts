import { DistributedProcessor } from '../../queues/DistributedProcessor';
import { QueueMonitor } from '../../queues/QueueMonitor';
import { PriorityQueue } from '../../queues/PriorityQueue';
import { DeadLetterQueue } from '../../queues/DeadLetterQueue';
import { IQueueJob } from '../../models/QueueJob';
import { EventEmitter } from 'events';

export class QueueService extends EventEmitter {
  private processors: Map<string, DistributedProcessor> = new Map();
  private priorityQueues: Map<string, PriorityQueue> = new Map();
  private deadLetterQueues: Map<string, DeadLetterQueue> = new Map();
  private monitor: QueueMonitor | null = null;
  private queueNames: string[] = [];
  private autoScalingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Register a new queue
   */
  async registerQueue(
    name: string,
    handler: (job: IQueueJob) => Promise<void>,
    options: {
      concurrency?: number;
      timeout?: number;
      autoScale?: boolean;
    } = {}
  ): Promise<void> {
    if (this.processors.has(name)) return;

    this.queueNames.push(name);
    this.priorityQueues.set(name, new PriorityQueue(name));
    this.deadLetterQueues.set(name, new DeadLetterQueue(name));

    const processor = new DistributedProcessor(name, handler, {
      concurrency: options.concurrency || 5,
      timeout: options.timeout || 30000,
    });

    this.processors.set(name, processor);
    processor.start();

    // Re-initialize monitor with new queue names
    if (this.monitor) {
      this.monitor.removeAllListeners();
    }
    this.monitor = new QueueMonitor(this.queueNames);
    
    if (options.autoScale) {
      this.startAutoScaling(name);
    }

    this.emit('queue:registered', { name, options });
  }

  /**
   * Add a job to a queue
   */
  async addJob(queueName: string, data: any, priority: number = 0): Promise<IQueueJob> {
    const queue = this.priorityQueues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not registered`);
    }
    return await queue.addJob(data, priority);
  }

  /**
   * Get queue status
   */
  async getStatus(queueName: string): Promise<any> {
    if (!this.monitor) return null;
    return await this.monitor.getRealTimeStatus(queueName);
  }

  /**
   * Get all queue statuses
   */
  async getAllStatuses(): Promise<any[]> {
    if (!this.monitor) return [];
    return await this.monitor.getAllStatuses();
  }

  /**
   * Auto-scale based on queue length
   */
  private startAutoScaling(name: string): void {
    if (this.autoScalingInterval) return;

    this.autoScalingInterval = setInterval(async () => {
      const processor = this.processors.get(name);
      const queue = this.priorityQueues.get(name);
      
      if (!processor || !queue) return;

      const length = await queue.getLength();
      let newConcurrency = 5; // default

      if (length > 1000) {
        newConcurrency = 50;
      } else if (length > 500) {
        newConcurrency = 30;
      } else if (length > 100) {
        newConcurrency = 15;
      } else if (length > 50) {
        newConcurrency = 10;
      }

      // Update processor concurrency if needed
      if (newConcurrency !== (processor as any).concurrency) {
        processor.setConcurrency(newConcurrency);
        this.emit('queue:scaled', { name, concurrency: newConcurrency });
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Shutdown all processors
   */
  async shutdown(): Promise<void> {
    for (const processor of this.processors.values()) {
      processor.stop();
    }
    if (this.autoScalingInterval) {
      clearInterval(this.autoScalingInterval);
    }
  }
}

export const queueService = new QueueService();
