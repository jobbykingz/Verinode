import axios from 'axios';

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scope: string;
}

export class OAuth2Provider {
  constructor(private config: OAuth2Config) {}

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope,
      state: state,
    });
    return `${this.config.authEndpoint}?${params.toString()}`;
  }

  async getAccessToken(code: string): Promise<string> {
    try {
      const response = await axios.post(this.config.tokenEndpoint, new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      return response.data.access_token;
    } catch (error) {
      throw new Error('Failed to exchange OAuth2 code for token');
    }
  }

  async getUserProfile(accessToken: string): Promise<any> {
    try {
      const response = await axios.get(this.config.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch user profile from OAuth2 provider');
    }
  }

  async authenticate(code: string): Promise<any> {
    const token = await this.getAccessToken(code);
    const profile = await this.getUserProfile(token);
    return {
      id: profile.id || profile.sub,
      email: profile.email,
      name: profile.name || profile.preferred_username,
      raw: profile
    };
  }
}