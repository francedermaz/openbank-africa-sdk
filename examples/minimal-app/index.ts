import { OpenBankClient } from '../../src';

async function main(): Promise<void> {
  const client = new OpenBankClient({
    adapter: 'mtn-momo',
    environment: 'sandbox',
    callbackHost: process.env.MTN_CALLBACK_HOST ?? 'https://example.com/webhooks/momo',
    // Collections and Disbursements are separate subscriptions in the MoMo
    // portal, each with its own primary key. Configure only what you use.
    products: {
      collections: { subscriptionKey: process.env.MTN_COLLECTIONS_KEY ?? '' },
      disbursements: { subscriptionKey: process.env.MTN_DISBURSEMENTS_KEY ?? '' },
    },
  });

  await client.authenticate();

  // --- Collections: charge a user ---------------------------------------
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
  console.log('Payment status:', await client.collections.getStatus(payment.referenceId));
  console.log('Collections balance:', await client.collections.getBalance());

  // --- Disbursements: pay a user ----------------------------------------
  const recipient = '250788123456';

  // Check the number is a live MoMo account before sending money to it.
  const holder = await client.disbursements.validateAccountHolder(recipient);
  if (!holder.isActive) {
    console.log(`${recipient} is not an active MoMo account — skipping payout`);
    return;
  }

  const payout = await client.disbursements.transfer({
    amount: 1000,
    currency: 'EUR',
    phoneNumber: recipient,
    externalId: `payout-${Date.now()}`,
    payeeNote: 'Your payout',
  });

  console.log('Payout initiated:', payout);
  console.log('Payout status:', await client.disbursements.getStatus(payout.referenceId));
  console.log('Disbursements balance:', await client.disbursements.getBalance());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
