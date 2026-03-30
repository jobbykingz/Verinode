import { OAuth2Provider, OAuth2Config } from './OAuth2Provider';

export enum SocialPlatform {
  GOOGLE = 'google',
  GITHUB = 'github',
  LINKEDIN = 'linkedin'
}

export class SocialAuth {
  private providers: Map<SocialPlatform, OAuth2Provider> = new Map();

  constructor() {
    // Initialization would normally pull from process.env
  }

  public registerProvider(platform: SocialPlatform, config: OAuth2Config): void {
    this.providers.set(platform, new OAuth2Provider(config));
  }

  /**
   * Handles the complete social login flow for a specific platform
   */
  public async authenticate(platform: SocialPlatform, code: string): Promise<any> {
    const provider = this.providers.get(platform);
    if (!provider) throw new Error(`Provider ${platform} not configured`);

    const result = await provider.authenticate(code);

    return {
      platform,
      profile: result,
      timestamp: new Date()
    };
  }

  public getAuthUrl(platform: SocialPlatform, state: string): string {
    const provider = this.providers.get(platform);
    if (!provider) throw new Error(`Provider ${platform} not configured`);
    return provider.getAuthUrl(state);
  }
}