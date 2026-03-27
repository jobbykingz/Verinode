import { eventService } from './src/services/events/EventService';
import { AuthTokenGeneratedEvent, AuthTokenRevokedEvent, AuthFailedEvent } from './src/events/EventTypes';
import { EventUtils } from './src/utils/eventUtils';

export class OAuthService {
    static generateAuthUrl(provider: 'github' | 'slack' | 'discord') {
        const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
        const redirectUri = encodeURIComponent(`https://api.verinode.com/auth/${provider}/callback`);
        
        switch (provider) {
            case 'github':
                return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`;
            case 'slack':
                return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=chat:write,commands&redirect_uri=${redirectUri}`;
            case 'discord':
                return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=bot`;
            default:
                throw new Error('Unknown provider');
        }
    }

    static async exchangeCode(provider: string, code: string, ipAddress?: string) {
        try {
            // Mock token exchange
            const tokenData = {
                accessToken: `mock_${provider}_access_token_${Date.now()}`,
                refreshToken: `mock_${provider}_refresh_token`,
                expiresIn: 3600
            };

            // Emit AUTH_TOKEN_GENERATED event
            try {
                const tokenGeneratedEvent = await eventService.createEvent<AuthTokenGeneratedEvent>(
                    'AUTH_TOKEN_GENERATED',
                    {
                        userId: `oauth_user_${provider}_${Date.now()}`,
                        tokenType: 'access',
                        expiresIn: tokenData.expiresIn,
                        scope: ['oauth'],
                        ipAddress
                    },
                    {
                        source: 'auth-service',
                        correlationId: EventUtils.generateCorrelationId(),
                        metadata: {
                            provider,
                            operation: 'oauth_exchange',
                            timestamp: new Date()
                        }
                    }
                );
                
                await eventService.publishEvent(tokenGeneratedEvent);
            } catch (eventError) {
                console.warn('Failed to publish AUTH_TOKEN_GENERATED event:', eventError);
            }

            return tokenData;
        } catch (error) {
            // Emit AUTH_FAILED event
            try {
                const authFailedEvent = await eventService.createEvent<AuthFailedEvent>(
                    'AUTH_FAILED',
                    {
                        reason: `OAuth exchange failed for ${provider}`,
                        ipAddress,
                        attemptCount: 1
                    },
                    {
                        source: 'auth-service',
                        correlationId: EventUtils.generateCorrelationId(),
                        metadata: {
                            provider,
                            operation: 'oauth_exchange_failed',
                            timestamp: new Date()
                        }
                    }
                );
                
                await eventService.publishEvent(authFailedEvent);
            } catch (eventError) {
                console.warn('Failed to publish AUTH_FAILED event:', eventError);
            }

            throw error;
        }
    }

    static async revokeToken(provider: string, tokenId: string, userId: string, reason: string) {
        try {
            // Mock token revocation
            console.log(`Revoking token ${tokenId} for provider ${provider}`);

            // Emit AUTH_TOKEN_REVOKED event
            try {
                const tokenRevokedEvent = await eventService.createEvent<AuthTokenRevokedEvent>(
                    'AUTH_TOKEN_REVOKED',
                    {
                        userId,
                        tokenId,
                        reason,
                        revokedBy: 'auth-service'
                    },
                    {
                        source: 'auth-service',
                        correlationId: EventUtils.generateCorrelationId(),
                        metadata: {
                            provider,
                            operation: 'token_revocation',
                            timestamp: new Date()
                        }
                    }
                );
                
                await eventService.publishEvent(tokenRevokedEvent);
            } catch (eventError) {
                console.warn('Failed to publish AUTH_TOKEN_REVOKED event:', eventError);
            }

            return true;
        } catch (error) {
            console.error('Failed to revoke token:', error);
            return false;
        }
    }
}