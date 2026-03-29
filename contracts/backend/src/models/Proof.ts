import mongoose, { Schema, Document } from 'mongoose';

/**
 * Proof Interface
 */
export interface IProof extends Document {
  id: string;
  title: string;
  description: string;
  proofType: string;
  metadata: Record<string, any>;
  eventData: Record<string, any>;
  recipientAddress?: string;
  tags: string[];
  hash: string;
  status: 'draft' | 'verified' | 'verification_failed' | 'revoked';
  verifiedAt?: Date;
  verifiedBy?: string;
  verificationHistory: Array<{
    verifiedAt: Date;
    verifiedBy: string;
    method: string;
    result: boolean;
    details: Record<string, any>;
  }>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  sharedWith: Array<{
    shareId: string;
    recipientEmail: string;
    permissions: string[];
    message?: string;
    sharedAt: Date;
    sharedBy: string;
  }>;
}

/**
 * Proof Schema
 */
const ProofSchema = new Schema<IProof>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  proofType: {
    type: String,
    required: true,
    enum: [
      'identity',
      'education',
      'employment',
      'financial',
      'health',
      'legal',
      'property',
      'digital',
      'custom'
    ],
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  eventData: {
    type: Schema.Types.Mixed,
    default: {}
  },
  recipientAddress: {
    type: String,
    trim: true,
    maxlength: 500
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  hash: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'verified', 'verification_failed', 'revoked'],
    default: 'draft',
    index: true
  },
  verifiedAt: {
    type: Date
  },
  verifiedBy: {
    type: String,
    index: true
  },
  verificationHistory: [{
    verifiedAt: {
      type: Date,
      required: true
    },
    verifiedBy: {
      type: String,
      required: true
    },
    method: {
      type: String,
      required: true
    },
    result: {
      type: Boolean,
      required: true
    },
    details: {
      type: Schema.Types.Mixed,
      default: {}
    }
  }],
  createdBy: {
    type: String,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  sharedWith: [{
    shareId: {
      type: String,
      required: true
    },
    recipientEmail: {
      type: String,
      required: true
    },
    permissions: [{
      type: String,
      enum: ['view', 'edit', 'share', 'verify']
    }],
    message: {
      type: String,
      maxlength: 500
    },
    sharedAt: {
      type: Date,
      default: Date.now
    },
    sharedBy: {
      type: String,
      required: true
    }
  }]
}, {
  timestamps: true,
  collection: 'proofs'
});

// Indexes for better query performance
ProofSchema.index({ createdBy: 1, createdAt: -1 });
ProofSchema.index({ status: 1, createdAt: -1 });
ProofSchema.index({ proofType: 1, status: 1 });
ProofSchema.index({ tags: 1 });
ProofSchema.index({ hash: 1 });
ProofSchema.index({ 'sharedWith.recipientEmail': 1 });

// Text index for search functionality
ProofSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text'
});

// Middleware to update updatedAt timestamp
ProofSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for proof age
ProofSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for verification status
ProofSchema.virtual('isVerified').get(function() {
  return this.status === 'verified';
});

