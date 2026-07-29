export interface OpenBankClientConfig {
  adapter: 'mtn-momo';
  subscriptionKey: string;
  callbackHost: string;
  environment: 'sandbox' | 'production';
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
  | 'APPROVAL_REJECTED'
  | 'EXPIRED'
  | 'PAYER_NOT_FOUND'
  | 'NOT_ALLOWED'
  | 'INTERNAL_PROCESSING_ERROR'
  | 'UNKNOWN_ERROR';

export class OpenBankError extends Error {
  constructor(
    public readonly code: SdkErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OpenBankError';
  }
}
