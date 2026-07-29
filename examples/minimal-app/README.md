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

## Note on currency

MTN's sandbox only accepts `EUR` as the payment currency, regardless of the target country — this example hardcodes it for that reason. Switch to the real local currency (e.g. `RWF`) once you move to `environment: 'production'`.
