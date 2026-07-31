# OpenBank Africa SDK

> The open-source React Native SDK for African mobile money & open banking APIs.

**First adapter:** MTN Mobile Money (MoMo) API — Rwanda, with an architecture ready to add Airtel Money and banks later.

## Status

✅ **Collections** — Request to Pay, transaction status, balance. Validated end-to-end against the real MTN sandbox.
✅ **Disbursements** — Transfer, transfer status, balance, account-holder validation.

See [`docs/spec.md`](./docs/spec.md) for the full technical spec (architecture, endpoints, types, checklist).

> **Upgrading from 0.2.x?** The config changed shape. Per-product credentials now live under `products.*` because Collections and Disbursements are separate subscriptions in the MoMo portal, each with its own primary key. See [Migrating from 0.2.x](#migrating-from-02x).

## Requirements

- Node.js 18+ (needs global `fetch`), or a React Native runtime with `fetch`/`AbortController` available (0.71+).
- No runtime dependencies — the SDK ships with none, so it doesn't add anything to your dependency tree.

## Installation

```bash
npm install openbank-africa-sdk
```

## Usage

Collections and Disbursements are **separate product subscriptions** in the MoMo portal, each issuing its own primary key. Configure the ones you use — at least one is required.

```typescript
import { OpenBankClient } from 'openbank-africa-sdk';

const client = new OpenBankClient({
  adapter: 'mtn-momo',
  environment: 'sandbox',
  callbackHost: 'https://my-app.com/webhooks/momo',
  products: {
    collections: { subscriptionKey: process.env.MTN_COLLECTIONS_KEY ?? '' },
    disbursements: { subscriptionKey: process.env.MTN_DISBURSEMENTS_KEY ?? '' },
  },
});

await client.authenticate(); // authenticates every configured product
```

### Collections — charge a user

```typescript
const payment = await client.collections.requestToPay({
  amount: 5000,
  currency: 'RWF',
  phoneNumber: '250788123456', // the party being charged
  externalId: 'order-123',
  payerMessage: 'Payment for order #123',
});

const status = await client.collections.getStatus(payment.referenceId);
const balance = await client.collections.getBalance();
```

### Disbursements — pay a user

```typescript
// Check the number is a live MoMo account before sending money to it.
const holder = await client.disbursements.validateAccountHolder('250788123456');
if (!holder.isActive) return;

const payout = await client.disbursements.transfer({
  amount: 5000,
  currency: 'RWF',
  phoneNumber: '250788123456', // the party being paid
  externalId: 'payout-123',
  payeeNote: 'Your payout',
});

const status = await client.disbursements.getStatus(payout.referenceId);
const balance = await client.disbursements.getBalance();
```

`transfer` returns as soon as MTN accepts the request (`202 Accepted`), with `status: 'PENDING'` — poll `getStatus` for the settled outcome. `validateAccountHolder` answers `{ isActive: false }` for a number MTN doesn't know rather than throwing; only real failures (auth, server, timeout) reject.

Calling into a product you didn't configure rejects with `INVALID_CONFIGURATION` naming the missing key, rather than failing on an undefined namespace.

> MTN's sandbox only accepts `EUR` as the currency, regardless of country — use the real local currency (e.g. `RWF`) once you switch to `environment: 'production'`. See [`examples/minimal-app`](./examples/minimal-app) for a runnable end-to-end example against the real sandbox.

## Production

MTN exposes no self-service credential provisioning in production. `apiUser`, `apiKey`, and your production base URL are issued through the MTN Partner Portal after your KYC application is approved — there is no single production base URL, since MTN runs a separate host per market. Credentials are issued **per product**, so each configured product carries its own pair:

```typescript
const client = new OpenBankClient({
  adapter: 'mtn-momo',
  environment: 'production',
  callbackHost: 'https://my-app.com/webhooks/momo', // sandbox provisioning only — see note below
  baseUrl: process.env.MTN_BASE_URL ?? '', // from the MTN Partner Portal
  targetEnvironment: process.env.MTN_TARGET_ENVIRONMENT ?? '', // e.g. 'mtnrwanda' — NOT 'production'
  products: {
    collections: {
      subscriptionKey: process.env.MTN_COLLECTIONS_KEY ?? '',
      apiUser: process.env.MTN_COLLECTIONS_API_USER ?? '',
      apiKey: process.env.MTN_COLLECTIONS_API_KEY ?? '',
    },
    disbursements: {
      subscriptionKey: process.env.MTN_DISBURSEMENTS_KEY ?? '',
      apiUser: process.env.MTN_DISBURSEMENTS_API_USER ?? '',
      apiKey: process.env.MTN_DISBURSEMENTS_API_KEY ?? '',
    },
  },
});
```

`baseUrl` and `targetEnvironment` are shared — the host and wallet platform are the same across your product subscriptions.

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

`code` is one of `SdkErrorCode`: the MTN-documented reasons (`RESOURCE_NOT_FOUND`, `RESOURCE_ALREADY_EXIST`, `APPROVAL_REJECTED`, `EXPIRED`, `PAYER_NOT_FOUND`, `PAYEE_NOT_FOUND`, `NOT_ENOUGH_FUNDS`, `PAYER_LIMIT_REACHED`, `SENDER_ACCOUNT_NOT_ACTIVE`, `NOT_ALLOWED`, `NOT_ALLOWED_TARGET_ENVIRONMENT`, `INVALID_CALLBACK_URL_HOST`, `INVALID_CURRENCY`, `SERVICE_UNAVAILABLE`, `COULD_NOT_PERFORM_TRANSACTION`, `INTERNAL_PROCESSING_ERROR`), plus three SDK-only codes (`INVALID_CONFIGURATION`, `NOT_AUTHENTICATED`, `TIMEOUT`), and `UNKNOWN_ERROR` as a fallback for anything MTN returns that isn't in this list yet.

## Migrating from 0.2.x

Collections and Disbursements are separate subscriptions in the MoMo portal with different primary keys, so a single top-level `subscriptionKey` could not express both. Credentials moved under `products.*`:

```diff
  const client = new OpenBankClient({
    adapter: 'mtn-momo',
    environment: 'sandbox',
    callbackHost: 'https://my-app.com/webhooks/momo',
-   subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY ?? '',
+   products: {
+     collections: { subscriptionKey: process.env.MTN_COLLECTIONS_KEY ?? '' },
+   },
  });
```

In production, `apiUser` and `apiKey` move into the same per-product object; `baseUrl` and `targetEnvironment` stay at the top level. Every call site (`client.collections.*`) is unchanged. The integration-test env var `MTN_SUBSCRIPTION_KEY` is now `MTN_COLLECTIONS_KEY`.

## License

[MIT](./LICENSE)
