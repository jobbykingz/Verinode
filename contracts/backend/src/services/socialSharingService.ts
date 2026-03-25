import { WinstonLogger } from '../utils/logger';

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  verificationBadges: VerificationBadge[];
  proofCount: number;
  followers: number;
  following: number;
  joinedAt: Date;
  lastActive: Date;
}

export interface VerificationBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface SocialProof {
  id: string;
  userId: string;
  proofType: string;
  title: string;
  description: string;
  isPublic: boolean;
  shares: number;
  likes: number;
  comments: Comment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  content: string;
  createdAt: Date;
  likes: number;
  replies?: Comment[];
}

export interface ShareEvent {
  proofId: string;
  platform: string;
  userId: string;
  timestamp: Date;
  url?: string;
}

export class SocialSharingService {
  private logger: WinstonLogger;

  constructor() {
    this.logger = new WinstonLogger();
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      this.logger.info('Fetching user profile:', { userId });
      
      // Mock database query
      const profile = await this.fetchFromDatabase('user_profile', userId);
      
      if (profile) {
        // Update last active timestamp
        profile.lastActive = new Date();
        await this.saveToDatabase('user_profile', userId, profile);
      }
      
      return profile;
    } catch (error) {
      this.logger.error('Error fetching user profile:', error);
      return null;
    }
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
    try {
      const existingProfile = await this.getUserProfile(userId);
      if (!existingProfile) {
        return false;
      }

      const updatedProfile = { ...existingProfile, ...updates };
      await this.saveToDatabase('user_profile', userId, updatedProfile);
      
      this.logger.info('User profile updated:', { userId });
      return true;
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      return false;
    }
  }

  async shareProof(proofId: string, platform: string, userId: string, customMessage?: string): Promise<ShareEvent> {
    try {
      this.logger.info('Sharing proof:', { proofId, platform, userId });

      const shareEvent: ShareEvent = {
        proofId,
        platform,
        userId,
        timestamp: new Date(),
        url: `${process.env.FRONTEND_URL}/proof/${proofId}`
      };

      // Track share event
      await this.saveToDatabase('share_event', `${proofId}_${platform}_${Date.now()}`, shareEvent);

      // Update proof share count
      await this.incrementProofShares(proofId);

      // Generate share URLs for different platforms
      const shareUrl = this.generateShareUrl(proofId, platform, customMessage);
      
      this.logger.info('Proof shared successfully:', { proofId, platform, shareUrl });
      return shareEvent;
    } catch (error) {
      this.logger.error('Error sharing proof:', error);
      throw error;
    }
  }

  async likeProof(proofId: string, userId: string): Promise<boolean> {
    try {
      this.logger.info('Liking proof:', { proofId, userId });

      // Check if already liked
      const existingLike = await this.fetchFromDatabase('proof_like', `${proofId}_${userId}`);
      if (existingLike) {
        return false; // Already liked
      }

      // Add like
      const like = {
        proofId,
        userId,
        timestamp: new Date()
      };
      
      await this.saveToDatabase('proof_like', `${proofId}_${userId}`, like);
      await this.incrementProofLikes(proofId);

      // Create notification for proof owner
      await this.createNotification(proofId, 'like', userId);

      this.logger.info('Proof liked successfully:', { proofId, userId });
      return true;
    } catch (error) {
      this.logger.error('Error liking proof:', error);
      return false;
    }
  }

  async commentOnProof(proofId: string, userId: string, content: string): Promise<Comment | null> {
    try {
      this.logger.info('Adding comment to proof:', { proofId, userId });

      const comment: Comment = {
        id: this.generateId(),
        userId,
        username: await this.getUsername(userId),
        content,
        createdAt: new Date(),
        likes: 0,
        replies: []
      };

      // Save comment
      await this.saveToDatabase('proof_comment', comment.id, comment);
      await this.incrementProofComments(proofId);

      // Create notification for proof owner
      await this.createNotification(proofId, 'comment', userId);

      this.logger.info('Comment added successfully:', { proofId, commentId: comment.id });
      return comment;
    } catch (error) {
      this.logger.error('Error adding comment:', error);
      return null;
    }
  }

  async followUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      this.logger.info('User following:', { followerId, followingId });

      // Check if already following
      const existingFollow = await this.fetchFromDatabase('user_follow', `${followerId}_${followingId}`);
      if (existingFollow) {
        return false; // Already following
      }

      // Add follow relationship
      const follow = {
        followerId,
        followingId,
        timestamp: new Date()
      };
      
      await this.saveToDatabase('user_follow', `${followerId}_${followingId}`, follow);
      
      // Update follower counts
      await this.incrementFollowCount(followerId, 'following');
      await this.incrementFollowCount(followingId, 'followers');

      // Create notification
      await this.createNotification(followingId, 'follow', followerId);

      this.logger.info('User followed successfully:', { followerId, followingId });
      return true;
    } catch (error) {
      this.logger.error('Error following user:', error);
      return false;
    }
  }

  async getUserProofs(userId: string, includePrivate: boolean = false): Promise<SocialProof[]> {
    try {
      this.logger.info('Fetching user proofs:', { userId, includePrivate });
      
      // Mock database query
      const proofs = await this.fetchAllFromDatabase('social_proof', { 
        userId,
        includePrivate 
      });

      return proofs.filter(proof => includePrivate || proof.isPublic);
    } catch (error) {
      this.logger.error('Error fetching user proofs:', error);
      return [];
    }
  }

  async getProofFeed(limit: number = 20, offset: number = 0): Promise<SocialProof[]> {
    try {
      this.logger.info('Fetching proof feed:', { limit, offset });
      
      // Mock database query with pagination
      const proofs = await this.fetchAllFromDatabase('social_proof', {
        isPublic: true,
        limit,
        offset,
        orderBy: 'createdAt',
        order: 'desc'
      });

      return proofs;
    } catch (error) {
      this.logger.error('Error fetching proof feed:', error);
      return [];
    }
  }

  async getDiscoveryFeed(userId: string, interests?: string[]): Promise<SocialProof[]> {
    try {
      this.logger.info('Fetching discovery feed:', { userId, interests });

      // Mock discovery algorithm based on user interests and connections
      const userProfile = await this.getUserProfile(userId);
      const followingProofs = await this.getFollowingProofs(userId);
      
      // Get proofs from followed users
      const discoveryProofs = await this.fetchAllFromDatabase('social_proof', {
        userIds: followingProofs.map(p => p.userId),
        exclude: followingProofs.map(p => p.id),
        limit: 50,
        orderBy: 'createdAt',
        order: 'desc'
      });

      return discoveryProofs;
    } catch (error) {
      this.logger.error('Error fetching discovery feed:', error);
      return [];
    }
  }

  async awardVerificationBadge(userId: string, badgeType: string): Promise<VerificationBadge | null> {
    try {
      this.logger.info('Awarding verification badge:', { userId, badgeType });

      const badge: VerificationBadge = {
        id: this.generateId(),
        name: this.getBadgeName(badgeType),
        description: this.getBadgeDescription(badgeType),
        icon: this.getBadgeIcon(badgeType),
        earnedAt: new Date(),
        level: this.getBadgeLevel(badgeType)
      };

      // Save badge
      await this.saveToDatabase('verification_badge', badge.id, badge);
      
      // Update user profile
      await this.addBadgeToProfile(userId, badge.id);

      this.logger.info('Verification badge awarded:', { userId, badgeId: badge.id });
      return badge;
    } catch (error) {
      this.logger.error('Error awarding verification badge:', error);
      return null;
    }
  }

  private generateShareUrl(proofId: string, platform: string, customMessage?: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'https://verinode.app';
    const proofUrl = `${baseUrl}/proof/${proofId}`;
    const message = customMessage || `Check out this verified proof on Verinode`;
    const encodedMessage = encodeURIComponent(message);
    const encodedUrl = encodeURIComponent(proofUrl);

    switch (platform) {
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encodedMessage}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`;
      case 'reddit':
        return `https://reddit.com/submit?url=${encodedUrl}&title=Verinode%20Proof`;
      default:
        return proofUrl;
    }
  }

  private async incrementProofShares(proofId: string): Promise<void> {
    const proof = await this.fetchFromDatabase('social_proof', proofId);
    if (proof) {
      proof.shares = (proof.shares || 0) + 1;
      await this.saveToDatabase('social_proof', proofId, proof);
    }
  }

  private async incrementProofLikes(proofId: string): Promise<void> {
    const proof = await this.fetchFromDatabase('social_proof', proofId);
    if (proof) {
      proof.likes = (proof.likes || 0) + 1;
      await this.saveToDatabase('social_proof', proofId, proof);
    }
  }

  private async incrementProofComments(proofId: string): Promise<void> {
    const proof = await this.fetchFromDatabase('social_proof', proofId);
    if (proof) {
      proof.comments = proof.comments || [];
      // Comment count is derived from array length
      await this.saveToDatabase('social_proof', proofId, proof);
    }
  }

  private async incrementFollowCount(userId: string, type: 'followers' | 'following'): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (profile) {
      if (type === 'followers') {
        profile.followers = (profile.followers || 0) + 1;
      } else {
        profile.following = (profile.following || 0) + 1;
      }
      await this.saveToDatabase('user_profile', userId, profile);
    }
  }

  private async addBadgeToProfile(userId: string, badgeId: string): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (profile) {
      profile.verificationBadges = profile.verificationBadges || [];
      profile.verificationBadges.push(badgeId as any);
      await this.saveToDatabase('user_profile', userId, profile);
    }
  }

  private async createNotification(proofId: string, type: 'like' | 'comment' | 'follow', actorId: string): Promise<void> {
    const notification = {
      id: this.generateId(),
      proofId,
      type,
      actorId,
      userId: await this.getProofOwner(proofId),
      timestamp: new Date(),
      read: false
    };
    
    await this.saveToDatabase('notification', notification.id, notification);
  }

  private async getFollowingProofs(userId: string): Promise<SocialProof[]> {
    // Get proofs from users that current user follows
    const follows = await this.fetchAllFromDatabase('user_follow', { followerId: userId });
    const followingIds = follows.map(f => f.followingId);
    
    return await this.fetchAllFromDatabase('social_proof', { userIds: followingIds });
  }

  private async getProofOwner(proofId: string): Promise<string> {
    const proof = await this.fetchFromDatabase('social_proof', proofId);
    return proof?.userId || '';
  }

  private async getUsername(userId: string): Promise<string> {
    const profile = await this.getUserProfile(userId);
    return profile?.username || userId;
  }

  private getBadgeName(badgeType: string): string {
    const badges = {
      'early_adopter': 'Early Adopter',
      'power_user': 'Power User',
      'verified_creator': 'Verified Creator',
      'community_leader': 'Community Leader'
    };
    return badges[badgeType as keyof typeof badges] || 'Achievement Unlocked';
  }

  private getBadgeDescription(badgeType: string): string {
    const descriptions = {
      'early_adopter': 'Joined Verinode in the first month',
      'power_user': 'Created more than 100 verified proofs',
      'verified_creator': 'Verified identity with advanced proof types',
      'community_leader': 'Top contributor in community engagement'
    };
    return descriptions[badgeType as keyof typeof descriptions] || 'Special achievement';
  }

  private getBadgeIcon(badgeType: string): string {
    const icons = {
      'early_adopter': '🌟',
      'power_user': '⚡',
      'verified_creator': '✅',
      'community_leader': '👑'
    };
    return icons[badgeType as keyof typeof icons] || '🏆';
  }

  private getBadgeLevel(badgeType: string): 'bronze' | 'silver' | 'gold' | 'platinum' {
    const levels = {
      'early_adopter': 'bronze',
      'power_user': 'silver',
      'verified_creator': 'gold',
      'community_leader': 'platinum'
    };
    return levels[badgeType as keyof typeof levels] || 'bronze';
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mock database methods
  private async saveToDatabase(collection: string, key: string, value: any): Promise<void> {
    console.log(`Saving to ${collection}:`, { key, value });
  }

  private async fetchFromDatabase(collection: string, key: string): Promise<any> {
    console.log(`Fetching from ${collection}:`, key);
    return null;
  }

  private async fetchAllFromDatabase(collection: string, filter?: any): Promise<any[]> {
    console.log(`Fetching all from ${collection}:`, filter);
    return [];
  }
}

export const socialSharingService = new SocialSharingService();