// Virtual for days since verification
ProofSchema.virtual('daysSinceVerification').get(function() {
  if (!this.verifiedAt) return null;
  return Math.floor((Date.now() - this.verifiedAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Static methods
ProofSchema.statics.findByUser = function(userId: string, options: any = {}) {
  const query = this.find({ createdBy: userId });
  
  if (options.status) {
    query.where({ status: options.status });
  }
  
  if (options.proofType) {
    query.where({ proofType: options.proofType });
  }
  
  if (options.tags && options.tags.length > 0) {
    query.where({ tags: { $in: options.tags } });
  }
  
  if (options.dateFrom || options.dateTo) {
    const dateQuery: any = {};
    if (options.dateFrom) dateQuery.$gte = options.dateFrom;
    if (options.dateTo) dateQuery.$lte = options.dateTo;
    query.where({ createdAt: dateQuery });
  }
  
  return query.sort({ createdAt: -1 });
};

ProofSchema.statics.findVerified = function(options: any = {}) {
  const query = this.find({ status: 'verified' });
  
  if (options.proofType) {
    query.where({ proofType: options.proofType });
  }
  
  if (options.dateFrom || options.dateTo) {
    const dateQuery: any = {};
    if (options.dateFrom) dateQuery.$gte = options.dateFrom;
    if (options.dateTo) dateQuery.$lte = options.dateTo;
    query.where({ verifiedAt: dateQuery });
  }
  
  return query.sort({ verifiedAt: -1 });
};

ProofSchema.statics.searchByTitle = function(searchTerm: string, options: any = {}) {
  const query = this.find({
    $or: [
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ]
  });
  
  if (options.status) {
    query.where({ status: options.status });
  }
  
  if (options.proofType) {
    query.where({ proofType: options.proofType });
  }
  
  return query.sort({ createdAt: -1 });
};

// Instance methods
ProofSchema.methods.verify = function(verifiedBy: string, method: string, details: any = {}) {
  this.status = 'verified';
  this.verifiedAt = new Date();
  this.verifiedBy = verifiedBy;
  
  this.verificationHistory.push({
    verifiedAt: this.verifiedAt,
    verifiedBy,
    method,
    result: true,
    details
  });
  
  return this.save();
};

ProofSchema.methods.failVerification = function(verifiedBy: string, method: string, details: any = {}) {
  this.status = 'verification_failed';
  
  this.verificationHistory.push({
    verifiedAt: new Date(),
    verifiedBy,
    method,
    result: false,
    details
  });
  
  return this.save();
};

ProofSchema.methods.revoke = function(reason: string) {
  this.status = 'revoked';
  this.metadata.revocationReason = reason;
  this.metadata.revokedAt = new Date();
  
  return this.save();
};

ProofSchema.methods.share = function(shareData: any) {
  this.sharedWith = this.sharedWith || [];
  this.sharedWith.push({
    shareId: shareData.shareId,
    recipientEmail: shareData.recipientEmail,
    permissions: shareData.permissions,
    message: shareData.message,
    sharedAt: new Date(),
    sharedBy: shareData.sharedBy
  });
  
  return this.save();
};

ProofSchema.methods.updateMetadata = function(newMetadata: Record<string, any>) {
  this.metadata = { ...this.metadata, ...newMetadata };
  this.updatedAt = new Date();
  
  return this.save();
};

ProofSchema.methods.addTags = function(newTags: string[]) {
  const existingTags = new Set(this.tags);
  newTags.forEach(tag => existingTags.add(tag));
  this.tags = Array.from(existingTags);
  this.updatedAt = new Date();
  
  return this.save();
};

ProofSchema.methods.removeTags = function(tagsToRemove: string[]) {
  const removeSet = new Set(tagsToRemove);
  this.tags = this.tags.filter(tag => !removeSet.has(tag));
  this.updatedAt = new Date();
  
  return this.save();
};

// Validation methods
ProofSchema.methods.isValidStatus = function(status: string) {
  return ['draft', 'verified', 'verification_failed', 'revoked'].includes(status);
};

ProofSchema.methods.hasPermission = function(userId: string, permission: string) {
  // Owner has all permissions
  if (this.createdBy === userId) return true;
  
  // Check shared permissions
  const sharedAccess = this.sharedWith?.find(share => 
    share.recipientEmail === userId || share.sharedBy === userId
  );
  
  return sharedAccess?.permissions?.includes(permission) || false;
};

// Transform method for JSON output
ProofSchema.methods.toJSON = function() {
  const proof = this.toObject();
  
  // Remove sensitive fields if needed
  delete proof.__v;
  delete proof._id;
  
  // Add computed fields
  proof.age = this.age;
  proof.isVerified = this.isVerified;
  proof.daysSinceVerification = this.daysSinceVerification;
  
  return proof;
};

export const Proof = mongoose.model<IProof>('Proof', ProofSchema);
export default Proof;
