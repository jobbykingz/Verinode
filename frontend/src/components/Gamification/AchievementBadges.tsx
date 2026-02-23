import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Lock,
  Unlock,
  Share2,
  Twitter,
  Linkedin,
  Facebook,
  X,
  ChevronRight,
  Award,
  Star,
  Zap,
  Target,
  Flame,
  Crown,
  Gem
} from 'lucide-react';

interface Achievement {
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
  category: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | 'LEGENDARY';
  progress: number;
  target: number;
  unlocked: boolean;
  unlockedAt?: Date;
  rewards: {
    points: number;
    specialPerks?: string[];
  };
}

interface AchievementStats {
  totalAchievements: number;
  unlockedCount: number;
  unlockedByTier: Record<string, number>;
  unlockedByCategory: Record<string, number>;
  completionPercentage: number;
}

interface AchievementBadgesProps {
  userId: string;
  onAchievementUnlock?: (achievement: Achievement) => void;
  onShare?: (achievementId: string, platform: string) => void;
}

const tierColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  BRONZE: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700', glow: 'shadow-orange-400' },
  SILVER: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700', glow: 'shadow-gray-400' },
  GOLD: { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700', glow: 'shadow-yellow-400' },
  PLATINUM: { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-700', glow: 'shadow-slate-400' },
  DIAMOND: { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-700', glow: 'shadow-cyan-400' }
};

const categoryIcons: Record<string, React.ReactNode> = {
  BEGINNER: <Target className="h-4 w-4" />,
  INTERMEDIATE: <Zap className="h-4 w-4" />,
  ADVANCED: <Star className="h-4 w-4" />,
  EXPERT: <Crown className="h-4 w-4" />,
  LEGENDARY: <Gem className="h-4 w-4" />
};

const AchievementBadges: React.FC<AchievementBadgesProps> = ({
  userId,
  onAchievementUnlock,
  onShare
}) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [filterTier, setFilterTier] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [showShareModal, setShowShareModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);

  // Mock data - replace with API call
  useEffect(() => {
    const mockAchievements: Achievement[] = [
      {
        achievementId: 'first_proof',
        name: 'First Steps',
        description: 'Create your first proof',
        icon: '🎯',
        tier: 'BRONZE',
        category: 'BEGINNER',
        progress: 100,
        target: 1,
        unlocked: true,
        unlockedAt: new Date('2024-01-15'),
        rewards: { points: 50 }
      },
      {
        achievementId: 'proof_master',
        name: 'Proof Master',
        description: 'Create 10 proofs',
        icon: '📜',
        tier: 'SILVER',
        category: 'INTERMEDIATE',
        progress: 70,
        target: 10,
        unlocked: false,
        rewards: { points: 200 }
      },
      {
        achievementId: 'week_warrior',
        name: 'Week Warrior',
        description: 'Maintain a 7-day login streak',
        icon: '🔥',
        tier: 'SILVER',
        category: 'INTERMEDIATE',
        progress: 100,
        target: 7,
        unlocked: true,
        unlockedAt: new Date('2024-01-20'),
        rewards: { points: 300 }
      },
      {
        achievementId: 'point_millionaire',
        name: 'Point Millionaire',
        description: 'Earn 5,000 total points',
        icon: '💎',
        tier: 'PLATINUM',
        category: 'EXPERT',
        progress: 45,
        target: 5000,
        unlocked: false,
        rewards: { points: 1000, specialPerks: ['Exclusive Badge', 'Priority Support'] }
      },
      {
        achievementId: 'legendary',
        name: 'Legendary',
        description: 'Reach level 10',
        icon: '🌟',
        tier: 'DIAMOND',
        category: 'LEGENDARY',
        progress: 20,
        target: 10,
        unlocked: false,
        rewards: { points: 2000, specialPerks: ['Legendary Status', 'Custom Badge', 'Beta Access'] }
      }
    ];

    const mockStats: AchievementStats = {
      totalAchievements: 25,
      unlockedCount: 8,
      unlockedByTier: { BRONZE: 4, SILVER: 3, GOLD: 1 },
      unlockedByCategory: { BEGINNER: 5, INTERMEDIATE: 3 },
      completionPercentage: 32
    };

    setAchievements(mockAchievements);
    setStats(mockStats);
    setLoading(false);
  }, [userId]);

  // Filter achievements
  const filteredAchievements = achievements.filter(achievement => {
    if (filterTier !== 'ALL' && achievement.tier !== filterTier) return false;
    if (filterCategory !== 'ALL' && achievement.category !== filterCategory) return false;
    return true;
  });

  // Group by category
  const groupedAchievements = filteredAchievements.reduce<Record<string, Achievement[]>>((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category].push(achievement);
    return acc;
  }, {});

  const handleShare = (platform: string) => {
    if (selectedAchievement) {
      onShare?.(selectedAchievement.achievementId, platform);
      setShowShareModal(false);
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      {stats && (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="h-6 w-6" />
                Achievements
              </h2>
              <p className="text-purple-100 mt-1">
                {stats.unlockedCount} of {stats.totalAchievements} unlocked
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.completionPercentage}%</div>
              <div className="text-sm text-purple-100">Complete</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 bg-white/20 rounded-full h-3">
            <div
              className="bg-white rounded-full h-3 transition-all duration-500"
              style={{ width: `${stats.completionPercentage}%` }}
            />
          </div>

          {/* Tier Breakdown */}
          <div className="mt-4 flex gap-4">
            {Object.entries(stats.unlockedByTier).map(([tier, count]) => (
              <div key={tier} className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
                <Award className="h-4 w-4" style={{ color: tierColors[tier]?.text }} />
                <span className="text-sm">{tier}: {count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Tiers</option>
          <option value="BRONZE">Bronze</option>
          <option value="SILVER">Silver</option>
          <option value="GOLD">Gold</option>
          <option value="PLATINUM">Platinum</option>
          <option value="DIAMOND">Diamond</option>
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Categories</option>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
          <option value="EXPERT">Expert</option>
          <option value="LEGENDARY">Legendary</option>
        </select>
      </div>

      {/* Achievement Grid */}
      {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            {categoryIcons[category]}
            {category}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryAchievements.map((achievement) => {
              const tierStyle = tierColors[achievement.tier];
              const isNewlyUnlocked = newlyUnlocked.includes(achievement.achievementId);

              return (
                <div
                  key={achievement.achievementId}
                  onClick={() => setSelectedAchievement(achievement)}
                  className={`
                    relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300
                    ${achievement.unlocked 
                      ? `${tierStyle.bg} ${tierStyle.border} ${tierStyle.glow} shadow-lg` 
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }
                    ${isNewlyUnlocked ? 'animate-pulse ring-2 ring-green-400' : ''}
                  `}
                >
                  {/* Unlocked Badge */}
                  {achievement.unlocked && (
                    <div className="absolute top-2 right-2">
                      <Unlock className="h-4 w-4 text-green-600" />
                    </div>
                  )}

                  {/* Locked Overlay */}
                  {!achievement.unlocked && (
                    <div className="absolute inset-0 bg-gray-100/50 rounded-xl flex items-center justify-center">
                      <Lock className="h-8 w-8 text-gray-400" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={`
                      text-3xl p-2 rounded-lg
                      ${achievement.unlocked ? 'bg-white/50' : 'bg-gray-200'}
                    `}>
                      {achievement.icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold truncate ${achievement.unlocked ? tierStyle.text : 'text-gray-600'}`}>
                        {achievement.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {achievement.description}
                      </p>
                      
                      {/* Progress Bar */}
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{achievement.progress}%</span>
                          <span>{achievement.rewards.points} pts</span>
                        </div>
                        <div className="bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`${getProgressColor(achievement.progress)} rounded-full h-1.5 transition-all duration-500`}
                            style={{ width: `${Math.min(100, achievement.progress)}%` }}
                          />
                        </div>
                      </div>

                      {/* Tier Badge */}
                      <div className="mt-2">
                        <span className={`
                          text-xs px-2 py-0.5 rounded-full font-medium
                          ${tierStyle.bg} ${tierStyle.text}
                        `}>
                          {achievement.tier}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Achievement Detail Modal */}
      {selectedAchievement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setSelectedAchievement(null)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className={`
                text-6xl mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4
                ${tierColors[selectedAchievement.tier].bg}
              `}>
                {selectedAchievement.icon}
              </div>

              <h3 className="text-2xl font-bold text-gray-800">{selectedAchievement.name}</h3>
              <p className="text-gray-600 mt-2">{selectedAchievement.description}</p>

              <div className="mt-4 flex justify-center gap-2">
                <span className={`
                  px-3 py-1 rounded-full text-sm font-medium
                  ${tierColors[selectedAchievement.tier].bg}
                  ${tierColors[selectedAchievement.tier].text}
                `}>
                  {selectedAchievement.tier}
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                  {selectedAchievement.category}
                </span>
              </div>

              {/* Progress */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{selectedAchievement.progress}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-3">
                  <div
                    className={`${getProgressColor(selectedAchievement.progress)} rounded-full h-3 transition-all duration-500`}
                    style={{ width: `${Math.min(100, selectedAchievement.progress)}%` }}
                  />
                </div>
              </div>

              {/* Rewards */}
              <div className="mt-6 bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-700 mb-2">Rewards</h4>
                <div className="flex items-center gap-2 text-green-600">
                  <Star className="h-5 w-5" />
                  <span className="font-bold">{selectedAchievement.rewards.points} Points</span>
                </div>
                {selectedAchievement.rewards.specialPerks && (
                  <div className="mt-2 space-y-1">
                    {selectedAchievement.rewards.specialPerks.map((perk, idx) => (
                      <div key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                        <ChevronRight className="h-4 w-4" />
                        {perk}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Share Button */}
              {selectedAchievement.unlocked && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="h-5 w-5" />
                  Share Achievement
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedAchievement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-xl font-bold text-center mb-6">Share Achievement</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleShare('twitter')}
                className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
              >
                <Twitter className="h-8 w-8 text-blue-500" />
                <span className="text-sm">Twitter</span>
              </button>
              
              <button
                onClick={() => handleShare('linkedin')}
                className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
              >
                <Linkedin className="h-8 w-8 text-blue-700" />
                <span className="text-sm">LinkedIn</span>
              </button>
              
              <button
                onClick={() => handleShare('facebook')}
                className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
              >
                <Facebook className="h-8 w-8 text-blue-600" />
                <span className="text-sm">Facebook</span>
              </button>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="mt-6 w-full py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AchievementBadges;
