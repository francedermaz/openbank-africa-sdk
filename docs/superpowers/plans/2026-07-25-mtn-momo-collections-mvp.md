# MTN MoMo Collections MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1.0 MVP of the OpenBank Africa SDK — a TypeScript/React Native client that authenticates against MTN MoMo's sandbox, provisions API credentials automatically, and exposes Request to Pay, transaction status, and account balance under the `OpenBankClient` public interface described in `docs/spec.md`.

**Architecture:** Layered as `core` (HTTP client, OAuth2 token manager, shared types, base64/UUID utilities with zero runtime dependencies) → `adapters/mtn-momo` (sandbox provisioning, Collections endpoints, MTN→SDK error/response mappers) → `OpenBankClient` (public facade). Every network-touching function takes its `HttpClient` as a parameter instead of constructing one internally, so unit tests inject a fake client instead of mocking modules or hitting the network.

**Tech Stack:** TypeScript 5, Jest + ts-jest (Given/When/Then unit tests), Node's/React Native's built-in global `fetch` (no HTTP dependency), GitHub Actions CI.

## Global Constraints

(Copied verbatim from `docs/spec.md`.)

- License: MIT (spec §3).
- MVP v1.0 scope is limited to the **Collections** product only: sandbox provisioning, Request to Pay, transaction status, account balance. Disbursements, Remittances, and the Airtel Money adapter are explicitly out of scope for v1.0 (spec §2).
- Sandbox base URL: `https://sandbox.momodeveloper.mtn.com` (spec §4).
- `OpenBankClientConfig.environment` accepts only `'sandbox' | 'production'` (spec §6); this MVP implements sandbox only and throws if `'production'` is passed (spec has no production flow defined yet).
- SDK error codes normalize MTN's own reasons: `RESOURCE_NOT_FOUND`, `APPROVAL_REJECTED`, `EXPIRED`, `PAYER_NOT_FOUND`, `NOT_ALLOWED`, `INTERNAL_PROCESSING_ERROR` (spec §8).
- File/folder structure must match spec §3 exactly: `src/core/`, `src/adapters/mtn-momo/`, `tests/unit/`, `tests/integration/`, `examples/minimal-app/`, `.github/workflows/ci.yml`.
- Integration tests run against the real `sandbox.momodeveloper.mtn.com`, using the automatic provisioning flow (spec §9) — no shared credentials are requested from anyone.

**Out of scope for this plan (spec checklist §10, steps 1–3):** registering at momodeveloper.mtn.com, subscribing to the Collections product for the Primary Key, and manually validating the provisioning flow in Postman. These require a human with an email/phone and cannot be done by an agent. This plan starts at checklist step 4.

---

### Task 1: Project scaffolding & toolchain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `jest.config.js`
- Create: `jest.integration.config.js`
- Create: `.github/workflows/ci.yml`
- Create: `tests/unit/smoke.spec.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `npm test` / `npm run build` toolchain that every later task relies on. `tsconfig.json` sets `"lib": ["ES2020", "DOM"]` so the global `fetch`/`Response` types used in Task 5 resolve without extra dependencies.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "openbank-africa-sdk",
  "version": "0.1.0",
  "description": "The open-source React Native SDK for African mobile money & open banking APIs.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/francedermaz/openbank-africa-sdk.git"
  },
  "keywords": ["react-native", "mobile-money", "mtn-momo", "open-banking", "africa", "fintech"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "lint": "tsc --noEmit",
    "test": "jest",
    "test:integration": "jest --config jest.integration.config.js",
    "example": "ts-node examples/minimal-app/index.ts"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "moduleResolution": "node"
  },
  "include": ["src", "tests", "examples"]
}
```

- [ ] **Step 3: Create `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "include": ["src"],
  "exclude": ["tests", "examples"]
}
```

- [ ] **Step 4: Create `jest.config.js`**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.spec.ts'],
};
```

- [ ] **Step 5: Create `jest.integration.config.js`**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.spec.ts'],
};
```

- [ ] **Step 6: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

- [ ] **Step 7: Create a smoke test to verify the toolchain**

`tests/unit/smoke.spec.ts`:
```typescript
describe('toolchain smoke test', () => {
  it('should run TypeScript tests via ts-jest', () => {
    // Given
    const value: number = 1 + 1;

    // Then
    expect(value).toBe(2);
  });
});
```

- [ ] **Step 8: Install dependencies and run the smoke test**

