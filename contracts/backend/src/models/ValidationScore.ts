import mongoose, { Schema, Document } from 'mongoose';

export interface IValidationScore extends Document {
  proofId: string;
  proofHash: string;
  issuerAddress: string;
  validationScore: number;
  confidenceLevel: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suspiciousPatterns: string[];
  modelVersion: string;
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
  explainability: {
    primaryReasons: string[];
    featureImportance: { [key: string]: number };
    similarCases: Array<{
      proofId: string;
      similarity: number;
      outcome: string;
    }>;
  };
  metadata: {
    validationTime: number;
    processingTime: number;
    modelLatency: number;
    timestamp: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ValidationScoreSchema: Schema = new Schema({
  proofId: { type: String, required: true, unique: true, index: true },
  proofHash: { type: String, required: true, index: true },
  issuerAddress: { type: String, required: true, index: true },
  validationScore: { type: Number, required: true, min: 0, max: 1 },
  confidenceLevel: { type: Number, required: true, min: 0, max: 1 },
  riskLevel: { 
    type: String, 
    required: true, 
    enum: ['low', 'medium', 'high', 'critical'],
    index: true 
  },
  suspiciousPatterns: [{ type: String }],
  modelVersion: { type: String, required: true },
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
  explainability: {
    primaryReasons: [{ type: String }],
    featureImportance: { type: Schema.Types.Mixed, default: {} },
    similarCases: [{
      proofId: { type: String },
      similarity: { type: Number },
      outcome: { type: String }
    }]
  },
  metadata: {
    validationTime: { type: Number, required: true },
    processingTime: { type: Number, required: true },
    modelLatency: { type: Number, required: true },
    timestamp: { type: Date, required: true }
  }
}, {
  timestamps: true
});

// Indexes for performance
ValidationScoreSchema.index({ proofId: 1 });
ValidationScoreSchema.index({ proofHash: 1 });
ValidationScoreSchema.index({ issuerAddress: 1 });
ValidationScoreSchema.index({ riskLevel: 1 });
ValidationScoreSchema.index({ validationScore: 1 });
ValidationScoreSchema.index({ createdAt: -1 });
ValidationScoreSchema.index({ 'metadata.timestamp': -1 });

// Compound indexes for complex queries
ValidationScoreSchema.index({ issuerAddress: 1, riskLevel: 1 });
ValidationScoreSchema.index({ riskLevel: 1, createdAt: -1 });

export const ValidationScore = mongoose.model<IValidationScore>('ValidationScore', ValidationScoreSchema);
