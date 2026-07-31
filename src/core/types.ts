/**
 * Credentials for a single MoMo product.
 *
 * Collections and Disbursements are separate product subscriptions in the
 * MoMo portal, each issuing its own primary key — so each is configured,
 * authenticated, and token-managed independently.
 */
export interface MtnProductCredentials {
  subscriptionKey: string;
  /**
   * Required when environment is 'production'. MTN exposes no self-service
   * provisioning API in production — these are issued per product through the
   * MTN Partner Portal after KYC approval. Ignored in sandbox, where every
   * configured product auto-provisions its own pair on authenticate().
   */
  apiUser?: string;
  apiKey?: string;
}

export interface MtnProducts {
  collections?: MtnProductCredentials;
  disbursements?: MtnProductCredentials;
}

export type MtnProductName = keyof MtnProducts;

export interface OpenBankClientConfig {
  adapter: 'mtn-momo';
  environment: 'sandbox' | 'production';
  callbackHost: string;
  /** Per-product credentials. At least one product is required. */
  products: MtnProducts;
  /**
   * Required when environment is 'production'. Shared across products — the
   * host and wallet platform are the same for every product subscription.
   * Issued through the MTN Partner Portal after KYC approval; ignored (and
   * unnecessary) in sandbox.
   */
  baseUrl?: string;
  /**
   * Required when environment is 'production'. MTN's wire-level
   * X-Target-Environment value for your market (e.g. 'mtnrwanda',
   * 'mtnuganda', 'mtnghana') — NOT the literal string 'production'.
   * Sandbox always uses 'sandbox' automatically; ignored there.
   */
  targetEnvironment?: string;
}

/** Charge a user. `phoneNumber` is the party being debited. */
export interface PaymentRequest {
  amount: number;
  currency: string;
  phoneNumber: string;
  externalId: string;
  payerMessage?: string;
  payeeNote?: string;
}

/**
 * Pay a user.
 *
 * Structurally identical to {@link PaymentRequest}, but `phoneNumber` means
 * the opposite party: here it is the recipient being credited, not the payer
 * being charged. TypeScript's structural typing will not stop you passing one
 * where the other is expected — the separate name documents intent, it does
 * not enforce it.
 */
export interface TransferRequest {
  amount: number;
  currency: string;
  phoneNumber: string;
  externalId: string;
  payerMessage?: string;
  payeeNote?: string;
}

export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export interface PaymentResult {
  referenceId: string;
  status: PaymentStatus;
  reason?: string;
}

export type TransferResult = PaymentResult;

export interface Balance {
  availableBalance: number;
  currency: string;
}

export interface AccountHolderStatus {
  isActive: boolean;
}

export interface CollectionsApi {
  requestToPay(payment: PaymentRequest): Promise<PaymentResult>;
  getStatus(referenceId: string): Promise<PaymentResult>;
  getBalance(): Promise<Balance>;
}

export interface DisbursementsApi {
  transfer(transfer: TransferRequest): Promise<TransferResult>;
  getStatus(referenceId: string): Promise<TransferResult>;
  getBalance(): Promise<Balance>;
  /**
   * Checks whether a phone number is a registered, active MoMo account before
   * you send money to it. A number MTN does not know resolves to
   * `{ isActive: false }` rather than throwing — an unknown payee is an
   * expected answer for this call, not a failure.
   */
  validateAccountHolder(phoneNumber: string): Promise<AccountHolderStatus>;
}

export type SdkErrorCode =
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_ALREADY_EXIST'
  | 'APPROVAL_REJECTED'
  | 'EXPIRED'
  | 'PAYER_NOT_FOUND'
  | 'PAYEE_NOT_FOUND'
  | 'NOT_ENOUGH_FUNDS'
  | 'PAYER_LIMIT_REACHED'
  | 'SENDER_ACCOUNT_NOT_ACTIVE'
  | 'NOT_ALLOWED'
  | 'NOT_ALLOWED_TARGET_ENVIRONMENT'
  | 'INVALID_CALLBACK_URL_HOST'
  | 'INVALID_CURRENCY'
  | 'SERVICE_UNAVAILABLE'
  | 'COULD_NOT_PERFORM_TRANSACTION'
  | 'INTERNAL_PROCESSING_ERROR'
  | 'INVALID_CONFIGURATION'
  | 'NOT_AUTHENTICATED'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

export class OpenBankError extends Error {
  constructor(
    public readonly code: SdkErrorCode,
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'OpenBankError';
  }
}
