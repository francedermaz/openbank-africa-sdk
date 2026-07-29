import { base64Encode } from './base64';
import { HttpClient } from './client';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthCredentials {
  apiUser: string;
  apiKey: string;
  subscriptionKey: string;
}

const TOKEN_EXPIRY_BUFFER_MS = 5000;

export class TokenManager {
  private cachedToken: string | null = null;
  private expiresAt = 0;

  constructor(
    private readonly httpClient: Pick<HttpClient, 'post'>,
    private readonly tokenPath: string,
  ) {}

  async getToken(credentials: AuthCredentials): Promise<string> {
    const now = Date.now();

    if (this.cachedToken && now < this.expiresAt) {
      return this.cachedToken;
    }

    const response = await this.httpClient.post<TokenResponse>(this.tokenPath, {
      headers: {
        Authorization: `Basic ${base64Encode(`${credentials.apiUser}:${credentials.apiKey}`)}`,
        'Ocp-Apim-Subscription-Key': credentials.subscriptionKey,
      },
    });

    this.cachedToken = response.access_token;
    this.expiresAt = now + response.expires_in * 1000 - TOKEN_EXPIRY_BUFFER_MS;
    return this.cachedToken;
  }

  invalidate(): void {
    this.cachedToken = null;
    this.expiresAt = 0;
  }
}
