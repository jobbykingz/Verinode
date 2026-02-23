import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPoints extends Document {
  userId: string;
  totalPoints: number;
  currentPoints: number; // Available to spend
  lifetimePoints: number;
  
  // Level system
  level: number;
  levelTitle: string;
  currentLevelProgress: number;
  pointsToNextLevel: number;
  
  // Multipliers
  activeMultipliers: {
    source: string;
    multiplier: number;
    expiresAt?: Date;
  }[];
  
  // Streaks
  dailyStreak: {
    current: number;
    longest: number;
    lastActivity: Date;
  };
  weeklyStreak: {
    current: number;
    longest: number;
    lastActivity: Date;
  };
  
  // History
  transactions: IPointsTransaction[];
  
  // Stats
  stats: {
    totalActions: number;
    proofsCreated: number;
    proofsVerified: number;
    challengesCompleted: number;
    achievementsUnlocked: number;
    referrals: number;
  };
  
  // Preferences
  preferences: {
    autoClaimRewards: boolean;
    notificationsEnabled: boolean;
    publicProfile: boolean;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IPointsTransaction {
  transactionId: string;
  type: 'EARNED' | 'SPENT' | 'BONUS' | 'PENALTY' | 'REFUND';
  amount: number;
  source: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
}

const PointsTransactionSchema: Schema = new Schema({
  transactionId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['EARNED', 'SPENT', 'BONUS', 'PENALTY', 'REFUND']
  },
  amount: {
    type: Number,
    required: true
  },
  source: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: Date
}, { _id: false });

const UserPointsSchema: Schema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  totalPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  currentPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  lifetimePoints: {
    type: Number,
    default: 0,
    min: 0
  },
  
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  levelTitle: {
    type: String,
    default: 'Novice'
  },
  currentLevelProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  pointsToNextLevel: {
    type: Number,
    default: 100
  },
  
  activeMultipliers: [{
    source: String,
    multiplier: {
      type: Number,
      min: 1
    },
    expiresAt: Date
  }],
  
  dailyStreak: {
    current: {
      type: Number,
      default: 0
    },
    longest: {
      type: Number,
      default: 0
    },
    lastActivity: Date
  },
  
  weeklyStreak: {
    current: {
      type: Number,
      default: 0
    },
    longest: {
      type: Number,
      default: 0
    },
    lastActivity: Date
  },
  
  transactions: [PointsTransactionSchema],
  
  stats: {
    totalActions: {
      type: Number,
      default: 0
    },
    proofsCreated: {
      type: Number,
      default: 0
    },
    proofsVerified: {
      type: Number,
      default: 0
    },
    challengesCompleted: {
      type: Number,
      default: 0
    },
    achievementsUnlocked: {
      type: Number,
      default: 0
    },
    referrals: {
      type: Number,
      default: 0
    }
  },
  
  preferences: {
    autoClaimRewards: {
      type: Boolean,
      default: true
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    },
    publicProfile: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
UserPointsSchema.index({ totalPoints: -1 });
UserPointsSchema.index({ level: -1 });
UserPointsSchema.index({ 'dailyStreak.current': -1 });
UserPointsSchema.index({ createdAt: -1 });

// Level titles based on level number
export const LevelTitles: Record<number, string> = {
  1: 'Novice',
  2: 'Apprentice',
  3: 'Journeyman',
  4: 'Expert',
  5: 'Master',
  6: 'Grandmaster',
  7: 'Legend',
  8: 'Mythic',
  9: 'Immortal',
  10: 'Transcendent'
};

// Points required for each level
export const LevelThresholds: Record<number, number> = {
  1: 0,
  2: 100,
  3: 300,
  4: 600,
  5: 1000,
  6: 1500,
  7: 2200,
  8: 3000,
  9: 4000,
  10: 5500
};

export default mongoose.model<IUserPoints>('UserPoints', UserPointsSchema);
