import { describe, expect, it } from 'vitest';
import { fiveMark } from './five';

describe('fiveMark', () => {
  it('marks an exact match as all "y"', () => {
    expect(fiveMark('apple', 'apple')).toEqual(['y', 'y', 'y', 'y', 'y']);
  });
  it('marks letters absent from the word as "n"', () => {
    expect(fiveMark('zzzzz', 'apple')).toEqual(['n', 'n', 'n', 'n', 'n']);
  });
  it('does not double-count a repeated letter beyond its occurrences', () => {
    // word "apple" (a,p,p,l,e); guess "pppax" matches both p's exactly,
    // leaves one spare "a" to mark as misplaced, and no spare "p" left over
    expect(fiveMark('pppax', 'apple')).toEqual(['n', 'y', 'y', 'm', 'n']);
  });
});
