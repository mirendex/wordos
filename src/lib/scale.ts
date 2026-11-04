export const esc = (s: unknown): string =>
  String(s == null ? '' : s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c as '&' | '<' | '>' | '"'],
  );

// the words in the frequency dictionary, and so the end of the scales that go by them
export const MAX_WORDS = 10000;

// the words the scales are marked at, and how a mark is written
export const SCALE_MARKS = [0, 500, 1000, 2500, 5000, 7500, 10000];
export const markText = (n: number): string => (n >= 1000 ? n / 1000 + 'k' : String(n));

// smooth scale: the step (words per pixel) is largest on the left and shrinks going right
export function nToPct(n: number): number {
  n = Math.max(0, Math.min(MAX_WORDS, n));
  return Math.sqrt(n / MAX_WORDS);
}

export function pctToN(pct: number): number {
  pct = Math.max(0, Math.min(1, pct));
  return MAX_WORDS * pct * pct;
}

// The level a number of well-known words stands for: a square-root curve up to B2 (82) at 3700
// words, which is as far as the first 5000 words took it, and from there a slow line on to C1 (92) at
// 9000, as the words beyond them are what separates a good reader from a very good one
export function byWordsLevel(words: number): number {
  const plain = 12 + Math.sqrt(words) * 1.15;
  const level = plain <= 82 ? plain : 82 + ((words - 3700) / (9000 - 3700)) * 10;
  return Math.max(10, Math.min(92, Math.round(level)));
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const cefr = (v: number): string =>
  v < 15 ? 'A1' : v < 30 ? 'A2' : v < 44 ? 'A2+' : v < 58 ? 'B1' : v < 72 ? 'B1+' : v < 87 ? 'B2' : 'C1';

export const tone = (v: number): string =>
  v < 30
    ? 'самые простые слова, короткие фразы без сложной грамматики'
    : v < 44
      ? 'короткие простые предложения, базовая лексика'
      : v < 58
        ? 'обычная рабочая переписка, средняя длина'
        : v < 72
          ? 'живой английский носителя, фразовые глаголы и идиомы'
          : 'быстрый носительский английский, сложные конструкции';
