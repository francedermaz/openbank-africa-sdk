import { OpenBankClient } from '../../src/OpenBankClient';
import { OpenBankError } from '../../src/core/types';

describe('OpenBankClient', () => {
  const baseConfig = {
    adapter: 'mtn-momo' as const,
    callbackHost: 'https://example.com/webhooks',
    environment: 'sandbox' as const,
  };

  it('should throw an OpenBankError with code INVALID_CONFIGURATION for an unsupported adapter', () => {
    // Given / When
    let caught: unknown;
    try {
      new OpenBankClient({
        ...baseConfig,
        adapter: 'unknown-adapter' as unknown as 'mtn-momo',
        products: { collections: { subscriptionKey: 'sub-1' } },
      });
    } catch (error) {
      caught = error;
    }

    // Then
    expect(caught).toBeInstanceOf(OpenBankError);
    expect((caught as OpenBankError).code).toBe('INVALID_CONFIGURATION');
    expect((caught as OpenBankError).message).toBe('Unsupported adapter: unknown-adapter');
  });

  it('should throw INVALID_CONFIGURATION when no product is configured', () => {
    // Given / When
    let caught: unknown;
    try {
      new OpenBankClient({ ...baseConfig, products: {} });
    } catch (error) {
      caught = error;
    }

    // Then
    expect(caught).toBeInstanceOf(OpenBankError);
    expect((caught as OpenBankError).code).toBe('INVALID_CONFIGURATION');
    expect((caught as OpenBankError).message).toMatch(/At least one product must be configured/);
  });

  it('should expose both product namespaces when both products are configured', () => {
    // Given
    const client = new OpenBankClient({
      ...baseConfig,
      products: {
        collections: { subscriptionKey: 'sub-collections' },
        disbursements: { subscriptionKey: 'sub-disbursements' },
      },
    });

    // Then
    expect(client.collections.requestToPay).toBeInstanceOf(Function);
    expect(client.collections.getStatus).toBeInstanceOf(Function);
    expect(client.collections.getBalance).toBeInstanceOf(Function);
    expect(client.disbursements.transfer).toBeInstanceOf(Function);
    expect(client.disbursements.getStatus).toBeInstanceOf(Function);
    expect(client.disbursements.getBalance).toBeInstanceOf(Function);
    expect(client.disbursements.validateAccountHolder).toBeInstanceOf(Function);
  });

  it('should expose the disbursements namespace but reject its calls when only collections is configured', async () => {
    // Given
    const client = new OpenBankClient({
      ...baseConfig,
      products: { collections: { subscriptionKey: 'sub-collections' } },
    });

    // Then: the namespace exists, so callers get a named configuration error
    // rather than "Cannot read property 'transfer' of undefined".
    expect(client.disbursements.transfer).toBeInstanceOf(Function);
    await expect(client.disbursements.getBalance()).rejects.toMatchObject({
      code: 'INVALID_CONFIGURATION',
      message: expect.stringContaining('products.disbursements'),
    });
  });

  it('should expose the collections namespace but reject its calls when only disbursements is configured', async () => {
    // Given
    const client = new OpenBankClient({
      ...baseConfig,
      products: { disbursements: { subscriptionKey: 'sub-disbursements' } },
    });

    // When / Then
    await expect(client.collections.getBalance()).rejects.toMatchObject({
      code: 'INVALID_CONFIGURATION',
      message: expect.stringContaining('products.collections'),
    });
  });
});
