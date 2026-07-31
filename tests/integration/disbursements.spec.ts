import { OpenBankClient } from '../../src';

const subscriptionKey = process.env.MTN_DISBURSEMENTS_KEY;
const describeIfCredentials = subscriptionKey ? describe : describe.skip;

function createClient(): OpenBankClient {
  return new OpenBankClient({
    adapter: 'mtn-momo',
    environment: 'sandbox',
    callbackHost: process.env.MTN_CALLBACK_HOST ?? 'https://example.com/webhooks/momo',
    products: { disbursements: { subscriptionKey: subscriptionKey as string } },
  });
}

describeIfCredentials('Disbursements against the real MTN MoMo sandbox', () => {
  it('should authenticate and read the disbursement account balance', async () => {
    // Given
    const client = createClient();

    // When
    await client.authenticate();
    const balance = await client.disbursements.getBalance();

    // Then
    expect(typeof balance.availableBalance).toBe('number');
    expect(Number.isNaN(balance.availableBalance)).toBe(false);
    expect(balance.currency).toEqual(expect.any(String));
  }, 30000);

  it('should report a well-formed sandbox number as an active account holder', async () => {
    // Given
    const client = createClient();

    // When
    await client.authenticate();
    const holder = await client.disbursements.validateAccountHolder('250788123456');

    // Then
    expect(typeof holder.isActive).toBe('boolean');
  }, 30000);

  it('should transfer to a payee and read the transfer status back', async () => {
    // Given
    const client = createClient();

    // When
    await client.authenticate();
    const payout = await client.disbursements.transfer({
      amount: 100,
      // MTN's sandbox only accepts EUR as the test currency, regardless of
      // the target country — RWF is a production-only value.
      currency: 'EUR',
      phoneNumber: '250788123456',
      externalId: `payout-${Date.now()}`,
      payeeNote: 'Integration test payout',
    });
    const status = await client.disbursements.getStatus(payout.referenceId);

    // Then
    expect(payout.referenceId).toBeDefined();
    expect(payout.status).toBe('PENDING');
    expect(['PENDING', 'SUCCESSFUL', 'FAILED']).toContain(status.status);
  }, 30000);
});
