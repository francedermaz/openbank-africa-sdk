import { OpenBankClient } from '../../src';

const subscriptionKey = process.env.MTN_COLLECTIONS_KEY;
const describeIfCredentials = subscriptionKey ? describe : describe.skip;

describeIfCredentials('Collections against the real MTN MoMo sandbox', () => {
  it('should authenticate, request a payment, and read its status', async () => {
    // Given
    const client = new OpenBankClient({
      adapter: 'mtn-momo',
      environment: 'sandbox',
      callbackHost: process.env.MTN_CALLBACK_HOST ?? 'https://example.com/webhooks/momo',
      products: { collections: { subscriptionKey: subscriptionKey as string } },
    });

    // When
    await client.authenticate();
    const payment = await client.collections.requestToPay({
      amount: 5000,
      // MTN's sandbox environment only accepts EUR as the test currency,
      // regardless of the target country — RWF is a production-only value.
      currency: 'EUR',
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
