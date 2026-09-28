import { esc } from './scale';

// guards against stale/malformed BANK cards (e.g. saved by an older card schema) whose
// "sentence" never actually had a ___ gap to fill in, so it's really just the bare word
export function hasGapSentence(sentence: unknown): boolean {
  return typeof sentence === 'string' && sentence.indexOf('___') >= 0;
}

export function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return 9;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) {
    d.push([i]);
    for (let j = 1; j <= n; j++) d[i][j] = i === 0 ? j : 0;
  }
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[m][n];
}

export const norm = (s: unknown): string =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z']/g, '');

export type AnswerCheck = 'ok' | 'typo' | 'no';

export function checkAnswer(given: string, word: string): AnswerCheck {
  const a = norm(given);
  const b = norm(word);
  if (!a) return 'no';
  if (a === b) return 'ok';
  const d = lev(a, b);
  if (d === 1 || (d === 2 && b.length >= 7)) return 'typo';
  return 'no';
}

export function mask(word: string, hint: number): string {
  const w = String(word);
  return w
    .split('')
    .map((ch, i) => (i < hint ? ch : '·'))
    .join(' ');
}

// like mask(), but for a gap that can be several words (GOAL's phrase cards) — keeps the
// real spaces between words so a multi-word answer doesn't look like one solid blob of dots
export function maskPhrase(text: string, hint: number): string {
  let seen = 0;
  return String(text)
    .split('')
    .map((ch) => {
      if (ch === ' ') return ' ';
      const out = seen < hint ? ch : '·';
      seen++;
      return out;
    })
    .join('');
}

export interface DiffToken {
  t: '=' | '-' | '+';
  w: string;
}

export function wordDiff(a: string, b: string): DiffToken[] {
  const A = (a || '').trim().split(/\s+/).filter(Boolean);
  const B = (b || '').trim().split(/\s+/).filter(Boolean);
  const key = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
  const n = A.length;
  const m = B.length;
  if (n * m > 250000) return B.map((w) => ({ t: '=', w }));
  const dp: Uint16Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = key(A[i]) === key(B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(A[i]) === key(B[j])) {
      out.push({ t: '=', w: B[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ t: '-', w: A[i] });
      i++;
    } else {
      out.push({ t: '+', w: B[j] });
      j++;
    }
  }
  while (i < n) out.push({ t: '-', w: A[i++] });
  while (j < m) out.push({ t: '+', w: B[j++] });
  return out;
}

export function diffHtml(a: string, b: string): string {
  return wordDiff(a, b)
    .map((x) =>
      x.t === '='
        ? esc(x.w)
        : x.t === '-'
          ? '<span class="wrong">' + esc(x.w) + '</span>'
          : '<span class="right">' + esc(x.w) + '</span>',
    )
    .join(' ');
}

export interface EchoWordScore {
  w: string;
  ok: true | false | 'close';
}

export interface EchoScore {
  pct: number;
  words: EchoWordScore[];
}

export function echoScore(said: string, target: string): EchoScore {
  const norm2 = (s: unknown) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z' ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const a = norm2(said).split(' ').filter(Boolean);
  const b = norm2(target).split(' ').filter(Boolean);
  if (!b.length) return { pct: 0, words: [] };
  const pool = a.slice();
  const words: EchoWordScore[] = b.map((w) => {
    const i = pool.indexOf(w);
    if (i >= 0) {
      pool.splice(i, 1);
      return { w, ok: true };
    }
    const near = pool.findIndex((x) => lev(x, w) <= 1);
    if (near >= 0) {
      pool.splice(near, 1);
      return { w, ok: 'close' };
    }
    return { w, ok: false };
  });
  const hit = words.reduce((s, x) => s + (x.ok === true ? 1 : x.ok === 'close' ? 0.6 : 0), 0);
  return { pct: Math.round((hit / b.length) * 100), words };
}
