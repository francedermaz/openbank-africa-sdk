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
    // MTN's sandbox environment only accepts EUR as the test currency,
    // regardless of the target country — use the real local currency
    // (e.g. RWF) once you switch environment to 'production'.
    currency: 'EUR',
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
