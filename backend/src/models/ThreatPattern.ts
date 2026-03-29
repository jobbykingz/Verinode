import mongoose, { Schema, Document } from 'mongoose';

export interface IThreatPattern extends Document {
  patternType: string;
  signature: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  detectedAt: Date;
  metadata: Record<string, any>;
  isActive: boolean;
}

const ThreatPatternSchema: Schema = new Schema({
  patternType: { type: String, required: true },
  signature: { type: String, required: true, unique: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  detectedAt: { type: Date, default: Date.now },
  metadata: { type: Object, default: {} },
  isActive: { type: Boolean, default: true }
});

export default mongoose.model<IThreatPattern>('ThreatPattern', ThreatPatternSchema);
