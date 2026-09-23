export const esc = (s: unknown): string =>
  String(s == null ? '' : s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c as '&' | '<' | '>' | '"'],
  );

// плавная шкала: шаг (слов на пиксель) самый крупный слева и постепенно убывает вправо
export function nToPct(n: number): number {
  n = Math.max(0, Math.min(5000, n));
  return Math.sqrt(n / 5000);
}

export function pctToN(pct: number): number {
  pct = Math.max(0, Math.min(1, pct));
  return 5000 * pct * pct;
}

export function byWordsLevel(words: number): number {
  // знание топ-5000 частотных слов само по себе не тянет выше B2 — C1 сюда не входит
  return Math.max(10, Math.min(82, Math.round(12 + Math.sqrt(words) * 1.15)));
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
