import { HttpClient, HttpError } from '../../core/client';
import { OpenBankError, type Balance, type PaymentRequest, type PaymentResult } from '../../core/types';
import { generateUuidV4 } from '../../core/uuid';
import { mapMtnBalanceResponse, mapMtnError, mapMtnStatusResponse } from './mappers';

export async function withMtnErrorMapping<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 0) {
        throw new OpenBankError('TIMEOUT', error.body, error.status);
      }
      const parsed = parseMtnErrorBody(error.body);
      throw mapMtnError(parsed?.code ?? 'UNKNOWN_ERROR', parsed?.message ?? error.message, error.status);
    }
    throw error;
  }
}

function parseMtnErrorBody(body: string): { code?: string; message?: string } | null {
  try {
    return JSON.parse(body) as { code?: string; message?: string };
  } catch {
    return null;
  }
}

export interface CollectionsRequestContext {
  token: string;
  subscriptionKey: string;
  /** MTN's wire-level X-Target-Environment value, e.g. 'sandbox' or 'mtnrwanda'. */
  targetEnvironment: string;
}

function buildHeaders(context: CollectionsRequestContext, referenceId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.token}`,
    'X-Target-Environment': context.targetEnvironment,
    'Ocp-Apim-Subscription-Key': context.subscriptionKey,
  };

  if (referenceId) {
    headers['X-Reference-Id'] = referenceId;
  }

  return headers;
}

export async function requestToPay(
  httpClient: HttpClient,
  context: CollectionsRequestContext,
  payment: PaymentRequest,
  referenceId: string = generateUuidV4(),
): Promise<PaymentResult> {
  return withMtnErrorMapping(async () => {
    await httpClient.post<void>('/collection/v1_0/requesttopay', {
      headers: buildHeaders(context, referenceId),
      body: {
        amount: String(payment.amount),
        currency: payment.currency,
        externalId: payment.externalId,
        payer: { partyIdType: 'MSISDN', partyId: payment.phoneNumber },
        payerMessage: payment.payerMessage,
        payeeNote: payment.payeeNote,
      },
    });

    return { referenceId, status: 'PENDING' };
  });
}

export async function getStatus(
  httpClient: HttpClient,
  context: CollectionsRequestContext,
  referenceId: string,
): Promise<PaymentResult> {
  return withMtnErrorMapping(async () => {
    const response = await httpClient.get<{ status: string; reason?: string }>(
      `/collection/v1_0/requesttopay/${referenceId}`,
      { headers: buildHeaders(context) },
    );

    return mapMtnStatusResponse(referenceId, response);
  });
}

export async function getBalance(httpClient: HttpClient, context: CollectionsRequestContext): Promise<Balance> {
  return withMtnErrorMapping(async () => {
    const response = await httpClient.get<{ availableBalance: string; currency: string }>(
      '/collection/v1_0/account/balance',
      { headers: buildHeaders(context) },
    );

    return mapMtnBalanceResponse(response);
  });
}
