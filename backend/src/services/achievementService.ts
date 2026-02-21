import crypto from 'crypto';
import { Achievement, UserAchievement, IAchievement } from '../models/Achievement';
import UserPoints from '../models/UserPoints';
import gamificationService from './gamificationService';

export interface AchievementUnlockResult {
  success: boolean;
  unlocked: boolean;
  achievement?: IAchievement;
  progress: number;
  alreadyUnlocked?: boolean;
  error?: string;
}

export interface AchievementProgress {
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  progress: number;
  target: number;
  unlocked: boolean;
  unlockedAt?: Date;
}

export interface UserAchievementStats {
  totalAchievements: number;
  unlockedCount: number;
  unlockedByTier: Record<string, number>;
  unlockedByCategory: Record<string, number>;
  completionPercentage: number;
  recentUnlocks: IAchievement[];
  nextAchievements: IAchievement[];
}

export class AchievementService {
  private readonly DEFAULT_ACHIEVEMENTS: Partial<IAchievement>[] = [
    {
      achievementId: 'first_proof',
      name: 'First Steps',
      description: 'Create your first proof',
      category: 'BEGINNER',
      tier: 'BRONZE',
      icon: '🎯',
      color: '#CD7F32',
      requirements: {
        type: 'ACTION',
        targetValue: 1,
        actionType: 'CREATE_PROOF'
      },
      rewards: {
        points: 50
      },
      order: 1
    },
    {
      achievementId: 'proof_master',
      name: 'Proof Master',
      description: 'Create 10 proofs',
      category: 'INTERMEDIATE',
      tier: 'SILVER',
      icon: '📜',
      color: '#C0C0C0',
      requirements: {
        type: 'ACTION',
        targetValue: 10,
        actionType: 'CREATE_PROOF'
      },
      rewards: {
        points: 200
      },
      order: 2
    },
    {
      achievementId: 'proof_legend',
      name: 'Proof Legend',
      description: 'Create 100 proofs',
      category: 'EXPERT',
      tier: 'GOLD',
      icon: '👑',
      color: '#FFD700',
      requirements: {
        type: 'ACTION',
        targetValue: 100,
        actionType: 'CREATE_PROOF'
      },
      rewards: {
        points: 1000
      },
      order: 3
    },
    {
      achievementId: 'verifier',
      name: 'Verifier',
      description: 'Verify 5 proofs',
      category: 'BEGINNER',
      tier: 'BRONZE',
      icon: '✅',
      color: '#CD7F32',
      requirements: {
        type: 'ACTION',
        targetValue: 5,
        actionType: 'VERIFY_PROOF'
      },
      rewards: {
        points: 75
      },
      order: 4
    },
    {
      achievementId: 'verification_expert',
      name: 'Verification Expert',
      description: 'Verify 50 proofs',
      category: 'ADVANCED',
      tier: 'SILVER',
      icon: '🔍',
      color: '#C0C0C0',
      requirements: {
        type: 'ACTION',
        targetValue: 50,
        actionType: 'VERIFY_PROOF'
      },
      rewards: {
        points: 500
      },
      order: 5
    },
    {
      achievementId: 'week_warrior',
      name: 'Week Warrior',
      description: 'Maintain a 7-day login streak',
      category: 'INTERMEDIATE',
      tier: 'SILVER',
      icon: '🔥',
      color: '#C0C0C0',
      requirements: {
        type: 'STREAK',
        targetValue: 7,
        actionType: 'DAILY_LOGIN'
      },
      rewards: {
        points: 300
      },
      order: 6
    },
    {
      achievementId: 'dedication',
      name: 'Dedication',
      description: 'Maintain a 30-day login streak',
      category: 'ADVANCED',
      tier: 'GOLD',
      icon: '💎',
      color: '#FFD700',
      requirements: {
        type: 'STREAK',
        targetValue: 30,
        actionType: 'DAILY_LOGIN'
      },
      rewards: {
        points: 1000
      },
      order: 7
    },
    {
      achievementId: 'point_collector',
      name: 'Point Collector',
      description: 'Earn 1,000 total points',
      category: 'INTERMEDIATE',
      tier: 'SILVER',
      icon: '💰',
      color: '#C0C0C0',
      requirements: {
        type: 'POINTS',
        targetValue: 1000
      },
      rewards: {
        points: 200
      },
      order: 8
    },
    {
      achievementId: 'point_millionaire',
      name: 'Point Millionaire',
      description: 'Earn 5,000 total points',
      category: 'EXPERT',
      tier: 'PLATINUM',
      icon: '💎',
      color: '#E5E4E2',
      requirements: {
        type: 'POINTS',
        targetValue: 5000
      },
      rewards: {
        points: 1000,
        specialPerks: ['Exclusive Badge', 'Priority Support']
      },
      order: 9
    },
    {
      achievementId: 'social_butterfly',
      name: 'Social Butterfly',
      description: 'Share 10 proofs on social media',
      category: 'INTERMEDIATE',
      tier: 'SILVER',
      icon: '🦋',
      color: '#C0C0C0',
      requirements: {
        type: 'ACTION',
        targetValue: 10,
        actionType: 'SHARE_PROOF'
      },
      rewards: {
        points: 250
      },
      order: 10
    },
    {
      achievementId: 'referrer',
      name: 'Referrer',
      description: 'Refer 3 friends to Verinode',
      category: 'INTERMEDIATE',
      tier: 'SILVER',
      icon: '🤝',
      color: '#C0C0C0',
      requirements: {
        type: 'ACTION',
        targetValue: 3,
        actionType: 'REFERRAL'
      },
      rewards: {
        points: 500
      },
      order: 11
    },
    {
      achievementId: 'level_5',
      name: 'Rising Star',
      description: 'Reach level 5',
      category: 'ADVANCED',
      tier: 'GOLD',
      icon: '⭐',
      color: '#FFD700',
      requirements: {
        type: 'SPECIAL',
        targetValue: 5,
        actionType: 'REACH_LEVEL'
      },
      rewards: {
        points: 500
      },
      order: 12
    },
    {
      achievementId: 'level_10',
      name: 'Legendary',
      description: 'Reach level 10',
      category: 'LEGENDARY',
      tier: 'DIAMOND',
      icon: '🌟',
      color: '#B9F2FF',
      requirements: {
        type: 'SPECIAL',
        targetValue: 10,
        actionType: 'REACH_LEVEL'
      },
      rewards: {
        points: 2000,
        specialPerks: ['Legendary Status', 'Custom Badge', 'Beta Access']
      },
      isSecret: true,
      order: 13
    }
  ];

