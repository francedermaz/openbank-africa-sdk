export interface OpenBankClientConfig {
  adapter: 'mtn-momo';
  subscriptionKey: string;
  callbackHost: string;
  environment: 'sandbox' | 'production';
  /**
   * Required when environment is 'production'. MTN exposes no self-service
   * provisioning API in production — apiUser, apiKey, and the production
   * base URL are issued through the MTN Partner Portal after KYC approval.
   * Ignored (and unnecessary) in sandbox, where they're auto-provisioned.
   */
  baseUrl?: string;
  apiUser?: string;
  apiKey?: string;
}

export interface PaymentRequest {
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

export interface Balance {
  availableBalance: number;
  currency: string;
}

export type SdkErrorCode =
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_ALREADY_EXIST'
  | 'APPROVAL_REJECTED'
  | 'EXPIRED'
  | 'PAYER_NOT_FOUND'
  | 'PAYEE_NOT_FOUND'
  | 'NOT_ALLOWED'
  | 'NOT_ALLOWED_TARGET_ENVIRONMENT'
  | 'INVALID_CALLBACK_URL_HOST'
  | 'INVALID_CURRENCY'
  | 'SERVICE_UNAVAILABLE'
  | 'COULD_NOT_PERFORM_TRANSACTION'
  | 'INTERNAL_PROCESSING_ERROR'
  | 'INVALID_CONFIGURATION'
  | 'NOT_AUTHENTICATED'
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
