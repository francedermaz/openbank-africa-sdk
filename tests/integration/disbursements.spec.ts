import { OpenBankClient } from '../../src';

const subscriptionKey = process.env.MTN_DISBURSEMENTS_KEY;
const describeIfCredentials = subscriptionKey ? describe : describe.skip;

describeIfCredentials('Disbursements against the real MTN MoMo sandbox', () => {
  let client: OpenBankClient;

  // Provision and authenticate once for the whole suite. Authenticating per
  // test would create a fresh sandbox API user each time, and MTN's
  // provisioning is eventually consistent — a brand-new user's account
  // resource is not queryable immediately, which surfaced as a spurious
  // RESOURCE_NOT_FOUND on the first balance read.
  beforeAll(async () => {
    client = new OpenBankClient({
      adapter: 'mtn-momo',
      environment: 'sandbox',
      callbackHost: process.env.MTN_CALLBACK_HOST ?? 'https://example.com/webhooks/momo',
      products: { disbursements: { subscriptionKey: subscriptionKey as string } },
    });

    await client.authenticate();
  }, 30000);

  // No balance test here, for the same reason as in collections.spec.ts: the
  // endpoint is correct — a direct probe returned 200 { availableBalance:
  // "-25", currency: "EUR" } — but MTN's sandbox answers it unreliably. Four
  // consecutive runs of a byte-identical request produced RESOURCE_NOT_FOUND,
  // INTERNAL_PROCESSING_ERROR, "Authorization failed. Insufficient
  // permissions." and "Access to target environment is forbidden.", with 200s
  // in between. getBalance is fully covered by unit tests.

  it('should report a known sandbox number as an active account holder', async () => {
    // When
    const holder = await client.disbursements.validateAccountHolder('250788123456');

    // Then: MTN answers { result: true } for this number in sandbox. Asserting
    // true (not merely "a boolean") is what makes this test able to fail — an
    // unknown number, or a broken path, answers 404 and maps to false.
    expect(holder.isActive).toBe(true);
  }, 30000);

  // The 404 -> { isActive: false } mapping is covered by unit test only, and
  // deliberately so: MTN's sandbox answers { result: true } for any
  // well-formed MSISDN, so there is no number that produces the 404 this
  // branch exists to handle. Asserting inactivity here fails against a
  // correct SDK.

  it('should transfer to a payee and read the transfer status back', async () => {
    // When
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
