import { Schema, model, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  id: string;
  type: string;
  timestamp: Date;
  payload: any;
  source: string;
  version: string;
  signature?: string;
  processed: boolean;
  processedAt?: Date;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    requestId?: string;
    correlationId?: string;
  };
  tags: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  expiresAt?: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  payload: {
    type: Schema.Types.Mixed,
    required: true
  },
  source: {
    type: String,
    required: true,
    index: true
  },
  version: {
    type: String,
    required: true,
    default: '1.0'
  },
  signature: {
    type: String,
    sparse: true
  },
  processed: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  processedAt: {
    type: Date,
    sparse: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    requestId: String,
    correlationId: String
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
  },
  retryCount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  maxRetries: {
    type: Number,
    required: true,
    default: 5,
    min: 0
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
  }
}, {
  timestamps: true,
  collection: 'webhook_events'
});

WebhookEventSchema.index({ type: 1, timestamp: -1 });
WebhookEventSchema.index({ source: 1, type: 1 });
WebhookEventSchema.index({ processed: 1, priority: 1 });
WebhookEventSchema.index({ tags: 1, timestamp: -1 });
WebhookEventSchema.index({ 'metadata.correlationId': 1 });

WebhookEventSchema.pre('save', function(next) {
  if (this.isNew && !this.id) {
    this.id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

WebhookEventSchema.methods.markAsProcessed = function(): void {
  this.processed = true;
  this.processedAt = new Date();
};

WebhookEventSchema.methods.incrementRetry = function(): void {
  this.retryCount += 1;
};

WebhookEventSchema.methods.canRetry = function(): boolean {
  return this.retryCount < this.maxRetries && (!this.expiresAt || this.expiresAt > new Date());
};

WebhookEventSchema.methods.isExpired = function(): boolean {
  return this.expiresAt && this.expiresAt <= new Date();
};

WebhookEventSchema.methods.addTag = function(tag: string): void {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
};

WebhookEventSchema.methods.removeTag = function(tag: string): void {
  const index = this.tags.indexOf(tag);
  if (index > -1) {
    this.tags.splice(index, 1);
  }
};

WebhookEventSchema.statics.findByType = function(type: string, limit: number = 50) {
  return this.find({ type })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

WebhookEventSchema.statics.findBySource = function(source: string, limit: number = 50) {
  return this.find({ source })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

WebhookEventSchema.statics.findUnprocessed = function(limit: number = 100) {
  return this.find({ 
    processed: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .sort({ priority: -1, timestamp: 1 })
    .limit(limit)
    .exec();
};

WebhookEventSchema.statics.findRetryable = function(limit: number = 100) {
  return this.find({
    processed: false,
    retryCount: { $lt: this.maxRetries },
    $or: [
      { nextRetryAt: { $lte: new Date() } },
      { nextRetryAt: { $exists: false } }
    ],
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .sort({ priority: -1, nextRetryAt: 1 })
    .limit(limit)
    .exec();
};

WebhookEventSchema.statics.findByTag = function(tag: string, limit: number = 50) {
  return this.find({ tags: tag })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

WebhookEventSchema.statics.findByCorrelationId = function(correlationId: string) {
  return this.find({ 'metadata.correlationId': correlationId })
    .sort({ timestamp: 1 })
    .exec();
};

WebhookEventSchema.statics.getEventStats = function(timeRange?: { start: Date; end: Date }) {
  const matchStage: any = {};
  if (timeRange) {
    matchStage.timestamp = { $gte: timeRange.start, $lte: timeRange.end };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        processedEvents: { $sum: { $cond: ['$processed', 1, 0] } },
        unprocessedEvents: { $sum: { $cond: ['$processed', 0, 1] } },
        eventsByType: {
          $push: {
            type: '$type',
            count: 1
          }
        },
        eventsBySource: {
          $push: {
            source: '$source',
            count: 1
          }
        },
        eventsByPriority: {
          $push: {
            priority: '$priority',
            count: 1
          }
        },
        averageRetries: { $avg: '$retryCount' },
        expiredEvents: {
          $sum: {
            $cond: [
              { $and: [
                { $ne: ['$expiresAt', null] },
                { $lte: ['$expiresAt', new Date()] }
              ]},
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalEvents: 1,
        processedEvents: 1,
        unprocessedEvents: 1,
        processingRate: { $divide: ['$processedEvents', '$totalEvents'] },
        eventsByType: {
          $reduce: {
            input: '$eventsByType',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [[
                    { k: '$$this.type', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.type', input: '$$value' } }, 0] }, 1] } }
                  ]]
                }
              ]
            }
          }
        },
        eventsBySource: {
          $reduce: {
            input: '$eventsBySource',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [[
                    { k: '$$this.source', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.source', input: '$$value' } }, 0] }, 1] } }
                  ]]
                }
              ]
            }
          }
        },
        eventsByPriority: {
          $reduce: {
            input: '$eventsByPriority',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [[
                    { k: '$$this.priority', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.priority', input: '$$value' } }, 0] }, 1] } }
                  ]]
                }
              ]
            }
          }
        },
        averageRetries: { $round: ['$averageRetries', 2] },
        expiredEvents: 1
      }
    }
  ]);
};

WebhookEventSchema.statics.cleanupExpired = function(olderThanDays: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  return this.deleteMany({
    $or: [
      { expiresAt: { $lte: cutoffDate } },
      { 
        processed: true, 
        timestamp: { $lte: cutoffDate },
        priority: { $in: ['low', 'normal'] }
      }
    ]
  });
};

export const WebhookEvent = model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
