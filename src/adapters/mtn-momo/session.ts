import { TokenManager } from '../../core/auth';
import { HttpClient } from '../../core/client';
import { OpenBankError, type MtnProductCredentials, type MtnProductName } from '../../core/types';
import { withMtnErrorMapping } from './errors';
import { provisionSandboxCredentials, type SandboxCredentials } from './sandbox';

export interface MtnRequestContext {
  token: string;
  subscriptionKey: string;
  /** MTN's wire-level X-Target-Environment value, e.g. 'sandbox' or 'mtnrwanda'. */
  targetEnvironment: string;
}

export function buildHeaders(context: MtnRequestContext, referenceId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.token}`,
    'X-Target-Environment': context.targetEnvironment,
    'Ocp-Apim-Subscription-Key': context.subscriptionKey,
  };

  if (referenceId) {
    headers['X-Reference-Id'] = referenceId;
  }

  return headers;
}

export interface MtnProductSessionOptions {
  product: MtnProductName;
  credentials: MtnProductCredentials;
  /** Product-scoped token endpoint, e.g. '/collection/token/'. */
  tokenPath: string;
  environment: 'sandbox' | 'production';
  targetEnvironment: string;
  callbackHost: string;
}

/**
 * One authenticated MoMo product.
 *
 * Each product subscription carries its own subscription key, its own
 * API user/key pair, and its own token endpoint, so each gets its own
 * session. Tokens are never shared: a 401 on disbursements invalidates only
 * the disbursements token and leaves collections untouched.
 */
export class MtnProductSession {
  private readonly tokenManager: TokenManager;
  private credentials: SandboxCredentials | null = null;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly options: MtnProductSessionOptions,
  ) {
    if (options.environment === 'production') {
      const { apiUser, apiKey } = options.credentials;
      if (!apiUser || !apiKey) {
        throw new OpenBankError(
          'INVALID_CONFIGURATION',
          `products.${options.product} requires apiUser and apiKey when environment is "production" — MTN has no ` +
            'self-service provisioning API in production; credentials are issued per product through the MTN ' +
            'Partner Portal after KYC approval.',
        );
      }
      this.credentials = { apiUser, apiKey };
    }

    this.tokenManager = new TokenManager(httpClient, options.tokenPath);
  }

  async authenticate(): Promise<void> {
    await withMtnErrorMapping(async () => {
      if (this.options.environment === 'sandbox' && !this.credentials) {
        this.credentials = await provisionSandboxCredentials(
          this.httpClient,
          this.options.credentials.subscriptionKey,
          this.options.callbackHost,
        );
      }

      await this.tokenManager.getToken(this.authCredentials());
    });
  }

  async buildContext(): Promise<MtnRequestContext> {
    const token = await withMtnErrorMapping(() => this.tokenManager.getToken(this.authCredentials()));

    return {
      token,
      subscriptionKey: this.options.credentials.subscriptionKey,
      targetEnvironment: this.options.targetEnvironment,
    };
  }

  /**
   * Retries a call exactly once on a 401. Per MTN's error reference, 401 is
   * documented as an invalid subscription key — which a fresh token won't fix
   * — but RFC 6750 also uses 401 for an expired or server-side-revoked Bearer
   * token, which a fresh token does fix. MTN doesn't distinguish the two in
   * the response, so invalidating and retrying once is a cheap, safe hedge:
   * worst case it's one wasted round trip before the same error surfaces
   * anyway. Any other failure, or a second 401, propagates as-is. The retried
   * operation must be idempotent (callers building a write closure must
   * generate the X-Reference-Id once, outside this call, and reuse it on
   * retry).
   */
  async withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OpenBankError && error.httpStatus === 401) {
        this.tokenManager.invalidate();
        return await operation();
      }
      throw error;
    }
  }

  private authCredentials(): { apiUser: string; apiKey: string; subscriptionKey: string } {
    if (!this.credentials) {
      throw new OpenBankError('NOT_AUTHENTICATED', 'Call authenticate() before using the adapter');
    }

    return {
      apiUser: this.credentials.apiUser,
      apiKey: this.credentials.apiKey,
      subscriptionKey: this.options.credentials.subscriptionKey,
    };
  }
}
