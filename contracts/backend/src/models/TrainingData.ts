import mongoose, { Schema, Document } from 'mongoose';

export interface ITrainingData extends Document {
  proofId: string;
  proofHash: string;
  issuerAddress: string;
  label: 'legitimate' | 'fraudulent' | 'suspicious' | 'verified';
  confidence: number;
  features: {
    hashComplexity: number;
    timestampAnomaly: number;
    issuerReputation: number;
    contentSimilarity: number;
    networkActivity: number;
    geographicAnomaly: number;
    frequencyPattern: number;
    sizeAnomaly: number;
  };
  rawData: {
    eventData: any;
    hash: string;
    timestamp: Date;
    ipfsCid?: string;
    ipfsSize?: number;
    stellarTxId?: string;
  };
  feedback: {
    humanReviewed: boolean;
    reviewerAddress?: string;
    reviewTimestamp?: Date;
    reviewerComments?: string;
    reportedFalsePositive?: boolean;
    reportedFalseNegative?: boolean;
    feedbackScore?: number;
  };
  modelPerformance: {
    predictedScore: number;
    predictedRiskLevel: string;
    actualOutcome: string;
    accuracy: number;
    modelVersion: string;
  };
  metadata: {
    dataSource: string;
    collectionMethod: string;
    qualityScore: number;
    timestamp: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TrainingDataSchema: Schema = new Schema({
  proofId: { type: String, required: true, unique: true, index: true },
  proofHash: { type: String, required: true, index: true },
  issuerAddress: { type: String, required: true, index: true },
  label: { 
    type: String, 
    required: true, 
    enum: ['legitimate', 'fraudulent', 'suspicious', 'verified'],
    index: true 
  },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  features: {
    hashComplexity: { type: Number, required: true, min: 0, max: 1 },
    timestampAnomaly: { type: Number, required: true, min: 0, max: 1 },
    issuerReputation: { type: Number, required: true, min: 0, max: 1 },
    contentSimilarity: { type: Number, required: true, min: 0, max: 1 },
    networkActivity: { type: Number, required: true, min: 0, max: 1 },
    geographicAnomaly: { type: Number, required: true, min: 0, max: 1 },
    frequencyPattern: { type: Number, required: true, min: 0, max: 1 },
    sizeAnomaly: { type: Number, required: true, min: 0, max: 1 }
  },
  rawData: {
    eventData: { type: Schema.Types.Mixed, required: true },
    hash: { type: String, required: true },
    timestamp: { type: Date, required: true },
    ipfsCid: { type: String },
    ipfsSize: { type: Number },
    stellarTxId: { type: String }
  },
  feedback: {
    humanReviewed: { type: Boolean, default: false },
    reviewerAddress: { type: String },
    reviewTimestamp: { type: Date },
    reviewerComments: { type: String },
    reportedFalsePositive: { type: Boolean, default: false },
    reportedFalseNegative: { type: Boolean, default: false },
    feedbackScore: { type: Number, min: 1, max: 5 }
  },
  modelPerformance: {
    predictedScore: { type: Number, required: true, min: 0, max: 1 },
    predictedRiskLevel: { type: String, required: true },
    actualOutcome: { type: String, required: true },
    accuracy: { type: Number, required: true, min: 0, max: 1 },
    modelVersion: { type: String, required: true }
  },
  metadata: {
    dataSource: { type: String, required: true },
    collectionMethod: { type: String, required: true },
    qualityScore: { type: Number, required: true, min: 0, max: 1 },
    timestamp: { type: Date, required: true }
  }
}, {
  timestamps: true
});

// Indexes for performance
TrainingDataSchema.index({ proofId: 1 });
TrainingDataSchema.index({ proofHash: 1 });
TrainingDataSchema.index({ issuerAddress: 1 });
TrainingDataSchema.index({ label: 1 });
TrainingDataSchema.index({ confidence: 1 });
TrainingDataSchema.index({ createdAt: -1 });
TrainingDataSchema.index({ 'metadata.timestamp': -1 });
TrainingDataSchema.index({ 'feedback.humanReviewed': 1 });

// Compound indexes for complex queries
TrainingDataSchema.index({ label: 1, createdAt: -1 });
TrainingDataSchema.index({ issuerAddress: 1, label: 1 });
TrainingDataSchema.index({ 'feedback.humanReviewed': 1, 'feedback.reportedFalsePositive': 1 });

export const TrainingData = mongoose.model<ITrainingData>('TrainingData', TrainingDataSchema);
