import mongoose, { Schema, Document } from 'mongoose';

export interface IMultiSigWallet extends Document {
  walletId: string;
  name: string;
  description?: string;
  
  // Multi-signature configuration
  config: {
    threshold: number; // M signatures required out of N
    signers: Array<{
      address: string;
      name: string;
      role: 'OWNER' | 'ADMIN' | 'SIGNER';
      weight: number;
      active: boolean;
      addedAt: Date;
    }>;
    maxSigners: number;
    allowSignerRemoval: boolean;
    requireAllForCritical: boolean;
  };
  
  // Wallet state
  state: {
    isActive: boolean;
    isFrozen: boolean;
    frozenBy?: string;
    frozenAt?: Date;
    freezeReason?: string;
    network: 'STELLAR' | 'ETHEREUM' | 'POLYGON';
    contractAddress?: string;
    deploymentTx?: string;
  };
  
  // Security settings
  security: {
    dailyLimit: number;
    singleTransactionLimit: number;
    requireConfirmation: boolean;
    allowedOperations: string[];
    timeLockPeriod: number; // in seconds
    autoRecoveryEnabled: boolean;
  };
  
  // Recovery configuration
  recovery: {
    enabled: boolean;
    method: 'SOCIAL_RECOVERY' | 'BACKUP_SIGNATURES' | 'TIME_DELAY';
    recoverySigners: Array<{
      address: string;
      name: string;
      trusted: boolean;
      addedAt: Date;
    }>;
    recoveryThreshold: number;
    recoveryPeriod: number; // in hours
  };
  
  // Metadata
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModified: Date;
    lastModifiedBy: string;
    version: number;
    tags: string[];
  };
  
  // Statistics
  stats: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingSignatures: number;
    averageConfirmationTime: number; // in seconds
  };
}

const MultiSigWalletSchema: Schema = new Schema({
  walletId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  config: {
    threshold: {
      type: Number,
      required: true,
      min: 1,
      max: 100
    },
    signers: [{
      address: {
        type: String,
        required: true,
        validate: {
          validator: function(v: string) {
            // Basic address validation - extend based on network
            return v && v.length > 0;
          },
          message: 'Invalid signer address'
        }
      },
      name: {
        type: String,
        required: true,
        trim: true
      },
      role: {
        type: String,
        enum: ['OWNER', 'ADMIN', 'SIGNER'],
        default: 'SIGNER'
      },
      weight: {
        type: Number,
        default: 1,
        min: 1,
        max: 100
      },
      active: {
        type: Boolean,
        default: true
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    maxSigners: {
      type: Number,
      default: 10,
      min: 2,
      max: 100
    },
    allowSignerRemoval: {
      type: Boolean,
      default: true
    },
    requireAllForCritical: {
      type: Boolean,
      default: false
    }
  },
  
  state: {
    isActive: {
      type: Boolean,
      default: true
    },
    isFrozen: {
      type: Boolean,
      default: false
    },
    frozenBy: String,
    frozenAt: Date,
    freezeReason: String,
    network: {
      type: String,
      enum: ['STELLAR', 'ETHEREUM', 'POLYGON'],
      required: true
    },
    contractAddress: String,
    deploymentTx: String
  },
  
  security: {
    dailyLimit: {
      type: Number,
      default: 1000000 // in smallest unit (e.g., stroops for Stellar)
    },
    singleTransactionLimit: {
      type: Number,
      default: 100000 // in smallest unit
    },
    requireConfirmation: {
      type: Boolean,
      default: true
    },
    allowedOperations: [{
      type: String,
      enum: [
        'PROOF_CREATION',
        'PROOF_VERIFICATION',
        'CONTRACT_INTERACTION',
        'TOKEN_TRANSFER',
        'CONFIG_CHANGE',
        'SIGNER_MANAGEMENT',
        'EMERGENCY_ACTIONS'
      ]
    }],
    timeLockPeriod: {
      type: Number,
      default: 3600, // 1 hour in seconds
      min: 0
    },
    autoRecoveryEnabled: {
      type: Boolean,
      default: false
    }
  },
  
  recovery: {
    enabled: {
      type: Boolean,
      default: false
    },
    method: {
      type: String,
      enum: ['SOCIAL_RECOVERY', 'BACKUP_SIGNATURES', 'TIME_DELAY'],
      default: 'SOCIAL_RECOVERY'
    },
    recoverySigners: [{
      address: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true,
        trim: true
      },
      trusted: {
        type: Boolean,
        default: false
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    recoveryThreshold: {
      type: Number,
      default: 2,
      min: 1
    },
    recoveryPeriod: {
      type: Number,
      default: 168, // 7 days in hours
      min: 24
    }
  },
  
  metadata: {
    createdBy: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
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
    tags: [{
      type: String,
      trim: true
    }]
  },
  
  stats: {
    totalTransactions: {
      type: Number,
      default: 0
    },
    successfulTransactions: {
      type: Number,
      default: 0
    },
    failedTransactions: {
      type: Number,
      default: 0
    },
    pendingSignatures: {
      type: Number,
      default: 0
    },
    averageConfirmationTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
MultiSigWalletSchema.index({ walletId: 1 });
MultiSigWalletSchema.index({ 'config.signers.address': 1 });
MultiSigWalletSchema.index({ 'metadata.createdBy': 1 });
MultiSigWalletSchema.index({ 'state.isActive': 1 });
MultiSigWalletSchema.index({ 'state.network': 1 });
MultiSigWalletSchema.index({ 'state.contractAddress': 1 });

// Validation methods
MultiSigWalletSchema.methods.isValidThreshold = function() {
  const activeSigners = this.config.signers.filter(s => s.active);
  return this.config.threshold <= activeSigners.length && this.config.threshold > 0;
};

MultiSigWalletSchema.methods.getSignerByAddress = function(address: string) {
  return this.config.signers.find(s => s.address === address && s.active);
};

MultiSigWalletSchema.methods.calculateTotalWeight = function() {
  return this.config.signers
    .filter(s => s.active)
    .reduce((total: number, signer: any) => total + signer.weight, 0);
};

export default mongoose.model<IMultiSigWallet>('MultiSigWallet', MultiSigWalletSchema);
