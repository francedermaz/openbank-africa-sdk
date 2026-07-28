import { MtnMomoAdapter } from './adapters/mtn-momo';
import type { Balance, OpenBankClientConfig, PaymentRequest, PaymentResult } from './core/types';

export type { OpenBankClientConfig };

export class OpenBankClient {
  private readonly adapter: MtnMomoAdapter;

  readonly collections: {
    requestToPay: (payment: PaymentRequest) => Promise<PaymentResult>;
    getStatus: (referenceId: string) => Promise<PaymentResult>;
    getBalance: () => Promise<Balance>;
  };

  constructor(config: OpenBankClientConfig) {
    if (config.adapter !== 'mtn-momo') {
      throw new Error(`Unsupported adapter: ${config.adapter}`);
    }

    this.adapter = new MtnMomoAdapter({
      subscriptionKey: config.subscriptionKey,
      callbackHost: config.callbackHost,
      environment: config.environment,
    });

    this.collections = {
      requestToPay: (payment) => this.adapter.requestToPay(payment),
      getStatus: (referenceId) => this.adapter.getStatus(referenceId),
      getBalance: () => this.adapter.getBalance(),
    };
  }

  async authenticate(): Promise<void> {
    await this.adapter.authenticate();
  }
}
