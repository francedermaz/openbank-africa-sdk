import { MtnMomoAdapter, resolveBaseUrl } from '../../../../src/adapters/mtn-momo';
import { base64Encode } from '../../../../src/core/base64';
import { HttpClient, HttpError } from '../../../../src/core/client';
import { OpenBankError } from '../../../../src/core/types';

function createFakeHttpClient(): jest.Mocked<Pick<HttpClient, 'get' | 'post'>> {
  const tokenCounts: Record<string, number> = {};
  return {
    get: jest.fn(),
    post: jest.fn().mockImplementation((path: string) => {
      if (path === '/v1_0/apiuser') return Promise.resolve(undefined);
      if (path.endsWith('/apikey')) return Promise.resolve({ apiKey: 'key-1' });
      if (path === '/collection/token/' || path === '/disbursement/token/') {
        tokenCounts[path] = (tokenCounts[path] ?? 0) + 1;
        const product = path === '/collection/token/' ? 'collections' : 'disbursements';
        return Promise.resolve({
          access_token: `${product}-token-${tokenCounts[path]}`,
          token_type: 'Bearer',
          expires_in: 3600,
        });
      }
      throw new Error(`Unexpected POST to ${path}`);
    }),
  };
}

const COLLECTIONS_ONLY = {
  callbackHost: 'https://example.com/webhooks',
  environment: 'sandbox' as const,
  products: { collections: { subscriptionKey: 'sub-collections' } },
};

const BOTH_PRODUCTS = {
  callbackHost: 'https://example.com/webhooks',
  environment: 'sandbox' as const,
  products: {
    collections: { subscriptionKey: 'sub-collections' },
    disbursements: { subscriptionKey: 'sub-disbursements' },
  },
};

describe('resolveBaseUrl', () => {
  it('should resolve the hardcoded sandbox base URL for environment sandbox', () => {
    // Given / When
    const baseUrl = resolveBaseUrl({ ...COLLECTIONS_ONLY, environment: 'sandbox' });

    // Then
    expect(baseUrl).toBe('https://sandbox.momodeveloper.mtn.com');
  });

  it('should resolve the caller-supplied base URL for environment production', () => {
    // Given / When
    const baseUrl = resolveBaseUrl({ ...COLLECTIONS_ONLY, environment: 'production', baseUrl: 'https://custom.example' });

    // Then
    expect(baseUrl).toBe('https://custom.example');
  });
});

describe('MtnMomoAdapter configuration', () => {
  it('should throw INVALID_CONFIGURATION when constructed for production without baseUrl/targetEnvironment', () => {
    // Given / When
    let caught: unknown;
    try {
      new MtnMomoAdapter({ ...COLLECTIONS_ONLY, environment: 'production' });
    } catch (error) {
      caught = error;
    }

    // Then
    expect(caught).toBeInstanceOf(OpenBankError);
    expect((caught as OpenBankError).code).toBe('INVALID_CONFIGURATION');
  });

  it('should throw INVALID_CONFIGURATION naming the product when a production product lacks apiUser/apiKey', () => {
    // Given / When
    let caught: unknown;
    try {
      new MtnMomoAdapter({
        ...BOTH_PRODUCTS,
        environment: 'production',
        baseUrl: 'https://example-production.test',
        targetEnvironment: 'mtnrwanda',
        products: {
          collections: { subscriptionKey: 'sub-collections', apiUser: 'u', apiKey: 'k' },
          disbursements: { subscriptionKey: 'sub-disbursements' },
        },
      });
    } catch (error) {
      caught = error;
    }

    // Then
    expect(caught).toBeInstanceOf(OpenBankError);
    expect((caught as OpenBankError).code).toBe('INVALID_CONFIGURATION');
    expect((caught as OpenBankError).message).toMatch(/products\.disbursements/);
  });

  it('should throw INVALID_CONFIGURATION when no product is configured', () => {
    // Given / When
    let caught: unknown;
    try {
      new MtnMomoAdapter({ ...COLLECTIONS_ONLY, products: {} });
    } catch (error) {
      caught = error;
    }

    // Then
    expect(caught).toBeInstanceOf(OpenBankError);
    expect((caught as OpenBankError).code).toBe('INVALID_CONFIGURATION');
  });

  it('should reject calls into a product that is not configured', async () => {
    // Given
    const adapter = new MtnMomoAdapter(COLLECTIONS_ONLY, createFakeHttpClient() as unknown as HttpClient);

    // When / Then
    await expect(adapter.disbursements.getBalance()).rejects.toMatchObject({
      code: 'INVALID_CONFIGURATION',
      message: expect.stringContaining('products.disbursements'),
    });
  });
});