  /**
   * Initialize default achievements
   */
  async initializeAchievements(): Promise<void> {
    try {
      for (const achievementData of this.DEFAULT_ACHIEVEMENTS) {
        const existing = await Achievement.findOne({
          achievementId: achievementData.achievementId
        });

        if (!existing) {
          await Achievement.create(achievementData);
        }
      }
      console.log('Default achievements initialized');
    } catch (error) {
      console.error('Initialize achievements error:', error);
    }
  }

  /**
   * Check and update achievement progress
   */
  async checkAchievement(
    userId: string,
    actionType: string,
    value: number = 1,
    metadata?: Record<string, any>
  ): Promise<AchievementUnlockResult[]> {
    const results: AchievementUnlockResult[] = [];

    try {
      // Get all active achievements for this action type
      const achievements = await Achievement.find({
        isActive: true,
        'requirements.actionType': actionType
      });

      for (const achievement of achievements) {
        const result = await this.updateAchievementProgress(userId, achievement, value);
        results.push(result);
      }

      // Also check POINTS and SPECIAL type achievements
      if (actionType === 'EARN_POINTS') {
        const pointsAchievements = await Achievement.find({
          isActive: true,
          'requirements.type': 'POINTS'
        });

        for (const achievement of pointsAchievements) {
          const userPoints = await UserPoints.findOne({ userId });
          if (userPoints) {
            const result = await this.updateAchievementProgress(
              userId,
              achievement,
              userPoints.totalPoints
            );
            results.push(result);
          }
        }
      }

      if (actionType === 'REACH_LEVEL') {
        const levelAchievements = await Achievement.find({
          isActive: true,
          'requirements.type': 'SPECIAL',
          'requirements.actionType': 'REACH_LEVEL'
        });

        for (const achievement of levelAchievements) {
          const result = await this.updateAchievementProgress(
            userId,
            achievement,
            metadata?.level || 0
          );
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      console.error('Check achievement error:', error);
      return results;
    }
  }

  /**
   * Update achievement progress for a user
   */
  private async updateAchievementProgress(
    userId: string,
    achievement: IAchievement,
    value: number
  ): Promise<AchievementUnlockResult> {
    try {
      // Check if already unlocked
      const existingUnlock = await UserAchievement.findOne({
        userId,
        achievementId: achievement.achievementId
      });

      if (existingUnlock) {
        return {
          success: true,
          unlocked: true,
          achievement,
          progress: 100,
          alreadyUnlocked: true
        };
      }

      // Calculate progress
      const targetValue = achievement.requirements.targetValue;
      const progress = Math.min(100, Math.round((value / targetValue) * 100));

      // Check if unlocked
      if (value >= targetValue) {
        // Unlock achievement
        await UserAchievement.create({
          userId,
          achievementId: achievement.achievementId,
          unlockedAt: new Date(),
          progress: 100,
          isNotified: false
        });

        // Update achievement stats
        achievement.unlockedBy += 1;
        await achievement.save();

        // Award points
        if (achievement.rewards.points > 0) {
          await gamificationService.awardPoints(
            userId,
            'UNLOCK_ACHIEVEMENT',
            achievement.rewards.points,
            `Unlocked achievement: ${achievement.name}`
          );
        }

        // Update user stats
        const userPoints = await UserPoints.findOne({ userId });
        if (userPoints) {
          userPoints.stats.achievementsUnlocked++;
          await userPoints.save();
        }

        return {
          success: true,
          unlocked: true,
          achievement,
          progress: 100
        };
      }

      // Not yet unlocked, track progress
      await UserAchievement.findOneAndUpdate(
        { userId, achievementId: achievement.achievementId },
        {
          userId,
          achievementId: achievement.achievementId,
          progress
        },
        { upsert: true }
      );

      return {
        success: true,
        unlocked: false,
        progress
      };
    } catch (error) {
      console.error('Update achievement progress error:', error);
      return {
        success: false,
        unlocked: false,
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to update progress'
      };
    }
  }

  /**
   * Get all achievements for a user
   */
  async getUserAchievements(userId: string): Promise<{
    success: boolean;
    achievements?: AchievementProgress[];
    stats?: UserAchievementStats;
    error?: string;
  }> {
    try {
      // Get all active achievements
      const allAchievements = await Achievement.find({ isActive: true })
        .sort({ order: 1 });

      // Get user's progress
      const userAchievements = await UserAchievement.find({ userId });

      const achievementProgress: AchievementProgress[] = allAchievements.map(achievement => {
        const userAchievement = userAchievements.find(
          ua => ua.achievementId === achievement.achievementId
        );

        return {
          achievementId: achievement.achievementId,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          tier: achievement.tier,
          progress: userAchievement?.progress || 0,
          target: achievement.requirements.targetValue,
          unlocked: !!userAchievement?.unlockedAt,
          unlockedAt: userAchievement?.unlockedAt
        };
      });

      // Calculate stats
      const unlockedAchievements = achievementProgress.filter(a => a.unlocked);
      const unlockedByTier: Record<string, number> = {};
      const unlockedByCategory: Record<string, number> = {};

      unlockedAchievements.forEach(a => {
        const achievement = allAchievements.find(aa => aa.achievementId === a.achievementId);
        if (achievement) {
          unlockedByTier[achievement.tier] = (unlockedByTier[achievement.tier] || 0) + 1;
          unlockedByCategory[achievement.category] = (unlockedByCategory[achievement.category] || 0) + 1;
        }
      });

      const recentUnlocks = allAchievements
        .filter(a => unlockedAchievements.some(ua => ua.achievementId === a.achievementId))
        .slice(-5);

      const nextAchievements = allAchievements
        .filter(a => !unlockedAchievements.some(ua => ua.achievementId === a.achievementId))
        .slice(0, 3);

      const stats: UserAchievementStats = {
        totalAchievements: allAchievements.length,
        unlockedCount: unlockedAchievements.length,
        unlockedByTier,
        unlockedByCategory,
        completionPercentage: Math.round((unlockedAchievements.length / allAchievements.length) * 100),
        recentUnlocks,
        nextAchievements
      };

      return {
        success: true,
        achievements: achievementProgress,
        stats
      };
    } catch (error) {
      console.error('Get user achievements error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get achievements'
      };
    }
  }

  /**
   * Get unlocked achievements for a user
   */
  async getUnlockedAchievements(userId: string): Promise<{
    success: boolean;
    achievements?: IAchievement[];
    error?: string;
  }> {
    try {
      const userAchievements = await UserAchievement.find({
        userId,
        unlockedAt: { $exists: true }
      }).sort({ unlockedAt: -1 });

      const achievementIds = userAchievements.map(ua => ua.achievementId);
      const achievements = await Achievement.find({
        achievementId: { $in: achievementIds }
      });

      // Sort by unlock date
      const sortedAchievements = userAchievements
        .map(ua => achievements.find(a => a.achievementId === ua.achievementId))
        .filter((a): a is NonNullable<typeof a> => a !== undefined);

      return {
        success: true,
        achievements: sortedAchievements
      };
    } catch (error) {
      console.error('Get unlocked achievements error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get unlocked achievements'
      };
    }
  }

  /**
   * Mark achievement as notified
   */
  async markAsNotified(userId: string, achievementId: string): Promise<void> {
    try {
      await UserAchievement.findOneAndUpdate(
        { userId, achievementId },
        { isNotified: true }
      );
    } catch (error) {
      console.error('Mark as notified error:', error);
    }
  }

  /**
   * Get pending notifications
   */
  async getPendingNotifications(userId: string): Promise<{
    success: boolean;
    achievements?: IAchievement[];
    error?: string;
  }> {
    try {
      const userAchievements = await UserAchievement.find({
        userId,
        isNotified: false,
        unlockedAt: { $exists: true }
      });

      const achievementIds = userAchievements.map(ua => ua.achievementId);
      const achievements = await Achievement.find({
        achievementId: { $in: achievementIds }
      });

      return {
        success: true,
        achievements
      };
    } catch (error) {
      console.error('Get pending notifications error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get notifications'
      };
    }
  }

  /**
   * Share achievement on social media
   */
  async shareAchievement(
    userId: string,
    achievementId: string,
    platform: 'twitter' | 'linkedin' | 'facebook'
  ): Promise<{ success: boolean; shareUrl?: string; error?: string }> {
    try {
      const userAchievement = await UserAchievement.findOne({
        userId,
        achievementId,
        unlockedAt: { $exists: true }
      });

      if (!userAchievement) {
        return { success: false, error: 'Achievement not unlocked' };
      }

      const achievement = await Achievement.findOne({ achievementId });
      if (!achievement) {
        return { success: false, error: 'Achievement not found' };
      }

      // Update share timestamp
      const shareField = `sharedOn.${platform}`;
      await UserAchievement.findOneAndUpdate(
        { userId, achievementId },
        { [shareField]: new Date() }
      );

      // Generate share URL (mock)
      const shareUrl = `https://verinode.io/achievement/${achievementId}?user=${userId}`;

      // Award bonus points for sharing
      await gamificationService.awardPoints(
        userId,
        'SHARE_PROOF',
        25,
        `Shared achievement on ${platform}`
      );

      return {
        success: true,
        shareUrl
      };
    } catch (error) {
      console.error('Share achievement error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to share achievement'
      };
    }
  }

  /**
   * Create custom achievement
   */
  async createAchievement(achievementData: Partial<IAchievement>): Promise<{
    success: boolean;
    achievement?: IAchievement;
    error?: string;
  }> {
    try {
      const achievementId = `custom_${crypto.randomBytes(8).toString('hex')}`;
      
      const achievement = await Achievement.create({
        ...achievementData,
        achievementId,
        unlockedBy: 0,
        rarity: 100
      });

      return {
        success: true,
        achievement
      };
    } catch (error) {
      console.error('Create achievement error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create achievement'
      };
    }
  }
}

export default new AchievementService();
