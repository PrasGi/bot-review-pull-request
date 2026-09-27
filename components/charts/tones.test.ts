import { describe, expect, it } from 'vitest';
import { niceMax } from './tones';

describe('niceMax', () => {
  it('returns 1 for empty or negative data so the axis never divides by zero', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
  });

  it('rounds up to 1, 2, 5 or 10 times a power of ten', () => {
    expect(niceMax(0.8)).toBe(1);
    expect(niceMax(1.4)).toBe(2);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(31)).toBe(50);
    expect(niceMax(120)).toBe(200);
  });
});
