import { Schema, model, Document } from 'mongoose';

export interface IWebhookDelivery extends Document {
  id: string;
  webhookId: string;
  eventId: string;
  status: 'pending' | 'processing' | 'delivered' | 'failed' | 'retrying' | 'dead_letter';
  attempts: number;
  maxAttempts: number;
  responseTime?: number;
  statusCode?: number;
  error?: string;
  headers?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  signature?: string;
  verified: boolean;
  createdAt: Date;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  nextRetryAt?: Date;
  expiresAt?: Date;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    requestId?: string;
    correlationId?: string;
    sourceIp?: string;
    destinationUrl?: string;
  };
  tags: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
}

const WebhookDeliverySchema = new Schema<IWebhookDelivery>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  webhookId: {
    type: String,
    required: true,
    index: true
  },
  eventId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'delivered', 'failed', 'retrying', 'dead_letter'],
    default: 'pending',
    index: true
  },
  attempts: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  maxAttempts: {
    type: Number,
    required: true,
    default: 5,
    min: 0
  },
  responseTime: {
    type: Number,
    min: 0
  },
  statusCode: {
    type: Number,
    min: 100,
    max: 599
  },
  error: {
    type: String,
    sparse: true
  },
  headers: {
    type: Map,
    of: String,
    default: new Map()
  },
  requestBody: {
    type: Schema.Types.Mixed
  },
  responseBody: {
    type: Schema.Types.Mixed
  },
  signature: {
    type: String,
    sparse: true
  },
  verified: {
    type: Boolean,
    required: true,
    default: false
  },
  lastAttemptAt: {
    type: Date,
    sparse: true
  },
  deliveredAt: {
    type: Date,
    sparse: true
  },
  nextRetryAt: {
    type: Date,
    sparse: true,
    index: true
  },
  expiresAt: {
    type: Date,
    sparse: true,
    index: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    requestId: String,
    correlationId: String,
    sourceIp: String,
    destinationUrl: String
  },
  tags: [{
    type: String,
    index: true
  }],
  priority: {
    type: String,
    required: true,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal',
    index: true
  }
}, {
  timestamps: true,
  collection: 'webhook_deliveries'
});

WebhookDeliverySchema.index({ webhookId: 1, status: 1 });
WebhookDeliverySchema.index({ eventId: 1, status: 1 });
WebhookDeliverySchema.index({ status: 1, nextRetryAt: 1 });
WebhookDeliverySchema.index({ createdAt: -1 });
WebhookDeliverySchema.index({ webhookId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ 'metadata.correlationId': 1 });

