import { OpenBankError, type Balance, type PaymentResult, type PaymentStatus, type SdkErrorCode } from '../../core/types';

const VALID_STATUSES: readonly PaymentStatus[] = ['PENDING', 'SUCCESSFUL', 'FAILED'];

const MTN_ERROR_CODES: readonly SdkErrorCode[] = [
  'RESOURCE_NOT_FOUND',
  'APPROVAL_REJECTED',
  'EXPIRED',
  'PAYER_NOT_FOUND',
  'NOT_ALLOWED',
  'INTERNAL_PROCESSING_ERROR',
];

export function mapMtnStatusResponse(referenceId: string, response: { status: string }): PaymentResult {
  const status = VALID_STATUSES.includes(response.status as PaymentStatus)
    ? (response.status as PaymentStatus)
    : 'FAILED';

  return { referenceId, status };
}

export function mapMtnBalanceResponse(response: { availableBalance: string; currency: string }): Balance {
  return {
    availableBalance: Number(response.availableBalance),
    currency: response.currency,
  };
}

export function mapMtnError(reason: string, message: string): OpenBankError {
  const code = MTN_ERROR_CODES.includes(reason as SdkErrorCode) ? (reason as SdkErrorCode) : 'UNKNOWN_ERROR';
  return new OpenBankError(code, message);
}
