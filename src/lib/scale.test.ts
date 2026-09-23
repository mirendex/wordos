import { describe, expect, it } from 'vitest';
import { byWordsLevel, cefr, esc, nToPct, pctToN } from './scale';

describe('esc', () => {
  it('escapes html-significant characters', () => {
    expect(esc('<b>a & "b"</b>')).toBe('&lt;b&gt;a &amp; &quot;b&quot;&lt;/b&gt;');
  });
  it('treats null/undefined as empty string', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('nToPct / pctToN', () => {
  it('round-trips within the 0..5000 range', () => {
    for (const n of [0, 1, 500, 2500, 5000]) {
      expect(Math.round(pctToN(nToPct(n)))).toBe(n);
    }
  });
  it('clamps out-of-range input', () => {
    expect(nToPct(-10)).toBe(0);
    expect(nToPct(999999)).toBe(1);
  });
});

describe('byWordsLevel', () => {
  it('never exceeds B2 (82)', () => {
    expect(byWordsLevel(5000)).toBeLessThanOrEqual(82);
  });
  it('is monotonically non-decreasing', () => {
    expect(byWordsLevel(2000)).toBeGreaterThan(byWordsLevel(200));
  });
});

describe('cefr', () => {
  it('maps score ranges to labels', () => {
    expect(cefr(0)).toBe('A1');
    expect(cefr(50)).toBe('B1');
    expect(cefr(100)).toBe('C1');
  });
});