describe('MtnMomoAdapter authentication', () => {
  it('should skip auto-provisioning and authenticate with the supplied credentials in production', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(
      {
        ...COLLECTIONS_ONLY,
        environment: 'production',
        baseUrl: 'https://example-production.test',
        targetEnvironment: 'mtnrwanda',
        products: { collections: { subscriptionKey: 'sub-collections', apiUser: 'prod-user', apiKey: 'prod-key' } },
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

  it('should send the configured targetEnvironment (not the literal string "production") on product calls', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    httpClient.get.mockResolvedValue({ availableBalance: '1000.00', currency: 'RWF' });
    const adapter = new MtnMomoAdapter(
      {
        ...COLLECTIONS_ONLY,
        environment: 'production',
        baseUrl: 'https://example-production.test',
        targetEnvironment: 'mtnrwanda',
        products: { collections: { subscriptionKey: 'sub-collections', apiUser: 'prod-user', apiKey: 'prod-key' } },
      },
      httpClient as unknown as HttpClient,
    );
    await adapter.authenticate();

    // When
    await adapter.collections.getBalance();

    // Then
    expect(httpClient.get).toHaveBeenCalledWith(
      '/collection/v1_0/account/balance',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Target-Environment': 'mtnrwanda' }) }),
    );
  });

  it('should provision sandbox credentials and fetch a token on authenticate', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(COLLECTIONS_ONLY, httpClient as unknown as HttpClient);

    // When
    await adapter.authenticate();

    // Then
    expect(httpClient.post).toHaveBeenCalledWith('/v1_0/apiuser', expect.anything());
    expect(httpClient.post).toHaveBeenCalledWith(expect.stringContaining('/apikey'), expect.anything());
    expect(httpClient.post).toHaveBeenCalledWith('/collection/token/', expect.anything());
  });

  it('should provision one API user per configured product, each with its own subscription key', async () => {
    // Given: collections and disbursements are separate MoMo subscriptions,
    // so each needs its own sandbox API user and its own token.
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(BOTH_PRODUCTS, httpClient as unknown as HttpClient);

    // When
    await adapter.authenticate();

    // Then
    const provisioningKeys = httpClient.post.mock.calls
      .filter(([path]) => path === '/v1_0/apiuser')
      .map(([, options]) => (options as { headers: Record<string, string> }).headers['Ocp-Apim-Subscription-Key']);
    expect(provisioningKeys).toEqual(expect.arrayContaining(['sub-collections', 'sub-disbursements']));
    expect(provisioningKeys).toHaveLength(2);

    expect(httpClient.post).toHaveBeenCalledWith('/collection/token/', expect.anything());
    expect(httpClient.post).toHaveBeenCalledWith('/disbursement/token/', expect.anything());
  });

  it('should throw NOT_AUTHENTICATED when using the adapter before authenticate', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(COLLECTIONS_ONLY, httpClient as unknown as HttpClient);

    // When / Then
    await expect(adapter.collections.getBalance()).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
      message: 'Call authenticate() before using the adapter',
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
    const adapter = new MtnMomoAdapter(COLLECTIONS_ONLY, httpClient as unknown as HttpClient);

    // When / Then
    await expect(adapter.authenticate()).rejects.toBeInstanceOf(OpenBankError);
    await expect(adapter.authenticate()).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
  });
});

describe('MtnMomoAdapter product routing', () => {
  it('should send each product its own subscription key and token', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    httpClient.get.mockResolvedValue({ availableBalance: '1000.00', currency: 'RWF' });
    const adapter = new MtnMomoAdapter(BOTH_PRODUCTS, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    // When
    await adapter.collections.getBalance();
    await adapter.disbursements.getBalance();

    // Then
    expect(httpClient.get).toHaveBeenCalledWith(
      '/collection/v1_0/account/balance',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Ocp-Apim-Subscription-Key': 'sub-collections',
          Authorization: 'Bearer collections-token-1',
        }),
      }),
    );
    expect(httpClient.get).toHaveBeenCalledWith(
      '/disbursement/v1_0/account/balance',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Ocp-Apim-Subscription-Key': 'sub-disbursements',
          Authorization: 'Bearer disbursements-token-1',
        }),
      }),
    );
  });

  it('should fetch the balance once authenticated', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    httpClient.get.mockResolvedValue({ availableBalance: '1000.00', currency: 'RWF' });
    const adapter = new MtnMomoAdapter(COLLECTIONS_ONLY, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    // When
    const balance = await adapter.collections.getBalance();

    // Then
    expect(balance).toEqual({ availableBalance: 1000, currency: 'RWF' });
  });

  it('should reject with a mapped OpenBankError (not the raw HttpError) when a request fails after authenticate', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    httpClient.get.mockRejectedValue(
      new HttpError(400, JSON.stringify({ code: 'PAYER_NOT_FOUND', message: 'Payer could not be found' })),
    );
    const adapter = new MtnMomoAdapter(COLLECTIONS_ONLY, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    // When / Then
    await expect(adapter.collections.getBalance()).rejects.toBeInstanceOf(OpenBankError);
    await expect(adapter.collections.getBalance()).rejects.toMatchObject({
      code: 'PAYER_NOT_FOUND',
      message: 'Payer could not be found',
    });
  });
});

