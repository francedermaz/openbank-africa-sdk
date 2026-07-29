import { TokenManager } from '../../core/auth';
import { HttpClient } from '../../core/client';
import { OpenBankError, type Balance, type PaymentRequest, type PaymentResult } from '../../core/types';
import { generateUuidV4 } from '../../core/uuid';
import type { CollectionsRequestContext } from './collections';
import { getBalance, getStatus, requestToPay, withMtnErrorMapping } from './collections';
import { provisionSandboxCredentials, type SandboxCredentials } from './sandbox';

const SANDBOX_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

export interface MtnMomoAdapterConfig {
  subscriptionKey: string;
  callbackHost: string;
  environment: 'sandbox' | 'production';
  /**
   * Required when environment is 'production'. MTN exposes no self-service
   * provisioning API in production — these are issued through the MTN
   * Partner Portal after KYC approval. Ignored in sandbox, where
   * credentials are auto-provisioned instead.
   */
  baseUrl?: string;
  apiUser?: string;
  apiKey?: string;
  /**
   * Required when environment is 'production'. MTN's wire-level
   * X-Target-Environment value for your market (e.g. 'mtnrwanda',
   * 'mtnuganda', 'mtnghana') — NOT the literal string 'production'.
   * Sandbox always uses 'sandbox' automatically; ignored there.
   */
  targetEnvironment?: string;
}

export function resolveBaseUrl(config: MtnMomoAdapterConfig): string {
  return config.environment === 'production' ? (config.baseUrl ?? '') : SANDBOX_BASE_URL;
}

export class MtnMomoAdapter {
  private readonly tokenManager: TokenManager;
  private credentials: SandboxCredentials | null = null;

  constructor(
    private readonly config: MtnMomoAdapterConfig,
    private readonly httpClient: HttpClient = new HttpClient(resolveBaseUrl(config)),
  ) {
    if (config.environment === 'production') {
      if (!config.baseUrl || !config.apiUser || !config.apiKey || !config.targetEnvironment) {
        throw new OpenBankError(
          'INVALID_CONFIGURATION',
          'environment "production" requires baseUrl, apiUser, apiKey, and targetEnvironment — MTN has no ' +
            'self-service provisioning API in production; these are issued through the MTN Partner Portal ' +
            'after KYC approval.',
        );
      }
      this.credentials = { apiUser: config.apiUser, apiKey: config.apiKey };
    } else if (config.environment !== 'sandbox') {
      throw new OpenBankError('INVALID_CONFIGURATION', `Unsupported environment: ${config.environment as string}`);
    }

    this.tokenManager = new TokenManager(this.httpClient, '/collection/token/');
  }

  async authenticate(): Promise<void> {
    await withMtnErrorMapping(async () => {
      if (this.config.environment === 'sandbox' && !this.credentials) {
        this.credentials = await provisionSandboxCredentials(
          this.httpClient,
          this.config.subscriptionKey,
          this.config.callbackHost,
        );
      }

      await this.tokenManager.getToken(this.currentCredentials());
    });
  }

  async requestToPay(payment: PaymentRequest): Promise<PaymentResult> {
    const referenceId = generateUuidV4();
    return this.withAuthRetry(async () =>
      requestToPay(this.httpClient, await this.buildContext(), payment, referenceId),
    );
  }

  async getStatus(referenceId: string): Promise<PaymentResult> {
    return this.withAuthRetry(async () => getStatus(this.httpClient, await this.buildContext(), referenceId));
  }

  async getBalance(): Promise<Balance> {
    return this.withAuthRetry(async () => getBalance(this.httpClient, await this.buildContext()));
  }

  /**
   * Retries a collections call exactly once on a 401. Per MTN's error
   * reference, 401 is documented as an invalid subscription key — which a
   * fresh token won't fix — but RFC 6750 also uses 401 for an expired or
   * server-side-revoked Bearer token, which a fresh token does fix. MTN
   * doesn't distinguish the two in the response, so invalidating and
   * retrying once is a cheap, safe hedge: worst case it's one wasted round
   * trip before the same error surfaces anyway. Any other failure, or a
   * second 401, propagates as-is. The retried operation must be idempotent
   * (callers building a request-to-pay closure must generate the
   * X-Reference-Id once, outside this call, and reuse it on retry).
   */
  private async withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
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

  private currentCredentials(): { apiUser: string; apiKey: string; subscriptionKey: string } {
    if (!this.credentials) {
      throw new OpenBankError('NOT_AUTHENTICATED', 'Call authenticate() before using the adapter');
    }

    return {
      apiUser: this.credentials.apiUser,
      apiKey: this.credentials.apiKey,
      subscriptionKey: this.config.subscriptionKey,
    };
  }

  private async buildContext(): Promise<CollectionsRequestContext> {
    const token = await withMtnErrorMapping(() => this.tokenManager.getToken(this.currentCredentials()));
    return {
      token,
      subscriptionKey: this.config.subscriptionKey,
      targetEnvironment: this.config.environment === 'sandbox' ? 'sandbox' : (this.config.targetEnvironment as string),
    };
  }
}
