import { HttpClient } from '../../core/client';
import {
  OpenBankError,
  type CollectionsApi,
  type DisbursementsApi,
  type MtnProductName,
  type MtnProducts,
} from '../../core/types';
import { generateUuidV4 } from '../../core/uuid';
import * as collections from './collections';
import * as disbursements from './disbursements';
import { MtnProductSession } from './session';

const SANDBOX_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

/** Each MoMo product authenticates against its own token endpoint. */
const TOKEN_PATHS: Record<MtnProductName, string> = {
  collections: '/collection/token/',
  disbursements: '/disbursement/token/',
};

export interface MtnMomoAdapterConfig {
  callbackHost: string;
  environment: 'sandbox' | 'production';
  /** Per-product credentials. At least one product is required. */
  products: MtnProducts;
  /**
   * Required when environment is 'production', and shared across products —
   * the host and wallet platform are the same for every product
   * subscription. Issued through the MTN Partner Portal after KYC approval.
   */
  baseUrl?: string;
  targetEnvironment?: string;
}

export function resolveBaseUrl(config: MtnMomoAdapterConfig): string {
  return config.environment === 'production' ? (config.baseUrl ?? '') : SANDBOX_BASE_URL;
}

export class MtnMomoAdapter {
  private readonly sessions: Partial<Record<MtnProductName, MtnProductSession>> = {};

  readonly collections: CollectionsApi;
  readonly disbursements: DisbursementsApi;

  constructor(
    config: MtnMomoAdapterConfig,
    private readonly httpClient: HttpClient = new HttpClient(resolveBaseUrl(config)),
  ) {
    if (config.environment === 'production') {
      if (!config.baseUrl || !config.targetEnvironment) {
        throw new OpenBankError(
          'INVALID_CONFIGURATION',
          'environment "production" requires baseUrl and targetEnvironment — MTN has no self-service ' +
            'provisioning API in production; these are issued through the MTN Partner Portal after KYC approval.',
        );
      }
    } else if (config.environment !== 'sandbox') {
      throw new OpenBankError('INVALID_CONFIGURATION', `Unsupported environment: ${config.environment as string}`);
    }

    const configured = (Object.keys(TOKEN_PATHS) as MtnProductName[]).filter((product) => config.products[product]);
    if (configured.length === 0) {
      throw new OpenBankError(
        'INVALID_CONFIGURATION',
        'At least one product must be configured — set products.collections and/or products.disbursements. ' +
          'Each is a separate subscription in the MoMo portal with its own primary key.',
      );
    }

    for (const product of configured) {
      this.sessions[product] = new MtnProductSession(this.httpClient, {
        product,
        // Non-null: `configured` only contains products present in the config.
        credentials: config.products[product] as NonNullable<MtnProducts[MtnProductName]>,
        tokenPath: TOKEN_PATHS[product],
        environment: config.environment,
        targetEnvironment: config.environment === 'sandbox' ? 'sandbox' : (config.targetEnvironment as string),
        callbackHost: config.callbackHost,
      });
    }

    this.collections = {
      requestToPay: async (payment) => {
        const session = this.session('collections');
        // Generated once, outside withAuthRetry, so a 401 retry replays the
        // same X-Reference-Id and MTN sees one idempotent request, not two.
        const referenceId = generateUuidV4();
        return session.withAuthRetry(async () =>
          collections.requestToPay(this.httpClient, await session.buildContext(), payment, referenceId),
        );
      },
      getStatus: async (referenceId) => {
        const session = this.session('collections');
        return session.withAuthRetry(async () =>
          collections.getStatus(this.httpClient, await session.buildContext(), referenceId),
        );
      },
      getBalance: async () => {
        const session = this.session('collections');
        return session.withAuthRetry(async () =>
          collections.getBalance(this.httpClient, await session.buildContext()),
        );
      },
    };

    this.disbursements = {
      transfer: async (request) => {
        const session = this.session('disbursements');
        const referenceId = generateUuidV4();
        return session.withAuthRetry(async () =>
          disbursements.transfer(this.httpClient, await session.buildContext(), request, referenceId),
        );
      },
      getStatus: async (referenceId) => {
        const session = this.session('disbursements');
        return session.withAuthRetry(async () =>
          disbursements.getStatus(this.httpClient, await session.buildContext(), referenceId),
        );
      },
      getBalance: async () => {
        const session = this.session('disbursements');
        return session.withAuthRetry(async () =>
          disbursements.getBalance(this.httpClient, await session.buildContext()),
        );
      },
      validateAccountHolder: async (phoneNumber) => {
        const session = this.session('disbursements');
        return session.withAuthRetry(async () =>
          disbursements.validateAccountHolder(this.httpClient, await session.buildContext(), phoneNumber),
        );
      },
    };
  }

  /**
   * Authenticates every configured product. In sandbox this provisions one
   * API user/key pair per product, since each product subscription carries a
   * different subscription key. Fails as a whole if any product fails — a bad
   * key should surface here, not on the first payment.
   */
  async authenticate(): Promise<void> {
    await Promise.all(Object.values(this.sessions).map((session) => session.authenticate()));
  }

  private session(product: MtnProductName): MtnProductSession {
    const session = this.sessions[product];
    if (!session) {
      throw new OpenBankError(
        'INVALID_CONFIGURATION',
        `The "${product}" product is not configured — add products.${product} to your client config. ` +
          `In the MoMo portal it is a separate subscription with its own primary key.`,
      );
    }
    return session;
  }
}
