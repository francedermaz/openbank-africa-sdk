describe('toolchain smoke test', () => {
  it('should run TypeScript tests via ts-jest', () => {
    // Given
    const value: number = 1 + 1;

    // Then
    expect(value).toBe(2);
  });
});
