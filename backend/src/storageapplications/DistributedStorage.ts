import { EventEmitter } from 'events';
import crypto from 'crypto';
import { DecentralizedStorageService, StorageType, StorageResult } from '../services/storage/DecentralizedStorageService';

/**
 * Represents a storage node in the distributed network.
 */
export interface StorageNode {
  id: string;
  address: string;
  region: string;
  capacity: number;
  usedStorage: number;
  status: 'online' | 'offline' | 'syncing';
  latency: number;
  reliability: number; // 0-1 score
  incentives: number; // Accrued rewards
  lastHeartbeat: number;
}

/**
 * Configuration for distributed storage.
 */
export interface DistributedStorageConfig {
  minReplicas: number;
  maxReplicas: number;
  targetRedundancy: number;
  replicationStrategy: 'eager' | 'lazy' | 'adaptive';
  consistencyLevel: 'strong' | 'eventual' | 'quorum';
  nodeHealthCheckIntervalMs: number;
  rebalanceThreshold: number;
  maxChunkSize: number;
}

/**
 * A single chunk of data distributed across nodes.
 */
export interface StorageChunk {
  chunkId: string;
  parentId: string;
  index: number;
  totalChunks: number;
  data: Buffer;
  size: number;
  hash: string;
  replicas: string[]; // Node IDs
  createdAt: number;
  verifiedAt: number;
}

/**
 * Distribution result containing chunk allocation information.
 */
export interface DistributionResult {
  storageId: string;
  chunks: number;
  nodes: string[];
  replicas: number;
  totalSize: number;
  distributedAt: number;
  storageType: StorageType;
}

/**
 * Incentive record for storage provider rewards.
 */
export interface IncentiveRecord {
  nodeId: string;
  totalRewards: number;
  pendingRewards: number;
  dataStored: number;
  uptimePercentage: number;
  lastPayout: number;
}

/**
 * DistributedStorage handles distributed file storage across network nodes.
 *
 * GIVEN distributed storage, WHEN implemented, THEN data is available across network nodes.
 */
export class DistributedStorage extends EventEmitter {
  private storageService: DecentralizedStorageService;
  private config: DistributedStorageConfig;
  private nodes: Map<string, StorageNode> = new Map();
  private chunks: Map<string, StorageChunk> = new Map();
  private incentives: Map<string, IncentiveRecord> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private rebalanceTimer?: NodeJS.Timeout;

  constructor(storageService: DecentralizedStorageService, config: DistributedStorageConfig) {
    super();
    this.storageService = storageService;
    this.config = config;

    this.startHealthChecks();
    this.startRebalancing();
  }

  /**
   * Register a storage node in the distributed network.
   */
  registerNode(node: StorageNode): void {
    this.nodes.set(node.id, {
      ...node,
      lastHeartbeat: Date.now(),
    });

    if (!this.incentives.has(node.id)) {
      this.incentives.set(node.id, {
        nodeId: node.id,
        totalRewards: 0,
        pendingRewards: 0,
        dataStored: 0,
        uptimePercentage: 100,
        lastPayout: 0,
      });
    }

    this.emit('nodeRegistered', { nodeId: node.id });
  }

  /**
   * Unregister a storage node.
   */
  unregisterNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.emit('nodeUnregistered', { nodeId });

    // Trigger rebalancing for chunks that were on this node
    const affectedChunks = Array.from(this.chunks.values()).filter((c) =>
      c.replicas.includes(nodeId)
    );

