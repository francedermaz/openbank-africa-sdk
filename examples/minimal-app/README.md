# Minimal example

Runs a full cycle against the real MTN MoMo sandbox: authenticate → Request to Pay → status → balance for **Collections**, then validate account holder → transfer → status → balance for **Disbursements**.

## Prerequisites

1. Register at https://momodeveloper.mtn.com and subscribe to the products you want. **Collections** and **Disbursements** are separate subscriptions, each issuing its own Primary Key.
2. Export them:
   ```bash
   export MTN_COLLECTIONS_KEY=your-collections-primary-key
   export MTN_DISBURSEMENTS_KEY=your-disbursements-primary-key
   export MTN_CALLBACK_HOST=https://example.com/webhooks/momo
   ```

## Run

```bash
npm run example
```

Sandbox user/key provisioning happens automatically on the first `authenticate()` call — once per configured product, since each carries a different subscription key. No manual setup beyond the Primary Keys above.

## Note on currency

MTN's sandbox only accepts `EUR` as the currency, regardless of the target country — this example hardcodes it for that reason. Switch to the real local currency (e.g. `RWF`) once you move to `environment: 'production'`.
