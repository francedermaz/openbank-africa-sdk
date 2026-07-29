import { HttpClient } from '../../core/client';
import { generateUuidV4 } from '../../core/uuid';

export interface SandboxCredentials {
  apiUser: string;
  apiKey: string;
}

export async function provisionSandboxCredentials(
  httpClient: HttpClient,
  subscriptionKey: string,
  callbackHost: string,
): Promise<SandboxCredentials> {
  const apiUser = generateUuidV4();

  await httpClient.post<void>('/v1_0/apiuser', {
    headers: {
      'X-Reference-Id': apiUser,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
    body: { providerCallbackHost: callbackHost },
  });

  const apiKeyResponse = await httpClient.post<{ apiKey: string }>(`/v1_0/apiuser/${apiUser}/apikey`, {
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  });

  return { apiUser, apiKey: apiKeyResponse.apiKey };
}
