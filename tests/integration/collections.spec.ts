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
