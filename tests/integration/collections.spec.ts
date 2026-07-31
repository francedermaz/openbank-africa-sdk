import { OpenBankClient } from '../../src';

const subscriptionKey = process.env.MTN_COLLECTIONS_KEY;
const describeIfCredentials = subscriptionKey ? describe : describe.skip;

describeIfCredentials('Collections against the real MTN MoMo sandbox', () => {
  let client: OpenBankClient;

  // Provision and authenticate once — see the note in disbursements.spec.ts
  // on MTN's eventually-consistent sandbox provisioning.
  beforeAll(async () => {
    client = new OpenBankClient({
      adapter: 'mtn-momo',
      environment: 'sandbox',
      callbackHost: process.env.MTN_CALLBACK_HOST ?? 'https://example.com/webhooks/momo',
      products: { collections: { subscriptionKey: subscriptionKey as string } },
    });

    await client.authenticate();
  }, 30000);

  it('should request a payment and read its status', async () => {
    // When
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

  // No balance test here on purpose. The endpoint works — a direct probe
  // returned 200 { availableBalance, currency } — but MTN's sandbox answers
  // it intermittently, returning INTERNAL_PROCESSING_ERROR on one run and
  // "Authorization failed. Insufficient permissions." on the next for a
  // byte-identical request. A test that red-flags half the time for reasons
  // outside this SDK trains you to ignore red. getBalance is fully covered by
  // unit tests.
});
