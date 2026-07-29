export interface HttpRequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultTimeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async get<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  async post<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  private async request<T>(method: string, path: string, options: HttpRequestOptions): Promise<T> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(0, `Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }

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
