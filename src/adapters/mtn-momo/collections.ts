import { HttpClient } from '../../core/client';
import { type Balance, type PaymentRequest, type PaymentResult } from '../../core/types';
import { generateUuidV4 } from '../../core/uuid';
import { withMtnErrorMapping } from './errors';
import { mapMtnBalanceResponse, mapMtnStatusResponse } from './mappers';
import { buildHeaders, type MtnRequestContext } from './session';

export async function requestToPay(
  httpClient: HttpClient,
  context: MtnRequestContext,
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
  context: MtnRequestContext,
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

export async function getBalance(httpClient: HttpClient, context: MtnRequestContext): Promise<Balance> {
  return withMtnErrorMapping(async () => {
    const response = await httpClient.get<{ availableBalance: string; currency: string }>(
      '/collection/v1_0/account/balance',
      { headers: buildHeaders(context) },
    );

    return mapMtnBalanceResponse(response);
  });
}
