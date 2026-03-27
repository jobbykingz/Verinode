import mongoose, { Schema, Document } from 'mongoose';

export interface IContractMetrics extends Document {
  contractAddress: string;
  userAddress?: string;
  functionName: string;
  usageCount: number;
  dataSize: number;
  computeConsumed: number;
  estimatedFee: number;
  actualFee: number;
  latency_ms: number;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

const ContractMetricsSchema: Schema = new Schema(
  {
    contractAddress: { type: String, required: true, index: true },
    userAddress: { type: String, index: true },
    functionName: { type: String, required: true, index: true },
    usageCount: { type: Number, default: 1 },
    dataSize: { type: Number, default: 0 },
    computeConsumed: { type: Number, default: 0 },
    estimatedFee: { type: Number, default: 0 },
    actualFee: { type: Number, default: 0 },
    latency_ms: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// High-speed index for usage analysis
ContractMetricsSchema.index({ contractAddress: 1, functionName: 1, timestamp: -1 });
ContractMetricsSchema.index({ userAddress: 1, timestamp: -1 });

export const ContractMetricsModel = mongoose.model<IContractMetrics>('ContractMetrics', ContractMetricsSchema);
