import { MtnMomoAdapter } from './adapters/mtn-momo';
import {
  OpenBankError,
  type CollectionsApi,
  type DisbursementsApi,
  type OpenBankClientConfig,
} from './core/types';

export type { OpenBankClientConfig };

export class OpenBankClient {
  private readonly adapter: MtnMomoAdapter;

  /** Charge users. Requires `products.collections`. */
  readonly collections: CollectionsApi;
  /** Pay users. Requires `products.disbursements`. */
  readonly disbursements: DisbursementsApi;

  constructor(config: OpenBankClientConfig) {
    if (config.adapter !== 'mtn-momo') {
      throw new OpenBankError('INVALID_CONFIGURATION', `Unsupported adapter: ${config.adapter}`);
    }

    this.adapter = new MtnMomoAdapter({
      callbackHost: config.callbackHost,
      environment: config.environment,
      products: config.products,
      baseUrl: config.baseUrl,
      targetEnvironment: config.targetEnvironment,
    });

    // Both namespaces are always present. Calling into a product that was not
    // configured rejects with a INVALID_CONFIGURATION naming the missing key,
    // which beats the "Cannot read property of undefined" an optional
    // namespace would produce.
    this.collections = this.adapter.collections;
    this.disbursements = this.adapter.disbursements;
  }

  /** Authenticates every configured product. */
  async authenticate(): Promise<void> {
    await this.adapter.authenticate();
  }
}
