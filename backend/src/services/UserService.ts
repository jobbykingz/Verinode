import { WinstonLogger } from '../utils/logger';
import { eventService } from './events/EventService';
import { 
  UserRegisteredEvent, 
  UserLoggedInEvent, 
  UserUpdatedEvent, 
  UserDeactivatedEvent,
  AuthTokenGeneratedEvent,
  PasswordChangedEvent
} from '../events/EventTypes';
import { EventUtils } from '../utils/eventUtils';

export interface User {
  id: string;
  email: string;
  username?: string;
  passwordHash: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    bio?: string;
  };
  preferences?: {
    theme?: string;
    language?: string;
    notifications?: boolean;
  };
  metadata?: {
    registrationSource?: string;
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface CreateUserRequest {
  email: string;
  username?: string;
  password: string;
  profile?: User['profile'];
  preferences?: User['preferences'];
  metadata?: User['metadata'];
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  profile?: User['profile'];
  preferences?: User['preferences'];
}

export interface LoginRequest {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  sessionId?: string;
  token?: string;
  error?: string;
}

export class UserService {
  private logger: WinstonLogger;
  private users: Map<string, User> = new Map();

  constructor() {
    this.logger = new WinstonLogger();
  }

  async createUser(request: CreateUserRequest): Promise<User> {
    try {
      this.logger.info('Creating user:', { email: request.email });

      const userId = this.generateUserId();
      const passwordHash = await this.hashPassword(request.password);

      const user: User = {
        id: userId,
        email: request.email,
        username: request.username,
        passwordHash,
        profile: request.profile,
        preferences: request.preferences,
        metadata: {
          registrationSource: request.metadata?.registrationSource || 'direct',
          ipAddress: request.metadata?.ipAddress,
          userAgent: request.metadata?.userAgent,
          referrer: request.metadata?.referrer
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store user (mock implementation)
      await this.storeUser(user);

      // Emit USER_REGISTERED event
      try {
        const userRegisteredEvent = await eventService.createEvent<UserRegisteredEvent>(
          'USER_REGISTERED',
          {
            userId: user.id,
            email: user.email,
            username: user.username,
            registrationSource: user.metadata?.registrationSource || 'direct',
            metadata: {
              ipAddress: user.metadata?.ipAddress,
              userAgent: user.metadata?.userAgent,
              referrer: user.metadata?.referrer
            }
          },
          {
            source: 'user-service',
            correlationId: EventUtils.generateCorrelationId(),
            metadata: {
              operation: 'register',
              timestamp: new Date()
            }
          }
        );
        
        await eventService.publishEvent(userRegisteredEvent, `user:${user.id}`);
      } catch (eventError) {
        this.logger.warn('Failed to publish USER_REGISTERED event:', eventError);
      }

      this.logger.info('User created successfully:', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw error;
    }
  }

  async authenticateUser(request: LoginRequest): Promise<LoginResult> {
    try {
      this.logger.info('Authenticating user:', { email: request.email });

      const user = await this.getUserByEmail(request.email);
      if (!user) {
        const result = { success: false, error: 'User not found' };
        
        // Emit AUTH_FAILED event
        await this.emitAuthFailedEvent(request.email, 'User not found', request.ipAddress, request.userAgent);
        
        return result;
      }

      const isValidPassword = await this.verifyPassword(request.password, user.passwordHash);
      if (!isValidPassword) {
        const result = { success: false, error: 'Invalid password' };
        
        // Emit AUTH_FAILED event
        await this.emitAuthFailedEvent(user.id, 'Invalid password', request.ipAddress, request.userAgent);
        
        return result;
      }

      if (!user.isActive) {
        const result = { success: false, error: 'User account is deactivated' };
        
        // Emit AUTH_FAILED event
        await this.emitAuthFailedEvent(user.id, 'Account deactivated', request.ipAddress, request.userAgent);
        
        return result;
      }

      // Update last login
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
      await this.storeUser(user);

      const sessionId = this.generateSessionId();
      const token = await this.generateToken(user);

      // Emit USER_LOGGED_IN event
      try {
        const userLoggedInEvent = await eventService.createEvent<UserLoggedInEvent>(
          'USER_LOGGED_IN',
          {
            userId: user.id,
            loginMethod: 'password',
            ipAddress: request.ipAddress,
            userAgent: request.userAgent,
            sessionId
          },
          {
            source: 'user-service',
            correlationId: EventUtils.generateCorrelationId(),
            metadata: {
              operation: 'login',
              timestamp: new Date()
            }
          }
        );
        
        await eventService.publishEvent(userLoggedInEvent, `user:${user.id}`);
      } catch (eventError) {
        this.logger.warn('Failed to publish USER_LOGGED_IN event:', eventError);
      }

      // Emit AUTH_TOKEN_GENERATED event
      try {
        const tokenGeneratedEvent = await eventService.createEvent<AuthTokenGeneratedEvent>(
          'AUTH_TOKEN_GENERATED',
          {
            userId: user.id,
            tokenType: 'access',
            expiresIn: 3600,
            scope: ['read', 'write'],
            ipAddress: request.ipAddress
          },
          {
            source: 'user-service',
            causationId: sessionId,
            metadata: {
              operation: 'token_generation',
              timestamp: new Date()
            }
          }
        );
        
        await eventService.publishEvent(tokenGeneratedEvent, `user:${user.id}`);
      } catch (eventError) {
        this.logger.warn('Failed to publish AUTH_TOKEN_GENERATED event:', eventError);
      }

      this.logger.info('User authenticated successfully:', { userId: user.id });
      return {
        success: true,
        user,
        sessionId,
        token
      };
    } catch (error) {
      this.logger.error('Error authenticating user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  async updateUser(userId: string, request: UpdateUserRequest, updatedBy: string): Promise<User | null> {
    try {
      this.logger.info('Updating user:', { userId });

      const existingUser = await this.getUserById(userId);
      if (!existingUser) {
        return null;
      }

      const updatedUser: User = {
        ...existingUser,
        ...request,
        updatedAt: new Date()
      };

      await this.storeUser(updatedUser);

      // Emit USER_UPDATED event
      try {
        const userUpdatedEvent = await eventService.createEvent<UserUpdatedEvent>(
          'USER_UPDATED',
          {
            userId: updatedUser.id,
            updates: {
              email: request.email,
              username: request.username,
              profile: request.profile,
              preferences: request.preferences
            },
            updatedBy
          },
          {
            source: 'user-service',
            correlationId: EventUtils.generateCorrelationId(),
            metadata: {
              operation: 'update',
              timestamp: new Date()
            }
          }
        );
        
        await eventService.publishEvent(userUpdatedEvent, `user:${userId}`);
      } catch (eventError) {
        this.logger.warn('Failed to publish USER_UPDATED event:', eventError);
      }

      this.logger.info('User updated successfully:', { userId });
      return updatedUser;
    } catch (error) {
      this.logger.error('Error updating user:', error);
      return null;
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string, ipAddress?: string): Promise<boolean> {
    try {
      this.logger.info('Changing password for user:', { userId });

      const user = await this.getUserById(userId);
      if (!user) {
        return false;
      }

      const isValidOldPassword = await this.verifyPassword(oldPassword, user.passwordHash);
      if (!isValidOldPassword) {
        await this.emitAuthFailedEvent(userId, 'Invalid old password', ipAddress);
        return false;
      }

      const newPasswordHash = await this.hashPassword(newPassword);
      user.passwordHash = newPasswordHash;
      user.updatedAt = new Date();

      await this.storeUser(user);

      // Emit PASSWORD_CHANGED event
      try {
        const passwordChangedEvent = await eventService.createEvent<PasswordChangedEvent>(
          'PASSWORD_CHANGED',
          {
            userId: user.id,
            changedBy: user.id,
            ipAddress,
            method: 'user'
          },
          {
            source: 'user-service',
            correlationId: EventUtils.generateCorrelationId(),
            metadata: {
              operation: 'password_change',
              timestamp: new Date()
            }
          }
        );
        
        await eventService.publishEvent(passwordChangedEvent, `user:${userId}`);
      } catch (eventError) {
        this.logger.warn('Failed to publish PASSWORD_CHANGED event:', eventError);
      }

      this.logger.info('Password changed successfully:', { userId });
      return true;
    } catch (error) {
      this.logger.error('Error changing password:', error);
      return false;
    }
  }

  async deactivateUser(userId: string, deactivatedBy: string, reason?: string): Promise<boolean> {
    try {
      this.logger.info('Deactivating user:', { userId });

      const user = await this.getUserById(userId);
      if (!user) {
        return false;
      }

      user.isActive = false;
      user.updatedAt = new Date();

      await this.storeUser(user);

      // Emit USER_DEACTIVATED event
      try {
        const userDeactivatedEvent = await eventService.createEvent<UserDeactivatedEvent>(
          'USER_DEACTIVATED',
          {
            userId: user.id,
            deactivatedBy,
            reason
          },
          {
            source: 'user-service',
            correlationId: EventUtils.generateCorrelationId(),
            metadata: {
              operation: 'deactivate',
              timestamp: new Date()
            }
          }
        );
        
        await eventService.publishEvent(userDeactivatedEvent, `user:${userId}`);
      } catch (eventError) {
        this.logger.warn('Failed to publish USER_DEACTIVATED event:', eventError);
      }

      this.logger.info('User deactivated successfully:', { userId });
      return true;
    } catch (error) {
      this.logger.error('Error deactivating user:', error);
      return false;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      // Mock database retrieval
      return this.users.get(userId) || null;
    } catch (error) {
      this.logger.error('Error fetching user by ID:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      // Mock database retrieval
      for (const user of this.users.values()) {
        if (user.email === email) {
          return user;
        }
      }
      return null;
    } catch (error) {
      this.logger.error('Error fetching user by email:', error);
      return null;
    }
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    registrationsToday: number;
    registrationsThisWeek: number;
    registrationsThisMonth: number;
  }> {
    try {
      const allUsers = Array.from(this.users.values());
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

      return {
        total: allUsers.length,
        active: allUsers.filter(u => u.isActive).length,
        inactive: allUsers.filter(u => !u.isActive).length,
        registrationsToday: allUsers.filter(u => u.createdAt >= today).length,
        registrationsThisWeek: allUsers.filter(u => u.createdAt >= weekAgo).length,
        registrationsThisMonth: allUsers.filter(u => u.createdAt >= monthAgo).length
      };
    } catch (error) {
      this.logger.error('Error calculating user stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        registrationsToday: 0,
        registrationsThisWeek: 0,
        registrationsThisMonth: 0
      };
    }
  }

  private async emitAuthFailedEvent(
    userId?: string, 
    reason: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    try {
      const authFailedEvent = await eventService.createEvent(
        'AUTH_FAILED',
        {
          userId,
          reason,
          ipAddress,
          userAgent,
          attemptCount: 1
        },
        {
          source: 'user-service',
          correlationId: EventUtils.generateCorrelationId(),
          metadata: {
            operation: 'auth_failed',
            timestamp: new Date()
          }
        }
      );
      
      await eventService.publishEvent(authFailedEvent);
    } catch (error) {
      this.logger.warn('Failed to publish AUTH_FAILED event:', error);
    }
  }

  private async storeUser(user: User): Promise<void> {
    // Mock database storage
    this.users.set(user.id, user);
  }

  private async hashPassword(password: string): Promise<string> {
    // Mock password hashing - in practice use bcrypt
    return `hashed_${password}_${Date.now()}`;
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    // Mock password verification - in practice use bcrypt
    return hash.includes(password);
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateToken(user: User): Promise<string> {
    // Mock JWT generation - in practice use jsonwebtoken
    return `token_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const userService = new UserService();