WebhookDeliverySchema.pre('save', function(next: any) {
  if (this.isNew && !this.id) {
    this.id = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

WebhookDeliverySchema.methods.markAsProcessing = function(): void {
  this.status = 'processing';
  this.lastAttemptAt = new Date();
};

WebhookDeliverySchema.methods.markAsDelivered = function(responseTime: number, statusCode: number): void {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  this.responseTime = responseTime;
  this.statusCode = statusCode;
  this.error = undefined;
};

WebhookDeliverySchema.methods.markAsFailed = function(error: string, statusCode?: number, responseTime?: number): void {
  this.status = 'failed';
  this.error = error;
  if (statusCode) this.statusCode = statusCode;
  if (responseTime) this.responseTime = responseTime;
};

WebhookDeliverySchema.methods.markForRetry = function(nextRetryAt: Date): void {
  this.status = 'retrying';
  this.nextRetryAt = nextRetryAt;
};

WebhookDeliverySchema.methods.moveToDeadLetter = function(reason: string): void {
  this.status = 'dead_letter';
  this.error = this.error || reason;
};

WebhookDeliverySchema.methods.incrementAttempt = function(): void {
  this.attempts += 1;
  this.lastAttemptAt = new Date();
};

WebhookDeliverySchema.methods.canRetry = function(): boolean {
  return this.attempts < this.maxAttempts && 
         (!this.expiresAt || this.expiresAt > new Date()) &&
         this.status !== 'delivered' &&
         this.status !== 'dead_letter';
};

WebhookDeliverySchema.methods.isExpired = function(): boolean {
  return this.expiresAt && this.expiresAt <= new Date();
};

WebhookDeliverySchema.methods.isFinalStatus = function(): boolean {
  return ['delivered', 'dead_letter'].includes(this.status);
};

WebhookDeliverySchema.methods.addTag = function(tag: string): void {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
};

WebhookDeliverySchema.methods.removeTag = function(tag: string): void {
  const index = this.tags.indexOf(tag);
  if (index > -1) {
    this.tags.splice(index, 1);
  }
};

WebhookDeliverySchema.methods.calculateLatency = function(): number {
  if (!this.deliveredAt) return 0;
  return this.deliveredAt.getTime() - this.createdAt.getTime();
};

WebhookDeliverySchema.statics.findByWebhookId = function(webhookId: string, limit: number = 50) {
  return this.find({ webhookId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

WebhookDeliverySchema.statics.findByEventId = function(eventId: string) {
  return this.find({ eventId })
    .sort({ createdAt: 1 })
    .exec();
};

WebhookDeliverySchema.statics.findPending = function(limit: number = 100) {
  return this.find({ 
    status: 'pending',
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit)
    .exec();
};

WebhookDeliverySchema.statics.findRetryable = function(limit: number = 100) {
  return this.find({
    status: 'retrying',
    nextRetryAt: { $lte: new Date() },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .sort({ priority: -1, nextRetryAt: 1 })
    .limit(limit)
    .exec();
};

WebhookDeliverySchema.statics.findFailed = function(limit: number = 50) {
  return this.find({ status: 'failed' })
    .sort({ lastAttemptAt: -1 })
    .limit(limit)
    .exec();
};

WebhookDeliverySchema.statics.findDeadLetter = function(limit: number = 50) {
  return this.find({ status: 'dead_letter' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

WebhookDeliverySchema.statics.findByStatus = function(status: string, limit: number = 50) {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

WebhookDeliverySchema.statics.findByTag = function(tag: string, limit: number = 50) {
  return this.find({ tags: tag })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

WebhookDeliverySchema.statics.findByCorrelationId = function(correlationId: string) {
  return this.find({ 'metadata.correlationId': correlationId })
    .sort({ createdAt: 1 })
    .exec();
};

WebhookDeliverySchema.statics.getDeliveryStats = function(timeRange?: { start: Date; end: Date }) {
  const matchStage: any = {};
  if (timeRange) {
    matchStage.createdAt = { $gte: timeRange.start, $lte: timeRange.end };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalDeliveries: { $sum: 1 },
        successfulDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        failedDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        pendingDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        retryingDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'retrying'] }, 1, 0] } },
        deadLetterDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'dead_letter'] }, 1, 0] } },
        averageResponseTime: { $avg: '$responseTime' },
        averageAttempts: { $avg: '$attempts' },
        deliveriesByStatus: {
          $push: {
            status: '$status',
            count: 1
          }
        },
        deliveriesByWebhook: {
          $push: {
            webhookId: '$webhookId',
            count: 1
          }
        },
        statusCodeDistribution: {
          $push: {
            statusCode: '$statusCode',
            count: 1
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalDeliveries: 1,
        successfulDeliveries: 1,
        failedDeliveries: 1,
        pendingDeliveries: 1,
        retryingDeliveries: 1,
        deadLetterDeliveries: 1,
        successRate: { $divide: ['$successfulDeliveries', '$totalDeliveries'] },
        failureRate: { $divide: ['$failedDeliveries', '$totalDeliveries'] },
        averageResponseTime: { $round: ['$averageResponseTime', 2] },
        averageAttempts: { $round: ['$averageAttempts', 2] },
        deliveriesByStatus: {
          $reduce: {
            input: '$deliveriesByStatus',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [[
                    { k: '$$this.status', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.status', input: '$$value' } }, 0] }, 1] } }
                  ]]
                }
              ]
            }
          }
        },
        deliveriesByWebhook: {
          $reduce: {
            input: '$deliveriesByWebhook',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [[
                    { k: '$$this.webhookId', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.webhookId', input: '$$value' } }, 0] }, 1] } }
                  ]]
                }
              ]
            }
          }
        },
        statusCodeDistribution: {
          $reduce: {
            input: '$statusCodeDistribution',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [[
                    { k: { $toString: '$$this.statusCode' }, v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.statusCode', input: '$$value' } }, 0] }, 1] } }
                  ]]
                }
              ]
            }
          }
        }
      }
    }
  ]);
};

WebhookDeliverySchema.statics.getHourlyStats = function(timeRange: { start: Date; end: Date }) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: timeRange.start, $lte: timeRange.end }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%dT%H', date: '$createdAt' } },
        total: { $sum: 1 },
        successful: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        avgResponseTime: { $avg: '$responseTime' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

WebhookDeliverySchema.statics.cleanupExpired = function(olderThanDays: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  return this.deleteMany({
    $or: [
      { expiresAt: { $lte: cutoffDate } },
      { 
        status: { $in: ['delivered', 'dead_letter'] }, 
        createdAt: { $lte: cutoffDate }
      }
    ]
  });
};

export const WebhookDelivery = model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);
