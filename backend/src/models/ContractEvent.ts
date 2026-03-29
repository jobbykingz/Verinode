import { Schema, model, Document, Types } from 'mongoose';

export enum EventType {
  PROOF_ISSUED = 'ProofIssued',
  PROOF_VERIFIED = 'ProofVerified',
  PROOF_UPDATED = 'ProofUpdated',
  BATCH_OPERATION = 'BatchOperation',
  SYSTEM_EVENT = 'SystemEvent',
  CROSS_CHAIN_EVENT = 'CrossChainEvent',
  GOVERNANCE_EVENT = 'GovernanceEvent',
  TREASURY_EVENT = 'TreasuryEvent',
}

export enum EventSeverity {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

export enum EventStatus {
  PENDING = 'Pending',
  PROCESSED = 'Processed',
  FAILED = 'Failed',
  REVERTED = 'Reverted',
}

export interface IContractEvent {
  eventId: string;
  eventType: EventType;
  emitter: string;
  timestamp: Date;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  severity: EventSeverity;
  schemaVersion: number;
  data: Record<string, any>;
  indexedData: Record<string, any>;
  topics: string[];
  gasUsed: number;
  status: EventStatus;
  processed: boolean;
  processedAt?: Date;
  processingAttempts: number;
  processingTime?: number;
  lastError?: string;
  lastErrorAt?: Date;
  permanentlyFailed?: boolean;
  chainId?: number;
  contractAddress?: string;
  signature?: string;
  replayed?: boolean;
  replayCount?: number;
  version?: string;
  compatibilityVersion?: string;
}

export interface ContractEventDocument extends IContractEvent, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContractEventSchema = new Schema<ContractEventDocument>({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  eventType: {
    type: String,
    enum: Object.values(EventType),
    required: true,
    index: true,
  },
  emitter: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    required: true,
    index: true,
  },
  blockNumber: {
    type: Number,
    required: true,
    index: true,
  },
  transactionHash: {
    type: String,
    required: true,
    index: true,
  },
  logIndex: {
    type: Number,
    required: true,
  },
  severity: {
    type: String,
    enum: Object.values(EventSeverity),
    default: EventSeverity.MEDIUM,
    index: true,
  },
  schemaVersion: {
    type: Number,
    required: true,
    default: 1,
  },
  data: {
    type: Schema.Types.Mixed,
    default: {},
  },
  indexedData: {
    type: Schema.Types.Mixed,
    default: {},
  },
  topics: [{
    type: String,
    index: true,
  }],
  gasUsed: {
    type: Number,
    required: true,
    default: 0,
  },
  status: {
    type: String,
    enum: Object.values(EventStatus),
    default: EventStatus.PENDING,
    index: true,
  },
  processed: {
    type: Boolean,
    default: false,
    index: true,
  },
  processedAt: {
    type: Date,
  },
  processingAttempts: {
    type: Number,
    default: 0,
  },
  processingTime: {
    type: Number,
  },
  lastError: {
    type: String,
  },
  lastErrorAt: {
    type: Date,
  },
  permanentlyFailed: {
    type: Boolean,
    default: false,
  },
  chainId: {
    type: Number,
    index: true,
  },
  contractAddress: {
    type: String,
    index: true,
  },
  signature: {
    type: String,
    index: true,
  },
  replayed: {
    type: Boolean,
    default: false,
  },
  replayCount: {
    type: Number,
    default: 0,
  },
  version: {
    type: String,
    default: '1.0.0',
  },
  compatibilityVersion: {
    type: String,
    default: '1.0.0',
  },
}, {
  timestamps: true,
  collection: 'contract_events',
});

// Compound indexes for efficient querying
ContractEventSchema.index({ eventType: 1, timestamp: -1 });
ContractEventSchema.index({ emitter: 1, timestamp: -1 });
ContractEventSchema.index({ blockNumber: 1, logIndex: 1 });
ContractEventSchema.index({ transactionHash: 1, logIndex: 1 });
ContractEventSchema.index({ topics: 1, timestamp: -1 });
ContractEventSchema.index({ severity: 1, processed: 1 });
ContractEventSchema.index({ chainId: 1, blockNumber: -1 });

