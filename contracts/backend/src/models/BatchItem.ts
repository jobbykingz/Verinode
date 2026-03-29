import mongoose, { Schema, Document } from 'mongoose';

export interface IBatchItem extends Document {
  itemId: string;
  batchId: string;
  userId: string;
  index: number;
  
  // Input data
  input: {
    type: 'PROOF' | 'VERIFICATION' | 'TEMPLATE' | 'CUSTOM';
    data: Record<string, any>;
    rawData?: string;
    fileUrl?: string;
  };
  
  // Processing status
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'SKIPPED';
  
  // Processing stages
  stages: IProcessingStage[];
  
  // Output data
  output: {
    success: boolean;
    data?: Record<string, any>;
    proofId?: string;
    transactionHash?: string;
    verificationResult?: {
      valid: boolean;
      confidence: number;
      details: Record<string, any>;
    };
    error?: {
      code: string;
      message: string;
      details?: Record<string, any>;
      stackTrace?: string;
    };
  };
  
  // Retry information
  retry: {
    count: number;
    maxRetries: number;
    lastAttempt?: Date;
    nextAttempt?: Date;
    retryReason?: string;
  };
  
  // Performance metrics
  metrics: {
    processingTime: number;
    queueTime: number;
    attempts: number;
    stageTimings: Record<string, number>;
  };
  
  // Validation
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    validatedAt?: Date;
  };
  
  // Dependencies
  dependencies: {
    itemIds: string[];
    resolved: boolean;
  };
  
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface IProcessingStage {
  name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: {
    code: string;
    message: string;
  };
}

const ProcessingStageSchema: Schema = new Schema({
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'],
    default: 'PENDING'
  },
  startedAt: Date,
  completedAt: Date,
  duration: Number,
  error: {
    code: String,
    message: String
  }
}, { _id: false });

const BatchItemSchema: Schema = new Schema({
  itemId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  batchId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  index: {
    type: Number,
    required: true
  },
  
  input: {
    type: {
      type: String,
      required: true,
      enum: ['PROOF', 'VERIFICATION', 'TEMPLATE', 'CUSTOM']
    },
    data: {
      type: Map,
      of: Schema.Types.Mixed,
      required: true
    },
    rawData: String,
    fileUrl: String
  },
  
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING', 'SKIPPED'],
    default: 'PENDING',
    index: true
  },
  
  stages: [ProcessingStageSchema],
  
  output: {
    success: {
      type: Boolean,
      default: false
    },
    data: {
      type: Map,
      of: Schema.Types.Mixed
    },
    proofId: String,
    transactionHash: String,
    verificationResult: {
      valid: Boolean,
      confidence: Number,
      details: {
        type: Map,
        of: Schema.Types.Mixed
      }
    },
    error: {
      code: String,
      message: String,
      details: {
        type: Map,
        of: Schema.Types.Mixed
      },
      stackTrace: String
    }
  },
  
  retry: {
    count: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    lastAttempt: Date,
    nextAttempt: Date,
    retryReason: String
  },
  
  metrics: {
    processingTime: {
      type: Number,
      default: 0
    },
    queueTime: {
      type: Number,
      default: 0
    },
    attempts: {
      type: Number,
      default: 0
    },
    stageTimings: {
      type: Map,
      of: Number
    }
  },
  
  validation: {
    isValid: {
      type: Boolean,
      default: false
    },
    errors: [String],
    warnings: [String],
    validatedAt: Date
  },
  
  dependencies: {
    itemIds: [String],
    resolved: {
      type: Boolean,
      default: true
    }
  },
  
  startedAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

// Indexes for efficient querying
BatchItemSchema.index({ batchId: 1, index: 1 });
BatchItemSchema.index({ batchId: 1, status: 1 });
BatchItemSchema.index({ userId: 1, createdAt: -1 });
BatchItemSchema.index({ status: 1, 'retry.nextAttempt': 1 });

// Methods
BatchItemSchema.methods.startProcessing = async function(): Promise<void> {
  this.status = 'PROCESSING';
  this.startedAt = new Date();
  this.metrics.attempts += 1;
  
  // Update first pending stage
  const pendingStage = this.stages.find((s: IProcessingStage) => s.status === 'PENDING');
  if (pendingStage) {
    pendingStage.status = 'RUNNING';
    pendingStage.startedAt = new Date();
  }
  
  await this.save();
};

BatchItemSchema.methods.completeStage = async function(
  stageName: string,
  success: boolean,
  error?: { code: string; message: string }
): Promise<void> {
  const stage = this.stages.find((s: IProcessingStage) => s.name === stageName);
  if (stage) {
    stage.status = success ? 'COMPLETED' : 'FAILED';
    stage.completedAt = new Date();
    stage.duration = stage.completedAt.getTime() - (stage.startedAt?.getTime() || 0);
    
    if (error) {
      stage.error = error;
    }
    
    this.metrics.stageTimings.set(stageName, stage.duration);
  }
  
  await this.save();
};

BatchItemSchema.methods.complete = async function(
  success: boolean,
  output?: Record<string, any>
): Promise<void> {
  this.status = success ? 'COMPLETED' : 'FAILED';
  this.completedAt = new Date();
  this.output.success = success;
  
  if (output) {
    this.output.data = output;
  }
  
  if (this.startedAt) {
    this.metrics.processingTime = Date.now() - this.startedAt.getTime();
  }
  
  await this.save();
};

BatchItemSchema.methods.markForRetry = async function(
  reason: string,
  delay?: number
): Promise<void> {
  this.status = 'RETRYING';
  this.retry.count += 1;
  this.retry.lastAttempt = new Date();
  this.retry.retryReason = reason;
  
  if (delay) {
    this.retry.nextAttempt = new Date(Date.now() + delay);
  }
  
  // Reset stages for retry
  this.stages.forEach((stage: IProcessingStage) => {
    if (stage.status === 'FAILED') {
      stage.status = 'PENDING';
      stage.error = undefined;
    }
  });
  
  await this.save();
};

BatchItemSchema.methods.addError = async function(
  code: string,
  message: string,
  details?: Record<string, any>
): Promise<void> {
  this.output.error = {
    code,
    message,
    details,
    stackTrace: new Error().stack
  };
  await this.save();
};

export const BatchItem = mongoose.model<IBatchItem>('BatchItem', BatchItemSchema);
