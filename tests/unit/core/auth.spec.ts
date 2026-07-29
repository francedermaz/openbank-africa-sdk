import { TokenManager } from '../../../src/core/auth';
import { base64Encode } from '../../../src/core/base64';
import { HttpClient } from '../../../src/core/client';

describe('TokenManager', () => {
  const credentials = { apiUser: 'user-1', apiKey: 'key-1', subscriptionKey: 'sub-1' };
  let httpClient: jest.Mocked<Pick<HttpClient, 'post'>>;
  let tokenManager: TokenManager;

  beforeEach(() => {
    httpClient = { post: jest.fn() };
    tokenManager = new TokenManager(httpClient as unknown as HttpClient, '/token');
  });

  it('should request a new token with a Basic auth header', async () => {
    // Given
    httpClient.post.mockResolvedValue({ access_token: 'token-abc', token_type: 'Bearer', expires_in: 3600 });

    // When
    const token = await tokenManager.getToken(credentials);

    // Then
    expect(token).toBe('token-abc');
    expect(httpClient.post).toHaveBeenCalledWith('/token', {
      headers: {
        Authorization: `Basic ${base64Encode('user-1:key-1')}`,
        'Ocp-Apim-Subscription-Key': 'sub-1',
      },
    });
  });

  it('should reuse a cached token before it expires', async () => {
    // Given
    httpClient.post.mockResolvedValue({ access_token: 'token-abc', token_type: 'Bearer', expires_in: 3600 });
    await tokenManager.getToken(credentials);

    // When
    const token = await tokenManager.getToken(credentials);

    // Then
    expect(token).toBe('token-abc');
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('should request a new token after the cached one expires', async () => {
    // Given
    httpClient.post.mockResolvedValue({ access_token: 'token-abc', token_type: 'Bearer', expires_in: 10 });
    await tokenManager.getToken(credentials);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6_000);
    httpClient.post.mockResolvedValue({ access_token: 'token-def', token_type: 'Bearer', expires_in: 3600 });

    // When
    const token = await tokenManager.getToken(credentials);

    // Then
    expect(token).toBe('token-def');
    expect(httpClient.post).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it('should request a new token after invalidate() even if the cached one has not expired', async () => {
    // Given
    httpClient.post.mockResolvedValue({ access_token: 'token-abc', token_type: 'Bearer', expires_in: 3600 });
    await tokenManager.getToken(credentials);
    httpClient.post.mockResolvedValue({ access_token: 'token-def', token_type: 'Bearer', expires_in: 3600 });

    // When
    tokenManager.invalidate();
    const token = await tokenManager.getToken(credentials);

    // Then
    expect(token).toBe('token-def');
    expect(httpClient.post).toHaveBeenCalledTimes(2);
  });
});
