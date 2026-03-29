import mongoose, { Schema, Document } from 'mongoose';

export interface ISignatureRequest extends Document {
  requestId: string;
  walletId: string;
  
  // Request details
  request: {
    type: 'PROOF_CREATION' | 'PROOF_VERIFICATION' | 'CONTRACT_INTERACTION' | 'TOKEN_TRANSFER' | 'CONFIG_CHANGE' | 'SIGNER_MANAGEMENT' | 'EMERGENCY_ACTIONS';
    title: string;
    description: string;
    payload: any; // Transaction data or operation details
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    estimatedGas?: number;
    estimatedValue?: number;
  };
  
  // Signature collection
  signatures: Array<{
    signerAddress: string;
    signature: string;
    signedAt: Date;
    weight: number;
    metadata?: {
      userAgent?: string;
      ipAddress?: string;
      deviceInfo?: string;
    };
  }>;
  
  // Status tracking
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED' | 'FAILED';
  rejectionReason?: string;
  
  // Timing
  timing: {
    createdAt: Date;
    expiresAt: Date;
    executedAt?: Date;
    lastSignatureAt?: Date;
    timeToExecution?: number; // in seconds
  };
  
  // Threshold tracking
  threshold: {
    required: number;
    currentWeight: number;
    requiredWeight: number;
    isMet: boolean;
  };
  
  // Security measures
  security: {
    nonce: string;
    hash: string; // Hash of the request payload
    encryptionKey?: string; // For sensitive data
    requiresConfirmation: boolean;
    confirmed: boolean;
    confirmedBy?: string;
    confirmedAt?: Date;
  };
  
  // Notifications
  notifications: {
    sent: boolean;
    channels: string[];
    lastSentAt?: Date;
    reminderCount: number;
    nextReminderAt?: Date;
  };
  
  // Execution details
  execution?: {
    transactionHash?: string;
    blockNumber?: number;
    gasUsed?: number;
    actualCost?: number;
    success: boolean;
    errorMessage?: string;
    retries: number;
  };
  
  // Metadata
  metadata: {
    createdBy: string;
    createdByName?: string;
    tags: string[];
    category?: string;
    relatedProofId?: string;
    relatedContractAddress?: string;
  };
  
  // Audit trail
  audit: {
    createdAt: Date;
    createdBy: string;
    lastModified: Date;
    lastModifiedBy: string;
    version: number;
    ipAddress: string;
    userAgent: string;
  };
}

const SignatureRequestSchema: Schema = new Schema({
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  walletId: {
    type: String,
    required: true,
    index: true
  },
  
  request: {
    type: {
      type: String,
      enum: ['PROOF_CREATION', 'PROOF_VERIFICATION', 'CONTRACT_INTERACTION', 'TOKEN_TRANSFER', 'CONFIG_CHANGE', 'SIGNER_MANAGEMENT', 'EMERGENCY_ACTIONS'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    estimatedGas: Number,
    estimatedValue: Number
  },
  
  signatures: [{
    signerAddress: {
      type: String,
      required: true
    },
    signature: {
      type: String,
      required: true
    },
    signedAt: {
      type: Date,
      default: Date.now
    },
    weight: {
      type: Number,
      required: true,
      min: 1
    },
    metadata: {
      userAgent: String,
      ipAddress: String,
      deviceInfo: String
    }
  }],
  
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'FAILED'],
    default: 'PENDING'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  
  timing: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    executedAt: Date,
    lastSignatureAt: Date,
    timeToExecution: Number
  },
  
  threshold: {
    required: {
      type: Number,
      required: true,
      min: 1
    },
    currentWeight: {
      type: Number,
      default: 0
    },
    requiredWeight: {
      type: Number,
      required: true,
      min: 1
    },
    isMet: {
      type: Boolean,
      default: false
    }
  },
  
  security: {
    nonce: {
      type: String,
      required: true,
      unique: true
    },
    hash: {
      type: String,
      required: true
    },
    encryptionKey: String,
    requiresConfirmation: {
      type: Boolean,
      default: false
    },
    confirmed: {
      type: Boolean,
      default: false
    },
    confirmedBy: String,
    confirmedAt: Date
  },
  
  notifications: {
    sent: {
      type: Boolean,
      default: false
    },
    channels: [{
      type: String,
      enum: ['EMAIL', 'SMS', 'PUSH', 'WEBHOOK', 'IN_APP']
    }],
    lastSentAt: Date,
    reminderCount: {
      type: Number,
      default: 0
    },
    nextReminderAt: Date
  },
  
  execution: {
    transactionHash: String,
    blockNumber: Number,
    gasUsed: Number,
    actualCost: Number,
    success: {
      type: Boolean,
      default: false
    },
    errorMessage: String,
    retries: {
      type: Number,
      default: 0
    }
  },
  
  metadata: {
    createdBy: {
      type: String,
      required: true
    },
    createdByName: String,
    tags: [{
      type: String,
      trim: true
    }],
    category: String,
    relatedProofId: String,
    relatedContractAddress: String
  },
  
  audit: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: String,
      required: true
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    lastModifiedBy: {
      type: String,
      required: true
    },
    version: {
      type: Number,
      default: 1
    },
    ipAddress: {
      type: String,
      required: true
    },
    userAgent: {
      type: String,
      required: true
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
SignatureRequestSchema.index({ requestId: 1 });
SignatureRequestSchema.index({ walletId: 1, status: 1 });
SignatureRequestSchema.index({ 'signatures.signerAddress': 1 });
SignatureRequestSchema.index({ status: 1, 'timing.expiresAt': 1 });
SignatureRequestSchema.index({ 'metadata.createdBy': 1 });
SignatureRequestSchema.index({ 'request.type': 1 });
SignatureRequestSchema.index({ 'request.priority': 1 });
SignatureRequestSchema.index({ 'security.nonce': 1 });

// Instance methods
SignatureRequestSchema.methods.addSignature = function(signerAddress: string, signature: string, weight: number, metadata?: any) {
  // Check if signer has already signed
  const existingSignature = this.signatures.find(s => s.signerAddress === signerAddress);
  if (existingSignature) {
    throw new Error('Signer has already signed this request');
  }
  
  this.signatures.push({
    signerAddress,
    signature,
    weight,
    metadata,
    signedAt: new Date()
  });
  
  // Update threshold tracking
  this.threshold.currentWeight += weight;
  this.threshold.isMet = this.threshold.currentWeight >= this.threshold.requiredWeight;
  this.timing.lastSignatureAt = new Date();
  
  // Update status if threshold is met
  if (this.threshold.isMet && this.status === 'PENDING') {
    this.status = 'APPROVED';
  }
  
  return this.save();
};

SignatureRequestSchema.methods.isExpired = function() {
  return new Date() > this.timing.expiresAt;
};

SignatureRequestSchema.methods.canSign = function(signerAddress: string) {
  return this.status === 'PENDING' && 
         !this.isExpired() && 
         !this.signatures.some(s => s.signerAddress === signerAddress);
};

SignatureRequestSchema.methods.getRemainingWeight = function() {
  return Math.max(0, this.threshold.requiredWeight - this.threshold.currentWeight);
};

export default mongoose.model<ISignatureRequest>('SignatureRequest', SignatureRequestSchema);
