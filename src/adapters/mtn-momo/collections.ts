import { HttpClient } from '../../core/client';
import type { Balance, PaymentRequest, PaymentResult } from '../../core/types';
import { generateUuidV4 } from '../../core/uuid';
import { mapMtnBalanceResponse, mapMtnStatusResponse } from './mappers';

export interface CollectionsRequestContext {
  token: string;
  subscriptionKey: string;
  environment: 'sandbox' | 'production';
}

function buildHeaders(context: CollectionsRequestContext, referenceId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.token}`,
    'X-Target-Environment': context.environment,
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
): Promise<PaymentResult> {
  const referenceId = generateUuidV4();

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
}

export async function getStatus(
  httpClient: HttpClient,
  context: CollectionsRequestContext,
  referenceId: string,
): Promise<PaymentResult> {
  const response = await httpClient.get<{ status: string }>(`/collection/v1_0/requesttopay/${referenceId}`, {
    headers: buildHeaders(context),
  });

  return mapMtnStatusResponse(referenceId, response);
}

export async function getBalance(httpClient: HttpClient, context: CollectionsRequestContext): Promise<Balance> {
  const response = await httpClient.get<{ availableBalance: string; currency: string }>(
    '/collection/v1_0/account/balance',
    { headers: buildHeaders(context) },
  );

  return mapMtnBalanceResponse(response);
}
