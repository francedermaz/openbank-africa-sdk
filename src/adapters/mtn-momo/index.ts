import { TokenManager } from '../../core/auth';
import { HttpClient } from '../../core/client';
import type { Balance, PaymentRequest, PaymentResult } from '../../core/types';
import type { CollectionsRequestContext } from './collections';
import { getBalance, getStatus, requestToPay } from './collections';
import { provisionSandboxCredentials, type SandboxCredentials } from './sandbox';

const SANDBOX_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

export interface MtnMomoAdapterConfig {
  subscriptionKey: string;
  callbackHost: string;
  environment: 'sandbox' | 'production';
}

export class MtnMomoAdapter {
  private readonly tokenManager: TokenManager;
  private credentials: SandboxCredentials | null = null;

  constructor(
    private readonly config: MtnMomoAdapterConfig,
    private readonly httpClient: HttpClient = new HttpClient(SANDBOX_BASE_URL),
  ) {
    if (config.environment !== 'sandbox') {
      throw new Error('Only the sandbox environment is supported in v1.0');
    }

    this.tokenManager = new TokenManager(this.httpClient, '/collection/token/');
  }

  async authenticate(): Promise<void> {
    if (!this.credentials) {
      this.credentials = await provisionSandboxCredentials(
        this.httpClient,
        this.config.subscriptionKey,
        this.config.callbackHost,
      );
    }

    await this.tokenManager.getToken({
      apiUser: this.credentials.apiUser,
      apiKey: this.credentials.apiKey,
      subscriptionKey: this.config.subscriptionKey,
    });
  }

  async requestToPay(payment: PaymentRequest): Promise<PaymentResult> {
    return requestToPay(this.httpClient, await this.buildContext(), payment);
  }

  async getStatus(referenceId: string): Promise<PaymentResult> {
    return getStatus(this.httpClient, await this.buildContext(), referenceId);
  }

  async getBalance(): Promise<Balance> {
    return getBalance(this.httpClient, await this.buildContext());
  }

  private async buildContext(): Promise<CollectionsRequestContext> {
    if (!this.credentials) {
      throw new Error('Call authenticate() before using the adapter');
    }

    const token = await this.tokenManager.getToken({
      apiUser: this.credentials.apiUser,
      apiKey: this.credentials.apiKey,
      subscriptionKey: this.config.subscriptionKey,
    });

    return { token, subscriptionKey: this.config.subscriptionKey, environment: this.config.environment };
  }
}
