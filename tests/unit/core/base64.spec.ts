import { base64Encode } from '../../../src/core/base64';

describe('base64Encode', () => {
  it('should encode a simple ascii string', () => {
    // Given
    const input = 'Hello';

    // When
    const result = base64Encode(input);

    // Then
    expect(result).toBe('SGVsbG8=');
  });

  it('should encode strings whose length is not a multiple of 3', () => {
    // Given
    const input = 'foobar';

    // When
    const result = base64Encode(input);

    // Then
    expect(result).toBe('Zm9vYmFy');
  });

  it('should encode a user:key credential pair', () => {
    // Given
    const input = 'apiUser:apiKey';

    // When
    const result = base64Encode(input);

    // Then
    expect(result).toBe('YXBpVXNlcjphcGlLZXk=');
  });
});
