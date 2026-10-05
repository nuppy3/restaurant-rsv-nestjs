describe('Jestの練習', () => {
  it('1 + 1 は 2 である', () => {
    const result = 1 + 1;
    const expected = 2;
    expect(result).toEqual(expected);
  });

  it('2 * 5 は 10 である', () => {
    const result = 2 * 5;
    const expectedValue = 10;
    expect(expectedValue).toEqual(result);
  });
});
