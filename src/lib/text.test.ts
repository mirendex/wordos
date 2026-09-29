import { describe, expect, it } from 'vitest';
import {
  checkAnswer,
  diffHtml,
  echoScore,
  hasGapSentence,
  lev,
  mask,
  maskPhrase,
  normaliseGap,
  wordDiff,
} from './text';

describe('normaliseGap', () => {
  it('keeps a sentence that already has a ___ gap', () => {
    expect(normaliseGap('Could I get ___, please?', 'the bill')).toBe('Could I get ___, please?');
  });
  it('brings longer underscore runs and [blank] to ___', () => {
    expect(normaliseGap('Could I get _____, please?', 'the bill')).toBe('Could I get ___, please?');
    expect(normaliseGap('Could I get [blank], please?', 'the bill')).toBe('Could I get ___, please?');
  });
  it('cuts the answer out of a sentence that has no gap', () => {
    expect(normaliseGap('Could I get the bill, please?', 'the bill')).toBe('Could I get ___, please?');
    expect(normaliseGap('Where is The Gate?', 'the gate')).toBe('Where is ___?');
  });
  it('gives up when there is no gap and the answer is not in the sentence', () => {
    expect(normaliseGap('Could I get it, please?', 'the bill')).toBeNull();
    expect(normaliseGap('', 'the bill')).toBeNull();
    expect(normaliseGap(undefined, 'the bill')).toBeNull();
  });
  it('leaves one gap and shows any other as the answer', () => {
    expect(normaliseGap('___ and ___ please', 'tea')).toBe('___ and tea please');
  });
});

describe('lev', () => {
  it('is 0 for identical strings', () => {
    expect(lev('hello', 'hello')).toBe(0);
  });
  it('counts a single substitution as 1', () => {
    expect(lev('cat', 'cot')).toBe(1);
  });
  it('treats an adjacent transposition as 1', () => {
    expect(lev('form', 'from')).toBe(1);
  });
  it('bails out early on very different lengths', () => {
    expect(lev('hi', 'a very long different string')).toBe(9);
  });
});

describe('checkAnswer', () => {
  it('accepts an exact match', () => {
    expect(checkAnswer('Hello', 'hello')).toBe('ok');
  });
  it('accepts a single typo', () => {
    expect(checkAnswer('helllo', 'hello')).toBe('typo');
  });
  it('accepts 2 edits only on long enough (7+ letter) words', () => {
    expect(checkAnswer('bicycl', 'bicycle')).toBe('typo');
    expect(checkAnswer('xyz', 'cat')).toBe('no');
  });
  it('rejects an empty answer', () => {
    expect(checkAnswer('', 'hello')).toBe('no');
  });
});

describe('mask', () => {
  it('reveals the first `hint` letters', () => {
    expect(mask('hello', 2)).toBe('h e · · ·');
  });
});

describe('maskPhrase', () => {
  it('keeps word-boundary spaces so a phrase does not look like one word', () => {
    expect(maskPhrase('How often', 0)).toBe('··· ·····');
  });
  it('reveals the first `hint` letters, not counting spaces', () => {
    expect(maskPhrase('How often', 5)).toBe('How of···');
  });
  it('matches plain mask() for a single word', () => {
    expect(maskPhrase('hello', 2).replace(/ /g, '')).toBe(mask('hello', 2).replace(/ /g, ''));
  });
});

describe('wordDiff / diffHtml', () => {
  it('marks unchanged words as equal', () => {
    expect(wordDiff('a b c', 'a b c')).toEqual([
      { t: '=', w: 'a' },
      { t: '=', w: 'b' },
      { t: '=', w: 'c' },
    ]);
  });
  it('marks removed and added words', () => {
    expect(wordDiff('a b', 'a c')).toEqual([
      { t: '=', w: 'a' },
      { t: '-', w: 'b' },
      { t: '+', w: 'c' },
    ]);
  });
  it('renders wrong/right spans', () => {
    expect(diffHtml('a b', 'a c')).toBe('a <span class="wrong">b</span> <span class="right">c</span>');
  });
});

describe('echoScore', () => {
  it('scores a perfect match at 100', () => {
    expect(echoScore('good morning', 'good morning').pct).toBe(100);
  });
  it('gives partial credit for a near-miss word', () => {
    const { pct } = echoScore('good mornin', 'good morning');
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
  it('scores an empty target at 0 with no words', () => {
    expect(echoScore('anything', '')).toEqual({ pct: 0, words: [] });
  });
});

describe('hasGapSentence', () => {
  it('accepts a sentence with a ___ gap', () => {
    expect(hasGapSentence('I need to ___ this by Friday.')).toBe(true);
  });
  it('rejects a stale card whose "sentence" is really just the bare word', () => {
    expect(hasGapSentence('finish')).toBe(false);
  });
  it('rejects missing or non-string values', () => {
    expect(hasGapSentence(undefined)).toBe(false);
    expect(hasGapSentence(null)).toBe(false);
    expect(hasGapSentence(42)).toBe(false);
  });
});
