import { OAuth2Provider, OAuth2Config } from './OAuth2Provider';

export enum SocialProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
  LINKEDIN = 'linkedin'
}

export class SocialAuth {
  private providers: Map<SocialProvider, OAuth2Provider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Configuration would normally come from environment variables
    const googleConfig: OAuth2Config = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: `${process.env.APP_URL}/auth/google/callback`,
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
      scope: 'openid email profile'
    };

    this.providers.set(SocialProvider.GOOGLE, new OAuth2Provider(googleConfig));
    
    // Similarly for GitHub and LinkedIn...
  }

  getRedirectUrl(provider: SocialProvider, state: string): string {
    const authProvider = this.providers.get(provider);
    if (!authProvider) throw new Error(`Provider ${provider} not configured`);
    return authProvider.getAuthUrl(state);
  }

  async handleCallback(provider: SocialProvider, code: string): Promise<any> {
    const authProvider = this.providers.get(provider);
    if (!authProvider) throw new Error(`Provider ${provider} not configured`);
    
    const profile = await authProvider.authenticate(code);
    
    return {
      provider,
      providerId: profile.id,
      email: profile.email,
      displayName: profile.name,
      avatar: profile.raw.picture || profile.raw.avatar_url
    };
  }
}