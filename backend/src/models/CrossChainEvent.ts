import mongoose, { Schema, Document } from 'mongoose';

export interface ICrossChainEvent extends Document {
  eventId: string;
  chainId: number;
  contractAddress: string;
  eventSignature: string;
  eventData: any;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  timestamp: Date;
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt?: Date;
  errorMessage?: string;
  relayedToChains: number[];
  createdAt: Date;
  updatedAt: Date;
}

const CrossChainEventSchema: Schema = new Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  chainId: {
    type: Number,
    required: true,
    index: true
  },
  contractAddress: {
    type: String,
    required: true,
    index: true
  },
  eventSignature: {
    type: String,
    required: true
  },
  eventData: {
    type: Schema.Types.Mixed,
    required: true
  },
  blockNumber: {
    type: Number,
    required: true,
    index: true
  },
  transactionHash: {
    type: String,
    required: true,
    index: true
  },
  logIndex: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  synced: {
    type: Boolean,
    default: false,
    index: true
  },
  syncAttempts: {
    type: Number,
    default: 0
  },
  lastSyncAttempt: {
    type: Date
  },
  errorMessage: {
    type: String
  },
  relayedToChains: [{
    type: Number
  }]
}, {
  timestamps: true
});

// Compound indexes for efficient queries
CrossChainEventSchema.index({ chainId: 1, blockNumber: -1 });
CrossChainEventSchema.index({ synced: 1, timestamp: -1 });
CrossChainEventSchema.index({ chainId: 1, synced: 1 });

// Instance methods
CrossChainEventSchema.methods.markAsSynced = function() {
  this.synced = true;
  this.lastSyncAttempt = new Date();
  return this.save();
};

CrossChainEventSchema.methods.incrementSyncAttempts = function(errorMessage?: string) {
  this.syncAttempts += 1;
  this.lastSyncAttempt = new Date();
  if (errorMessage) {
    this.errorMessage = errorMessage;
  }
  return this.save();
};

CrossChainEventSchema.methods.addRelayedChain = function(chainId: number) {
  if (!this.relayedToChains.includes(chainId)) {
    this.relayedToChains.push(chainId);
  }
  return this.save();
};

// Static methods
CrossChainEventSchema.statics.findUnsynced = function(chainId?: number) {
  const query = { synced: false };
  if (chainId) {
    query.chainId = chainId;
  }
  return this.find(query).sort({ timestamp: 1 });
};

CrossChainEventSchema.statics.findByChainAndBlockRange = function(
  chainId: number,
  fromBlock: number,
  toBlock: number
) {
  return this.find({
    chainId,
    blockNumber: { $gte: fromBlock, $lte: toBlock }
  }).sort({ blockNumber: 1 });
};

CrossChainEventSchema.statics.getSyncStats = function(chainId?: number) {
  const matchStage = chainId ? { chainId } : {};

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$chainId',
        total: { $sum: 1 },
        synced: { $sum: { $cond: ['$synced', 1, 0] } },
        failed: { $sum: { $cond: [{ $gt: ['$syncAttempts', 0] }, 1, 0] } },
        avgAttempts: { $avg: '$syncAttempts' }
      }
    }
  ]);
};

export const CrossChainEvent = mongoose.model<ICrossChainEvent>('CrossChainEvent', CrossChainEventSchema);