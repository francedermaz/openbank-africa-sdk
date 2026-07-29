import { MtnMomoAdapter } from '../../../../src/adapters/mtn-momo';
import { HttpClient, HttpError } from '../../../../src/core/client';
import { OpenBankError } from '../../../../src/core/types';

function createFakeHttpClient(): jest.Mocked<Pick<HttpClient, 'get' | 'post'>> {
  return {
    get: jest.fn(),
    post: jest.fn().mockImplementation((path: string) => {
      if (path === '/v1_0/apiuser') return Promise.resolve(undefined);
      if (path.endsWith('/apikey')) return Promise.resolve({ apiKey: 'key-1' });
      if (path === '/collection/token/') {
        return Promise.resolve({ access_token: 'token-abc', token_type: 'Bearer', expires_in: 3600 });
      }
      throw new Error(`Unexpected POST to ${path}`);
    }),
  };
}

describe('MtnMomoAdapter', () => {
  const config = {
    subscriptionKey: 'sub-1',
    callbackHost: 'https://example.com/webhooks',
    environment: 'sandbox' as const,
  };

  it('should throw INVALID_CONFIGURATION when constructed for production without baseUrl/apiUser/apiKey', () => {
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

  it('should skip auto-provisioning and use the supplied credentials in production', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(
      {
        ...config,
        environment: 'production',
        baseUrl: 'https://example-production.test',
        apiUser: 'prod-user',
        apiKey: 'prod-key',
      },
      httpClient as unknown as HttpClient,
    );

    // When
    await adapter.authenticate();

    // Then
    expect(httpClient.post).not.toHaveBeenCalledWith('/v1_0/apiuser', expect.anything());
    expect(httpClient.post).toHaveBeenCalledWith('/collection/token/', expect.anything());
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

  it('should retry once and succeed when a 401 is followed by a healthy request', async () => {
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
    // The token endpoint is called once for the initial authenticate() and
    // once more for the retry's fresh token, after the cache was invalidated.
    expect(httpClient.post).toHaveBeenCalledTimes(4);
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
});