describe('MtnMomoAdapter 401 retry', () => {
  it('should retry once with a fresh token and succeed when a 401 is followed by a healthy request', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(COLLECTIONS_ONLY, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    httpClient.get
      .mockRejectedValueOnce(new HttpError(401, JSON.stringify({ code: 'UNKNOWN_ERROR', message: 'Access denied' })))
      .mockResolvedValueOnce({ availableBalance: '1000.00', currency: 'RWF' });

    // When
    const balance = await adapter.collections.getBalance();

    // Then
    expect(balance).toEqual({ availableBalance: 1000, currency: 'RWF' });
    expect(httpClient.get).toHaveBeenCalledTimes(2);
    // authenticate() fetched collections-token-1; invalidate() + retry must
    // fetch a genuinely new token, and the retried request must carry it.
    expect(httpClient.get).toHaveBeenLastCalledWith(
      '/collection/v1_0/account/balance',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer collections-token-2' }) }),
    );
  });

  it('should retry exactly once and propagate the mapped error when 401 persists', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(COLLECTIONS_ONLY, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    httpClient.get.mockRejectedValue(
      new HttpError(401, JSON.stringify({ code: 'UNKNOWN_ERROR', message: 'Access denied' })),
    );

    // When / Then
    await expect(adapter.collections.getBalance()).rejects.toMatchObject({ code: 'UNKNOWN_ERROR', httpStatus: 401 });
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });

  it('should invalidate only the failing product token, leaving the other product untouched', async () => {
    // Given: tokens are per-product, so a 401 on disbursements must not force
    // collections to re-authenticate.
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(BOTH_PRODUCTS, httpClient as unknown as HttpClient);
    await adapter.authenticate();

    httpClient.get
      .mockRejectedValueOnce(new HttpError(401, JSON.stringify({ code: 'UNKNOWN_ERROR', message: 'Access denied' })))
      .mockResolvedValue({ availableBalance: '1000.00', currency: 'RWF' });

    // When
    await adapter.disbursements.getBalance();
    await adapter.collections.getBalance();

    // Then: disbursements rotated to token-2, collections still holds token-1.
    expect(httpClient.get).toHaveBeenLastCalledWith(
      '/collection/v1_0/account/balance',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer collections-token-1' }) }),
    );
    const disbursementAuth = httpClient.get.mock.calls
      .filter(([path]) => path === '/disbursement/v1_0/account/balance')
      .map(([, options]) => (options as { headers: Record<string, string> }).headers.Authorization);
    expect(disbursementAuth).toEqual(['Bearer disbursements-token-1', 'Bearer disbursements-token-2']);
  });

  it('should retry requestToPay on 401 using the same X-Reference-Id (idempotent retry)', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(COLLECTIONS_ONLY, httpClient as unknown as HttpClient);
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
    const result = await adapter.collections.requestToPay({
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

  it('should retry transfer on 401 using the same X-Reference-Id (idempotent retry)', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(
      { ...COLLECTIONS_ONLY, products: { disbursements: { subscriptionKey: 'sub-disbursements' } } },
      httpClient as unknown as HttpClient,
    );
    await adapter.authenticate();

    httpClient.post
      .mockImplementationOnce(() =>
        Promise.reject(new HttpError(401, JSON.stringify({ code: 'UNKNOWN_ERROR', message: 'Access denied' }))),
      )
      .mockImplementationOnce(() => Promise.resolve({ access_token: 'token-2', token_type: 'Bearer', expires_in: 3600 }))
      .mockImplementationOnce(() => Promise.resolve(undefined));

    // When
    const result = await adapter.disbursements.transfer({
      amount: 5000,
      currency: 'EUR',
      phoneNumber: '250788123456',
      externalId: 'payout-1',
    });

    // Then: sending money twice would be a real loss, so the retried transfer
    // must reuse the reference id MTN already saw.
    const referenceIds = httpClient.post.mock.calls
      .filter(([path]) => path === '/disbursement/v1_0/transfer')
      .map(([, options]) => (options as { headers: Record<string, string> }).headers['X-Reference-Id']);
    expect(referenceIds).toHaveLength(2);
    expect(referenceIds[0]).toBe(referenceIds[1]);
    expect(result.referenceId).toBe(referenceIds[0]);
  });
});
