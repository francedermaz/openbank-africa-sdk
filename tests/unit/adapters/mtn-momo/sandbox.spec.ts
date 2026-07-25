import { provisionSandboxCredentials } from '../../../../src/adapters/mtn-momo/sandbox';
import { HttpClient } from '../../../../src/core/client';

describe('provisionSandboxCredentials', () => {
  it('should create an API user then an API key and return both', async () => {
    // Given
    const httpClient = {
      post: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ apiKey: 'generated-key' }),
    };

    // When
    const result = await provisionSandboxCredentials(
      httpClient as unknown as HttpClient,
      'sub-1',
      'https://example.com/webhooks',
    );

    // Then
    expect(result.apiKey).toBe('generated-key');
    expect(result.apiUser).toMatch(/^[0-9a-f-]{36}$/i);

    expect(httpClient.post).toHaveBeenNthCalledWith(1, '/v1_0/apiuser', {
      headers: {
        'X-Reference-Id': result.apiUser,
        'Ocp-Apim-Subscription-Key': 'sub-1',
      },
      body: { providerCallbackHost: 'https://example.com/webhooks' },
    });

    expect(httpClient.post).toHaveBeenNthCalledWith(2, `/v1_0/apiuser/${result.apiUser}/apikey`, {
      headers: { 'Ocp-Apim-Subscription-Key': 'sub-1' },
    });
  });
});
