import mongoose, { Schema, Document } from 'mongoose';

export interface IAchievement extends Document {
  achievementId: string;
  name: string;
  description: string;
  category: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | 'LEGENDARY';
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
  icon: string;
  color: string;
  
  // Requirements to unlock
  requirements: {
    type: 'POINTS' | 'ACTION' | 'STREAK' | 'COLLECTION' | 'SPECIAL';
    targetValue: number;
    actionType?: string;
    conditions?: Record<string, any>;
  };
  
  // Rewards
  rewards: {
    points: number;
    badgeUrl?: string;
    specialPerks?: string[];
  };
  
  // Statistics
  unlockedBy: number;
  rarity: number; // Percentage of users who have unlocked
  
  // Metadata
  isActive: boolean;
  isSecret: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserAchievement extends Document {
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  progress: number;
  isNotified: boolean;
  sharedOn: {
    twitter?: Date;
    linkedin?: Date;
    facebook?: Date;
  };
}

const AchievementSchema: Schema = new Schema({
  achievementId: {
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
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'LEGENDARY']
  },
  tier: {
    type: String,
    required: true,
    enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']
  },
  icon: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#FFD700'
  },
  
  requirements: {
    type: {
      type: String,
      required: true,
      enum: ['POINTS', 'ACTION', 'STREAK', 'COLLECTION', 'SPECIAL']
    },
    targetValue: {
      type: Number,
      required: true
    },
    actionType: String,
    conditions: {
      type: Map,
      of: Schema.Types.Mixed
    }
  },
  
  rewards: {
    points: {
      type: Number,
      default: 0
    },
    badgeUrl: String,
    specialPerks: [String]
  },
  
  unlockedBy: {
    type: Number,
    default: 0
  },
  rarity: {
    type: Number,
    default: 100
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  isSecret: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const UserAchievementSchema: Schema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  achievementId: {
    type: String,
    required: true,
    index: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  isNotified: {
    type: Boolean,
    default: false
  },
  sharedOn: {
    twitter: Date,
    linkedin: Date,
    facebook: Date
  }
}, {
  timestamps: true
});

// Compound indexes
UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
AchievementSchema.index({ category: 1, tier: 1 });
AchievementSchema.index({ isActive: 1, order: 1 });

export const Achievement = mongoose.model<IAchievement>('Achievement', AchievementSchema);
export const UserAchievement = mongoose.model<IUserAchievement>('UserAchievement', UserAchievementSchema);
