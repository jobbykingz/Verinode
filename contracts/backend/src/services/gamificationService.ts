import crypto from 'crypto';
import UserPoints, { IUserPoints, IPointsTransaction, LevelTitles, LevelThresholds } from '../models/UserPoints';
import { Achievement, UserAchievement, IAchievement } from '../models/Achievement';
import { Leaderboard, ILeaderboard } from '../models/Leaderboard';

export interface PointsEarnedResult {
  success: boolean;
  pointsAdded: number;
  totalPoints: number;
  currentPoints: number;
  levelUp?: {
    oldLevel: number;
    newLevel: number;
    newTitle: string;
  };
  transactionId: string;
  error?: string;
}

export interface StreakResult {
  success: boolean;
  dailyStreak: number;
  weeklyStreak: number;
  streakBonus: number;
  isNewRecord: boolean;
  error?: string;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  type: 'CREATE_PROOF' | 'VERIFY_PROOF' | 'SHARE' | 'LOGIN' | 'INVITE';
  target: number;
  current: number;
  points: number;
  completed: boolean;
  expiresAt: Date;
}

export class GamificationService {
  private readonly POINTS_CONFIG = {
    CREATE_PROOF: 50,
    VERIFY_PROOF: 30,
    SHARE_PROOF: 20,
    COMPLETE_PROFILE: 100,
    DAILY_LOGIN: 10,
    REFER_USER: 200,
    COMPLETE_CHALLENGE: 100,
    UNLOCK_ACHIEVEMENT: 150,
    STREAK_BONUS: 5 // Multiplier per day
  };

  private readonly STREAK_THRESHOLDS = {
    DAILY: [3, 7, 14, 30, 60, 90, 180, 365],
    WEEKLY: [2, 4, 8, 12, 26, 52]
  };

  /**
   * Initialize user points for new user
   */
  async initializeUser(userId: string, username: string): Promise<IUserPoints> {
    try {
      const existingPoints = await UserPoints.findOne({ userId });
      if (existingPoints) {
        return existingPoints;
      }

      const userPoints = new UserPoints({
        userId,
        totalPoints: 0,
        currentPoints: 0,
        lifetimePoints: 0,
        level: 1,
        levelTitle: LevelTitles[1],
        currentLevelProgress: 0,
        pointsToNextLevel: LevelThresholds[2],
        transactions: []
      });

      await userPoints.save();

      // Award welcome bonus
      await this.awardPoints(userId, 'COMPLETE_PROFILE', 100, 'Welcome bonus for joining Verinode!');

      return userPoints;
    } catch (error) {
      console.error('Initialize user error:', error);
      throw error;
    }
  }

