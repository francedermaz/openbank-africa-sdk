import { getBalance, getStatus, requestToPay } from '../../../../src/adapters/mtn-momo/collections';
import { HttpClient, HttpError } from '../../../../src/core/client';
import { OpenBankError } from '../../../../src/core/types';

describe('collections', () => {
  const context = { token: 'token-abc', subscriptionKey: 'sub-1', targetEnvironment: 'sandbox' };
  let httpClient: jest.Mocked<Pick<HttpClient, 'get' | 'post'>>;

  beforeEach(() => {
    httpClient = { get: jest.fn(), post: jest.fn() };
  });

  describe('requestToPay', () => {
    it('should POST the payment and return a PENDING result with a generated reference id', async () => {
      // Given
      httpClient.post.mockResolvedValue(undefined);
      const payment = {
        amount: 5000,
        currency: 'RWF',
        phoneNumber: '250788123456',
        externalId: 'order-123',
        payerMessage: 'Payment for order #123',
      };

      // When
      const result = await requestToPay(httpClient as unknown as HttpClient, context, payment);

      // Then
      expect(result.status).toBe('PENDING');
      expect(result.referenceId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(httpClient.post).toHaveBeenCalledWith(
        '/collection/v1_0/requesttopay',
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
            externalId: 'order-123',
            payer: { partyIdType: 'MSISDN', partyId: '250788123456' },
          }),
        }),
      );
    });

    it('should reject with a mapped OpenBankError when the underlying request fails', async () => {
      // Given
      httpClient.post.mockRejectedValue(
        new HttpError(400, JSON.stringify({ code: 'PAYER_NOT_FOUND', message: 'Payer could not be found' })),
      );
      const payment = {
        amount: 5000,
        currency: 'RWF',
        phoneNumber: '250788123456',
        externalId: 'order-123',
        payerMessage: 'Payment for order #123',
      };

      // When / Then
      await expect(requestToPay(httpClient as unknown as HttpClient, context, payment)).rejects.toMatchObject({
        code: 'PAYER_NOT_FOUND',
        message: 'Payer could not be found',
      });
      await expect(requestToPay(httpClient as unknown as HttpClient, context, payment)).rejects.toBeInstanceOf(
        OpenBankError,
      );
    });
  });

  describe('getStatus', () => {
    it('should GET the transaction status and map it to a PaymentResult', async () => {
      // Given
      httpClient.get.mockResolvedValue({ status: 'SUCCESSFUL' });

      // When
      const result = await getStatus(httpClient as unknown as HttpClient, context, 'ref-1');

      // Then
      expect(result).toEqual({ referenceId: 'ref-1', status: 'SUCCESSFUL' });
      expect(httpClient.get).toHaveBeenCalledWith(
        '/collection/v1_0/requesttopay/ref-1',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }) }),
      );
    });

    it('should reject with a mapped OpenBankError when the underlying request fails', async () => {
      // Given
      httpClient.get.mockRejectedValue(
        new HttpError(400, JSON.stringify({ code: 'PAYER_NOT_FOUND', message: 'Payer could not be found' })),
      );

      // When / Then
      await expect(getStatus(httpClient as unknown as HttpClient, context, 'ref-1')).rejects.toMatchObject({
        code: 'PAYER_NOT_FOUND',
        message: 'Payer could not be found',
      });
      await expect(getStatus(httpClient as unknown as HttpClient, context, 'ref-1')).rejects.toBeInstanceOf(
        OpenBankError,
      );
    });
  });

  describe('getBalance', () => {
    it('should GET the account balance and map it to a Balance', async () => {
      // Given
      httpClient.get.mockResolvedValue({ availableBalance: '1000.00', currency: 'RWF' });

      // When
      const result = await getBalance(httpClient as unknown as HttpClient, context);

      // Then
      expect(result).toEqual({ availableBalance: 1000, currency: 'RWF' });
      expect(httpClient.get).toHaveBeenCalledWith(
        '/collection/v1_0/account/balance',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }) }),
      );
    });

    it('should reject with a mapped OpenBankError when the underlying request fails', async () => {
      // Given
      httpClient.get.mockRejectedValue(
        new HttpError(400, JSON.stringify({ code: 'PAYER_NOT_FOUND', message: 'Payer could not be found' })),
      );

      // When / Then
      await expect(getBalance(httpClient as unknown as HttpClient, context)).rejects.toMatchObject({
        code: 'PAYER_NOT_FOUND',
        message: 'Payer could not be found',
      });
      await expect(getBalance(httpClient as unknown as HttpClient, context)).rejects.toBeInstanceOf(OpenBankError);
    });
  });
});
