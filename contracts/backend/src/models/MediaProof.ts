import mongoose, { Schema, Document } from 'mongoose';

export interface IMediaProof extends Document {
  proofId: string;
  type: 'VIDEO' | 'AUDIO' | 'STREAM';
  ownerId: string;
  status: 'PENDING' | 'PROCESSING' | 'VERIFIED' | 'FAILED';
  
  // Media metadata
  mediaMetadata: {
    originalName: string;
    mimeType: string;
    size: number;
    duration: number;
    resolution?: {
      width: number;
      height: number;
    };
    bitrate?: number;
    codec?: string;
    frameRate?: number;
  };
  
  // Storage information
  storage: {
    originalUrl: string;
    compressedUrl?: string;
    thumbnailUrl?: string;
    streamingUrl?: string;
    storageProvider: 'LOCAL' | 'S3' | 'IPFS';
    bucket?: string;
    path: string;
  };
  
  // Compression settings
  compression: {
    enabled: boolean;
    algorithm: string;
    originalSize: number;
    compressedSize?: number;
    compressionRatio?: number;
    quality: number;
  };
  
  // Voice biometric data (for audio proofs)
  voiceBiometrics?: {
    voiceprintHash: string;
    confidenceScore: number;
    enrolledAt: Date;
    lastVerifiedAt?: Date;
    verificationAttempts: number;
    successfulVerifications: number;
  };
  
  // Authenticity verification
  authenticity: {
    hash: string;
    signature: string;
    timestamp: Date;
    verified: boolean;
    tamperingDetected: boolean;
    watermarkHash?: string;
    metadataIntact: boolean;
  };
  
  // Streaming configuration
  streaming?: {
    enabled: boolean;
    protocol: 'HLS' | 'DASH' | 'WebRTC';
    streamKey?: string;
    rtmpUrl?: string;
    hlsUrl?: string;
    isLive: boolean;
    startedAt?: Date;
    endedAt?: Date;
    viewers: number;
  };
  
  // Watermarking
  watermark?: {
    enabled: boolean;
    type: 'VISIBLE' | 'INVISIBLE';
    content: string;
    position?: {
      x: number;
      y: number;
    };
    opacity?: number;
    appliedAt: Date;
  };
  
  // Verification results
  verificationResults: {
    facialRecognition?: {
      matched: boolean;
      confidence: number;
      matchedUserId?: string;
    };
    voiceMatch?: {
      matched: boolean;
      confidence: number;
      similarityScore: number;
    };
    livenessDetection?: {
      passed: boolean;
      score: number;
      method: string;
    };
  };
  
  // Access control
  accessControl: {
    isPublic: boolean;
    allowedUsers: string[];
    expiresAt?: Date;
    downloadAllowed: boolean;
    maxViews?: number;
    currentViews: number;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

const MediaProofSchema: Schema = new Schema({
  proofId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['VIDEO', 'AUDIO', 'STREAM']
  },
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'PROCESSING', 'VERIFIED', 'FAILED'],
    default: 'PENDING'
  },
  
  mediaMetadata: {
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    duration: { type: Number, required: true },
    resolution: {
      width: Number,
      height: Number
    },
    bitrate: Number,
    codec: String,
    frameRate: Number
  },
  
  storage: {
    originalUrl: { type: String, required: true },
    compressedUrl: String,
    thumbnailUrl: String,
    streamingUrl: String,
    storageProvider: {
      type: String,
      enum: ['LOCAL', 'S3', 'IPFS'],
      default: 'LOCAL'
    },
    bucket: String,
    path: { type: String, required: true }
  },
  
  compression: {
    enabled: { type: Boolean, default: true },
    algorithm: { type: String, default: 'H264' },
    originalSize: { type: Number, required: true },
    compressedSize: Number,
    compressionRatio: Number,
    quality: { type: Number, default: 0.8, min: 0, max: 1 }
  },
  
  voiceBiometrics: {
    voiceprintHash: String,
    confidenceScore: Number,
    enrolledAt: Date,
    lastVerifiedAt: Date,
    verificationAttempts: { type: Number, default: 0 },
    successfulVerifications: { type: Number, default: 0 }
  },
  
  authenticity: {
    hash: { type: String, required: true },
    signature: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false },
    tamperingDetected: { type: Boolean, default: false },
    watermarkHash: String,
    metadataIntact: { type: Boolean, default: true }
  },
  
  streaming: {
    enabled: { type: Boolean, default: false },
    protocol: {
      type: String,
      enum: ['HLS', 'DASH', 'WebRTC']
    },
    streamKey: String,
    rtmpUrl: String,
    hlsUrl: String,
    isLive: { type: Boolean, default: false },
    startedAt: Date,
    endedAt: Date,
    viewers: { type: Number, default: 0 }
  },
  
  watermark: {
    enabled: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['VISIBLE', 'INVISIBLE']
    },
    content: String,
    position: {
      x: Number,
      y: Number
    },
    opacity: Number,
    appliedAt: Date
  },
  
  verificationResults: {
    facialRecognition: {
      matched: Boolean,
      confidence: Number,
      matchedUserId: String
    },
    voiceMatch: {
      matched: Boolean,
      confidence: Number,
      similarityScore: Number
    },
    livenessDetection: {
      passed: Boolean,
      score: Number,
      method: String
    }
  },
  
  accessControl: {
    isPublic: { type: Boolean, default: false },
    allowedUsers: [{ type: String }],
    expiresAt: Date,
    downloadAllowed: { type: Boolean, default: false },
    maxViews: Number,
    currentViews: { type: Number, default: 0 }
  },
  
  processedAt: Date
}, {
  timestamps: true
});

// Indexes for efficient querying
MediaProofSchema.index({ ownerId: 1, createdAt: -1 });
MediaProofSchema.index({ status: 1 });
MediaProofSchema.index({ type: 1 });
MediaProofSchema.index({ 'authenticity.verified': 1 });
MediaProofSchema.index({ 'streaming.isLive': 1 });
MediaProofSchema.index({ proofId: 1, ownerId: 1 });

export default mongoose.model<IMediaProof>('MediaProof', MediaProofSchema);
