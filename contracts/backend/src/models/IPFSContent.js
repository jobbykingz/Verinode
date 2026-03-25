const mongoose = require('mongoose');

const ipfsContentSchema = new mongoose.Schema({
  // Content identification
  cid: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: function(v) {
        // Basic CID validation
        return v && v.length > 0 && v.startsWith('Qm') || v.startsWith('baf');
      },
      message: 'Invalid CID format'
    }
  },
  
  // Content metadata
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  
  description: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  
  contentType: {
    type: String,
    required: true,
    enum: [
      'proof',
      'document',
      'image',
      'video',
      'audio',
      'json',
      'text',
      'binary',
      'directory'
    ]
  },
  
  mimeType: {
    type: String,
    trim: true
  },
  
  size: {
    type: Number,
    required: true,
    min: 0
  },
  
  hash: {
    type: String,
    required: true,
    index: true
  },
  
  // Ownership and access control
  owner: {
    type: String,
    required: true,
    index: true,
    ref: 'User'
  },
  
  issuer: {
    type: String,
    required: true,
    index: true
  },
  
  privacySettings: {
    public: {
      type: Boolean,
      default: false
    },
    allowedUsers: [{
      type: String,
      ref: 'User'
    }],
    allowedRoles: [{
      type: String
    }],
    encryptionEnabled: {
      type: Boolean,
      default: false
    },
    encryptionKey: {
      type: String,
      select: false // Exclude from queries by default
    }
  },
  
  // IPFS specific fields
  pinning: {
    isPinned: {
      type: Boolean,
      default: false
    },
    pinningStrategy: {
      type: String,
      enum: ['immediate', 'delayed', 'conditional', 'backup'],
      default: 'immediate'
    },
    pinningPriority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    },
    pinnedAt: {
      type: Date
    },
    backupServices: [{
      name: String,
      status: {
        type: String,
        enum: ['pending', 'success', 'error'],
        default: 'pending'
      },
      pinnedAt: Date,
      error: String
    }]
  },
  
  // IPNS support
  ipns: {
    enabled: {
      type: Boolean,
      default: false
    },
    name: {
      type: String,
      sparse: true
    },
    keyName: {
      type: String,
      sparse: true
    },
    autoRefresh: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date
    },
    updateHistory: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      fromCID: String,
      toCID: String,
      sequence: Number
    }]
  },
  
  // Content verification
  verification: {
    contentHash: {
      type: String,
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    },
    verificationAttempts: {
      type: Number,
      default: 0
    },
    lastVerificationAttempt: {
      type: Date
    },
    verificationErrors: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      error: String
    }]
  },
  
  // Gateway configuration
  gateway: {
    accessible: {
      type: Boolean,
      default: true
    },
    gatewayURL: {
      type: String
    },
    cacheEnabled: {
      type: Boolean,
      default: true
    },
    cacheExpiry: {
      type: Date
    },
    accessCount: {
      type: Number,
      default: 0
    },
    lastAccessed: {
      type: Date
    }
  },
  
  // Backup and redundancy
  backup: {
    enabled: {
      type: Boolean,
      default: false
    },
    backupLocations: [{
      type: String,
      enum: ['pinata', 'infura', 'filebase', 'custom']
    }],
    backupStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending'
    },
    lastBackup: {
      type: Date
    },
    backupSize: {
      type: Number
    },
    backupHash: {
      type: String
    }
  },
  
  // Performance metrics
  metrics: {
    uploadTime: {
      type: Number
    },
    downloadTime: {
      type: Number
    },
    retrievalCount: {
      type: Number,
      default: 0
    },
    lastRetrieved: {
      type: Date
    },
    averageRetrievalTime: {
      type: Number,
      default: 0
    }
  },
  
  // Tags and categorization
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  category: {
    type: String,
    trim: true,
    lowercase: true
  },
  
  // Status and lifecycle
  status: {
    type: String,
    enum: ['uploading', 'uploaded', 'processing', 'ready', 'error', 'archived'],
    default: 'uploading'
  },
  
  archived: {
    type: Boolean,
    default: false
  },
  
  archivedAt: {
    type: Date
  },
  
  // Timestamps
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  expiresAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'ipfs_contents'
});

// Indexes for performance
ipfsContentSchema.index({ owner: 1, uploadedAt: -1 });
ipfsContentSchema.index({ issuer: 1, uploadedAt: -1 });
ipfsContentSchema.index({ contentType: 1, uploadedAt: -1 });
ipfsContentSchema.index({ 'pinning.isPinned': 1, uploadedAt: -1 });
ipfsContentSchema.index({ 'verification.verified': 1, uploadedAt: -1 });
ipfsContentSchema.index({ tags: 1 });
ipfsContentSchema.index({ status: 1 });
ipfsContentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual fields
ipfsContentSchema.virtual('gatewayURL').get(function() {
  if (!this.cid) return null;
  return `https://ipfs.io/ipfs/${this.cid}`;
});

ipfsContentSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

