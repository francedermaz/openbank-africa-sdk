import { generateUuidV4 } from '../../../src/core/uuid';

describe('generateUuidV4', () => {
  it('should generate a valid v4 UUID', () => {
    // Given / When
    const uuid = generateUuidV4();

    // Then
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique values across calls', () => {
    // Given / When
    const first = generateUuidV4();
    const second = generateUuidV4();

    // Then
    expect(first).not.toBe(second);
  });
});