// Text index for searching event data
ContractEventSchema.index({
  'data.$**': 'text',
  'indexedData.$**': 'text',
});

// TTL index for old events (optional - 30 days)
ContractEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Static methods for common queries
ContractEventSchema.statics.findByEventType = function(eventType: EventType) {
  return this.find({ eventType }).sort({ timestamp: -1 });
};

ContractEventSchema.statics.findByEmitter = function(emitter: string) {
  return this.find({ emitter }).sort({ timestamp: -1 });
};

ContractEventSchema.statics.findByBlockRange = function(fromBlock: number, toBlock: number) {
  return this.find({
    blockNumber: { $gte: fromBlock, $lte: toBlock }
  }).sort({ blockNumber: 1, logIndex: 1 });
};

ContractEventSchema.statics.findByTimeRange = function(fromTime: Date, toTime: Date) {
  return this.find({
    timestamp: { $gte: fromTime, $lte: toTime }
  }).sort({ timestamp: -1 });
};

ContractEventSchema.statics.findUnprocessed = function() {
  return this.find({
    processed: false,
    permanentlyFailed: false,
    processingAttempts: { $lt: 3 }
  }).sort({ timestamp: 1 });
};

ContractEventSchema.statics.findByTopics = function(topics: string[]) {
  return this.find({
    topics: { $in: topics }
  }).sort({ timestamp: -1 });
};

ContractEventSchema.statics.findFailedEvents = function() {
  return this.find({
    permanentlyFailed: true
  }).sort({ lastErrorAt: -1 });
};

// Instance methods
ContractEventSchema.methods.markProcessed = function() {
  this.processed = true;
  this.processedAt = new Date();
  this.status = EventStatus.PROCESSED;
  return this.save();
};

ContractEventSchema.methods.markFailed = function(error: string) {
  this.processingAttempts += 1;
  this.lastError = error;
  this.lastErrorAt = new Date();
  
  if (this.processingAttempts >= 3) {
    this.permanentlyFailed = true;
    this.status = EventStatus.FAILED;
  }
  
  return this.save();
};

ContractEventSchema.methods.calculateGasEfficiency = function() {
  if (!this.processingTime) return 0;
  return this.gasUsed / this.processingTime;
};

ContractEventSchema.methods.getEventSignature = function() {
  if (this.signature) return this.signature;
  
  // Generate signature based on event type and key data
  const signatureData = {
    eventType: this.eventType,
    emitter: this.emitter,
    schemaVersion: this.schemaVersion,
    timestamp: this.timestamp.getTime(),
  };
  
  return Buffer.from(JSON.stringify(signatureData)).toString('base64');
};

ContractEventSchema.methods.isHighSeverity = function() {
  return this.severity === EventSeverity.HIGH || this.severity === EventSeverity.CRITICAL;
};

ContractEventSchema.methods.needsRetry = function() {
  return !this.processed && 
         !this.permanentlyFailed && 
         this.processingAttempts < 3;
};

ContractEventSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  
  // Remove sensitive or large fields for API responses
  delete obj.__v;
  delete obj.lastError;
  delete obj.lastErrorAt;
  
  return obj;
};

// Virtual fields
ContractEventSchema.virtual('age').get(function() {
  return Date.now() - this.timestamp.getTime();
});

ContractEventSchema.virtual('isRecent').get(function() {
  return this.age < 24 * 60 * 60 * 1000; // Less than 24 hours
});

ContractEventSchema.virtual('processingEfficiency').get(function() {
  if (!this.processingTime || !this.gasUsed) return 0;
  return this.gasUsed / this.processingTime;
});

