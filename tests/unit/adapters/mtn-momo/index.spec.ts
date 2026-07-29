import { MtnMomoAdapter, resolveBaseUrl } from '../../../../src/adapters/mtn-momo';
import { base64Encode } from '../../../../src/core/base64';
import { HttpClient, HttpError } from '../../../../src/core/client';
import { OpenBankError } from '../../../../src/core/types';

function createFakeHttpClient(): jest.Mocked<Pick<HttpClient, 'get' | 'post'>> {
  let tokenCallCount = 0;
  return {
    get: jest.fn(),
    post: jest.fn().mockImplementation((path: string) => {
      if (path === '/v1_0/apiuser') return Promise.resolve(undefined);
      if (path.endsWith('/apikey')) return Promise.resolve({ apiKey: 'key-1' });
      if (path === '/collection/token/') {
        tokenCallCount += 1;
        return Promise.resolve({ access_token: `token-${tokenCallCount}`, token_type: 'Bearer', expires_in: 3600 });
      }
      throw new Error(`Unexpected POST to ${path}`);
    }),
  };
}

describe('resolveBaseUrl', () => {
  const config = {
    subscriptionKey: 'sub-1',
    callbackHost: 'https://example.com/webhooks',
  };

  it('should resolve the hardcoded sandbox base URL for environment sandbox', () => {
    // Given / When
    const baseUrl = resolveBaseUrl({ ...config, environment: 'sandbox' });

    // Then
    expect(baseUrl).toBe('https://sandbox.momodeveloper.mtn.com');
  });

  it('should resolve the caller-supplied base URL for environment production', () => {
    // Given / When
    const baseUrl = resolveBaseUrl({ ...config, environment: 'production', baseUrl: 'https://custom.example' });

    // Then
    expect(baseUrl).toBe('https://custom.example');
  });
});

