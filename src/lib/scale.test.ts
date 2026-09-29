import { describe, expect, it } from 'vitest';
import { byWordsLevel, cefr, esc, median, nToPct, pctToN } from './scale';

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
  it('starts at 12 with no words and follows the square-root curve', () => {
    expect(byWordsLevel(0)).toBe(12);
    expect(byWordsLevel(400)).toBe(35);
    expect(byWordsLevel(1600)).toBe(58);
  });
  it('never exceeds B2 (82), however many words', () => {
    expect(byWordsLevel(5000)).toBe(82);
    expect(byWordsLevel(100000)).toBe(82);
  });
  it('never goes down as the word count grows', () => {
    const counts = [0, 50, 200, 800, 2000, 3500, 5000];
    const levels = counts.map(byWordsLevel);
    expect(levels).toEqual(levels.slice().sort((a, b) => a - b));
  });
});

describe('cefr', () => {
  it.each([
    [0, 'A1'],
    [14, 'A1'],
    [15, 'A2'],
    [29, 'A2'],
    [30, 'A2+'],
    [43, 'A2+'],
    [44, 'B1'],
    [57, 'B1'],
    [58, 'B1+'],
    [71, 'B1+'],
    [72, 'B2'],
    [86, 'B2'],
    [87, 'C1'],
    [100, 'C1'],
  ])('maps a score of %i to %s', (score, label) => {
    expect(cefr(score)).toBe(label);
  });
});

describe('median', () => {
  it('averages the two middle values for an even-length list', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it('picks the middle value for an odd-length list', () => {
    expect(median([5, 1, 3])).toBe(3);
  });
  it('returns 0 for an empty list', () => {
    expect(median([])).toBe(0);
  });
});
