import mongoose, { Schema, Document } from 'mongoose';

export interface IBatchOperation extends Document {
  batchId: string;
  userId: string;
  type: 'CREATE' | 'VERIFY' | 'UPDATE' | 'DELETE' | 'EXPORT';
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  
  // Item counts
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  
  // Progress tracking
  progress: {
    percentage: number;
    currentStage: string;
    stageProgress: number;
    estimatedTimeRemaining: number; // in seconds
    startedAt?: Date;
    completedAt?: Date;
  };
  
  // Configuration
  config: {
    parallelProcessing: boolean;
    maxConcurrency: number;
    retryAttempts: number;
    retryDelay: number; // in milliseconds
    timeout: number; // in milliseconds
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  };
  
  // Input data
  input: {
    source: 'UPLOAD' | 'API' | 'DATABASE' | 'INTEGRATION';
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    data?: any[];
    template?: string;
    options?: Record<string, any>;
  };
  
  // Output data
  output: {
    resultUrl?: string;
    resultFileName?: string;
    resultFileSize?: number;
    format: 'JSON' | 'CSV' | 'XLSX' | 'PDF';
    downloadUrl?: string;
    expiresAt?: Date;
  };
  
  // Error tracking
  batchErrors: IBatchError[];
  
  // Performance metrics
  metrics: {
    processingTime: number; // in milliseconds
    averageItemTime: number;
    throughput: number; // items per second
    memoryUsage: number;
    cpuUsage: number;
  };
  
  // Queue information
  queue: {
    queueName: string;
    jobId?: string;
    position?: number;
    attempts: number;
    maxAttempts: number;
  };
  
  // Notifications
  notifications: {
    onStart: boolean;
    onComplete: boolean;
    onError: boolean;
    email?: string;
    webhookUrl?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IBatchError {
  itemId: string;
  itemIndex: number;
  errorCode: string;
  errorMessage: string;
  errorDetails?: Record<string, any>;
  timestamp: Date;
  retryable: boolean;
  retryCount: number;
}

const BatchErrorSchema: Schema = new Schema({
  itemId: {
    type: String,
    required: true
  },
  itemIndex: {
    type: Number,
    required: true
  },
  errorCode: {
    type: String,
    required: true
  },
  errorMessage: {
    type: String,
    required: true
  },
  errorDetails: {
    type: Map,
    of: Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  retryable: {
    type: Boolean,
    default: true
  },
  retryCount: {
    type: Number,
    default: 0
  }
}, { _id: false });

const BatchOperationSchema: Schema = new Schema({
  batchId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['CREATE', 'VERIFY', 'UPDATE', 'DELETE', 'EXPORT']
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  
  totalItems: {
    type: Number,
    required: true,
    default: 0
  },
  processedItems: {
    type: Number,
    default: 0
  },
  successfulItems: {
    type: Number,
    default: 0
  },
  failedItems: {
    type: Number,
    default: 0
  },
  skippedItems: {
    type: Number,
    default: 0
  },
  
  progress: {
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    currentStage: {
      type: String,
      default: 'INITIALIZING'
    },
    stageProgress: {
      type: Number,
      default: 0
    },
    estimatedTimeRemaining: {
      type: Number,
      default: 0
    },
    startedAt: Date,
    completedAt: Date
  },
  
  config: {
    parallelProcessing: {
      type: Boolean,
      default: true
    },
    maxConcurrency: {
      type: Number,
      default: 10
    },
    retryAttempts: {
      type: Number,
      default: 3
    },
    retryDelay: {
      type: Number,
      default: 1000
    },
    timeout: {
      type: Number,
      default: 30000
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
      default: 'NORMAL'
    }
  },
  
  input: {
    source: {
      type: String,
      enum: ['UPLOAD', 'API', 'DATABASE', 'INTEGRATION'],
      required: true
    },
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    mimeType: String,
    data: [Schema.Types.Mixed],
    template: String,
    options: {
      type: Map,
      of: Schema.Types.Mixed
    }
  },
  
  output: {
    resultUrl: String,
    resultFileName: String,
    resultFileSize: Number,
    format: {
      type: String,
      enum: ['JSON', 'CSV', 'XLSX', 'PDF'],
      default: 'JSON'
    },
    downloadUrl: String,
    expiresAt: Date
  },
  
  batchErrors: [BatchErrorSchema],
  
  metrics: {
    processingTime: {
      type: Number,
      default: 0
    },
    averageItemTime: {
      type: Number,
      default: 0
    },
    throughput: {
      type: Number,
      default: 0
    },
    memoryUsage: {
      type: Number,
      default: 0
    },
    cpuUsage: {
      type: Number,
      default: 0
    }
  },
  
  queue: {
    queueName: {
      type: String,
      default: 'default'
    },
    jobId: String,
    position: Number,
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    }
  },
  
  notifications: {
    onStart: {
      type: Boolean,
      default: false
    },
    onComplete: {
      type: Boolean,
      default: true
    },
    onError: {
      type: Boolean,
      default: true
    },
    email: String,
    webhookUrl: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
BatchOperationSchema.index({ userId: 1, createdAt: -1 });
BatchOperationSchema.index({ status: 1, 'config.priority': 1 });
BatchOperationSchema.index({ 'queue.jobId': 1 });
BatchOperationSchema.index({ batchId: 1, userId: 1 });

// Methods
BatchOperationSchema.methods.updateProgress = async function(
  processed: number,
  successful: number,
  failed: number
): Promise<void> {
  this.processedItems = processed;
  this.successfulItems = successful;
  this.failedItems = failed;
  this.progress.percentage = Math.round((processed / this.totalItems) * 100);
  
  if (this.progress.startedAt) {
    const elapsed = Date.now() - this.progress.startedAt.getTime();
    const rate = processed / (elapsed / 1000);
    const remaining = this.totalItems - processed;
    this.progress.estimatedTimeRemaining = Math.round(remaining / rate);
    this.metrics.throughput = rate;
  }
  
  await this.save();
};

BatchOperationSchema.methods.addError = async function(
  error: Omit<IBatchError, 'timestamp'>
): Promise<void> {
  this.batchErrors.push({
    ...error,
    timestamp: new Date()
  });
  this.failedItems += 1;
  await this.save();
};

BatchOperationSchema.methods.complete = async function(
  success: boolean
): Promise<void> {
  this.status = success ? 'COMPLETED' : 'FAILED';
  this.progress.completedAt = new Date();
  this.progress.percentage = 100;
  
  if (this.progress.startedAt) {
    this.metrics.processingTime = Date.now() - this.progress.startedAt.getTime();
    this.metrics.averageItemTime = this.metrics.processingTime / this.processedItems;
  }
  
  await this.save();
};

export const BatchOperation = mongoose.model<IBatchOperation>('BatchOperation', BatchOperationSchema);
