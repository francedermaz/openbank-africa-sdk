# OpenBank Africa SDK

> The open-source React Native SDK for African mobile money & open banking APIs.

**First adapter:** MTN Mobile Money (MoMo) API — Rwanda, with an architecture ready to add Airtel Money and banks later.

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

## License

[MIT](./LICENSE)
