import mongoose, { Schema, Document } from 'mongoose';

/**
 * Event Interface for Event Sourcing
 */
export interface IEvent extends Document {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: Record<string, any>;
  eventMetadata: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
    version: number;
    timestamp: Date;
    [key: string]: any;
  };
  sequenceNumber: number;
  eventVersion: number;
  createdAt: Date;
  processedAt?: Date;
  processingAttempts: number;
  lastError?: string;
  isProcessed: boolean;
}

/**
 * Event Schema
 */
const EventSchema = new Schema<IEvent>({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  aggregateId: {
    type: String,
    required: true,
    index: true
  },
  aggregateType: {
    type: String,
    required: true,
    enum: ['Proof', 'User', 'BatchOperation', 'MultiSigWallet', 'WebhookEvent', 'CustomTemplate'],
    index: true
  },
  eventType: {
    type: String,
    required: true,
    index: true
  },
  eventData: {
    type: Schema.Types.Mixed,
    required: true
  },
  eventMetadata: {
    userId: {
      type: String,
      index: true
    },
    correlationId: {
      type: String,
      index: true
    },
    causationId: {
      type: String
    },
    version: {
      type: Number,
      required: true,
      min: 1
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  sequenceNumber: {
    type: Number,
    required: true,
    min: 1
  },
  eventVersion: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  processedAt: {
    type: Date,
    index: true
  },
  processingAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  lastError: {
    type: String
  },
  isProcessed: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'events'
});

// Compound indexes for optimal query performance
EventSchema.index({ aggregateId: 1, sequenceNumber: 1 });
EventSchema.index({ aggregateType: 1, aggregateId: 1, sequenceNumber: 1 });
EventSchema.index({ eventType: 1, createdAt: -1 });
EventSchema.index({ 'eventMetadata.userId': 1, createdAt: -1 });
EventSchema.index({ isProcessed: 1, createdAt: -1 });
EventSchema.index({ 'eventMetadata.correlationId': 1 });

// Text index for event data search
EventSchema.index({
  eventType: 'text',
  'eventData': 'text'
});

// Pre-save middleware to ensure sequence number consistency
EventSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Ensure sequence number is set correctly for the aggregate
    const lastEvent = await this.constructor.findOne({
      aggregateId: this.aggregateId
    }).sort({ sequenceNumber: -1 });
    
    if (!this.sequenceNumber) {
      this.sequenceNumber = (lastEvent?.sequenceNumber || 0) + 1;
    }
  }
  next();
});

// Static methods
EventSchema.statics.findByAggregate = function(
  aggregateId: string, 
  options: { fromSequence?: number; toSequence?: number; limit?: number } = {}
) {
  const query: any = { aggregateId };
  
  if (options.fromSequence !== undefined) {
    query.sequenceNumber = { $gte: options.fromSequence };
  }
  
  if (options.toSequence !== undefined) {
    query.sequenceNumber = query.sequenceNumber || {};
    query.sequenceNumber.$lte = options.toSequence;
  }
  
  let dbQuery = this.find(query).sort({ sequenceNumber: 1 });
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  return dbQuery;
};

EventSchema.statics.findByEventType = function(
  eventType: string, 
  options: { fromDate?: Date; toDate?: Date; limit?: number } = {}
) {
  const query: any = { eventType };
  
  if (options.fromDate || options.toDate) {
    query.createdAt = {};
    if (options.fromDate) query.createdAt.$gte = options.fromDate;
    if (options.toDate) query.createdAt.$lte = options.toDate;
  }
  
  let dbQuery = this.find(query).sort({ createdAt: -1 });
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  return dbQuery;
};

EventSchema.statics.findByCorrelationId = function(correlationId: string) {
  return this.find({ 'eventMetadata.correlationId': correlationId })
    .sort({ sequenceNumber: 1 });
};

EventSchema.statics.findUnprocessed = function(limit?: number) {
  const query = this.find({ isProcessed: false })
    .sort({ createdAt: 1 });
  
  if (limit) {
    query.limit(limit);
  }
  
  return query;
};

EventSchema.statics.getEventCount = function(aggregateId: string) {
  return this.countDocuments({ aggregateId });
};

EventSchema.statics.getLastEvent = function(aggregateId: string) {
  return this.findOne({ aggregateId })
    .sort({ sequenceNumber: -1 });
};

// Instance methods
EventSchema.methods.markAsProcessed = function() {
  this.isProcessed = true;
  this.processedAt = new Date();
  this.processingAttempts += 1;
  this.lastError = undefined;
  return this.save();
};

EventSchema.methods.markAsFailed = function(error: string) {
  this.isProcessed = false;
  this.processingAttempts += 1;
  this.lastError = error;
  return this.save();
};

EventSchema.methods.canRetry = function(maxAttempts: number = 3) {
  return this.processingAttempts < maxAttempts && !this.isProcessed;
};

// Validation methods
EventSchema.methods.isValidSequence = function() {
  return this.sequenceNumber > 0;
};

EventSchema.methods.isValidEventVersion = function() {
  return this.eventVersion > 0;
};

// Transform method for JSON output
EventSchema.methods.toJSON = function() {
  const event = this.toObject();
  
  // Remove sensitive fields
  delete event.__v;
  delete event._id;
  
  return event;
};

// Virtual for event age
EventSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for processing status
EventSchema.virtual('processingStatus').get(function() {
  if (this.isProcessed) return 'completed';
  if (this.processingAttempts === 0) return 'pending';
  return 'failed';
});

export const Event = mongoose.model<IEvent>('Event', EventSchema);
export default Event;