describe('MtnMomoAdapter', () => {
  const config = {
    subscriptionKey: 'sub-1',
    callbackHost: 'https://example.com/webhooks',
    environment: 'sandbox' as const,
  };

  it('should throw INVALID_CONFIGURATION when constructed for production without baseUrl/apiUser/apiKey/targetEnvironment', () => {
    // Given / When
    let caught: unknown;
    try {
      new MtnMomoAdapter({ ...config, environment: 'production' });
    } catch (error) {
      caught = error;
    }

    // Then
    expect(caught).toBeInstanceOf(OpenBankError);
    expect((caught as OpenBankError).code).toBe('INVALID_CONFIGURATION');
  });

  it('should skip auto-provisioning and authenticate with the supplied credentials in production', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(
      {
        ...config,
        environment: 'production',
        baseUrl: 'https://example-production.test',
        apiUser: 'prod-user',
        apiKey: 'prod-key',
        targetEnvironment: 'mtnrwanda',
      },
      httpClient as unknown as HttpClient,
    );

    // When
    await adapter.authenticate();

    // Then
    expect(httpClient.post).not.toHaveBeenCalledWith('/v1_0/apiuser', expect.anything());
    expect(httpClient.post).toHaveBeenCalledWith(
      '/collection/token/',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Basic ${base64Encode('prod-user:prod-key')}` }),
      }),
    );
  });

  it('should send the configured targetEnvironment (not the literal string "production") on collections calls', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    httpClient.get.mockResolvedValue({ availableBalance: '1000.00', currency: 'RWF' });
    const adapter = new MtnMomoAdapter(
      {
        ...config,
        environment: 'production',
        baseUrl: 'https://example-production.test',
        apiUser: 'prod-user',
        apiKey: 'prod-key',
        targetEnvironment: 'mtnrwanda',
      },
      httpClient as unknown as HttpClient,
    );
    await adapter.authenticate();

    // When
    await adapter.getBalance();

    // Then
    expect(httpClient.get).toHaveBeenCalledWith(
      '/collection/v1_0/account/balance',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Target-Environment': 'mtnrwanda' }) }),
    );
  });

  it('should provision sandbox credentials and fetch a token on authenticate', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(config, httpClient as unknown as HttpClient);

    // When
    await adapter.authenticate();

    // Then
    expect(httpClient.post).toHaveBeenCalledWith('/v1_0/apiuser', expect.anything());
    expect(httpClient.post).toHaveBeenCalledWith(expect.stringContaining('/apikey'), expect.anything());
    expect(httpClient.post).toHaveBeenCalledWith('/collection/token/', expect.anything());
  });

  it('should throw NOT_AUTHENTICATED when using the adapter before authenticate', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(config, httpClient as unknown as HttpClient);

    // When / Then
    await expect(adapter.getBalance()).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
      message: 'Call authenticate() before using the adapter',
    });
  });

  it('should fetch the balance once authenticated', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    httpClient.get.mockResolvedValue({ availableBalance: '1000.00', currency: 'RWF' });
    const adapter = new MtnMomoAdapter(config, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    // When
    const balance = await adapter.getBalance();

    // Then
    expect(balance).toEqual({ availableBalance: 1000, currency: 'RWF' });
  });

  it('should reject with a mapped OpenBankError (not the raw HttpError) when a request fails after authenticate', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    httpClient.get.mockRejectedValue(
      new HttpError(400, JSON.stringify({ code: 'PAYER_NOT_FOUND', message: 'Payer could not be found' })),
    );
    const adapter = new MtnMomoAdapter(config, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    // When / Then
    await expect(adapter.getBalance()).rejects.toBeInstanceOf(OpenBankError);
    await expect(adapter.getBalance()).rejects.toMatchObject({
      code: 'PAYER_NOT_FOUND',
      message: 'Payer could not be found',
    });
  });

  it('should reject with a mapped OpenBankError (not the raw HttpError) when authenticate itself fails', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    httpClient.post.mockImplementation((path: string) => {
      if (path === '/v1_0/apiuser') {
        return Promise.reject(
          new HttpError(401, JSON.stringify({ code: 'UNKNOWN_ERROR', message: 'Invalid subscription key' })),
        );
      }
      throw new Error(`Unexpected POST to ${path}`);
    });
    const adapter = new MtnMomoAdapter(config, httpClient as unknown as HttpClient);

    // When / Then
    await expect(adapter.authenticate()).rejects.toBeInstanceOf(OpenBankError);
    await expect(adapter.authenticate()).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
  });

  it('should retry once with a fresh token and succeed when a 401 is followed by a healthy request', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(config, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    httpClient.get
      .mockRejectedValueOnce(new HttpError(401, JSON.stringify({ code: 'UNKNOWN_ERROR', message: 'Access denied' })))
      .mockResolvedValueOnce({ availableBalance: '1000.00', currency: 'RWF' });

    // When
    const balance = await adapter.getBalance();

    // Then
    expect(balance).toEqual({ availableBalance: 1000, currency: 'RWF' });
    expect(httpClient.get).toHaveBeenCalledTimes(2);
    // authenticate() fetched token-1; invalidate() + retry must fetch a
    // genuinely new token-2, and the retried request must carry it.
    expect(httpClient.get).toHaveBeenLastCalledWith(
      '/collection/v1_0/account/balance',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-2' }) }),
    );
  });

  it('should retry exactly once and propagate the mapped error when 401 persists', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(config, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    httpClient.get.mockRejectedValue(
      new HttpError(401, JSON.stringify({ code: 'UNKNOWN_ERROR', message: 'Access denied' })),
    );

    // When / Then
    await expect(adapter.getBalance()).rejects.toMatchObject({ code: 'UNKNOWN_ERROR', httpStatus: 401 });
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });

  it('should retry requestToPay on 401 using the same X-Reference-Id (idempotent retry)', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(config, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    // After authenticate() the token is already cached, so the next three
    // post() calls are, in order: the failing requesttopay, the token
    // refresh triggered by invalidate(), and the retried requesttopay.
    httpClient.post
      .mockImplementationOnce(() =>
        Promise.reject(new HttpError(401, JSON.stringify({ code: 'UNKNOWN_ERROR', message: 'Access denied' }))),
      )
      .mockImplementationOnce(() => Promise.resolve({ access_token: 'token-2', token_type: 'Bearer', expires_in: 3600 }))
      .mockImplementationOnce(() => Promise.resolve(undefined));

    // When
    const result = await adapter.requestToPay({
      amount: 5000,
      currency: 'EUR',
      phoneNumber: '250788123456',
      externalId: 'order-1',
    });

    // Then: both the failed first attempt and the retried attempt used the
    // same X-Reference-Id, so MTN sees one idempotent request, not two.
    const referenceIds = httpClient.post.mock.calls
      .filter(([path]) => path === '/collection/v1_0/requesttopay')
      .map(([, options]) => (options as { headers: Record<string, string> }).headers['X-Reference-Id']);
    expect(referenceIds).toHaveLength(2);
    expect(referenceIds[0]).toBe(referenceIds[1]);
    expect(result.referenceId).toBe(referenceIds[0]);
  });
});
