import { OpenBankClient } from '../../src/OpenBankClient';
import { OpenBankError } from '../../src/core/types';

describe('OpenBankClient', () => {
  it('should throw an OpenBankError with code INVALID_CONFIGURATION for an unsupported adapter', () => {
    // Given / When
    let caught: unknown;
    try {
      new OpenBankClient({
        adapter: 'unknown-adapter' as unknown as 'mtn-momo',
        subscriptionKey: 'sub-1',
        callbackHost: 'https://example.com/webhooks',
        environment: 'sandbox',
      });
    } catch (error) {
      caught = error;
    }

    // Then
    expect(caught).toBeInstanceOf(OpenBankError);
    expect((caught as OpenBankError).code).toBe('INVALID_CONFIGURATION');
    expect((caught as OpenBankError).message).toBe('Unsupported adapter: unknown-adapter');
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
