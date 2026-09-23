import { byWordsLevel, esc, median, nToPct } from '../lib/scale';
import { S } from '../core/persist';
import { cover, DEMO, freqInit, FREQ, RANK } from './frequency';
import { masteryWeightedWords, myWords } from './vocab';

export function recalcLevel(): number {
  freqInit();
  // vocabulary-based estimate: weighted by how well each word is actually retained,
  // not just how many words were ever touched
  const byWords = byWordsLevel(masteryWeightedWords());
  const items = ((S.diary && S.diary.items) || [])
    .filter((x: { level: unknown }) => typeof x.level === 'number')
    .slice(-5);
  // median rather than mean: one odd LLM score on a single diary entry shouldn't swing the level
  const byText = items.length ? median(items.map((x: { level: number }) => x.level)) : null;
  const textWeight = 0.45 * Math.min(1, items.length / 5);
  S.level = Math.max(
    0,
    Math.min(100, Math.round(byText == null ? byWords : byWords * (1 - textWeight) + byText * textWeight)),
  );
  return S.level;
}

export function chartSvg(n: number): string {
  freqInit();
  const me = myWords();
  const W = 300;
  const H = 110;
  const pts: [number, number][] = [];
  const MAXY = 90;
  for (let i = 0; i <= 60; i++) {
    const idx = Math.round((i / 60) * FREQ!.length);
    pts.push([nToPct(idx) * W, H - (cover(idx) / MAXY) * H]);
  }
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const x = nToPct(n) * W;
  const y = H - (cover(n) / MAXY) * H;
  const mx = nToPct(Math.min(me, FREQ!.length)) * W;
  const my = H - (cover(me) / MAXY) * H;
  return `<svg viewBox="0 0 ${W} ${H + 16}" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#CFC8B5" stroke-width="1">${[0, 25, 50, 75].map((p) => `<line x1="0" y1="${(H - (p / MAXY) * H).toFixed(1)}" x2="${W}" y2="${(H - (p / MAXY) * H).toFixed(1)}"/>`).join('')}</g>
    <path d="${path} L ${W} ${H} L 0 ${H} Z" fill="#C9CEE8"/>
    <path d="${path}" fill="none" stroke="#39479E" stroke-width="2"/>
    <line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" stroke="#C1432C" stroke-width="2" stroke-dasharray="3 3"/>
    <rect x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6" fill="#C1432C"/>
    ${
      me > 0
        ? `<line x1="${mx.toFixed(1)}" y1="0" x2="${mx.toFixed(1)}" y2="${H}" stroke="#2C6B4A" stroke-width="2"/>
    <rect x="${(mx - 4).toFixed(1)}" y="${(my - 4).toFixed(1)}" width="8" height="8" fill="#2C6B4A"/>
    <rect x="${Math.max(0, Math.min(W - 52, mx - 24)).toFixed(1)}" y="${Math.max(0, my - 22).toFixed(1)}" width="52" height="15" fill="#2C6B4A"/>
    <text x="${Math.max(4, Math.min(W - 48, mx - 20)).toFixed(1)}" y="${Math.max(11, my - 11).toFixed(1)}" font-family="monospace" font-size="10" fill="#fff">ты здесь</text>`
        : ''
    }
    <text x="2" y="${H + 13}" font-family="monospace" font-size="9" fill="#7C7566">0</text>
    <text x="${W - 50}" y="${H + 13}" font-family="monospace" font-size="9" fill="#7C7566">5000 слов</text>
  </svg>`;
}

export function demoHtml(n: number): string {
  freqInit();
  return DEMO.split(' ')
    .map((word) => {
      const c = word.replace(/[^A-Za-z']/g, '').toLowerCase();
      const r = RANK![c] || 99999;
      if (r <= n) return `<i>${esc(word)}</i>`;
      return `<u>${esc(word)}</u>`;
    })
    .join(' ');
}
