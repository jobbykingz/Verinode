/**
 * Elasticsearch Configuration
 * Configuration and connection management for Elasticsearch
 */

import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';

export interface ElasticsearchConfig {
  node: string;
  cloud?: {
    id: string;
    username: string;
    password: string;
  };
  auth?: {
    username: string;
    password: string;
  };
  apiKeyId?: string;
  apiKey?: string;
  maxRetries: number;
  requestTimeout: number;
  sniffOnStart: boolean;
  sniffInterval: boolean;
  compression: 'gzip' | 'none';
  ssl?: {
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  indices: {
    main: string;
    proofs: string;
    courses: string;
    templates: string;
    users: string;
    audit: string;
  };
  settings: {
    numberOfShards: number;
    numberOfReplicas: number;
    refreshInterval: string;
    maxResultWindow: number;
  };
  mappings: Record<string, any>;
}

export class ElasticsearchManager {
  private client: Client;
  private config: ElasticsearchConfig;
  private isConnected = false;

  constructor(config: ElasticsearchConfig) {
    this.config = config;
    this.client = this.createClient();
  }

  /**
   * Create Elasticsearch client
   */
  private createClient(): Client {
    const clientConfig: any = {
      node: this.config.node,
      maxRetries: this.config.maxRetries,
      requestTimeout: this.config.requestTimeout,
      sniffOnStart: this.config.sniffOnStart,
      sniffInterval: this.config.sniffInterval,
      compression: this.config.compression
    };

    // Add authentication
    if (this.config.cloud) {
      clientConfig.cloud = this.config.cloud;
    } else if (this.config.auth) {
      clientConfig.auth = this.config.auth;
    } else if (this.config.apiKeyId && this.config.apiKey) {
      clientConfig.auth = {
        apiKey: {
          id: this.config.apiKeyId,
          api_key: this.config.apiKey
        }
      };
    }

    // Add SSL configuration
    if (this.config.ssl) {
      clientConfig.ssl = this.config.ssl;
    }

    return new Client(clientConfig);
  }

