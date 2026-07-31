import {
  getBalance,
  getStatus,
  transfer,
  validateAccountHolder,
} from '../../../../src/adapters/mtn-momo/disbursements';
import { HttpClient, HttpError } from '../../../../src/core/client';
import { OpenBankError } from '../../../../src/core/types';

describe('disbursements', () => {
  const context = { token: 'token-abc', subscriptionKey: 'sub-1', targetEnvironment: 'sandbox' };
  let httpClient: jest.Mocked<Pick<HttpClient, 'get' | 'post'>>;

  beforeEach(() => {
    httpClient = { get: jest.fn(), post: jest.fn() };
  });

  describe('transfer', () => {
    const request = {
      amount: 5000,
      currency: 'RWF',
      phoneNumber: '250788123456',
      externalId: 'payout-123',
      payerMessage: 'Salary payment',
      payeeNote: 'Thanks for your work',
    };

    it('should POST the transfer with a payee party and return a PENDING result', async () => {
      // Given
      httpClient.post.mockResolvedValue(undefined);

      // When
      const result = await transfer(httpClient as unknown as HttpClient, context, request);

      // Then
      expect(result.status).toBe('PENDING');
      expect(result.referenceId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(httpClient.post).toHaveBeenCalledWith(
        '/disbursement/v1_0/transfer',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token-abc',
            'X-Target-Environment': 'sandbox',
            'Ocp-Apim-Subscription-Key': 'sub-1',
            'X-Reference-Id': result.referenceId,
          }),
          body: expect.objectContaining({
            amount: '5000',
            currency: 'RWF',
            externalId: 'payout-123',
            payee: { partyIdType: 'MSISDN', partyId: '250788123456' },
            payerMessage: 'Salary payment',
            payeeNote: 'Thanks for your work',
          }),
        }),
      );
    });

    it('should send the counterparty as payee, never as payer', async () => {
      // Given: money flows out here, the inverse of collections. Sending
      // `payer` would make MTN debit the wrong side.
      httpClient.post.mockResolvedValue(undefined);

      // When
      await transfer(httpClient as unknown as HttpClient, context, request);

      // Then
      const [, options] = httpClient.post.mock.calls[0];
      const body = (options as { body: Record<string, unknown> }).body;
      expect(body).toHaveProperty('payee');
      expect(body).not.toHaveProperty('payer');
    });

    it('should reuse a caller-supplied reference id so a retry stays idempotent', async () => {
      // Given
      httpClient.post.mockResolvedValue(undefined);

      // When
      const result = await transfer(httpClient as unknown as HttpClient, context, request, 'fixed-reference');

      // Then
      expect(result.referenceId).toBe('fixed-reference');
      expect(httpClient.post).toHaveBeenCalledWith(
        '/disbursement/v1_0/transfer',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Reference-Id': 'fixed-reference' }),
        }),
      );
    });

    it('should reject with a mapped OpenBankError when the payee wallet has no funds available', async () => {
      // Given
      httpClient.post.mockRejectedValue(
        new HttpError(400, JSON.stringify({ code: 'NOT_ENOUGH_FUNDS', message: 'Insufficient funds' })),
      );

      // When / Then
      await expect(transfer(httpClient as unknown as HttpClient, context, request)).rejects.toBeInstanceOf(
        OpenBankError,
      );
      await expect(transfer(httpClient as unknown as HttpClient, context, request)).rejects.toMatchObject({
        code: 'NOT_ENOUGH_FUNDS',
        message: 'Insufficient funds',
      });
    });

    it('should map a duplicate reference id conflict to RESOURCE_ALREADY_EXIST', async () => {
      // Given
      httpClient.post.mockRejectedValue(
        new HttpError(409, JSON.stringify({ code: 'RESOURCE_ALREADY_EXIST', message: 'ReferenceId already in use' })),
      );

      // When / Then
      await expect(transfer(httpClient as unknown as HttpClient, context, request)).rejects.toMatchObject({
        code: 'RESOURCE_ALREADY_EXIST',
        httpStatus: 409,
      });
    });
  });

  describe('getStatus', () => {
    it('should GET the transfer status and map it to a TransferResult', async () => {
      // Given
      httpClient.get.mockResolvedValue({ status: 'SUCCESSFUL' });

      // When
      const result = await getStatus(httpClient as unknown as HttpClient, context, 'ref-1');

      // Then
      expect(result).toEqual({ referenceId: 'ref-1', status: 'SUCCESSFUL' });
      expect(httpClient.get).toHaveBeenCalledWith(
        '/disbursement/v1_0/transfer/ref-1',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }) }),
      );
    });

    it('should surface the failure reason MTN reports on a failed transfer', async () => {
      // Given
      httpClient.get.mockResolvedValue({ status: 'FAILED', reason: 'PAYEE_NOT_FOUND' });

      // When
      const result = await getStatus(httpClient as unknown as HttpClient, context, 'ref-1');

      // Then
      expect(result).toEqual({ referenceId: 'ref-1', status: 'FAILED', reason: 'PAYEE_NOT_FOUND' });
    });

    it('should reject with a mapped OpenBankError when the underlying request fails', async () => {
      // Given
      httpClient.get.mockRejectedValue(
        new HttpError(404, JSON.stringify({ code: 'RESOURCE_NOT_FOUND', message: 'Transaction not found' })),
      );

      // When / Then
      await expect(getStatus(httpClient as unknown as HttpClient, context, 'ref-1')).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Transaction not found',
      });
    });
  });

  describe('getBalance', () => {
    it('should GET the disbursement account balance and map it to a Balance', async () => {
      // Given
      httpClient.get.mockResolvedValue({ availableBalance: '1000.00', currency: 'RWF' });

      // When
      const result = await getBalance(httpClient as unknown as HttpClient, context);

      // Then
      expect(result).toEqual({ availableBalance: 1000, currency: 'RWF' });
      expect(httpClient.get).toHaveBeenCalledWith(
        '/disbursement/v1_0/account/balance',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }) }),
      );
    });

    it('should reject with a mapped OpenBankError when the underlying request fails', async () => {
      // Given
      httpClient.get.mockRejectedValue(
        new HttpError(500, JSON.stringify({ code: 'INTERNAL_PROCESSING_ERROR', message: 'Internal error' })),
      );

      // When / Then
      await expect(getBalance(httpClient as unknown as HttpClient, context)).rejects.toMatchObject({
        code: 'INTERNAL_PROCESSING_ERROR',
      });
    });
  });

  describe('validateAccountHolder', () => {
    it('should GET the account holder active endpoint and report an active holder', async () => {
      // Given
      httpClient.get.mockResolvedValue({ result: true });

      // When
      const result = await validateAccountHolder(httpClient as unknown as HttpClient, context, '250788123456');

      // Then
      expect(result).toEqual({ isActive: true });
      expect(httpClient.get).toHaveBeenCalledWith(
        '/disbursement/v1_0/accountholder/msisdn/250788123456/active',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }) }),
      );
    });

    it('should report an inactive holder when MTN answers result false', async () => {
      // Given
      httpClient.get.mockResolvedValue({ result: false });

      // When
      const result = await validateAccountHolder(httpClient as unknown as HttpClient, context, '250788123456');

      // Then
      expect(result).toEqual({ isActive: false });
    });

    it('should treat a 200 with an empty body as active, per MTN documenting 200 as the active answer', async () => {
      // Given
      httpClient.get.mockResolvedValue(undefined);

      // When
      const result = await validateAccountHolder(httpClient as unknown as HttpClient, context, '250788123456');

      // Then
      expect(result).toEqual({ isActive: true });
    });

    it('should report inactive rather than throwing when MTN does not know the number', async () => {
      // Given: 404 is the documented answer for an unknown account holder.
      // For a call whose purpose is asking whether the account exists, that
      // is an answer, not a failure.
      httpClient.get.mockRejectedValue(
        new HttpError(404, JSON.stringify({ code: 'RESOURCE_NOT_FOUND', message: 'Account holder not found' })),
      );

      // When
      const result = await validateAccountHolder(httpClient as unknown as HttpClient, context, '250700000000');

      // Then
      expect(result).toEqual({ isActive: false });
    });

    it('should propagate errors that are not a 404', async () => {
      // Given
      httpClient.get.mockRejectedValue(
        new HttpError(500, JSON.stringify({ code: 'INTERNAL_PROCESSING_ERROR', message: 'Internal error' })),
      );

      // When / Then
      await expect(
        validateAccountHolder(httpClient as unknown as HttpClient, context, '250788123456'),
      ).rejects.toMatchObject({ code: 'INTERNAL_PROCESSING_ERROR' });
    });

    it('should url-encode the phone number so it cannot break out of the path', async () => {
      // Given
      httpClient.get.mockResolvedValue({ result: true });

      // When
      await validateAccountHolder(httpClient as unknown as HttpClient, context, '250 788/123');

      // Then
      expect(httpClient.get).toHaveBeenCalledWith(
        '/disbursement/v1_0/accountholder/msisdn/250%20788%2F123/active',
        expect.anything(),
      );
    });
  });
});
