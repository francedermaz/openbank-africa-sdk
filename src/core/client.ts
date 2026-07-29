export interface HttpRequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
}

export class HttpClient {
  constructor(private readonly baseUrl: string) {}

  async get<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  async post<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  private async request<T>(method: string, path: string, options: HttpRequestOptions): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new HttpError(response.status, text);
    }

    return (text ? JSON.parse(text) : undefined) as T;
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`HTTP ${status}: ${body}`);
    this.name = 'HttpError';
  }
}
