import { esc } from '../../lib/scale';
import { paint } from '../../core/paint';
import { S, save } from '../../core/persist';
import { ask } from '../../services/llm';
import { haptic } from '../../platform/haptics';
import { recalcLevel } from '../../domain/progress';
import { gamePool, pairsSource } from './sources';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hangState(): any {
  if (!S.hang || typeof S.hang !== 'object')
    S.hang = { word: '', used: '', left: 7, won: 0, lost: 0, msg: '', ru: '' };
  if (typeof S.hang.used !== 'string') S.hang.used = '';
  return S.hang;
}

export function hangNew(): void {
  const g = hangState();
  const prev = g.word;
  let src = pairsSource().filter((x) => /^[a-z]{4,9}$/.test(String(x.en).toLowerCase()));
  if (src.length) {
    if (src.length > 1) src = src.filter((x) => String(x.en).toLowerCase() !== prev);
    const p = src[Math.floor(Math.random() * src.length)];
    g.word = String(p.en).toLowerCase();
    g.ru = p.ru;
    g.noSrc = false;
  } else {
    let pool = gamePool(4, 9);
    if (pool.length > 1) pool = pool.filter((w) => w !== prev);
    g.word = pool[Math.floor(Math.random() * pool.length)] || 'level';
    g.ru = '';
    g.noSrc = true;
  }
  g.used = '';
  g.left = 7;
  g.msg = '';
  save();
}

export function hangGuess(c: string): void {
  const g = hangState();
  if (g.msg || g.used.indexOf(c) >= 0) return;
  g.used += c;
  if (g.word.indexOf(c) < 0) g.left--;
  const all = g.word.split('').every((ch: string) => g.used.indexOf(ch) >= 0);
  if (all) {
    g.won++;
    g.msg = 'Слово целиком: ' + g.word.toUpperCase();
    if (!S.words.find((x: { en: string }) => x.en === g.word)) S.words.push({ en: g.word, ru: '' });
    setTimeout(recalcLevel, 0);
  } else if (g.left <= 0) {
    haptic('no');
    g.lost++;
    g.msg = 'Не хватило попыток. Слово: ' + g.word.toUpperCase();
  }
  save();
  paint();
}

const GALLOWS = [
  '  ______\n  |    |\n  |\n  |\n  |\n__|__',
  '  ______\n  |    |\n  |    O\n  |\n  |\n__|__',
  '  ______\n  |    |\n  |    O\n  |    |\n  |\n__|__',
  '  ______\n  |    |\n  |    O\n  |   /|\n  |\n__|__',
  '  ______\n  |    |\n  |    O\n  |   /|\\\n  |\n__|__',
  '  ______\n  |    |\n  |    O\n  |   /|\\\n  |   /\n__|__',
  '  ______\n  |    |\n  |    O\n  |   /|\\\n  |   / \\\n__|__',
];

export function hangView(): string {
  const g = hangState();
  if (!g.word) hangNew();
  const shown = g.word
    .split('')
    .map((c: string) => (g.used.indexOf(c) >= 0 ? c.toUpperCase() : '_'))
    .join(' ');
  const art = GALLOWS[Math.max(0, Math.min(6, 7 - g.left))];
  return `<div class="rowsplit"><h3 class="h">Виселица</h3>
      <span class="sub">${g.won} · ${g.lost}</span></div>
    ${
      g.noSrc
        ? `<p class="sub">Пока нет слов с переводом, загадано слово из твоего диапазона.</p>`
        : `<div class="hask"><span>переведи и собери по буквам</span><b>${esc(g.ru || '')}</b></div>`
    }
    <div class="hrow">
      <pre class="gallows">${esc(art)}</pre>
      <div class="hinfo"><div class="hlives">${'<i></i>'.repeat(Math.max(0, g.left))}${'<i class="off"></i>'.repeat(7 - Math.max(0, g.left))}</div>
        <span class="sub">осталось ошибок: ${Math.max(0, g.left)}</span></div>
    </div>
    <div class="hword">${esc(shown)}</div>
    ${
      g.msg
        ? `<div class="note"><div class="l">${esc(g.msg)}${g.ru ? '<p>' + esc(g.ru) + '</p>' : ''}</div>
      <div class="rowb"><button class="btn sm" data-speak="${esc(g.word)}">звук</button>
        ${g.ru ? '' : '<button class="btn sm" data-hru="1">перевод</button>'}
        <button class="btn p sm" data-hnew="1">новое слово</button></div></div>`
        : `<div class="kb">${['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
            .map(
              (row) => `<div class="krow">
      ${row
        .split('')
        .map(
          (c) =>
            `<button class="key ${g.used.indexOf(c) >= 0 ? (g.word.indexOf(c) >= 0 ? 'y' : 'n') : ''}" data-hkey="${c}">${c.toUpperCase()}</button>`,
        )
        .join('')}
    </div>`,
            )
            .join('')}</div>`
    }`;
}

export async function hangRu(): Promise<void> {
  const g = hangState();
  if (g.ru) return;
  g.ru = '...';
  paint();
  try {
    const r = await ask(`Слово "${g.word}".
Формат ответа:
{"ru":"перевод одним-двумя словами"}`);
    g.ru = r.ru || '';
  } catch {
    g.ru = 'перевод не пришёл';
  }
  save();
  paint();
}
