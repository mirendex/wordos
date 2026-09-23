import { esc } from '../../lib/scale';
import { fiveMark } from '../../lib/five';
import { paint } from '../../core/paint';
import { BANK, S, save } from '../../core/persist';
import { ask } from '../../services/llm';
import { fetchFreeTranslation } from '../../services/translate';
import { haptic } from '../../platform/haptics';
import { freqInit, FREQ } from '../../domain/frequency';
import { recalcLevel } from '../../domain/progress';
import { wordLimit } from './sources';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fiveState(): any {
  if (!S.five || typeof S.five !== 'object')
    S.five = { word: '', rows: [], cur: '', done: 0, streak: 0, best: 0, played: 0, won: 0, msg: '', ru: '' };
  return S.five;
}

export function fivePool(): string[] {
  freqInit();
  const top = Math.max(900, wordLimit());
  const p = FREQ!
    .slice(0, top)
    .map((x) => x.w)
    .filter((w) => /^[a-z]{5}$/.test(w));
  return p.length > 40
    ? p
    : FREQ!
        .slice(0, 2500)
        .map((x) => x.w)
        .filter((w) => /^[a-z]{5}$/.test(w));
}

export function fiveNew(): void {
  const g = fiveState();
  let pool = fivePool();
  if (pool.length > 1) pool = pool.filter((w) => w !== g.word);
  g.word = pool[Math.floor(Math.random() * pool.length)];
  g.rows = [];
  g.cur = '';
  g.done = 0;
  g.msg = '';
  g.ru = '';
  save();
}

