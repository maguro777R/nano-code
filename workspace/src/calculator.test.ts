import { describe, it, expect } from 'vitest';
import calculateOnePlusOne, { add } from './calculator';

describe('src/calculator', () => {
  it('calculateOnePlusOne returns 2', () => {
    expect(calculateOnePlusOne()).toBe(2);
  });

  it('add two positive integers', () => {
    expect(add(3, 4)).toBe(7);
  });

  it('add negative numbers', () => {
    expect(add(-2, -5)).toBe(-7);
  });

  it('add floats', () => {
    expect(add(1.5, 2.25)).toBeCloseTo(3.75);
  });
});
