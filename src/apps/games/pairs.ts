import { esc } from '../../lib/scale';
import { paint } from '../../core/paint';
import { S, save } from '../../core/persist';
import { haptic } from '../../platform/haptics';
import { pairsSource } from './sources';

interface PairCard {
  id: number;
  side: 'en' | 'ru';
  t: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pairsState(): any {
  if (!S.pairs || typeof S.pairs !== 'object')
    S.pairs = { cards: [], open: [], done: [], moves: 0, best: 0, ready: false };
  if (!Array.isArray(S.pairs.cards)) S.pairs.cards = [];
  return S.pairs;
}

export function pairsNew(): void {
  const g = pairsState();
  const src = pairsSource();
  if (src.length < 6) {
    g.ready = false;
    g.cards = [];
    save();
    return;
  }
  const pick = src
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);
  const cards: PairCard[] = [];
  pick.forEach((p, i) => {
    cards.push({ id: i, side: 'en', t: p.en });
    cards.push({ id: i, side: 'ru', t: p.ru });
  });
  g.cards = cards.sort(() => Math.random() - 0.5);
  g.open = [];
  g.done = [];
  g.moves = 0;
  g.ready = true;
  save();
}

export function pairsTap(i: number): void {
  const g = pairsState();
  if (g.open.length >= 2 || g.open.indexOf(i) >= 0 || g.done.indexOf(g.cards[i].id) >= 0) return;
  g.open.push(i);
  if (g.open.length === 2) {
    g.moves++;
    const a = g.cards[g.open[0]];
    const b = g.cards[g.open[1]];
    if (a.id === b.id && a.side !== b.side) {
      haptic('ok');
      g.done.push(a.id);
      g.open = [];
      if (g.done.length === 6) {
        haptic('win');
        g.best = g.best ? Math.min(g.best, g.moves) : g.moves;
      }
    } else {
      haptic('no');
      setTimeout(() => {
        const gg = pairsState();
        gg.open = [];
        paint();
      }, 700);
    }
  }
  save();
  paint();
}

export function pairsView(): string {
  const g = pairsState();
  if (!g.ready && !g.cards.length) pairsNew();
  if (!g.ready)
    return `<h3 class="h">Пары</h3>
    <p class="sub">Нужны слова с переводом. Пройди пачку карточек в WORDS.</p>
    <div class="rowb"><button class="btn p" data-go="vocab">К словам</button></div>`;
  const win = g.done.length === 6;
  return `<div class="rowsplit"><h3 class="h">Пары</h3>
      <span class="sub">ходов ${g.moves}${g.best ? ' · рекорд ' + g.best : ''}</span></div>
    <div class="pgrid">${g.cards
      .map((c: PairCard, i: number) => {
        const done = g.done.indexOf(c.id) >= 0;
        const open = g.open.indexOf(i) >= 0;
        return `<button class="pcard ${done ? 'done' : ''} ${open ? 'open' : ''} ${c.side}" data-ptap="${i}">
        ${done || open ? esc(c.t) : '?'}</button>`;
      })
      .join('')}</div>
    ${
      win
        ? `<div class="note"><div class="l">Собрано за ${g.moves} ходов.</div>
      <div class="rowb"><button class="btn p sm" data-pnew="1">Ещё раз</button></div></div>`
        : `<div class="rowb"><button class="btn sm" data-pnew="1">Перемешать</button></div>`
    }`;
}