ipfsContentSchema.virtual('needsVerification').get(function() {
  return !this.verification.verified || 
         this.verification.verificationAttempts === 0 ||
         (Date.now() - new Date(this.verification.lastVerificationAttempt).getTime() > 24 * 60 * 60 * 1000);
});

// Instance methods
ipfsContentSchema.methods.verifyContent = async function(actualContent) {
  const crypto = require('crypto');
  
  // Calculate hash of actual content
  const actualHash = crypto.createHash('sha256').update(actualContent).digest('hex');
  
  // Update verification record
  this.verification.contentHash = actualHash;
  this.verification.verified = actualHash === this.hash;
  this.verification.verifiedAt = new Date();
  this.verification.verificationAttempts += 1;
  this.verification.lastVerificationAttempt = new Date();
  
  if (!this.verification.verified) {
    this.verification.verificationErrors.push({
      error: `Hash mismatch: expected ${this.hash}, got ${actualHash}`
    });
  }
  
  return this.save();
};

ipfsContentSchema.methods.updateAccessMetrics = async function(retrievalTime) {
  this.metrics.retrievalCount += 1;
  this.metrics.lastRetrieved = new Date();
  
  if (retrievalTime) {
    // Update average retrieval time
    const totalTime = this.metrics.averageRetrievalTime * (this.metrics.retrievalCount - 1) + retrievalTime;
    this.metrics.averageRetrievalTime = totalTime / this.metrics.retrievalCount;
  }
  
  this.gateway.accessCount += 1;
  this.gateway.lastAccessed = new Date();
  
  return this.save();
};

ipfsContentSchema.methods.canAccess = function(userId) {
  if (this.privacySettings.public) {
    return true;
  }
  
  if (this.owner === userId || this.issuer === userId) {
    return true;
  }
  
  if (this.privacySettings.allowedUsers.includes(userId)) {
    return true;
  }
  
  return false;
};

ipfsContentSchema.methods.archive = async function() {
  this.archived = true;
  this.archivedAt = new Date();
  this.status = 'archived';
  
  return this.save();
};

// Static methods
ipfsContentSchema.statics.findByOwner = function(ownerId, options = {}) {
  const query = { owner: ownerId, archived: { $ne: true } };
  
  if (options.contentType) {
    query.contentType = options.contentType;
  }
  
  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }
  
  return this.find(query)
    .sort({ uploadedAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

ipfsContentSchema.statics.findPinnedContent = function(options = {}) {
  const query = { 'pinning.isPinned': true, archived: { $ne: true } };
  
  if (options.strategy) {
    query['pinning.pinningStrategy'] = options.strategy;
  }
  
  return this.find(query)
    .sort({ 'pinning.pinnedAt': -1 })
    .limit(options.limit || 50);
};

ipfsContentSchema.statics.findUnverifiedContent = function(options = {}) {
  const query = { 
    'verification.verified': { $ne: true },
    archived: { $ne: true }
  };
  
  if (options.maxAttempts) {
    query['verification.verificationAttempts'] = { $lt: options.maxAttempts };
  }
  
  return this.find(query)
    .sort({ 'verification.lastVerificationAttempt': 1 })
    .limit(options.limit || 100);
};

ipfsContentSchema.statics.findExpiredContent = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    archived: { $ne: true }
  });
};

ipfsContentSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalContent: { $sum: 1 },
        totalSize: { $sum: '$size' },
        pinnedContent: {
          $sum: { $cond: ['$pinning.isPinned', 1, 0] }
        },
        verifiedContent: {
          $sum: { $cond: ['$verification.verified', 1, 0] }
        },
        publicContent: {
          $sum: { $cond: ['$privacySettings.public', 1, 0] }
        },
        contentByType: {
          $push: '$contentType'
        }
      }
    }
  ]);
  
  const result = stats[0] || {};
  
  // Count by content type
  const typeStats = {};
  if (result.contentByType) {
    result.contentByType.forEach(type => {
      typeStats[type] = (typeStats[type] || 0) + 1;
    });
  }
  
  return {
    totalContent: result.totalContent || 0,
    totalSize: result.totalSize || 0,
    pinnedContent: result.pinnedContent || 0,
    verifiedContent: result.verifiedContent || 0,
    publicContent: result.publicContent || 0,
    contentByType: typeStats
  };
};

// Pre-save middleware
ipfsContentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Validate CID format
  if (this.isModified('cid')) {
    try {
      const { CID } = require('cids');
      new CID(this.cid);
    } catch (error) {
      return next(new Error('Invalid CID format'));
    }
  }
  
  next();
});

// Post-save middleware
ipfsContentSchema.post('save', function(doc) {
  // Log important events
  if (doc.isModified('verification.verified') && doc.verification.verified) {
    console.log(`IPFS content verified: ${doc.cid}`);
  }
  
  if (doc.isModified('pinning.isPinned') && doc.pinning.isPinned) {
    console.log(`IPFS content pinned: ${doc.cid}`);
  }
});

const IPFSContent = mongoose.model('IPFSContent', ipfsContentSchema);

module.exports = IPFSContent;