Run: `npm install && npm test`
Expected: 1 test suite, 1 test, PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json jest.config.js jest.integration.config.js .github/workflows/ci.yml tests/unit/smoke.spec.ts
git commit -m "chore: scaffold TypeScript project, Jest, and CI"
```

---

### Task 2: Core shared types

**Files:**
- Create: `src/core/types.ts`
- Modify: `tests/unit/smoke.spec.ts` (delete — superseded by real tests)

**Interfaces:**
- Consumes: nothing.
- Produces: `PaymentRequest`, `PaymentResult`, `PaymentStatus`, `Balance`, `OpenBankClientConfig`, `SdkErrorCode`, `OpenBankError` — imported by every task from here on.

- [ ] **Step 1: Delete the smoke test**

Run: `rm tests/unit/smoke.spec.ts`

- [ ] **Step 2: Write `src/core/types.ts`**

```typescript
export interface OpenBankClientConfig {
  adapter: 'mtn-momo';
  subscriptionKey: string;
  callbackHost: string;
  environment: 'sandbox' | 'production';
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  phoneNumber: string;
  externalId: string;
  payerMessage?: string;
  payeeNote?: string;
}

export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export interface PaymentResult {
  referenceId: string;
  status: PaymentStatus;
}

export interface Balance {
  availableBalance: number;
  currency: string;
}

export type SdkErrorCode =
  | 'RESOURCE_NOT_FOUND'
  | 'APPROVAL_REJECTED'
  | 'EXPIRED'
  | 'PAYER_NOT_FOUND'
  | 'NOT_ALLOWED'
  | 'INTERNAL_PROCESSING_ERROR'
  | 'UNKNOWN_ERROR';

