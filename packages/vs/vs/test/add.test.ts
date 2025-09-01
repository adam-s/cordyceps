import { describe, assert, expect, test, afterEach } from 'vitest';

describe('add function', () => {
  // test('add function should return the sum of two numbers', () => {
  //   const result = add(2, 3);
  //   assert.equal(result, 5);
  //   expect(result).toBe(5);
  // });
  test('fails', () => {
    const result = add(2, 3);
    assert.equal(result, 5);
  });
});

function add(a: number, b: number): number {
  return a + b;
}