function fiveKeyState(): Record<string, string> {
  const g = fiveState();
  const st: Record<string, string> = {};
  g.rows.forEach((r: { g: string; m: string }) => {
    for (let i = 0; i < 5; i++) {
      const c = r.g[i];
      const m = r.m[i];
      if (m === 'y' || (st[c] !== 'y' && m === 'm' && st[c] !== 'y'))
        st[c] = m === 'y' ? 'y' : st[c] === 'y' ? 'y' : m;
      if (!st[c]) st[c] = m;
    }
  });
  return st;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fiveShowAnswer(g: any): void {
  const w = g.word;
  g.msg = 'Слово было: ' + w.toUpperCase();
  const cached = BANK[w] && BANK[w][0] && BANK[w][0].word_ru;
  if (cached) {
    g.msg += ' — ' + cached;
  } else
    fetchFreeTranslation(w).then((t) => {
      if (!t) return;
      const g2 = fiveState();
      if (g2.word === w && g2.msg.indexOf('—') < 0) {
        g2.msg += ' — ' + t;
        save();
        paint();
      }
    });
}

export function fiveGiveUp(): void {
  const g = fiveState();
  if (g.done) return;
  g.done = 1;
  g.played++;
  g.streak = 0;
  g.cur = '';
  fiveShowAnswer(g);
  haptic('no');
  save();
  paint();
}

export async function fiveReveal(): Promise<void> {
  const g = fiveState();
  if (g.ru) return;
  g.ru = '...';
  paint();
  try {
    const r = await ask(`Слово "${g.word}".
Формат ответа:
{"ru":"перевод одним-двумя словами","ex":"короткое предложение-пример на английском с этим словом"}`);
    g.ru = (r.ru || '') + (r.ex ? ' · ' + r.ex : '');
  } catch {
    g.ru = 'перевод не пришёл';
  }
  save();
  paint();
}

export function fiveView(): string {
  const g = fiveState();
  if (!g.word) fiveNew();
  const keys = fiveKeyState();
  const rows: string[] = [];
  for (let i = 0; i < 6; i++) {
    const r = g.rows[i];
    if (r)
      rows.push(
        r.g
          .split('')
          .map((c: string, j: number) => `<div class="fc ${r.m[j]}">${esc(c.toUpperCase())}</div>`)
          .join(''),
      );
    else if (i === g.rows.length && !g.done) {
      const cur = g.cur.padEnd(5, ' ');
      rows.push(
        cur
          .split('')
          .map((c: string) => `<div class="fc ${c === ' ' ? '' : 'in'}">${esc(c.trim().toUpperCase())}</div>`)
          .join(''),
      );
    } else rows.push('<div class="fc"></div>'.repeat(5));
  }
  const kb = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  return `<div class="rowsplit"><h3 class="h">Пять букв</h3>
    <div class="sub">серия ${g.streak} · рекорд ${g.best} · ${g.won} из ${g.played}</div></div>
    <p class="sub">Шесть попыток. Зелёная на месте, жёлтая есть в слове.</p>
    <div class="fgrid">${rows.map((r) => `<div class="frow">${r}</div>`).join('')}</div>
    ${
      g.msg
        ? `<div class="note" style="margin-top:10px"><div class="l">${esc(g.msg)}
      ${g.ru ? '<p>' + esc(g.ru) + '</p>' : ''}</div>
      <div class="rowb"><button class="btn sm" data-speak="${esc(g.word)}">послушать</button>
      <button class="btn sm" data-fru="1">${g.ru ? 'ещё раз' : 'что это значит'}</button>
      <button class="btn sm" data-fsave="1">в блокнот</button>
      <button class="btn p sm" data-fnew="1">новое слово</button></div></div>`
        : ''
    }
    ${
      g.done
        ? ''
        : `<div class="kb">${kb
            .map(
              (row) => `<div class="krow">
      ${row
        .split('')
        .map((c) => `<button class="key ${keys[c] || ''}" data-fkey="${c}">${c.toUpperCase()}</button>`)
        .join('')}
      ${row === 'zxcvbnm' ? '<button class="key wide" data-fkey="-">↤</button>' : ''}
    </div>`,
            )
            .join('')}
    <div class="krow"><button class="key go" data-fkey="+">Проверить</button></div></div>
    <div class="rowb" style="margin-top:8px"><button class="btn sm" data-fgiveup="1">Сдаться</button></div>`
    }`;
}

function fiveRowPaint(): void {
  const g = fiveState();
  const rows = document.querySelectorAll('.fgrid .frow');
  const row = rows[g.rows.length];
  if (!row) {
    paint();
    return;
  }
  const cur = g.cur.padEnd(5, ' ');
  row.innerHTML = cur
    .split('')
    .map((c: string) => `<div class="fc ${c === ' ' ? '' : 'in'}">${esc(c.trim().toUpperCase())}</div>`)
    .join('');
}

export function fiveKey(c: string): void {
  const g = fiveState();
  if (g.done) return;
  if (c === '-') {
    g.cur = g.cur.slice(0, -1);
    fiveRowPaint();
    return;
  }
  if (c === '+') {
    if (g.cur.length < 5) {
      g.msg = 'не хватает букв';
      paint();
      return;
    }
    const pool = fivePool();
    if (pool.indexOf(g.cur) < 0 && !FREQ!.find((x) => x.w === g.cur)) {
      g.msg = 'такого слова нет в словаре';
      paint();
      return;
    }
    const m = fiveMark(g.cur, g.word);
    g.rows.push({ g: g.cur, m: m.join('') });
    const win = g.cur === g.word;
    g.cur = '';
    g.msg = '';
    if (win || g.rows.length >= 6) {
      g.done = 1;
      g.played++;
      haptic(win ? 'ok' : 'no');
      if (win) {
        haptic('win');
        g.won++;
        g.streak++;
        g.best = Math.max(g.best, g.streak);
        g.msg = 'Угадал: ' + g.word.toUpperCase();
        if (!S.words.find((x: { en: string }) => x.en === g.word)) S.words.push({ en: g.word, ru: '' });
        if (g.streak >= 5) S.egg = Object.assign({}, S.egg || {}, { five: 1 });
      } else {
        g.streak = 0;
        fiveShowAnswer(g);
      }
      setTimeout(recalcLevel, 0);
    }
    save();
    paint();
    return;
  }
  if (g.cur.length < 5) {
    g.cur += c;
    haptic('type');
    fiveRowPaint();
  }
}