  /**
   * Award points to user
   */
  async awardPoints(
    userId: string,
    source: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<PointsEarnedResult> {
    try {
      let userPoints = await UserPoints.findOne({ userId });
      
      if (!userPoints) {
        userPoints = await this.initializeUser(userId, '');
      }

      if (!userPoints) {
        return {
          success: false,
          pointsAdded: 0,
          totalPoints: 0,
          currentPoints: 0,
          transactionId: '',
          error: 'Failed to initialize user points'
        };
      }

      // Apply active multipliers
      const multiplier = this.calculateMultiplier(userPoints);
      const finalAmount = Math.round(amount * multiplier);

      // Create transaction
      const transactionId = this.generateTransactionId();
      const transaction: IPointsTransaction = {
        transactionId,
        type: 'EARNED',
        amount: finalAmount,
        source,
        description,
        metadata,
        createdAt: new Date()
      };

      // Update user points
      const oldLevel = userPoints.level;
      userPoints.totalPoints += finalAmount;
      userPoints.currentPoints += finalAmount;
      userPoints.lifetimePoints += finalAmount;
      userPoints.transactions.push(transaction as any);

      // Update stats
      if (source === 'CREATE_PROOF') {
        userPoints.stats.proofsCreated = (userPoints.stats.proofsCreated || 0) + 1;
      } else if (source === 'VERIFY_PROOF') {
        userPoints.stats.proofsVerified = (userPoints.stats.proofsVerified || 0) + 1;
      }
      userPoints.stats.totalActions = (userPoints.stats.totalActions || 0) + 1;

      // Check for level up
      const levelUpResult = this.checkLevelUp(userPoints);

      await userPoints.save();

      return {
        success: true,
        pointsAdded: finalAmount,
        totalPoints: userPoints.totalPoints,
        currentPoints: userPoints.currentPoints,
        levelUp: levelUpResult,
        transactionId
      };
    } catch (error) {
      console.error('Award points error:', error);
      return {
        success: false,
        pointsAdded: 0,
        totalPoints: 0,
        currentPoints: 0,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Failed to award points'
      };
    }
  }

  /**
   * Spend points
   */
  async spendPoints(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; remainingPoints: number; error?: string }> {
    try {
      const userPoints = await UserPoints.findOne({ userId });
      
      if (!userPoints) {
        return { success: false, remainingPoints: 0, error: 'User not found' };
      }

      if (userPoints.currentPoints < amount) {
        return { success: false, remainingPoints: userPoints.currentPoints, error: 'Insufficient points' };
      }

      const transactionId = this.generateTransactionId();
      const transaction: IPointsTransaction = {
        transactionId,
        type: 'SPENT',
        amount: -amount,
        source: 'REDEEM',
        description,
        metadata,
        createdAt: new Date()
      };

      userPoints.currentPoints -= amount;
      userPoints.transactions.push(transaction);

      await userPoints.save();

      return {
        success: true,
        remainingPoints: userPoints.currentPoints
      };
    } catch (error) {
      console.error('Spend points error:', error);
      return {
        success: false,
        remainingPoints: 0,
        error: error instanceof Error ? error.message : 'Failed to spend points'
      };
    }
  }

  /**
   * Update daily streak
   */
  async updateStreak(userId: string): Promise<StreakResult> {
    try {
      const userPoints = await UserPoints.findOne({ userId });
      
      if (!userPoints) {
        return { success: false, dailyStreak: 0, weeklyStreak: 0, streakBonus: 0, isNewRecord: false, error: 'User not found' };
      }

      const now = new Date();
      const lastActivity = userPoints.dailyStreak.lastActivity;
      
      let isNewRecord = false;
      let streakBonus = 0;

      if (lastActivity) {
        const daysSinceLastActivity = Math.floor(
          (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastActivity === 1) {
          // Consecutive day
          userPoints.dailyStreak.current++;
          if (userPoints.dailyStreak.current > userPoints.dailyStreak.longest) {
            userPoints.dailyStreak.longest = userPoints.dailyStreak.current;
            isNewRecord = true;
          }
        } else if (daysSinceLastActivity > 1) {
          // Streak broken
          userPoints.dailyStreak.current = 1;
        }
        // If same day, don't update
      } else {
        userPoints.dailyStreak.current = 1;
      }

      userPoints.dailyStreak.lastActivity = now;

      // Calculate streak bonus
      const streakMilestone = this.STREAK_THRESHOLDS.DAILY.findIndex(
        threshold => userPoints!.dailyStreak.current >= threshold
      );
      streakBonus = Math.max(1, streakMilestone + 1);

      // Award daily login points with streak bonus
      const basePoints = this.POINTS_CONFIG.DAILY_LOGIN;
      const bonusPoints = basePoints * streakBonus;
      
      await this.awardPoints(
        userId,
        'DAILY_LOGIN',
        bonusPoints,
        `Daily login bonus (${userPoints.dailyStreak.current} day streak!)`
      );

      await userPoints.save();

      return {
        success: true,
        dailyStreak: userPoints.dailyStreak.current,
        weeklyStreak: userPoints.weeklyStreak.current,
        streakBonus,
        isNewRecord
      };
    } catch (error) {
      console.error('Update streak error:', error);
      return {
        success: false,
        dailyStreak: 0,
        weeklyStreak: 0,
        streakBonus: 0,
        isNewRecord: false,
        error: error instanceof Error ? error.message : 'Failed to update streak'
      };
    }
  }

  /**
   * Get user points and level info
   */
  async getUserPoints(userId: string): Promise<{
    success: boolean;
    data?: {
      totalPoints: number;
      currentPoints: number;
      level: number;
      levelTitle: string;
      progress: number;
      pointsToNextLevel: number;
      dailyStreak: number;
      weeklyStreak: number;
    };
    error?: string;
  }> {
    try {
      const userPoints = await UserPoints.findOne({ userId });
      
      if (!userPoints) {
        return { success: false, error: 'User not found' };
      }

      return {
        success: true,
        data: {
          totalPoints: userPoints.totalPoints,
          currentPoints: userPoints.currentPoints,
          level: userPoints.level,
          levelTitle: userPoints.levelTitle,
          progress: userPoints.currentLevelProgress,
          pointsToNextLevel: userPoints.pointsToNextLevel,
          dailyStreak: userPoints.dailyStreak.current,
          weeklyStreak: userPoints.weeklyStreak.current
        }
      };
    } catch (error) {
      console.error('Get user points error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user points'
      };
    }
  }

  /**
   * Get daily challenges
   */
  async getDailyChallenges(userId: string): Promise<DailyChallenge[]> {
    // Mock daily challenges - in production, these would be generated daily
    const challenges: DailyChallenge[] = [
      {
        id: 'challenge_1',
        title: 'Proof Creator',
        description: 'Create 3 new proofs today',
        type: 'CREATE_PROOF',
        target: 3,
        current: 0,
        points: 100,
        completed: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: 'challenge_2',
        title: 'Verification Expert',
        description: 'Verify 5 proofs',
        type: 'VERIFY_PROOF',
        target: 5,
        current: 0,
        points: 75,
        completed: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: 'challenge_3',
        title: 'Social Sharer',
        description: 'Share a proof on social media',
        type: 'SHARE',
        target: 1,
        current: 0,
        points: 50,
        completed: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    ];

    return challenges;
  }

  /**
   * Complete a challenge
   */
  async completeChallenge(userId: string, challengeId: string): Promise<{
    success: boolean;
    pointsEarned: number;
    error?: string;
  }> {
    try {
      const result = await this.awardPoints(
        userId,
        'COMPLETE_CHALLENGE',
        this.POINTS_CONFIG.COMPLETE_CHALLENGE,
        `Completed challenge: ${challengeId}`
      );

      if (result.success) {
        const userPoints = await UserPoints.findOne({ userId });
        if (userPoints) {
          userPoints.stats.challengesCompleted++;
          await userPoints.save();
        }
      }

      return {
        success: result.success,
        pointsEarned: result.pointsAdded
      };
    } catch (error) {
      console.error('Complete challenge error:', error);
      return {
        success: false,
        pointsEarned: 0,
        error: error instanceof Error ? error.message : 'Failed to complete challenge'
      };
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    success: boolean;
    transactions?: IPointsTransaction[];
    total?: number;
    error?: string;
  }> {
    try {
      const userPoints = await UserPoints.findOne({ userId });
      
      if (!userPoints) {
        return { success: false, error: 'User not found' };
      }

      const transactions = userPoints.transactions
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(offset, offset + limit);

      return {
        success: true,
        transactions,
        total: userPoints.transactions.length
      };
    } catch (error) {
      console.error('Get transaction history error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transaction history'
      };
    }
  }

  /**
   * Apply referral bonus
   */
  async applyReferralBonus(referrerId: string, referredId: string): Promise<void> {
    try {
      // Award referrer
      await this.awardPoints(
        referrerId,
        'REFER_USER',
        this.POINTS_CONFIG.REFER_USER,
        `Referred user: ${referredId}`
      );

      const referrerPoints = await UserPoints.findOne({ userId: referrerId });
      if (referrerPoints) {
        referrerPoints.stats.referrals++;
        await referrerPoints.save();
      }

      // Award referred user
      await this.awardPoints(
        referredId,
        'REFER_USER',
        50,
        'Joined via referral'
      );
    } catch (error) {
      console.error('Apply referral bonus error:', error);
    }
  }

  /**
   * Calculate active multiplier
   */
  private calculateMultiplier(userPoints: IUserPoints): number {
    const now = new Date();
    let multiplier = 1;

    userPoints.activeMultipliers.forEach(m => {
      if (!m.expiresAt || m.expiresAt > now) {
        multiplier *= m.multiplier;
      }
    });

    return multiplier;
  }

  /**
   * Check and handle level up
   */
  private checkLevelUp(userPoints: IUserPoints): { oldLevel: number; newLevel: number; newTitle: string } | undefined {
    const oldLevel = userPoints.level;
    let newLevel = oldLevel;

    // Check if user has enough points for next level
    while (newLevel < 10 && userPoints.totalPoints >= LevelThresholds[newLevel + 1]) {
      newLevel++;
    }

    if (newLevel > oldLevel) {
      userPoints.level = newLevel;
      userPoints.levelTitle = LevelTitles[newLevel] || 'Legend';
      
      // Update progress
      const currentThreshold = LevelThresholds[newLevel];
      const nextThreshold = LevelThresholds[newLevel + 1] || currentThreshold * 2;
      const pointsInLevel = userPoints.totalPoints - currentThreshold;
      const pointsNeeded = nextThreshold - currentThreshold;
      userPoints.currentLevelProgress = Math.min(100, Math.round((pointsInLevel / pointsNeeded) * 100));
      userPoints.pointsToNextLevel = Math.max(0, nextThreshold - userPoints.totalPoints);

      return {
        oldLevel,
        newLevel,
        newTitle: userPoints.levelTitle
      };
    }

    // Update progress even if no level up
    const currentThreshold = LevelThresholds[userPoints.level];
    const nextThreshold = LevelThresholds[userPoints.level + 1] || currentThreshold * 2;
    const pointsInLevel = userPoints.totalPoints - currentThreshold;
    const pointsNeeded = nextThreshold - currentThreshold;
    userPoints.currentLevelProgress = Math.min(100, Math.round((pointsInLevel / pointsNeeded) * 100));
    userPoints.pointsToNextLevel = Math.max(0, nextThreshold - userPoints.totalPoints);

    return undefined;
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `txn_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;
  }
}

export default new GamificationService();
