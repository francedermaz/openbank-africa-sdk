import { HttpClient } from '../../core/client';
import {
  OpenBankError,
  type AccountHolderStatus,
  type Balance,
  type TransferRequest,
  type TransferResult,
} from '../../core/types';
import { generateUuidV4 } from '../../core/uuid';
import { withMtnErrorMapping } from './errors';
import { mapMtnAccountHolderResponse, mapMtnBalanceResponse, mapMtnStatusResponse } from './mappers';
import { buildHeaders, type MtnRequestContext } from './session';

export async function transfer(
  httpClient: HttpClient,
  context: MtnRequestContext,
  request: TransferRequest,
  referenceId: string = generateUuidV4(),
): Promise<TransferResult> {
  return withMtnErrorMapping(async () => {
    // MTN answers 202 Accepted with an empty body: the transfer is queued,
    // not settled. The caller polls getStatus() with this referenceId.
    await httpClient.post<void>('/disbursement/v1_0/transfer', {
      headers: buildHeaders(context, referenceId),
      body: {
        amount: String(request.amount),
        currency: request.currency,
        externalId: request.externalId,
        // The one wire-level difference from collections: money flows out, so
        // the counterparty is the payee rather than the payer.
        payee: { partyIdType: 'MSISDN', partyId: request.phoneNumber },
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      },
    });

    return { referenceId, status: 'PENDING' };
  });
}

export async function getStatus(
  httpClient: HttpClient,
  context: MtnRequestContext,
  referenceId: string,
): Promise<TransferResult> {
  return withMtnErrorMapping(async () => {
    const response = await httpClient.get<{ status: string; reason?: string }>(
      `/disbursement/v1_0/transfer/${referenceId}`,
      { headers: buildHeaders(context) },
    );

    return mapMtnStatusResponse(referenceId, response);
  });
}

export async function getBalance(httpClient: HttpClient, context: MtnRequestContext): Promise<Balance> {
  return withMtnErrorMapping(async () => {
    const response = await httpClient.get<{ availableBalance: string; currency: string }>(
      '/disbursement/v1_0/account/balance',
      { headers: buildHeaders(context) },
    );

    return mapMtnBalanceResponse(response);
  });
}

export async function validateAccountHolder(
  httpClient: HttpClient,
  context: MtnRequestContext,
  phoneNumber: string,
): Promise<AccountHolderStatus> {
  try {
    const response = await withMtnErrorMapping(() =>
      httpClient.get<{ result?: boolean } | undefined>(
        `/disbursement/v1_0/accountholder/msisdn/${encodeURIComponent(phoneNumber)}/active`,
        { headers: buildHeaders(context) },
      ),
    );

    return mapMtnAccountHolderResponse(response);
  } catch (error) {
    // MTN answers 404 for a number it does not know. For a call whose whole
    // purpose is asking "does this account exist?", that is the answer — not
    // a failure. Every other error (401, 500, timeout) still propagates.
    if (error instanceof OpenBankError && error.httpStatus === 404) {
      return { isActive: false };
    }
    throw error;
  }
}