  /**
   * Connect to Elasticsearch
   */
  async connect(): Promise<boolean> {
    try {
      // Test connection
      await this.client.ping();
      this.isConnected = true;
      
      logger.info('Connected to Elasticsearch successfully');
      return true;
    } catch (error) {
      logger.error('Failed to connect to Elasticsearch:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Elasticsearch
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.close();
      this.isConnected = false;
      logger.info('Disconnected from Elasticsearch');
    } catch (error) {
      logger.error('Error disconnecting from Elasticsearch:', error);
    }
  }

  /**
   * Check connection status
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.ping();
      return true;
    } catch (error) {
      this.isConnected = false;
      logger.error('Elasticsearch health check failed:', error);
      return false;
    }
  }

  /**
   * Create indices with mappings and settings
   */
  async createIndices(): Promise<boolean> {
    try {
      const indices = [
        { name: this.config.indices.main, mapping: this.config.mappings.main },
        { name: this.config.indices.proofs, mapping: this.config.mappings.proof },
        { name: this.config.indices.courses, mapping: this.config.mappings.course },
        { name: this.config.indices.templates, mapping: this.config.mappings.template },
        { name: this.config.indices.users, mapping: this.config.mappings.user },
        { name: this.config.indices.audit, mapping: this.config.mappings.audit }
      ];

      for (const index of indices) {
        const exists = await this.client.indices.exists({ index: index.name });
        
        if (!exists) {
          await this.client.indices.create({
            index: index.name,
            body: {
              settings: this.config.settings,
              mappings: index.mapping
            }
          });
          
          logger.info(`Created index: ${index.name}`);
        }
      }

      return true;
    } catch (error) {
      logger.error('Failed to create indices:', error);
      return false;
    }
  }

  /**
   * Delete indices
   */
  async deleteIndices(): Promise<boolean> {
    try {
      const indexNames = Object.values(this.config.indices);
      
      await this.client.indices.delete({
        index: indexNames
      });
      
      logger.info('Deleted all search indices');
      return true;
    } catch (error) {
      logger.error('Failed to delete indices:', error);
      return false;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<Record<string, any>> {
    try {
      const stats = await this.client.indices.stats({
        index: Object.values(this.config.indices)
      });

      return stats.body;
    } catch (error) {
      logger.error('Failed to get index stats:', error);
      return {};
    }
  }

  /**
   * Reindex data
   */
  async reindex(sourceIndex: string, targetIndex: string): Promise<boolean> {
    try {
      await this.client.reindex({
        body: {
          source: { index: sourceIndex },
          dest: { index: targetIndex }
        }
      });

      logger.info(`Reindexed from ${sourceIndex} to ${targetIndex}`);
      return true;
    } catch (error) {
      logger.error('Failed to reindex:', error);
      return false;
    }
  }

  /**
   * Optimize indices
   */
  async optimizeIndices(): Promise<boolean> {
    try {
      await this.client.indices.forcemerge({
        index: Object.values(this.config.indices),
        max_num_segments: 1
      });

      logger.info('Optimized search indices');
      return true;
    } catch (error) {
      logger.error('Failed to optimize indices:', error);
      return false;
    }
  }

  /**
   * Get cluster health
   */
  async getClusterHealth(): Promise<any> {
    try {
      const health = await this.client.cluster.health();
      return health.body;
    } catch (error) {
      logger.error('Failed to get cluster health:', error);
      return null;
    }
  }

  /**
   * Get client instance
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Get configuration
   */
  getConfig(): ElasticsearchConfig {
    return { ...this.config };
  }

  /**
   * Update index mapping
   */
  async updateMapping(indexName: string, mapping: any): Promise<boolean> {
    try {
      await this.client.indices.putMapping({
        index: indexName,
        body: mapping
      });

      logger.info(`Updated mapping for index: ${indexName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update mapping for index ${indexName}:`, error);
      return false;
    }
  }

  /**
   * Create index template
   */
  async createTemplate(name: string, template: any): Promise<boolean> {
    try {
      await this.client.indices.putIndexTemplate({
        name,
        body: template
      });

      logger.info(`Created index template: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to create template ${name}:`, error);
      return false;
    }
  }

  /**
   * Get index settings
   */
  async getSettings(indexName?: string): Promise<any> {
    try {
      const settings = await this.client.indices.getSettings({
        index: indexName || Object.values(this.config.indices)
      });

      return settings.body;
    } catch (error) {
      logger.error('Failed to get index settings:', error);
      return null;
    }
  }

  /**
   * Update index settings
   */
  async updateSettings(indexName: string, settings: any): Promise<boolean> {
    try {
      await this.client.indices.putSettings({
        index: indexName,
        body: settings
      });

      logger.info(`Updated settings for index: ${indexName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update settings for index ${indexName}:`, error);
      return false;
    }
  }
}

/**
 * Default Elasticsearch configuration
 */
export const defaultElasticsearchConfig: ElasticsearchConfig = {
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  maxRetries: parseInt(process.env.ELASTICSEARCH_MAX_RETRIES || '3'),
  requestTimeout: parseInt(process.env.ELASTICSEARCH_REQUEST_TIMEOUT || '30000'),
  sniffOnStart: process.env.ELASTICSEARCH_SNIFF_ON_START === 'true',
  sniffInterval: process.env.ELASTICSEARCH_SNIFF_INTERVAL === 'true',
  compression: (process.env.ELASTICSEARCH_COMPRESSION as 'gzip' | 'none') || 'gzip',
  indices: {
    main: process.env.ELASTICSEARCH_INDEX_MAIN || 'verinode_search',
    proofs: process.env.ELASTICSEARCH_INDEX_PROOFS || 'verinode_proofs',
    courses: process.env.ELASTICSEARCH_INDEX_COURSES || 'verinode_courses',
    templates: process.env.ELASTICSEARCH_INDEX_TEMPLATES || 'verinode_templates',
    users: process.env.ELASTICSEARCH_INDEX_USERS || 'verinode_users',
    audit: process.env.ELASTICSEARCH_INDEX_AUDIT || 'verinode_audit'
  },
  settings: {
    numberOfShards: parseInt(process.env.ELASTICSEARCH_SHARDS || '1'),
    numberOfReplicas: parseInt(process.env.ELASTICSEARCH_REPLICAS || '1'),
    refreshInterval: process.env.ELASTICSEARCH_REFRESH_INTERVAL || '1s',
    maxResultWindow: parseInt(process.env.ELASTICSEARCH_MAX_RESULTS || '10000')
  },
  mappings: {
    main: {
      properties: {
        id: { type: 'keyword' },
        type: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'standard',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 }
          }
        },
        description: {
          type: 'text',
          analyzer: 'standard'
        },
        content: {
          type: 'text',
          analyzer: 'standard'
        },
        tags: { type: 'keyword' },
        category: { type: 'keyword' },
        metadata: { type: 'object' },
        timestamp: { type: 'date' },
        tenantId: { type: 'keyword' },
        language: { type: 'keyword' },
        status: { type: 'keyword' },
        visibility: { type: 'keyword' },
        popularity: { type: 'float' },
        rating: { type: 'float' },
        lastIndexed: { type: 'date' },
        version: { type: 'integer' }
      }
    },
    proof: {
      properties: {
        id: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'standard',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 }
          }
        },
        description: { type: 'text', analyzer: 'standard' },
        content: { type: 'text', analyzer: 'standard' },
        proofType: { type: 'keyword' },
        status: { type: 'keyword' },
        creator: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        tags: { type: 'keyword' },
        metadata: { type: 'object' }
      }
    },
    course: {
      properties: {
        id: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'standard',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 }
          }
        },
        description: { type: 'text', analyzer: 'standard' },
        instructor: { type: 'object' },
        category: { type: 'keyword' },
        level: { type: 'keyword' },
        language: { type: 'keyword' },
        tags: { type: 'keyword' },
        skills: { type: 'keyword' },
        price: { type: 'float' },
        rating: { type: 'float' },
        enrollmentCount: { type: 'integer' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' }
      }
    },
    template: {
      properties: {
        id: { type: 'keyword' },
        name: {
          type: 'text',
          analyzer: 'standard',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 }
          }
        },
        description: { type: 'text', analyzer: 'standard' },
        type: { type: 'keyword' },
        category: { type: 'keyword' },
        tags: { type: 'keyword' },
        creator: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        metadata: { type: 'object' }
      }
    },
    user: {
      properties: {
        id: { type: 'keyword' },
        username: {
          type: 'text',
          analyzer: 'standard',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 }
          }
        },
        email: { type: 'keyword' },
        profile: { type: 'object' },
        roles: { type: 'keyword' },
        skills: { type: 'keyword' },
        interests: { type: 'keyword' },
        createdAt: { type: 'date' },
        lastActive: { type: 'date' }
      }
    },
    audit: {
      properties: {
        id: { type: 'keyword' },
        action: { type: 'keyword' },
        userId: { type: 'keyword' },
        resourceType: { type: 'keyword' },
        resourceId: { type: 'keyword' },
        timestamp: { type: 'date' },
        metadata: { type: 'object' },
        ipAddress: { type: 'ip' },
        userAgent: { type: 'text' }
      }
    }
  }
};

/**
 * Create Elasticsearch manager instance
 */
export function createElasticsearchManager(config?: Partial<ElasticsearchConfig>): ElasticsearchManager {
  const finalConfig = { ...defaultElasticsearchConfig, ...config };
  return new ElasticsearchManager(finalConfig);
}

export default ElasticsearchManager;
