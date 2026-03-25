import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Web3 from 'web3';
import { ICrossChainEvent } from '../models/CrossChainEvent';
import { MonitoringService } from '../monitoringService';
import { RedisService } from '../redisService';

export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  contractAddresses: string[];
  eventSignatures: string[];
  pollingInterval: number;
  lastPolledBlock: number;
  isActive: boolean;
}

export interface ListenerMetrics {
  chainId: number;
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  lastUpdate: Date;
  avgProcessingTime: number;
}

@Injectable()
export class ChainListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChainListener.name);
  private readonly web3Instances: Map<number, Web3> = new Map();
  private readonly chainConfigs: Map<number, ChainConfig> = new Map();
  private readonly pollingIntervals: Map<number, NodeJS.Timeout> = new Map();
  private readonly eventQueue: Map<number, any[]> = new Map();

  constructor(
    @InjectModel('CrossChainEvent') private eventModel: Model<ICrossChainEvent>,
    private monitoringService: MonitoringService,
    private redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.initializeChains();
    await this.startPolling();
  }

  async onModuleDestroy() {
    this.stopPolling();
    // Close Web3 connections
    for (const web3 of this.web3Instances.values()) {
      if (web3.currentProvider && typeof web3.currentProvider.disconnect === 'function') {
        web3.currentProvider.disconnect();
      }
    }
  }

  private async initializeChains() {
    // Initialize supported chains
    const chains = [
      {
        chainId: 1,
        rpcUrl: process.env.ETH_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
        contractAddresses: [], // To be loaded from config
        eventSignatures: [], // To be loaded from config
        pollingInterval: 15000, // 15 seconds
      },
      {
        chainId: 56,
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
        contractAddresses: [],
        eventSignatures: [],
        pollingInterval: 15000,
      },
      {
        chainId: 137,
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com/',
        contractAddresses: [],
        eventSignatures: [],
        pollingInterval: 15000,
      },
      {
        chainId: 43114,
        rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
        contractAddresses: [],
        eventSignatures: [],
        pollingInterval: 15000,
      },
    ];

    for (const chain of chains) {
      try {
        const web3 = new Web3(chain.rpcUrl);
        this.web3Instances.set(chain.chainId, web3);

        // Load last polled block from Redis or database
        const lastBlock = await this.getLastPolledBlock(chain.chainId);
        const config: ChainConfig = {
          ...chain,
          lastPolledBlock: lastBlock,
          isActive: true,
        };

        this.chainConfigs.set(chain.chainId, config);
        this.eventQueue.set(chain.chainId, []);

        this.logger.log(`Initialized listener for chain ${chain.chainId}`);
      } catch (error) {
        this.logger.error(`Failed to initialize chain ${chain.chainId}:`, error);
      }
    }
  }

  private async getLastPolledBlock(chainId: number): Promise<number> {
    // Try Redis first
    const cached = await this.redisService.get(`chain:${chainId}:lastBlock`);
    if (cached) {
      return parseInt(cached);
    }

    // Fallback to database
    const latestEvent = await this.eventModel
      .findOne({ chainId })
      .sort({ blockNumber: -1 })
      .select('blockNumber');

    return latestEvent ? latestEvent.blockNumber : 0;
  }

  private async startPolling() {
    for (const [chainId, config] of this.chainConfigs) {
      if (!config.isActive) continue;

      const interval = setInterval(async () => {
        try {
          await this.pollChain(chainId);
        } catch (error) {
          this.logger.error(`Polling failed for chain ${chainId}:`, error);
          await this.monitoringService.recordMetric('listener.poll.error', 1, { chainId: chainId.toString() });
        }
      }, config.pollingInterval);

      this.pollingIntervals.set(chainId, interval);
      this.logger.log(`Started polling for chain ${chainId} every ${config.pollingInterval}ms`);
    }
  }

  private stopPolling() {
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
  }

  private async pollChain(chainId: number): Promise<void> {
    const config = this.chainConfigs.get(chainId);
    const web3 = this.web3Instances.get(chainId);

    if (!config || !web3 || !config.isActive) {
      return;
    }

    try {
      const currentBlock = await web3.eth.getBlockNumber();
      const fromBlock = config.lastPolledBlock + 1;
      const toBlock = Math.min(currentBlock, fromBlock + 1000); // Limit batch size

      if (fromBlock > toBlock) {
        return; // No new blocks
      }

      this.logger.debug(`Polling chain ${chainId} from block ${fromBlock} to ${toBlock}`);

      // Get past events for all configured contracts and signatures
      const events = await this.fetchEvents(web3, config, fromBlock, toBlock);

      if (events.length > 0) {
        await this.processEvents(chainId, events);
        await this.updateLastPolledBlock(chainId, toBlock);
      }

      // Update metrics
      await this.updateMetrics(chainId, events.length, 0, 0);

    } catch (error) {
      this.logger.error(`Failed to poll chain ${chainId}:`, error);
      await this.monitoringService.recordMetric('listener.poll.error', 1, { chainId: chainId.toString() });
    }
  }

  private async fetchEvents(
    web3: Web3,
    config: ChainConfig,
    fromBlock: number,
    toBlock: number
  ): Promise<any[]> {
    const allEvents: any[] = [];

    for (const contractAddress of config.contractAddresses) {
      for (const eventSignature of config.eventSignatures) {
        try {
          const events = await web3.eth.getPastLogs({
            address: contractAddress,
            topics: [eventSignature],
            fromBlock,
            toBlock,
          });

          allEvents.push(...events.map(event => ({
            ...event,
            contractAddress,
            eventSignature,
          })));
        } catch (error) {
          this.logger.warn(`Failed to fetch events for contract ${contractAddress}:`, error);
        }
      }
    }

    return allEvents;
  }

  private async processEvents(chainId: number, events: any[]): Promise<void> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.processSingleEvent(chainId, event);
        processed++;
      } catch (error) {
        this.logger.error(`Failed to process event ${event.transactionHash}:`, error);
        failed++;
      }
    }

    const processingTime = Date.now() - startTime;
    await this.updateMetrics(chainId, 0, processed, failed);

    if (processed > 0) {
      await this.monitoringService.recordMetric('listener.events.processed', processed, {
        chainId: chainId.toString()
      });
    }

    if (failed > 0) {
      await this.monitoringService.recordMetric('listener.events.failed', failed, {
        chainId: chainId.toString()
      });
    }

    this.logger.log(`Processed ${processed} events, ${failed} failed for chain ${chainId}`);
  }

  private async processSingleEvent(chainId: number, event: any): Promise<void> {
    // Check if event already exists
    const existingEvent = await this.eventModel.findOne({
      chainId,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
    });

    if (existingEvent) {
      return; // Already processed
    }

    // Get block timestamp
    const web3 = this.web3Instances.get(chainId);
    if (!web3) throw new Error(`Web3 instance not found for chain ${chainId}`);

    const block = await web3.eth.getBlock(event.blockNumber);
    const timestamp = new Date(Number(block.timestamp) * 1000);

    // Create event document
    const crossChainEvent = new this.eventModel({
      eventId: `${chainId}-${event.transactionHash}-${event.logIndex}`,
      chainId,
      contractAddress: event.contractAddress,
      eventSignature: event.eventSignature,
      eventData: event,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      timestamp,
      synced: false,
      syncAttempts: 0,
      relayedToChains: [],
    });

    await crossChainEvent.save();

    // Add to event queue for immediate processing
    const queue = this.eventQueue.get(chainId) || [];
    queue.push(crossChainEvent);
    this.eventQueue.set(chainId, queue);
  }

  private async updateLastPolledBlock(chainId: number, blockNumber: number): Promise<void> {
    const config = this.chainConfigs.get(chainId);
    if (config) {
      config.lastPolledBlock = blockNumber;
      this.chainConfigs.set(chainId, config);

      // Cache in Redis
      await this.redisService.set(`chain:${chainId}:lastBlock`, blockNumber.toString(), 3600);
    }
  }

  private async updateMetrics(
    chainId: number,
    newEvents: number,
    processedEvents: number,
    failedEvents: number
  ): Promise<void> {
    const metricsKey = `listener:metrics:${chainId}`;
    const existing = await this.redisService.get(metricsKey);
    let metrics: ListenerMetrics;

    if (existing) {
      metrics = JSON.parse(existing);
      metrics.totalEvents += newEvents;
      metrics.processedEvents += processedEvents;
      metrics.failedEvents += failedEvents;
      metrics.lastUpdate = new Date();
    } else {
      metrics = {
        chainId,
        totalEvents: newEvents,
        processedEvents,
        failedEvents,
        lastUpdate: new Date(),
        avgProcessingTime: 0,
      };
    }

    await this.redisService.set(metricsKey, JSON.stringify(metrics), 3600);
  }

  async getQueuedEvents(chainId: number): Promise<any[]> {
    return this.eventQueue.get(chainId) || [];
  }

  async dequeueEvent(chainId: number): Promise<any | null> {
    const queue = this.eventQueue.get(chainId) || [];
    if (queue.length === 0) return null;

    const event = queue.shift();
    this.eventQueue.set(chainId, queue);
    return event;
  }

  async getMetrics(chainId: number): Promise<ListenerMetrics | null> {
    const cached = await this.redisService.get(`listener:metrics:${chainId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async updateChainConfig(chainId: number, updates: Partial<ChainConfig>): Promise<void> {
    const config = this.chainConfigs.get(chainId);
    if (config) {
      const updatedConfig = { ...config, ...updates };
      this.chainConfigs.set(chainId, updatedConfig);

      // If polling interval changed, restart polling
      if (updates.pollingInterval && updates.pollingInterval !== config.pollingInterval) {
        await this.restartPolling(chainId);
      }
    }
  }

  private async restartPolling(chainId: number): Promise<void> {
    const existingInterval = this.pollingIntervals.get(chainId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const config = this.chainConfigs.get(chainId);
    if (config && config.isActive) {
      const interval = setInterval(async () => {
        try {
          await this.pollChain(chainId);
        } catch (error) {
          this.logger.error(`Polling failed for chain ${chainId}:`, error);
        }
      }, config.pollingInterval);

      this.pollingIntervals.set(chainId, interval);
    }
  }

  async pauseChain(chainId: number): Promise<void> {
    const config = this.chainConfigs.get(chainId);
    if (config) {
      config.isActive = false;
      this.chainConfigs.set(chainId, config);

      const interval = this.pollingIntervals.get(chainId);
      if (interval) {
        clearInterval(interval);
        this.pollingIntervals.delete(chainId);
      }

      this.logger.log(`Paused listening for chain ${chainId}`);
    }
  }

  async resumeChain(chainId: number): Promise<void> {
    const config = this.chainConfigs.get(chainId);
    if (config) {
      config.isActive = true;
      this.chainConfigs.set(chainId, config);
      await this.restartPolling(chainId);
      this.logger.log(`Resumed listening for chain ${chainId}`);
    }
  }
}