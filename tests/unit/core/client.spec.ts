import { HttpClient, HttpError } from '../../../src/core/client';

describe('HttpClient', () => {
  const baseUrl = 'https://example.test';
  let client: HttpClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new HttpClient(baseUrl);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('get', () => {
    it('should return parsed JSON when the response is ok', async () => {
      // Given
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ hello: 'world' }),
      });

      // When
      const result = await client.get<{ hello: string }>('/path');

      // Then
      expect(result).toEqual({ hello: 'world' });
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/path`, expect.objectContaining({ method: 'GET' }));
    });

    it('should return undefined when the response body is empty', async () => {
      // Given
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });

      // When
      const result = await client.get('/path');

      // Then
      expect(result).toBeUndefined();
    });

    it('should throw HttpError when the response is not ok', async () => {
      // Given
      fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not Found' });

      // When / Then
      await expect(client.get('/path')).rejects.toThrow(HttpError);
      await expect(client.get('/path')).rejects.toMatchObject({ status: 404, body: 'Not Found' });
    });

    it('should abort and throw HttpError when the request exceeds the timeout', async () => {
      // Given
      jest.useFakeTimers();
      fetchMock.mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        });
      });

      // When
      const pending = client.get('/path', { timeoutMs: 5000 });
      const assertion = expect(pending).rejects.toMatchObject({
        status: 0,
        body: 'Request timed out after 5000ms',
      });
      jest.advanceTimersByTime(5000);

      // Then
      await assertion;
      jest.useRealTimers();
    });
  });

  describe('post', () => {
    it('should send a JSON body and merge custom headers', async () => {
      // Given
      fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => '' });

      // When
      await client.post('/path', { headers: { 'X-Custom': 'value' }, body: { a: 1 } });

      // Then
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/path`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ a: 1 }),
          headers: expect.objectContaining({ 'X-Custom': 'value', 'Content-Type': 'application/json' }),
        }),
      );
    });
  });
});
