import { describe, expect, it } from 'vitest';
import { isNewer, parseVersion } from './version';

describe('parseVersion', () => {
  it('reads a tag with a leading v', () => {
    expect(parseVersion('v1.5.0')).toEqual([1, 5, 0]);
  });
  it('fills missing parts with zeros', () => {
    expect(parseVersion('1.4')).toEqual([1, 4, 0]);
    expect(parseVersion('')).toEqual([0, 0, 0]);
  });
  it('ignores a pre-release or build suffix', () => {
    expect(parseVersion('2.0.1-beta.3')).toEqual([2, 0, 1]);
  });
});

describe('isNewer', () => {
  it('compares parts as numbers, not strings', () => {
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('1.9.0', '1.10.0')).toBe(false);
  });
  it('is false for the same version, with or without a v', () => {
    expect(isNewer('v1.4.0', '1.4.0')).toBe(false);
    expect(isNewer('1.4', '1.4.0')).toBe(false);
  });
  it('sees patch and major bumps', () => {
    expect(isNewer('v1.4.1', '1.4.0')).toBe(true);
    expect(isNewer('2.0.0', '1.99.99')).toBe(true);
  });
});