// Pre-save middleware
ContractEventSchema.pre('save', function(next) {
  // Generate event ID if not present
  if (!this.eventId) {
    this.eventId = `${this.transactionHash}_${this.logIndex}`;
  }
  
  // Generate signature if not present
  if (!this.signature) {
    this.signature = this.getEventSignature();
  }
  
  // Set chain ID from contract address if available
  if (this.contractAddress && !this.chainId) {
    // This would be determined based on the contract address
    // For now, default to 1 (Ethereum mainnet)
    this.chainId = 1;
  }
  
  next();
});

// Post-save middleware for indexing
ContractEventSchema.post('save', function(doc) {
  // Trigger event indexing
  if (process.env.EVENT_INDEXING_ENABLED === 'true') {
    // This would integrate with your event indexing service
    console.log(`Event indexed: ${doc.eventId}`);
  }
});

// Validation methods
ContractEventSchema.methods.validateEventData = function() {
  const errors: string[] = [];
  
  if (!this.eventType) {
    errors.push('Event type is required');
  }
  
  if (!this.emitter) {
    errors.push('Emitter address is required');
  }
  
  if (!this.timestamp) {
    errors.push('Timestamp is required');
  }
  
  if (!this.transactionHash) {
    errors.push('Transaction hash is required');
  }
  
  if (this.blockNumber < 0) {
    errors.push('Block number must be positive');
  }
  
  if (this.logIndex < 0) {
    errors.push('Log index must be positive');
  }
  
  return errors;
};

// Aggregation helpers
ContractEventSchema.statics.getEventStats = function(timeRange?: { from: Date; to: Date }) {
  const matchStage = timeRange ? {
    timestamp: { $gte: timeRange.from, $lte: timeRange.to }
  } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        processedEvents: { $sum: { $cond: ['$processed', 1, 0] } },
        failedEvents: { $sum: { $cond: ['$permanentlyFailed', 1, 0] } },
        averageGasUsed: { $avg: '$gasUsed' },
        eventTypes: { $addToSet: '$eventType' },
        emitters: { $addToSet: '$emitter' },
      }
    }
  ]);
};

ContractEventSchema.statics.getEventTypeDistribution = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        totalGas: { $sum: '$gasUsed' },
        avgGas: { $avg: '$gasUsed' },
      }
    },
    { $sort: { count: -1 } }
  ]);
};

ContractEventSchema.statics.getEmitterStats = function(limit = 10) {
  return this.aggregate([
    {
      $group: {
        _id: '$emitter',
        eventCount: { $sum: 1 },
        totalGas: { $sum: '$gasUsed' },
        avgGas: { $avg: '$gasUsed' },
        eventTypes: { $addToSet: '$eventType' },
      }
    },
    { $sort: { eventCount: -1 } },
    { $limit: limit }
  ]);
};

ContractEventSchema.statics.getGasUsageStats = function(timeRange?: { from: Date; to: Date }) {
  const matchStage = timeRange ? {
    timestamp: { $gte: timeRange.from, $lte: timeRange.to }
  } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalGas: { $sum: '$gasUsed' },
        avgGas: { $avg: '$gasUsed' },
        minGas: { $min: '$gasUsed' },
        maxGas: { $max: '$gasUsed' },
        medianGas: { $median: { input: '$gasUsed' } },
      }
    }
  ]);
};

// Query helpers for pagination
ContractEventSchema.statics.paginate = function(query: any = {}, options: {
  page?: number;
  limit?: number;
  sort?: any;
} = {}) {
  const page = options.page || 1;
  const limit = options.limit || 100;
  const skip = (page - 1) * limit;
  const sort = options.sort || { timestamp: -1 };
  
  return Promise.all([
    this.find(query).sort(sort).skip(skip).limit(limit),
    this.countDocuments(query)
  ]).then(([results, total]) => ({
    results,
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  }));
};

export const ContractEvent = model<ContractEventDocument>('ContractEvent', ContractEventSchema);
export { ContractEventDocument };
