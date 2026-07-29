# OpenBank Africa SDK

> The open-source React Native SDK for African mobile money & open banking APIs.

**First adapter:** MTN Mobile Money (MoMo) API — Rwanda, with an architecture ready to add Airtel Money and banks later.

## Status

✅ **v0.1.0** — MVP on MTN MoMo's **Collections** product (Request to Pay, transaction status, balance), validated end-to-end against the real MTN sandbox.

See [`docs/spec.md`](./docs/spec.md) for the full technical spec (architecture, endpoints, types, checklist).

## Requirements

- Node.js 18+ (needs global `fetch`), or a React Native runtime with `fetch`/`AbortController` available (0.71+).
- No runtime dependencies — the SDK ships with none, so it doesn't add anything to your dependency tree.

## Installation

```bash
npm install openbank-africa-sdk
```

## Usage

```typescript
import { OpenBankClient } from 'openbank-africa-sdk';

const client = new OpenBankClient({
  adapter: 'mtn-momo',
  subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY ?? '',
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

> MTN's sandbox only accepts `EUR` as the payment currency, regardless of country — use the real local currency (e.g. `RWF`) once you switch to `environment: 'production'`. See [`examples/minimal-app`](./examples/minimal-app) for a runnable end-to-end example against the real sandbox.

## Production

MTN exposes no self-service credential provisioning in production. `apiUser`, `apiKey`, and your production base URL are issued through the MTN Partner Portal after your KYC application is approved — there is no single production base URL, since MTN runs a separate host per market. Pass everything in explicitly:

```typescript
const client = new OpenBankClient({
  adapter: 'mtn-momo',
  subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY ?? '',
  callbackHost: 'https://my-app.com/webhooks/momo', // sandbox provisioning only — see note below
  environment: 'production',
  baseUrl: process.env.MTN_BASE_URL ?? '', // from the MTN Partner Portal
  apiUser: process.env.MTN_API_USER ?? '', // from the MTN Partner Portal
  apiKey: process.env.MTN_API_KEY ?? '', // from the MTN Partner Portal
  targetEnvironment: process.env.MTN_TARGET_ENVIRONMENT ?? '', // e.g. 'mtnrwanda' — NOT 'production'
});
```

`client.authenticate()` skips auto-provisioning in production and uses these directly. Note `callbackHost` only affects sandbox's auto-provisioning call — in production, your callback host is configured directly on the Partner Portal when you create your API user, so this field has no effect there; it's still required by the type for sandbox's sake.

> ⚠️ Production support has not yet been exercised against a real MTN production tenant — treat it as unverified until someone runs a real transaction through it.

## Error handling

Every failure — from MTN, or from the SDK's own validation — surfaces as an `OpenBankError` with a typed `code`:

```typescript
import { OpenBankError } from 'openbank-africa-sdk';

try {
  await client.collections.requestToPay({ /* ... */ });
} catch (error) {
  if (error instanceof OpenBankError) {
    console.error(error.code, error.message);
  }
}
```

`code` is one of `SdkErrorCode`: the MTN-documented reasons (`RESOURCE_NOT_FOUND`, `RESOURCE_ALREADY_EXIST`, `APPROVAL_REJECTED`, `EXPIRED`, `PAYER_NOT_FOUND`, `PAYEE_NOT_FOUND`, `NOT_ALLOWED`, `NOT_ALLOWED_TARGET_ENVIRONMENT`, `INVALID_CALLBACK_URL_HOST`, `INVALID_CURRENCY`, `SERVICE_UNAVAILABLE`, `COULD_NOT_PERFORM_TRANSACTION`, `INTERNAL_PROCESSING_ERROR`), plus two SDK-only codes for misuse (`INVALID_CONFIGURATION`, `NOT_AUTHENTICATED`), and `UNKNOWN_ERROR` as a fallback for anything MTN returns that isn't in this list yet.

## License

[MIT](./LICENSE)
