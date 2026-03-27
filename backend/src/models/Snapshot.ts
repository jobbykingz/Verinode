import mongoose, { Schema, Document } from 'mongoose';

/**
 * Snapshot Interface for Event Sourcing Performance Optimization
 */
export interface ISnapshot extends Document {
  snapshotId: string;
  aggregateId: string;
  aggregateType: string;
  snapshotData: Record<string, any>;
  snapshotMetadata: {
    version: number;
    sequenceNumber: number;
    eventCount: number;
    lastEventId?: string;
    lastEventTimestamp?: Date;
    compressionAlgorithm?: string;
    checksum?: string;
    [key: string]: any;
  };
  snapshotVersion: number;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  size: number;
  tags: string[];
}

/**
 * Snapshot Schema
 */
const SnapshotSchema = new Schema<ISnapshot>({
  snapshotId: {
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
  snapshotData: {
    type: Schema.Types.Mixed,
    required: true
  },
  snapshotMetadata: {
    version: {
      type: Number,
      required: true,
      min: 1
    },
    sequenceNumber: {
      type: Number,
      required: true,
      min: 1
    },
    eventCount: {
      type: Number,
      required: true,
      min: 0
    },
    lastEventId: {
      type: String,
      index: true
    },
    lastEventTimestamp: {
      type: Date
    },
    compressionAlgorithm: {
      type: String,
      enum: ['none', 'gzip', 'brotli', 'lz4'],
      default: 'none'
    },
    checksum: {
      type: String
    }
  },
  snapshotVersion: {
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
  expiresAt: {
    type: Date,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }]
}, {
  timestamps: true,
  collection: 'snapshots'
});

// Compound indexes for optimal query performance
SnapshotSchema.index({ aggregateId: 1, isActive: 1, snapshotMetadata.sequenceNumber: -1 });
SnapshotSchema.index({ aggregateType: 1, aggregateId: 1, isActive: 1 });
SnapshotSchema.index({ isActive: 1, expiresAt: 1 });
SnapshotSchema.index({ 'snapshotMetadata.lastEventTimestamp': -1 });
SnapshotSchema.index({ tags: 1 });

// TTL index for automatic cleanup of expired snapshots
SnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to calculate size and checksum
SnapshotSchema.pre('save', function(next) {
  if (this.isModified('snapshotData')) {
    // Calculate size in bytes (approximate)
    this.size = Buffer.byteLength(JSON.stringify(this.snapshotData), 'utf8');
    
    // Generate checksum for data integrity
    const crypto = require('crypto');
    this.snapshotMetadata.checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(this.snapshotData))
      .digest('hex');
  }
  
  // Set expiration if not provided (default 30 days)
  if (!this.expiresAt && this.isActive) {
    const expirationDays = 30;
    this.expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Static methods
SnapshotSchema.statics.findByAggregate = function(
  aggregateId: string,
  options: { activeOnly?: boolean; limit?: number } = {}
) {
  const query: any = { aggregateId };
  
  if (options.activeOnly !== false) {
    query.isActive = true;
  }
  
  let dbQuery = this.find(query)
    .sort({ 'snapshotMetadata.sequenceNumber': -1 });
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  return dbQuery;
};

SnapshotSchema.statics.findLatestSnapshot = function(aggregateId: string) {
  return this.findOne({
    aggregateId,
    isActive: true
  }).sort({ 'snapshotMetadata.sequenceNumber': -1 });
};

SnapshotSchema.statics.findSnapshotAtSequence = function(
  aggregateId: string,
  sequenceNumber: number
) {
  return this.findOne({
    aggregateId,
    isActive: true,
    'snapshotMetadata.sequenceNumber': { $lte: sequenceNumber }
  }).sort({ 'snapshotMetadata.sequenceNumber': -1 });
};

SnapshotSchema.statics.findExpiredSnapshots = function() {
  return this.find({
    isActive: true,
    expiresAt: { $lte: new Date() }
  });
};

SnapshotSchema.statics.findByTags = function(
  tags: string[],
  options: { activeOnly?: boolean; limit?: number } = {}
) {
  const query: any = { tags: { $in: tags } };
  
  if (options.activeOnly !== false) {
    query.isActive = true;
  }
  
  let dbQuery = this.find(query)
    .sort({ createdAt: -1 });
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  return dbQuery;
};

SnapshotSchema.statics.getSnapshotCount = function(aggregateId: string) {
  return this.countDocuments({ aggregateId, isActive: true });
};

SnapshotSchema.statics.getSnapshotStats = function(aggregateType?: string) {
  const matchStage: any = { isActive: true };
  if (aggregateType) {
    matchStage.aggregateType = aggregateType;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$aggregateType',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgSize: { $avg: '$size' },
        oldestSnapshot: { $min: '$createdAt' },
        newestSnapshot: { $max: '$createdAt' }
      }
    }
  ]);
};

// Instance methods
SnapshotSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

SnapshotSchema.methods.extendExpiration = function(days: number) {
  this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return this.save();
};

SnapshotSchema.methods.addTags = function(newTags: string[]) {
  const existingTags = new Set(this.tags);
  newTags.forEach(tag => existingTags.add(tag));
  this.tags = Array.from(existingTags);
  return this.save();
};

SnapshotSchema.methods.removeTags = function(tagsToRemove: string[]) {
  const removeSet = new Set(tagsToRemove);
  this.tags = this.tags.filter(tag => !removeSet.has(tag));
  return this.save();
};

SnapshotSchema.methods.isExpired = function() {
  return this.expiresAt ? this.expiresAt < new Date() : false;
};

SnapshotSchema.methods.verifyIntegrity = function() {
  if (!this.snapshotMetadata.checksum) return false;
  
  const crypto = require('crypto');
  const calculatedChecksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(this.snapshotData))
    .digest('hex');
  
  return calculatedChecksum === this.snapshotMetadata.checksum;
};

SnapshotSchema.methods.canRestoreToSequence = function(targetSequence: number) {
  return this.snapshotMetadata.sequenceNumber <= targetSequence;
};

// Validation methods
SnapshotSchema.methods.isValidSnapshot = function() {
  return this.snapshotId && 
         this.aggregateId && 
         this.aggregateType && 
         this.snapshotData &&
         this.snapshotMetadata.sequenceNumber > 0;
};

// Transform method for JSON output
SnapshotSchema.methods.toJSON = function() {
  const snapshot = this.toObject();
  
  // Remove sensitive fields
  delete snapshot.__v;
  delete snapshot._id;
  
  // Add computed fields
  snapshot.isExpired = this.isExpired();
  snapshot.integrityValid = this.verifyIntegrity();
  
  return snapshot;
};

// Virtual for snapshot age
SnapshotSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for time until expiration
SnapshotSchema.virtual('timeUntilExpiration').get(function() {
  if (!this.expiresAt) return null;
  return this.expiresAt.getTime() - Date.now();
});

// Virtual for size in human readable format
SnapshotSchema.virtual('sizeFormatted').get(function() {
  const bytes = this.size;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

export const Snapshot = mongoose.model<ISnapshot>('Snapshot', SnapshotSchema);
export default Snapshot;
