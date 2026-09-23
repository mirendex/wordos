import { esc } from '../../lib/scale';
import { paint } from '../../core/paint';
import { S, save } from '../../core/persist';
import { haptic } from '../../platform/haptics';
import { fwPlace } from '../../lib/grid';
import { fwSource } from './sources';

interface FwTile {
  i: number;
  ch: string;
  r: number;
  c: number;
}
interface FwWordSpot {
  w: string;
  ru: string;
  path: number[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fwState(): any {
  // состояние от старой версии (сетка без плиток с координатами)
  if (
    S.fw &&
    S.fw.grid &&
    (!Array.isArray(S.fw.tiles) ||
      !S.fw.tiles.length ||
      S.fw.tiles.some((t: FwTile) => !t || t.r === undefined))
  )
    S.fw = null;
  if (!S.fw || typeof S.fw !== 'object')
    S.fw = { tiles: [], words: [], found: [], used: [], picked: [], solved: 0, msg: '', hint: {} };
  if (S.fw.words.length && S.fw.words.some((x: { cells?: unknown }) => x && x.cells)) S.fw.words = [];
  if (S.fw.tiles.length && S.fw.tiles.some((t: FwTile) => t && t.r === undefined)) {
    S.fw.tiles = [];
    S.fw.words = [];
  }
  (['tiles', 'words', 'found', 'used', 'picked'] as const).forEach((k) => {
    if (!Array.isArray(S.fw[k])) S.fw[k] = [];
  });
  if (!S.fw.hint || typeof S.fw.hint !== 'object') S.fw.hint = {};
  return S.fw;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fwWord(g: any): string {
  return g.picked.map((k: number) => (g.tiles[k] || {}).ch || '').join('');
}

const FWLET = 'eeeeeeaaaaiiiioooonnnnssssrrrrttttllccuuddpmhggbfywkvxzjq';

export function fwNew(): boolean {
  const g = fwState();
  const src = fwSource().sort(() => Math.random() - 0.5);
  if (src.length < 3) {
    g.words = [];
    g.tiles = [];
    g.grid = null;
    save();
    return false;
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const pick: { w: string; ru: string }[] = [];
    let letters = 0;
    for (const x of src) {
      if (pick.length >= 5) break;
      if (letters + x.w.length > 30) continue;
      if (pick.find((p) => p.w === x.w)) continue;
      pick.push(x);
      letters += x.w.length;
    }
    if (pick.length < 3) break;
    const size = letters <= 16 ? 5 : letters <= 24 ? 6 : 7;
    const grid: string[][] = [];
    for (let r = 0; r < size; r++) grid.push(new Array(size).fill(''));
    const claimed: number[][] = [];
    for (let r = 0; r < size; r++) claimed.push(new Array(size).fill(0));
    const placed: { w: string; ru: string; path: [number, number][] }[] = [];
    pick
      .sort((a, b) => b.w.length - a.w.length)
      .forEach((x) => {
        const path = fwPlace(grid, size, claimed, x.w);
        if (path) placed.push({ w: x.w, ru: x.ru, path });
      });
    if (placed.length >= 3) {
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          if (!grid[r][c]) grid[r][c] = FWLET[Math.floor(Math.random() * FWLET.length)];
      g.size = size;
      g.grid = grid;
      g.tiles = [];
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++) g.tiles.push({ i: g.tiles.length, ch: grid[r][c], r, c });
      g.words = placed.map((x) => ({ w: x.w, ru: x.ru, path: x.path.map(([r, c]) => r * size + c) }));
      g.found = [];
      g.used = [];
      g.picked = [];
      g.msg = '';
      g.miss = false;
      g.hint = {};
      save();
      return true;
    }
    src.sort(() => Math.random() - 0.5);
  }
  g.words = [];
  g.tiles = [];
  g.grid = null;
  save();
  return false;
}

export function fwTap(i: number): void {
  const g = fwState();
  if (g.used.indexOf(i) >= 0) return;
  const at = g.picked.indexOf(i);
  if (at >= 0) {
    g.picked.splice(at, 1);
    haptic('soft');
    fwPaintSeq();
    return;
  }
  const last = g.picked[g.picked.length - 1];
  if (last !== undefined && !fwNear(last, i)) {
    haptic('no');
    return;
  }
  if (!g.picked.length) g.msg = '';
  g.picked.push(i);
  haptic('type');
  const word = fwWord(g);
  if (g.words.find((x: FwWordSpot) => x.w === word && g.found.indexOf(x.w) < 0)) {
    fwSubmit();
    return;
  }
  const max = Math.max.apply(
    null,
    g.words.filter((x: FwWordSpot) => g.found.indexOf(x.w) < 0).map((x: FwWordSpot) => x.w.length),
  );
  if (g.picked.length >= max) {
    g.picked = [];
    haptic('no');
  }
  save();
  fwPaintSeq();
}

export function fwView(): string {
  const g = fwState();
  if (!g.tiles.length && !fwNew())
    return `<h3 class="h">Буквы</h3>
    <p class="sub">Нужно минимум три своих слова с переводом. Пройди пачку карточек.</p>
    <div class="rowb"><button class="btn p" data-go="vocab">К словам</button></div>`;
  const cur = fwWord(g);
  const win = g.found.length === g.words.length;
  return `<div class="rowsplit"><h3 class="h">Буквы</h3>
      <span class="sub">${g.found.length} из ${g.words.length}${g.solved ? ' · полей ' + g.solved : ''}</span></div>

    <div class="ltiles" data-fw style="grid-template-columns:repeat(${g.size || 6},1fr)">${g.tiles
      .map((t: FwTile, i: number) => {
        const used = g.used.indexOf(i) >= 0;
        const sel = g.picked.indexOf(i) >= 0;
        return `<button class="ltile ${used ? 'used' : ''} ${sel ? 'sel' : ''}" data-fwtap="${i}">${esc(t.ch.toUpperCase())}</button>`;
      })
      .join('')}</div>

    <div class="lcur">${cur ? esc(cur.toUpperCase()) : '<i>веди пальцем по буквам</i>'}</div>

    <div class="ltasks">${g.words
      .map((x: FwWordSpot) => {
        const done = g.found.indexOf(x.w) >= 0;
        const hn = g.hint[x.w] || 0;
        return `<div class="ltask ${done ? 'done' : ''}" data-lword="${esc(x.w)}">
        <span class="lru">${esc(x.ru)}</span>
        <div class="lslots">${x.w
          .split('')
          .map((ch, j) => {
            const shown = done || j < hn;
            const isLast = !done && j === hn - 1;
            return `<i class="${isLast ? 'hint' : ''}">${shown ? esc(ch.toUpperCase()) : ''}</i>`;
          })
          .join('')}</div>
        ${done ? `<button class="btn sm" data-speak="${esc(x.w)}">звук</button>` : ''}
      </div>`;
      })
      .join('')}</div>

    ${
      win
        ? `<div class="note"><div class="l">${esc(g.msg || 'Готово')}</div>
      <div class="rowb"><button class="btn p sm" data-fwnew="1">Ещё набор</button></div></div>`
        : `${g.msg ? `<div class="note"><div class="l">${esc(g.msg)}</div></div>` : ''}
      <div class="rowb"><button class="btn sm" data-fwclear="1">Сбросить</button>
      <button class="btn sm" data-fwhint="1">Подсказка</button>
      <button class="btn sm" data-fwnew="1">Новые слова</button></div>`
    }`;
}

export function fwHint(): void {
  const g = fwState();
  const left = g.words.filter((x: FwWordSpot) => g.found.indexOf(x.w) < 0);
  if (!left.length) return;
  const x = left.slice().sort((a: FwWordSpot, b: FwWordSpot) => a.w.length - b.w.length)[0];
  if (!x.path || !x.path.length) return;
  const done = Math.min(g.hint[x.w] || 0, x.path.length - 1);
  const idx = x.path[done];
  g.hint[x.w] = done + 1;
  save();
  haptic('tick');
  paint();
  const el = document.querySelector('[data-fwtap="' + idx + '"]');
  if (el) {
    el.classList.add('hint');
    setTimeout(() => el.classList.remove('hint'), 1100);
  }
  const row = document.querySelector('[data-lword="' + x.w + '"]');
  if (row) {
    row.classList.add('hint');
    setTimeout(() => row.classList.remove('hint'), 1100);
  }
}

let fwdrag: { active: true } | null = null;

export function isFwDragging(): boolean {
  return !!fwdrag;
}

export function fwTileAt(x: number, y: number): { i: number; el: Element } | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const t = el.closest ? el.closest('.ltile') : null;
  if (!t || t.classList.contains('used')) return null;
  return { i: +(t as HTMLElement).dataset.fwtap!, el: t };
}

export function fwPaintSeq(): void {
  const g = fwState();
  document.querySelectorAll('.ltile').forEach((el) => {
    el.classList.toggle('sel', g.picked.indexOf(+(el as HTMLElement).dataset.fwtap!) >= 0);
  });
  const cur = document.querySelector('.lcur');
  if (cur) {
    const w = fwWord(g);
    cur.innerHTML = w ? esc(w.toUpperCase()) : '<i>веди пальцем по буквам</i>';
  }
}

export function fwStart(x: number, y: number): boolean {
  const t = fwTileAt(x, y);
  if (!t) return false;
  const g = fwState();
  g.picked = g.tiles[t.i] ? [t.i] : [];
  fwdrag = { active: true };
  haptic('type');
  fwPaintSeq();
  return true;
}

export function fwNear(a: number, b: number): boolean {
  const g = fwState();
  const A = g.tiles[a];
  const B = g.tiles[b];
  if (!A || !B || A.r === undefined) return true;
  return Math.abs(A.r - B.r) + Math.abs(A.c - B.c) === 1; // только вверх, вниз, влево, вправо
}

export function fwMove(x: number, y: number): void {
  if (!fwdrag) return;
  const t = fwTileAt(x, y);
  if (!t) return;
  const g = fwState();
  const at = g.picked.indexOf(t.i);
  if (at >= 0) {
    if (at === g.picked.length - 2) {
      g.picked.pop();
      haptic('soft');
      fwPaintSeq();
    }
    return;
  }
  const last = g.picked[g.picked.length - 1];
  if (last !== undefined && !fwNear(last, t.i)) return; // только соседняя клетка
  g.picked.push(t.i);
  haptic('type');
  fwPaintSeq();
}

export function fwEnd(): void {
  if (!fwdrag) return;
  fwdrag = null;
  const g = fwState();
  if (g.picked.length < 3) {
    g.picked = [];
    fwPaintSeq();
    return;
  }
  fwSubmit();
}

export function fwSubmit(): void {
  const g = fwState();
  const word = fwWord(g);
  const hit = g.words.find((x: FwWordSpot) => x.w === word && g.found.indexOf(x.w) < 0);
  if (hit) {
    // подводит игрока только если он занял клетку, которая нужна ДРУГОМУ ещё не найденному слову —
    // если буквы взяты "ничейные", неважно, что путь не тот, которым слово изначально положили
    const conflict = g.picked.some((idx: number) =>
      g.words.some(
        (x: FwWordSpot) => x.w !== hit.w && g.found.indexOf(x.w) < 0 && x.path && x.path.indexOf(idx) >= 0,
      ),
    );
    if (!conflict) {
      g.found.push(hit.w);
      g.used = g.used.concat(g.picked);
      g.picked = [];
      if (g.found.length === g.words.length) {
        g.solved++;
        g.msg = 'Все слова собраны';
        haptic('win');
        if (!g.miss) S.egg = Object.assign({}, S.egg || {}, { letters: 1 });
      } else {
        g.msg = '';
        haptic('ok');
      }
    } else {
      g.picked = [];
      haptic('ok');
      g.msg = 'Слово верное — «' + hit.w.toUpperCase() + '», но собери его по другим буквам на поле';
    }
    save();
    paint();
  } else {
    g.miss = true;
    g.picked = [];
    haptic('no');
    save();
    fwPaintSeq();
  }
}