    for (const chunk of affectedChunks) {
      this.emit('rebalanceNeeded', { chunkId: chunk.chunkId, lostNode: nodeId });
    }
  }

  /**
   * Distribute data across network nodes.
   *
   * GIVEN distributed storage, WHEN implemented, THEN data is available across network nodes.
   */
  async distributeData(
    data: Buffer,
    options: {
      storageType?: StorageType;
      metadata?: Record<string, any>;
      tags?: string[];
      contentType?: string;
    } = {}
  ): Promise<DistributionResult> {
    const availableNodes = this.getOnlineNodes();
    if (availableNodes.length === 0) {
      throw new Error('No available storage nodes');
    }

    // Chunk data for efficient distribution
    const chunks = this.chunkData(data);
    const selectedNodes = this.selectOptimalNodes(availableNodes, this.config.targetRedundancy);
    const distributionStart = Date.now();

    // Store chunks across selected nodes
    const storageId = this.generateStorageId();

    try {
      // First store all chunks to the primary storage backend
      const storageResult = await this.storageService.storeData(data, {
        storageType: options.storageType || StorageType.HYBRID,
        contentType: options.contentType || 'application/octet-stream',
        metadata: options.metadata,
        tags: options.tags,
      });

      // Then distribute chunks to nodes
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkNodes = this.selectChunkNodes(selectedNodes, this.config.minReplicas);

        const chunkRecord: StorageChunk = {
          chunkId: `${storageId}_chunk_${i}`,
          parentId: storageId,
          index: i,
          totalChunks: chunks.length,
          data: chunk,
          size: chunk.length,
          hash: this.computeHash(chunk),
          replicas: chunkNodes,
          createdAt: Date.now(),
          verifiedAt: 0,
        };

        this.chunks.set(chunkRecord.chunkId, chunkRecord);

        // Track data stored per node for incentives
        for (const nodeId of chunkNodes) {
          this.trackNodeStorage(nodeId, chunk.length);
        }

        this.emit('chunkDistributed', {
          chunkId: chunkRecord.chunkId,
          nodes: chunkNodes,
          size: chunk.length,
        });
      }

      const result: DistributionResult = {
        storageId: storageResult.id,
        chunks: chunks.length,
        nodes: selectedNodes,
        replicas: this.config.targetRedundancy,
        totalSize: data.length,
        distributedAt: distributionStart,
        storageType: options.storageType || StorageType.HYBRID,
      };

      this.emit('distributed', result);
      return result;
    } catch (error) {
      this.emit('distributeError', { storageId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Retrieve distributed data by reassembling chunks.
   */
  async retrieveDistributedData(storageId: string): Promise<Buffer> {
    const storageChunks = Array.from(this.chunks.values())
      .filter((c) => c.parentId === storageId)
      .sort((a, b) => a.index - b.index);

    if (storageChunks.length === 0) {
      // Fall back to standard retrieval
      return this.storageService.retrieveData(storageId);
    }

    // Assemble chunks in order
    const chunks = storageChunks.map((c) => c.data);
    return Buffer.concat(chunks);
  }

  /**
   * Verify distributed data integrity across nodes.
   */
  async verifyDistribution(storageId: string): Promise<boolean> {
    const storageChunks = Array.from(this.chunks.values()).filter(
      (c) => c.parentId === storageId
    );

    if (storageChunks.length === 0) {
      return this.storageService.verifyStorage(storageId);
    }

    for (const chunk of storageChunks) {
      const computedHash = this.computeHash(chunk.data);
      if (computedHash !== chunk.hash) {
        this.emit('chunkCorrupted', { chunkId: chunk.chunkId, expectedHash: chunk.hash, actualHash: computedHash });
        return false;
      }

      chunk.verifiedAt = Date.now();
    }

    return true;
  }

  /**
   * Repair distribution by re-replicating failed chunks.
   */
  async repairDistribution(storageId: string): Promise<boolean> {
    const storageChunks = Array.from(this.chunks.values()).filter(
      (c) => c.parentId === storageId
    );

    if (storageChunks.length === 0) {
      return this.storageService.repairStorage(storageId);
    }

    const onlineNodes = this.getOnlineNodes();
    let repaired = true;

    for (const chunk of storageChunks) {
      const activeReplicas = chunk.replicas.filter((id) =>
        this.nodes.has(id) && this.nodes.get(id)!.status === 'online'
      );

      if (activeReplicas.length < this.config.minReplicas) {
        const needed = this.config.minReplicas - activeReplicas.length;
        const newNodes = this.selectChunkNodes(
          this.selectOptimalNodes(onlineNodes, this.config.targetRedundancy),
          needed
        );

        chunk.replicas = [...activeReplicas, ...newNodes];
        this.emit('chunkRepaired', { chunkId: chunk.chunkId, addedNodes: newNodes });
      }
    }

    return repaired;
  }

  /**
   * Calculate and distribute incentives to storage providers.
   *
   * GIVEN incentive mechanisms, WHEN active, THEN storage providers are rewarded.
   */
  async distributeIncentives(): Promise<void> {
    const now = Date.now();
    const payoutPeriod = 24 * 60 * 60 * 1000; // 24 hours

    for (const [nodeId, incentive] of this.incentives.entries()) {
      const node = this.nodes.get(nodeId);
      if (!node || node.status !== 'online') continue;

      const timeSinceLastPayout = now - incentive.lastPayout;
      if (timeSinceLastPayout < payoutPeriod) continue;

      // Calculate rewards based on storage provided and uptime
      const storageReward = incentive.dataStored * 0.000001; // 0.000001 tokens per byte stored
      const uptimeBonus = (incentive.uptimePercentage / 100) * storageReward * 0.1;
      const totalReward = storageReward + uptimeBonus;

      incentive.pendingRewards += totalReward;
      incentive.lastPayout = now;

      this.emit('incentiveCalculated', {
        nodeId,
        storageReward,
        uptimeBonus,
        totalReward,
      });
    }
  }

  /**
   * Process pending incentive payouts.
   */
  async processPayouts(): Promise<void> {
    for (const [nodeId, incentive] of this.incentives.entries()) {
      if (incentive.pendingRewards > 0) {
        // In a real implementation, this would trigger on-chain payout
        incentive.totalRewards += incentive.pendingRewards;
        incentive.pendingRewards = 0;

        this.emit('payoutComplete', {
          nodeId,
          amount: incentive.pendingRewards,
          totalEarned: incentive.totalRewards,
        });
      }
    }
  }

  /**
   * Get node information.
   */
  getNode(nodeId: string): StorageNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all registered nodes.
   */
  getAllNodes(): StorageNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get online nodes sorted by reliability.
   */
  getOnlineNodes(): StorageNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.status === 'online')
      .sort((a, b) => b.reliability - a.reliability);
  }

  /**
   * Get all distributed chunks.
   */
  getAllChunks(): StorageChunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Get chunks for a specific storage reference.
   */
  getChunksForStorage(storageId: string): StorageChunk[] {
    return Array.from(this.chunks.values()).filter((c) => c.parentId === storageId);
  }

  /**
   * Get incentive record for a node.
   */
  getNodeIncentives(nodeId: string): IncentiveRecord | undefined {
    return this.incentives.get(nodeId);
  }

  /**
   * Get all incentive records.
   */
  getAllIncentives(): IncentiveRecord[] {
    return Array.from(this.incentives.values());
  }

  /**
   * Get distribution metrics.
   */
  getDistributionMetrics(): {
    totalNodes: number;
    onlineNodes: number;
    totalChunks: number;
    totalDataStored: number;
    averageRedundancy: number;
    networkUtilization: number;
  } {
    const onlineNodes = this.getOnlineNodes();
    const totalChunks = this.chunks.size;
    let totalDataStored = 0;
    let totalRedundancy = 0;

    for (const chunk of this.chunks.values()) {
      totalDataStored += chunk.size * chunk.replicas.length;
      totalRedundancy += chunk.replicas.length;
    }

    const totalCapacity = Array.from(this.nodes.values()).reduce((sum, n) => sum + n.capacity, 0);

    return {
      totalNodes: this.nodes.size,
      onlineNodes: onlineNodes.length,
      totalChunks,
      totalDataStored,
      averageRedundancy: totalChunks > 0 ? totalRedundancy / totalChunks : 0,
      networkUtilization: totalCapacity > 0 ? totalDataStored / totalCapacity : 0,
    };
  }

  /**
   * Chunk data into smaller pieces for distribution.
   */
  private chunkData(data: Buffer): Buffer[] {
    const maxSize = this.config.maxChunkSize;
    if (data.length <= maxSize) {
      return [data];
    }

    const chunks: Buffer[] = [];
    for (let i = 0; i < data.length; i += maxSize) {
      chunks.push(data.slice(i, i + maxSize));
    }
    return chunks;
  }

  /**
   * Select optimal nodes based on reliability, latency, and capacity.
   */
  private selectOptimalNodes(nodes: StorageNode[], count: number): string[] {
    return nodes
      .sort((a, b) => {
        const scoreA = a.reliability * 0.5 + (1 - a.latency / 1000) * 0.3 + (a.capacity - a.usedStorage) / a.capacity * 0.2;
        const scoreB = b.reliability * 0.5 + (1 - b.latency / 1000) * 0.3 + (b.capacity - b.usedStorage) / b.capacity * 0.2;
        return scoreB - scoreA;
      })
      .slice(0, Math.min(count, nodes.length))
      .map((n) => n.id);
  }

  /**
   * Select specific nodes for a chunk replica.
   */
  private selectChunkNodes(availableNodes: string[], count: number): string[] {
    // Shuffle to avoid all chunks going to the same nodes
    const shuffled = [...availableNodes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Track storage per node for incentive calculations.
   */
  private trackNodeStorage(nodeId: string, size: number): void {
    const incentive = this.incentives.get(nodeId);
    if (incentive) {
      incentive.dataStored += size;
    }
  }

  /**
   * Start periodic health checks on nodes.
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      for (const [nodeId, node] of this.nodes.entries()) {
        const timeSinceHeartbeat = Date.now() - node.lastHeartbeat;
        if (timeSinceHeartbeat > this.config.nodeHealthCheckIntervalMs * 3) {
          node.status = 'offline';

          // Update uptime
          const incentive = this.incentives.get(nodeId);
          if (incentive) {
            incentive.uptimePercentage = Math.max(0, incentive.uptimePercentage - 1);
          }

          this.emit('nodeOffline', { nodeId });
        }
      }
    }, this.config.nodeHealthCheckIntervalMs);
  }

  /**
   * Start periodic rebalancing.
   */
  private startRebalancing(): void {
    this.rebalanceTimer = setInterval(async () => {
      for (const [chunkId, chunk] of this.chunks.entries()) {
        const activeReplicas = chunk.replicas.filter((id) => {
          const node = this.nodes.get(id);
          return node && node.status === 'online';
        });

        if (activeReplicas.length < this.config.minReplicas) {
          this.emit('rebalanceNeeded', { chunkId, activeReplicas: activeReplicas.length, required: this.config.minReplicas });
          await this.repairDistribution(chunk.parentId);
        }
      }
    }, this.config.nodeHealthCheckIntervalMs * 2);
  }

  /**
   * Generate a unique storage ID.
   */
  private generateStorageId(): string {
    return `distributed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Compute hash of data.
   */
  private computeHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Cleanup resources.
   */
  async cleanup(): Promise<void> {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.rebalanceTimer) clearInterval(this.rebalanceTimer);
    this.nodes.clear();
    this.chunks.clear();
    this.incentives.clear();
    this.removeAllListeners();
  }
}
