import { describe, it, expect } from 'vitest';
import { calculateOnePlusOne, add } from './calculator';

describe('calculator', () => {
  it('adds 1 + 1 to equal 2', () => {
    expect(calculateOnePlusOne()).toBe(2);
  });

  it('add general numbers', () => {
    expect(add(3,4)).toBe(7);
  });
});
