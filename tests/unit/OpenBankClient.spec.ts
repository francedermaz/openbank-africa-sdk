import { OpenBankClient } from '../../src/OpenBankClient';

describe('OpenBankClient', () => {
  it('should throw for an unsupported adapter', () => {
    // Given / When / Then
    expect(
      () =>
        new OpenBankClient({
          adapter: 'unknown-adapter' as unknown as 'mtn-momo',
          subscriptionKey: 'sub-1',
          callbackHost: 'https://example.com/webhooks',
          environment: 'sandbox',
        }),
    ).toThrow('Unsupported adapter: unknown-adapter');
  });

  it('should expose a collections namespace backed by the configured adapter', () => {
    // Given
    const client = new OpenBankClient({
      adapter: 'mtn-momo',
      subscriptionKey: 'sub-1',
      callbackHost: 'https://example.com/webhooks',
      environment: 'sandbox',
    });

    // Then
    expect(client.collections.requestToPay).toBeInstanceOf(Function);
    expect(client.collections.getStatus).toBeInstanceOf(Function);
    expect(client.collections.getBalance).toBeInstanceOf(Function);
  });
});
