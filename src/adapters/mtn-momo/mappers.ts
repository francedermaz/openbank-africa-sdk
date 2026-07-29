import { OpenBankError, type Balance, type PaymentResult, type PaymentStatus, type SdkErrorCode } from '../../core/types';

const VALID_STATUSES: readonly PaymentStatus[] = ['PENDING', 'SUCCESSFUL', 'FAILED'];

// Per MTN's Open API "Common Error Codes" reference.
const MTN_ERROR_CODES: readonly SdkErrorCode[] = [
  'RESOURCE_NOT_FOUND',
  'RESOURCE_ALREADY_EXIST',
  'APPROVAL_REJECTED',
  'EXPIRED',
  'PAYER_NOT_FOUND',
  'PAYEE_NOT_FOUND',
  'NOT_ALLOWED',
  'NOT_ALLOWED_TARGET_ENVIRONMENT',
  'INVALID_CALLBACK_URL_HOST',
  'INVALID_CURRENCY',
  'SERVICE_UNAVAILABLE',
  'COULD_NOT_PERFORM_TRANSACTION',
  'INTERNAL_PROCESSING_ERROR',
];

export function mapMtnStatusResponse(
  referenceId: string,
  response: { status: string; reason?: string },
): PaymentResult {
  const status = VALID_STATUSES.includes(response.status as PaymentStatus)
    ? (response.status as PaymentStatus)
    : 'FAILED';

  return response.reason ? { referenceId, status, reason: response.reason } : { referenceId, status };
}

export function mapMtnBalanceResponse(response: { availableBalance: string; currency: string }): Balance {
  const availableBalance = Number(response.availableBalance);
  if (Number.isNaN(availableBalance)) {
    throw new OpenBankError('UNKNOWN_ERROR', `Invalid balance value received from MTN: "${response.availableBalance}"`);
  }
  return { availableBalance, currency: response.currency };
}

export function mapMtnError(reason: string, message: string, httpStatus?: number): OpenBankError {
  const code = MTN_ERROR_CODES.includes(reason as SdkErrorCode) ? (reason as SdkErrorCode) : 'UNKNOWN_ERROR';
  return new OpenBankError(code, message, httpStatus);
}
