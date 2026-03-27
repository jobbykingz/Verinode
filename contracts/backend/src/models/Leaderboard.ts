import mongoose, { Schema, Document } from 'mongoose';

export interface ILeaderboard extends Document {
  leaderboardId: string;
  name: string;
  description: string;
  type: 'GLOBAL' | 'WEEKLY' | 'MONTHLY' | 'SEASONAL' | 'SPECIAL';
  category: 'POINTS' | 'ACHIEVEMENTS' | 'STREAK' | 'REFERRALS' | 'PROOFS' | 'CHALLENGES';
  
  // Time frame
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  
  // Entries
  entries: ILeaderboardEntry[];
  
  // Rewards for top positions
  rewards: {
    position: number;
    rewardType: 'POINTS' | 'BADGE' | 'SPECIAL';
    rewardValue: number | string;
    description: string;
  }[];
  
  // Settings
  settings: {
    maxEntries: number;
    updateFrequency: number; // in minutes
    showAnonymous: boolean;
    allowTies: boolean;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  rank: number;
  previousRank?: number;
  score: number;
  stats: {
    proofsCreated?: number;
    proofsVerified?: number;
    achievements?: number;
    streak?: number;
    referrals?: number;
  };
  trend: 'UP' | 'DOWN' | 'STABLE';
  updatedAt: Date;
}

const LeaderboardEntrySchema: Schema = new Schema({
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  avatar: String,
  rank: {
    type: Number,
    required: true,
    min: 1
  },
  previousRank: Number,
  score: {
    type: Number,
    required: true,
    default: 0
  },
  stats: {
    proofsCreated: Number,
    proofsVerified: Number,
    achievements: Number,
    streak: Number,
    referrals: Number
  },
  trend: {
    type: String,
    enum: ['UP', 'DOWN', 'STABLE'],
    default: 'STABLE'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const LeaderboardSchema: Schema = new Schema({
  leaderboardId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['GLOBAL', 'WEEKLY', 'MONTHLY', 'SEASONAL', 'SPECIAL']
  },
  category: {
    type: String,
    required: true,
    enum: ['POINTS', 'ACHIEVEMENTS', 'STREAK', 'REFERRALS', 'PROOFS', 'CHALLENGES']
  },
  
  startDate: {
    type: Date,
    required: true
  },
  endDate: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  
  entries: [LeaderboardEntrySchema],
  
  rewards: [{
    position: {
      type: Number,
      required: true
    },
    rewardType: {
      type: String,
      enum: ['POINTS', 'BADGE', 'SPECIAL'],
      required: true
    },
    rewardValue: {
      type: Schema.Types.Mixed,
      required: true
    },
    description: String
  }],
  
  settings: {
    maxEntries: {
      type: Number,
      default: 100
    },
    updateFrequency: {
      type: Number,
      default: 5
    },
    showAnonymous: {
      type: Boolean,
      default: false
    },
    allowTies: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
LeaderboardSchema.index({ type: 1, category: 1, isActive: 1 });
LeaderboardSchema.index({ startDate: -1 });
LeaderboardSchema.index({ 'entries.userId': 1 });

// Methods
LeaderboardSchema.methods.getUserRank = function(userId: string): ILeaderboardEntry | undefined {
  return this.entries.find((entry: ILeaderboardEntry) => entry.userId === userId);
};

LeaderboardSchema.methods.getTopEntries = function(limit: number = 10): ILeaderboardEntry[] {
  return this.entries.slice(0, limit);
};

LeaderboardSchema.methods.updateEntry = async function(
  userId: string,
  username: string,
  score: number,
  stats?: Partial<ILeaderboardEntry['stats']>
): Promise<void> {
  const existingEntryIndex = this.entries.findIndex(
    (entry: ILeaderboardEntry) => entry.userId === userId
  );
  
  const now = new Date();
  
  if (existingEntryIndex >= 0) {
    const existingEntry = this.entries[existingEntryIndex];
    const previousRank = existingEntry.rank;
    
    existingEntry.score = score;
    existingEntry.previousRank = previousRank;
    existingEntry.stats = { ...existingEntry.stats, ...stats };
    existingEntry.updatedAt = now;
  } else {
    this.entries.push({
      userId,
      username,
      rank: this.entries.length + 1,
      score,
      stats: stats || {},
      trend: 'STABLE',
      updatedAt: now
    });
  }
  
  // Sort entries by score (descending)
  this.entries.sort((a: ILeaderboardEntry, b: ILeaderboardEntry) => b.score - a.score);
  
  // Update ranks and trends
  this.entries.forEach((entry: ILeaderboardEntry, index: number) => {
    const newRank = index + 1;
    if (entry.previousRank) {
      if (newRank < entry.previousRank) {
        entry.trend = 'UP';
      } else if (newRank > entry.previousRank) {
        entry.trend = 'DOWN';
      } else {
        entry.trend = 'STABLE';
      }
    }
    entry.rank = newRank;
  });
  
  // Trim to max entries
  if (this.entries.length > this.settings.maxEntries) {
    this.entries = this.entries.slice(0, this.settings.maxEntries);
  }
  
  await this.save();
};

export const Leaderboard = mongoose.model<ILeaderboard>('Leaderboard', LeaderboardSchema);