export class OpenBankError extends Error {
  constructor(
    public readonly code: SdkErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OpenBankError';
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts tests/unit/smoke.spec.ts
git commit -m "feat: add core SDK types and error class"
```

---

### Task 3: Base64 encoding utility

**Files:**
- Create: `src/core/base64.ts`
- Test: `tests/unit/core/base64.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `base64Encode(input: string): string` — used by Task 6 (`auth.ts`) to build the `Authorization: Basic` header without depending on Node's `Buffer` (unavailable in React Native without a polyfill).

- [ ] **Step 1: Write the failing test**

`tests/unit/core/base64.spec.ts`:
```typescript
import { base64Encode } from '../../../src/core/base64';

describe('base64Encode', () => {
  it('should encode a simple ascii string', () => {
    // Given
    const input = 'Hello';

    // When
    const result = base64Encode(input);

    // Then
    expect(result).toBe('SGVsbG8=');
  });

  it('should encode strings whose length is not a multiple of 3', () => {
    // Given
    const input = 'foobar';

    // When
    const result = base64Encode(input);

    // Then
    expect(result).toBe('Zm9vYmFy');
  });

  it('should encode a user:key credential pair', () => {
    // Given
    const input = 'apiUser:apiKey';

    // When
    const result = base64Encode(input);

    // Then
    expect(result).toBe('YXBpVXNlcjphcGlLZXk=');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/core/base64.spec.ts`
Expected: FAIL with "Cannot find module '../../../src/core/base64'".

- [ ] **Step 3: Write `src/core/base64.ts`**

```typescript
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Encode(input: string): string {
  let output = '';
  let i = 0;

  while (i < input.length) {
    const byte1 = input.charCodeAt(i++);
    const byte2 = i < input.length ? input.charCodeAt(i++) : NaN;
    const byte3 = i < input.length ? input.charCodeAt(i++) : NaN;

    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 3) << 4) | (isNaN(byte2) ? 0 : byte2 >> 4);
    const enc3 = isNaN(byte2) ? 64 : ((byte2 & 15) << 2) | (isNaN(byte3) ? 0 : byte3 >> 6);
    const enc4 = isNaN(byte3) ? 64 : byte3 & 63;

    output +=
      BASE64_CHARS.charAt(enc1) +
      BASE64_CHARS.charAt(enc2) +
      (enc3 === 64 ? '=' : BASE64_CHARS.charAt(enc3)) +
      (enc4 === 64 ? '=' : BASE64_CHARS.charAt(enc4));
  }

  return output;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/core/base64.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/base64.ts tests/unit/core/base64.spec.ts
git commit -m "feat: add dependency-free base64 encoder"
```

---

### Task 4: UUID v4 generator

**Files:**
- Create: `src/core/uuid.ts`
- Test: `tests/unit/core/uuid.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `generateUuidV4(): string` — used by Task 7 (`sandbox.ts`, as the `X-Reference-Id` for API user creation) and Task 9 (`collections.ts`, as the `X-Reference-Id` for each Request to Pay call).

- [ ] **Step 1: Write the failing test**

`tests/unit/core/uuid.spec.ts`:
```typescript
import { generateUuidV4 } from '../../../src/core/uuid';

describe('generateUuidV4', () => {
  it('should generate a valid v4 UUID', () => {
    // Given / When
    const uuid = generateUuidV4();

    // Then
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique values across calls', () => {
    // Given / When
    const first = generateUuidV4();
    const second = generateUuidV4();

    // Then
    expect(first).not.toBe(second);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/core/uuid.spec.ts`
Expected: FAIL with "Cannot find module '../../../src/core/uuid'".

- [ ] **Step 3: Write `src/core/uuid.ts`**

```typescript
export function generateUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/core/uuid.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/uuid.ts tests/unit/core/uuid.spec.ts
git commit -m "feat: add UUID v4 generator for reference IDs"
```

---

### Task 5: HTTP client

**Files:**
- Create: `src/core/client.ts`
- Test: `tests/unit/core/client.spec.ts`

**Interfaces:**
- Consumes: nothing (wraps global `fetch`).
- Produces: `class HttpClient` with `get<T>(path, options?): Promise<T>` and `post<T>(path, options?): Promise<T>`, plus `interface HttpRequestOptions { headers?, body? }` and `class HttpError extends Error { status, body }`. Every later task that talks to MTN takes an `HttpClient` (or a `Pick<HttpClient, 'get' | 'post'>` for test doubles) as a parameter.

- [ ] **Step 1: Write the failing test**

`tests/unit/core/client.spec.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/core/client.spec.ts`
Expected: FAIL with "Cannot find module '../../../src/core/client'".

- [ ] **Step 3: Write `src/core/client.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/core/client.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/client.ts tests/unit/core/client.spec.ts
git commit -m "feat: add dependency-free HTTP client wrapping fetch"
```

---

### Task 6: OAuth2 token manager

**Files:**
- Create: `src/core/auth.ts`
- Test: `tests/unit/core/auth.spec.ts`

**Interfaces:**
- Consumes: `HttpClient.post` (Task 5), `base64Encode` (Task 3).
- Produces: `class TokenManager` with `getToken(credentials: AuthCredentials): Promise<string>`, `interface AuthCredentials { apiUser, apiKey, subscriptionKey }`, `interface TokenResponse { access_token, token_type, expires_in }`. Consumed by Task 10 (`MtnMomoAdapter`).

- [ ] **Step 1: Write the failing test**

`tests/unit/core/auth.spec.ts`:
```typescript
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
    httpClient.post.mockResolvedValue({ access_token: 'token-abc', token_type: 'Bearer', expires_in: 1 });
    await tokenManager.getToken(credentials);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);
    httpClient.post.mockResolvedValue({ access_token: 'token-def', token_type: 'Bearer', expires_in: 3600 });

    // When
    const token = await tokenManager.getToken(credentials);

    // Then
    expect(token).toBe('token-def');
    expect(httpClient.post).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/core/auth.spec.ts`
Expected: FAIL with "Cannot find module '../../../src/core/auth'".

- [ ] **Step 3: Write `src/core/auth.ts`**

```typescript
import { base64Encode } from './base64';
import { HttpClient } from './client';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthCredentials {
  apiUser: string;
  apiKey: string;
  subscriptionKey: string;
}

const TOKEN_EXPIRY_BUFFER_MS = 5000;

export class TokenManager {
  private cachedToken: string | null = null;
  private expiresAt = 0;

  constructor(
    private readonly httpClient: Pick<HttpClient, 'post'>,
    private readonly tokenPath: string,
  ) {}

  async getToken(credentials: AuthCredentials): Promise<string> {
    const now = Date.now();

    if (this.cachedToken && now < this.expiresAt) {
      return this.cachedToken;
    }

    const response = await this.httpClient.post<TokenResponse>(this.tokenPath, {
      headers: {
        Authorization: `Basic ${base64Encode(`${credentials.apiUser}:${credentials.apiKey}`)}`,
        'Ocp-Apim-Subscription-Key': credentials.subscriptionKey,
      },
    });

    this.cachedToken = response.access_token;
    this.expiresAt = now + response.expires_in * 1000 - TOKEN_EXPIRY_BUFFER_MS;
    return this.cachedToken;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/core/auth.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/auth.ts tests/unit/core/auth.spec.ts
git commit -m "feat: add OAuth2 token manager with automatic refresh"
```

---

### Task 7: MTN MoMo sandbox provisioning

**Files:**
- Create: `src/adapters/mtn-momo/sandbox.ts`
- Test: `tests/unit/adapters/mtn-momo/sandbox.spec.ts`

**Interfaces:**
- Consumes: `HttpClient.post` (Task 5), `generateUuidV4` (Task 4).
- Produces: `provisionSandboxCredentials(httpClient, subscriptionKey, callbackHost): Promise<SandboxCredentials>`, `interface SandboxCredentials { apiUser, apiKey }`. Consumed by Task 10 (`MtnMomoAdapter.authenticate`).

- [ ] **Step 1: Write the failing test**

`tests/unit/adapters/mtn-momo/sandbox.spec.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/adapters/mtn-momo/sandbox.spec.ts`
Expected: FAIL with "Cannot find module '../../../../src/adapters/mtn-momo/sandbox'".

- [ ] **Step 3: Write `src/adapters/mtn-momo/sandbox.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/adapters/mtn-momo/sandbox.spec.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/mtn-momo/sandbox.ts tests/unit/adapters/mtn-momo/sandbox.spec.ts
git commit -m "feat: add MTN MoMo sandbox user/key provisioning"
```

---

### Task 8: MTN MoMo response and error mappers

**Files:**
- Create: `src/adapters/mtn-momo/mappers.ts`
- Test: `tests/unit/adapters/mtn-momo/mappers.spec.ts`

**Interfaces:**
- Consumes: `PaymentResult`, `PaymentStatus`, `Balance`, `SdkErrorCode`, `OpenBankError` (Task 2).
- Produces: `mapMtnStatusResponse(referenceId, response): PaymentResult`, `mapMtnBalanceResponse(response): Balance`, `mapMtnError(reason, message): OpenBankError`. Consumed by Task 9 (`collections.ts`).

- [ ] **Step 1: Write the failing test**

`tests/unit/adapters/mtn-momo/mappers.spec.ts`:
```typescript
import { mapMtnBalanceResponse, mapMtnError, mapMtnStatusResponse } from '../../../../src/adapters/mtn-momo/mappers';
import { OpenBankError } from '../../../../src/core/types';

describe('mapMtnStatusResponse', () => {
  it('should map a known status through unchanged', () => {
    // Given
    const response = { status: 'SUCCESSFUL' };

    // When
    const result = mapMtnStatusResponse('ref-1', response);

    // Then
    expect(result).toEqual({ referenceId: 'ref-1', status: 'SUCCESSFUL' });
  });

  it('should map an unrecognized status to FAILED', () => {
    // Given
    const response = { status: 'SOMETHING_UNEXPECTED' };

    // When
    const result = mapMtnStatusResponse('ref-2', response);

    // Then
    expect(result).toEqual({ referenceId: 'ref-2', status: 'FAILED' });
  });
});

describe('mapMtnBalanceResponse', () => {
  it('should convert the balance string to a number', () => {
    // Given
    const response = { availableBalance: '12345.67', currency: 'RWF' };

    // When
    const result = mapMtnBalanceResponse(response);

    // Then
    expect(result).toEqual({ availableBalance: 12345.67, currency: 'RWF' });
  });
});

describe('mapMtnError', () => {
  it('should map a known MTN error reason to the matching SDK error code', () => {
    // Given / When
    const error = mapMtnError('PAYER_NOT_FOUND', 'Payer could not be found');

    // Then
    expect(error).toBeInstanceOf(OpenBankError);
    expect(error.code).toBe('PAYER_NOT_FOUND');
    expect(error.message).toBe('Payer could not be found');
  });

  it('should map an unrecognized reason to UNKNOWN_ERROR', () => {
    // Given / When
    const error = mapMtnError('SOMETHING_NEW', 'Unexpected failure');

    // Then
    expect(error.code).toBe('UNKNOWN_ERROR');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/adapters/mtn-momo/mappers.spec.ts`
Expected: FAIL with "Cannot find module '../../../../src/adapters/mtn-momo/mappers'".

- [ ] **Step 3: Write `src/adapters/mtn-momo/mappers.ts`**

```typescript
import { OpenBankError, type Balance, type PaymentResult, type PaymentStatus, type SdkErrorCode } from '../../core/types';

const VALID_STATUSES: readonly PaymentStatus[] = ['PENDING', 'SUCCESSFUL', 'FAILED'];

const MTN_ERROR_CODES: readonly SdkErrorCode[] = [
  'RESOURCE_NOT_FOUND',
  'APPROVAL_REJECTED',
  'EXPIRED',
  'PAYER_NOT_FOUND',
  'NOT_ALLOWED',
  'INTERNAL_PROCESSING_ERROR',
];

export function mapMtnStatusResponse(referenceId: string, response: { status: string }): PaymentResult {
  const status = VALID_STATUSES.includes(response.status as PaymentStatus)
    ? (response.status as PaymentStatus)
    : 'FAILED';

  return { referenceId, status };
}

export function mapMtnBalanceResponse(response: { availableBalance: string; currency: string }): Balance {
  return {
    availableBalance: Number(response.availableBalance),
    currency: response.currency,
  };
}

export function mapMtnError(reason: string, message: string): OpenBankError {
  const code = MTN_ERROR_CODES.includes(reason as SdkErrorCode) ? (reason as SdkErrorCode) : 'UNKNOWN_ERROR';
  return new OpenBankError(code, message);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/adapters/mtn-momo/mappers.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/mtn-momo/mappers.ts tests/unit/adapters/mtn-momo/mappers.spec.ts
git commit -m "feat: add MTN MoMo response and error mappers"
```

---

### Task 9: MTN MoMo Collections operations

**Files:**
- Create: `src/adapters/mtn-momo/collections.ts`
- Test: `tests/unit/adapters/mtn-momo/collections.spec.ts`

**Interfaces:**
- Consumes: `HttpClient` (Task 5), `generateUuidV4` (Task 4), `PaymentRequest`/`PaymentResult`/`Balance` (Task 2), `mapMtnStatusResponse`/`mapMtnBalanceResponse` (Task 8).
- Produces: `interface CollectionsRequestContext { token, subscriptionKey, environment }`, `requestToPay(httpClient, context, payment): Promise<PaymentResult>`, `getStatus(httpClient, context, referenceId): Promise<PaymentResult>`, `getBalance(httpClient, context): Promise<Balance>`. Consumed by Task 10 (`MtnMomoAdapter`).

- [ ] **Step 1: Write the failing test**

`tests/unit/adapters/mtn-momo/collections.spec.ts`:
```typescript
import { getBalance, getStatus, requestToPay } from '../../../../src/adapters/mtn-momo/collections';
import { HttpClient } from '../../../../src/core/client';

describe('collections', () => {
  const context = { token: 'token-abc', subscriptionKey: 'sub-1', environment: 'sandbox' as const };
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/adapters/mtn-momo/collections.spec.ts`
Expected: FAIL with "Cannot find module '../../../../src/adapters/mtn-momo/collections'".

- [ ] **Step 3: Write `src/adapters/mtn-momo/collections.ts`**

```typescript
import { HttpClient } from '../../core/client';
import type { Balance, PaymentRequest, PaymentResult } from '../../core/types';
import { generateUuidV4 } from '../../core/uuid';
import { mapMtnBalanceResponse, mapMtnStatusResponse } from './mappers';

export interface CollectionsRequestContext {
  token: string;
  subscriptionKey: string;
  environment: 'sandbox' | 'production';
}

function buildHeaders(context: CollectionsRequestContext, referenceId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.token}`,
    'X-Target-Environment': context.environment,
    'Ocp-Apim-Subscription-Key': context.subscriptionKey,
  };

  if (referenceId) {
    headers['X-Reference-Id'] = referenceId;
  }

  return headers;
}

export async function requestToPay(
  httpClient: HttpClient,
  context: CollectionsRequestContext,
  payment: PaymentRequest,
): Promise<PaymentResult> {
  const referenceId = generateUuidV4();

  await httpClient.post<void>('/collection/v1_0/requesttopay', {
    headers: buildHeaders(context, referenceId),
    body: {
      amount: String(payment.amount),
      currency: payment.currency,
      externalId: payment.externalId,
      payer: { partyIdType: 'MSISDN', partyId: payment.phoneNumber },
      payerMessage: payment.payerMessage,
      payeeNote: payment.payeeNote,
    },
  });

  return { referenceId, status: 'PENDING' };
}

export async function getStatus(
  httpClient: HttpClient,
  context: CollectionsRequestContext,
  referenceId: string,
): Promise<PaymentResult> {
  const response = await httpClient.get<{ status: string }>(`/collection/v1_0/requesttopay/${referenceId}`, {
    headers: buildHeaders(context),
  });

  return mapMtnStatusResponse(referenceId, response);
}

export async function getBalance(httpClient: HttpClient, context: CollectionsRequestContext): Promise<Balance> {
  const response = await httpClient.get<{ availableBalance: string; currency: string }>(
    '/collection/v1_0/account/balance',
    { headers: buildHeaders(context) },
  );

  return mapMtnBalanceResponse(response);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/adapters/mtn-momo/collections.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/mtn-momo/collections.ts tests/unit/adapters/mtn-momo/collections.spec.ts
git commit -m "feat: add MTN MoMo Collections operations (Request to Pay, status, balance)"
```

---

### Task 10: MTN MoMo adapter + public OpenBankClient

**Files:**
- Create: `src/adapters/mtn-momo/index.ts`
- Create: `src/OpenBankClient.ts`
- Create: `src/index.ts`
- Test: `tests/unit/adapters/mtn-momo/index.spec.ts`
- Test: `tests/unit/OpenBankClient.spec.ts`

**Interfaces:**
- Consumes: `HttpClient` (Task 5), `TokenManager` (Task 6), `provisionSandboxCredentials` (Task 7), `requestToPay`/`getStatus`/`getBalance`/`CollectionsRequestContext` (Task 9), `OpenBankClientConfig` (Task 2).
- Produces: `class MtnMomoAdapter` (constructor takes `MtnMomoAdapterConfig` and an injectable `HttpClient`), `class OpenBankClient` matching spec §6's public interface, and the package's public `src/index.ts` barrel export.

- [ ] **Step 1: Write the failing test for the adapter**

`tests/unit/adapters/mtn-momo/index.spec.ts`:
```typescript
import { MtnMomoAdapter } from '../../../../src/adapters/mtn-momo';
import { HttpClient } from '../../../../src/core/client';

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

  it('should throw when constructed with a non-sandbox environment', () => {
    // Given / When / Then
    expect(() => new MtnMomoAdapter({ ...config, environment: 'production' })).toThrow(
      'Only the sandbox environment is supported in v1.0',
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

  it('should throw when using the adapter before authenticate', async () => {
    // Given
    const httpClient = createFakeHttpClient();
    const adapter = new MtnMomoAdapter(config, httpClient as unknown as HttpClient);

    // When / Then
    await expect(adapter.getBalance()).rejects.toThrow('Call authenticate() before using the adapter');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/adapters/mtn-momo/index.spec.ts`
Expected: FAIL with "Cannot find module '../../../../src/adapters/mtn-momo'".

- [ ] **Step 3: Write `src/adapters/mtn-momo/index.ts`**

```typescript
import { TokenManager } from '../../core/auth';
import { HttpClient } from '../../core/client';
import type { Balance, PaymentRequest, PaymentResult } from '../../core/types';
import type { CollectionsRequestContext } from './collections';
import { getBalance, getStatus, requestToPay } from './collections';
import { provisionSandboxCredentials, type SandboxCredentials } from './sandbox';

const SANDBOX_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

export interface MtnMomoAdapterConfig {
  subscriptionKey: string;
  callbackHost: string;
  environment: 'sandbox' | 'production';
}

export class MtnMomoAdapter {
  private readonly tokenManager: TokenManager;
  private credentials: SandboxCredentials | null = null;

  constructor(
    private readonly config: MtnMomoAdapterConfig,
    private readonly httpClient: HttpClient = new HttpClient(SANDBOX_BASE_URL),
  ) {
    if (config.environment !== 'sandbox') {
      throw new Error('Only the sandbox environment is supported in v1.0');
    }

    this.tokenManager = new TokenManager(this.httpClient, '/collection/token/');
  }

  async authenticate(): Promise<void> {
    if (!this.credentials) {
      this.credentials = await provisionSandboxCredentials(
        this.httpClient,
        this.config.subscriptionKey,
        this.config.callbackHost,
      );
    }

    await this.tokenManager.getToken({
      apiUser: this.credentials.apiUser,
      apiKey: this.credentials.apiKey,
      subscriptionKey: this.config.subscriptionKey,
    });
  }

  async requestToPay(payment: PaymentRequest): Promise<PaymentResult> {
    return requestToPay(this.httpClient, await this.buildContext(), payment);
  }

  async getStatus(referenceId: string): Promise<PaymentResult> {
    return getStatus(this.httpClient, await this.buildContext(), referenceId);
  }

  async getBalance(): Promise<Balance> {
    return getBalance(this.httpClient, await this.buildContext());
  }

  private async buildContext(): Promise<CollectionsRequestContext> {
    if (!this.credentials) {
      throw new Error('Call authenticate() before using the adapter');
    }

    const token = await this.tokenManager.getToken({
      apiUser: this.credentials.apiUser,
      apiKey: this.credentials.apiKey,
      subscriptionKey: this.config.subscriptionKey,
    });

    return { token, subscriptionKey: this.config.subscriptionKey, environment: this.config.environment };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/adapters/mtn-momo/index.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing test for OpenBankClient**

`tests/unit/OpenBankClient.spec.ts`:
```typescript
import { OpenBankClient } from '../../src/OpenBankClient';

describe('OpenBankClient', () => {
  it('should throw for an unsupported adapter', () => {
    // Given / When / Then
    expect(
      () =>
        new OpenBankClient({
          adapter: 'unknown-adapter' as unknown as 'mtn-momo',
          subscriptionKey: 'sub-1',
          callbackHost: 'https://example.com/webhooks',
          environment: 'sandbox',
        }),
    ).toThrow('Unsupported adapter: unknown-adapter');
  });

  it('should expose a collections namespace backed by the configured adapter', () => {
    // Given
    const client = new OpenBankClient({
      adapter: 'mtn-momo',
      subscriptionKey: 'sub-1',
      callbackHost: 'https://example.com/webhooks',
      environment: 'sandbox',
    });

    // Then
    expect(client.collections.requestToPay).toBeInstanceOf(Function);
    expect(client.collections.getStatus).toBeInstanceOf(Function);
    expect(client.collections.getBalance).toBeInstanceOf(Function);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/unit/OpenBankClient.spec.ts`
Expected: FAIL with "Cannot find module '../../src/OpenBankClient'".

- [ ] **Step 7: Write `src/OpenBankClient.ts`**

```typescript
import { MtnMomoAdapter } from './adapters/mtn-momo';
import type { Balance, OpenBankClientConfig, PaymentRequest, PaymentResult } from './core/types';

export type { OpenBankClientConfig };

export class OpenBankClient {
  private readonly adapter: MtnMomoAdapter;

  readonly collections: {
    requestToPay: (payment: PaymentRequest) => Promise<PaymentResult>;
    getStatus: (referenceId: string) => Promise<PaymentResult>;
    getBalance: () => Promise<Balance>;
  };

  constructor(config: OpenBankClientConfig) {
    if (config.adapter !== 'mtn-momo') {
      throw new Error(`Unsupported adapter: ${config.adapter}`);
    }

    this.adapter = new MtnMomoAdapter({
      subscriptionKey: config.subscriptionKey,
      callbackHost: config.callbackHost,
      environment: config.environment,
    });

    this.collections = {
      requestToPay: (payment) => this.adapter.requestToPay(payment),
      getStatus: (referenceId) => this.adapter.getStatus(referenceId),
      getBalance: () => this.adapter.getBalance(),
    };
  }

  async authenticate(): Promise<void> {
    await this.adapter.authenticate();
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/unit/OpenBankClient.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 9: Write the public barrel export `src/index.ts`**

```typescript
export { OpenBankClient } from './OpenBankClient';
export type { OpenBankClientConfig } from './OpenBankClient';
export { OpenBankError } from './core/types';
export type { Balance, PaymentRequest, PaymentResult, PaymentStatus, SdkErrorCode } from './core/types';
```

- [ ] **Step 10: Run the full unit suite and build**

Run: `npm test && npm run build`
Expected: all unit tests PASS, `dist/` generated with no type errors.

- [ ] **Step 11: Commit**

```bash
git add src/adapters/mtn-momo/index.ts src/OpenBankClient.ts src/index.ts tests/unit/adapters/mtn-momo/index.spec.ts tests/unit/OpenBankClient.spec.ts
git commit -m "feat: add MtnMomoAdapter and public OpenBankClient interface"
```

---

### Task 11: Minimal example app, integration test harness, changelog

**Files:**
- Create: `examples/minimal-app/index.ts`
- Create: `examples/minimal-app/README.md`
- Create: `tests/integration/collections.spec.ts`
- Create: `CHANGELOG.md`
- Modify: `README.md` (point at the real usage example)

**Interfaces:**
- Consumes: `OpenBankClient` (Task 10).
- Produces: nothing new consumed by other tasks — this is the final integration/documentation task.

- [ ] **Step 1: Write `examples/minimal-app/index.ts`**

```typescript
import { OpenBankClient } from '../../src';

async function main(): Promise<void> {
  const client = new OpenBankClient({
    adapter: 'mtn-momo',
    subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY ?? '',
    callbackHost: process.env.MTN_CALLBACK_HOST ?? 'https://example.com/webhooks/momo',
    environment: 'sandbox',
  });

  await client.authenticate();

  const payment = await client.collections.requestToPay({
    amount: 5000,
    currency: 'RWF',
    phoneNumber: '250788123456',
    externalId: `order-${Date.now()}`,
    payerMessage: 'Payment for order',
  });

  console.log('Payment initiated:', payment);

  const status = await client.collections.getStatus(payment.referenceId);
  console.log('Status:', status);

  const balance = await client.collections.getBalance();
  console.log('Balance:', balance);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Write `examples/minimal-app/README.md`**

```markdown
# Minimal example

Runs a full authenticate → Request to Pay → status → balance cycle against the real MTN MoMo sandbox.

## Prerequisites

1. Register at https://momodeveloper.mtn.com and subscribe to the **Collections** product to get a Primary Key.
2. Export it:
   ```bash
   export MTN_SUBSCRIPTION_KEY=your-primary-key
   export MTN_CALLBACK_HOST=https://example.com/webhooks/momo
   ```

## Run

```bash
npm run example
```

Sandbox user/key provisioning happens automatically on first `authenticate()` call — no manual setup beyond the Primary Key above.
```

- [ ] **Step 3: Write `tests/integration/collections.spec.ts`**

```typescript
import { OpenBankClient } from '../../src';

const subscriptionKey = process.env.MTN_SUBSCRIPTION_KEY;
const describeIfCredentials = subscriptionKey ? describe : describe.skip;

describeIfCredentials('OpenBankClient against the real MTN MoMo sandbox', () => {
  it('should authenticate, request a payment, and read its status', async () => {
    // Given
    const client = new OpenBankClient({
      adapter: 'mtn-momo',
      subscriptionKey: subscriptionKey as string,
      callbackHost: process.env.MTN_CALLBACK_HOST ?? 'https://example.com/webhooks/momo',
      environment: 'sandbox',
    });

    // When
    await client.authenticate();
    const payment = await client.collections.requestToPay({
      amount: 5000,
      currency: 'RWF',
      phoneNumber: '250788123456',
      externalId: `order-${Date.now()}`,
      payerMessage: 'Integration test payment',
    });
    const status = await client.collections.getStatus(payment.referenceId);

    // Then
    expect(payment.referenceId).toBeDefined();
    expect(['PENDING', 'SUCCESSFUL', 'FAILED']).toContain(status.status);
  }, 30000);
});
```

- [ ] **Step 4: Run the integration suite (expected to skip without credentials)**

Run: `npm run test:integration`
Expected: 1 suite skipped (no `MTN_SUBSCRIPTION_KEY` set yet — this is correct until checklist steps 1–3 are done manually).

- [ ] **Step 5: Write `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added
- Initial MVP scaffold: TypeScript project setup, Jest testing, CI workflow.
- Core HTTP client, OAuth2 token manager, base64 and UUID utilities.
- MTN MoMo adapter: sandbox provisioning, Request to Pay, transaction status, account balance.
- Public `OpenBankClient` interface with a `mtn-momo` adapter.
- Minimal example app and integration test harness (requires real MTN sandbox credentials).
```

- [ ] **Step 6: Update `README.md` usage section**

Replace the "Status" section content with:
```markdown
## Status

🚧 In development — MVP v1.0 on MTN MoMo's **Collections** product (Request to Pay, transaction status, balance).

See [`docs/spec.md`](./docs/spec.md) for the full technical spec (architecture, endpoints, types, checklist).

## Usage

```typescript
import { OpenBankClient } from 'openbank-africa-sdk';

const client = new OpenBankClient({
  adapter: 'mtn-momo',
  subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY,
  callbackHost: 'https://my-app.com/webhooks/momo',
  environment: 'sandbox',
});

await client.authenticate();

const payment = await client.collections.requestToPay({
  amount: 5000,
  currency: 'RWF',
  phoneNumber: '250788123456',
  externalId: 'order-123',
  payerMessage: 'Payment for order #123',
});

const status = await client.collections.getStatus(payment.referenceId);
const balance = await client.collections.getBalance();
```

See [`examples/minimal-app`](./examples/minimal-app) for a runnable end-to-end example against the real sandbox.
```
```

- [ ] **Step 7: Run the full suite one more time**

Run: `npm run lint && npm run build && npm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add examples CHANGELOG.md README.md tests/integration/collections.spec.ts
git commit -m "docs: add minimal example, integration test harness, and changelog"
```

---

## After this plan

Per spec checklist §10, steps 1–3 (MTN developer registration, Collections subscription, manual Postman validation) still need to happen manually before `npm run test:integration` or `npm run example` will do anything beyond skip/fail. Step 8 (public v0.1 release) is a follow-up once you're happy with the API surface — tag `v0.1.0` and `npm publish` (or hold off until Airtel/phase 2 per §10.9 if you'd rather ship both adapters together).
