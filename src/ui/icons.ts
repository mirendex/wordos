import { $ } from '../core/util';
import { dueWords } from '../domain/vocab';
import { freqReady } from '../domain/frequency';
import { S, save } from '../core/persist';
import { paint } from '../core/paint';
import { haptic } from '../platform/haptics';

type Px = [number, number, number, number, string];

const INK = '#16151A';
const PAPER = '#EDE7D8';
const PAPER2 = '#E2DBC8';
const BLUE = '#39479E';
const BLUE_HI = '#8C98E0';
const RED = '#C1432C';
const RED_HI = '#E0674F';
const GREEN = '#2C6B4A';
const YELLOW = '#D9A404';
const YELLOW_HI = '#F0C94A';
const GREY = '#7C7566';
const GREY_LO = '#B9B3A4';
const STICKY = '#F5F0C9';
const STICKY_LO = '#D8CF8E';
const AMBER = '#F0B84A';

function box(x: number, y: number, w: number, h: number, fill: string): Px[] {
  return [
    [x, y, w, h, INK],
    [x + 1, y + 1, w - 2, h - 2, fill],
  ];
}

function pixelIcon(px: Px[]): string {
  const rects = px
    .map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`)
    .join('');
  return `<svg width="40" height="40" viewBox="0 0 20 20" shape-rendering="crispEdges">${rects}</svg>`;
}

export const ICONS: Record<string, string> = {
  vocab: pixelIcon([
    ...box(5, 1, 13, 10, GREY_LO),
    [7, 3, 5, 1, GREEN],
    ...box(2, 5, 14, 12, PAPER),
    [6, 7, 3, 1, BLUE],
    [5, 8, 1, 5, BLUE],
    [9, 8, 1, 5, BLUE],
    [6, 10, 3, 1, BLUE],
    [11, 8, 3, 1, GREY],
    [11, 10, 3, 1, GREY],
    [11, 12, 2, 1, GREY],
    [5, 14, 9, 1, RED],
  ]),
  read: pixelIcon([
    ...box(1, 4, 9, 13, PAPER2),
    ...box(9, 4, 10, 13, PAPER),
    [3, 7, 5, 1, BLUE],
    [3, 9, 5, 1, BLUE],
    [3, 11, 5, 1, BLUE],
    [3, 13, 4, 1, RED],
    [11, 7, 2, 1, BLUE],
    [11, 10, 6, 1, BLUE],
    [11, 12, 6, 1, BLUE],
    [11, 14, 4, 1, BLUE],
    [13, 1, 5, 1, INK],
    [13, 2, 1, 2, INK],
    [17, 2, 1, 2, INK],
    [14, 2, 3, 5, RED],
    [14, 7, 1, 2, RED],
    [16, 7, 1, 2, RED],
    [14, 2, 1, 4, RED_HI],
  ]),
  diary: pixelIcon([
    ...box(2, 2, 12, 16, RED),
    [4, 3, 1, 14, INK],
    ...box(6, 5, 6, 5, PAPER),
    [7, 7, 4, 1, GREY],
    ...box(15, 3, 3, 12, YELLOW),
    [16, 4, 1, 3, YELLOW_HI],
    [16, 15, 1, 2, INK],
  ]),
  listen: pixelIcon([
    [6, 2, 8, 3, INK],
    [4, 3, 3, 3, INK],
    [13, 3, 3, 3, INK],
    [3, 5, 3, 6, INK],
    [14, 5, 3, 6, INK],
    [6, 3, 8, 1, PAPER],
    [5, 4, 1, 1, PAPER],
    [14, 4, 1, 1, PAPER],
    [4, 5, 1, 5, PAPER],
    [15, 5, 1, 5, PAPER],
    ...box(2, 10, 5, 8, BLUE),
    [3, 11, 1, 3, BLUE_HI],
    ...box(13, 10, 5, 8, BLUE),
    [14, 11, 1, 3, BLUE_HI],
  ]),
  echo: pixelIcon([
    [4, 7, 3, 5, INK],
    [13, 7, 3, 5, INK],
    [5, 11, 10, 3, INK],
    [5, 7, 1, 5, RED],
    [14, 7, 1, 5, RED],
    [6, 12, 8, 1, RED],
    [8, 1, 4, 1, INK],
    [7, 2, 6, 8, INK],
    [8, 10, 4, 1, INK],
    [8, 2, 4, 8, PAPER],
    [8, 4, 4, 1, GREY],
    [8, 6, 4, 1, GREY],
    [8, 8, 4, 1, GREY],
    [9, 14, 2, 2, INK],
    ...box(6, 16, 8, 3, PAPER),
  ]),
  games: pixelIcon([
    [3, 5, 14, 9, INK],
    [2, 6, 16, 7, INK],
    [2, 12, 5, 5, INK],
    [13, 12, 5, 5, INK],
    [3, 6, 14, 7, PAPER],
    [3, 12, 3, 4, PAPER],
    [14, 12, 3, 4, PAPER],
    [5, 8, 1, 3, INK],
    [4, 9, 3, 1, INK],
    [14, 7, 2, 2, RED],
    [12, 9, 2, 2, GREEN],
    [8, 8, 3, 1, GREY],
  ]),
  term: pixelIcon([
    ...box(1, 2, 18, 15, '#17140F'),
    [2, 3, 16, 2, PAPER],
    [2, 5, 16, 1, INK],
    [15, 3, 2, 2, RED],
    [4, 7, 2, 1, AMBER],
    [5, 8, 2, 1, AMBER],
    [6, 9, 2, 1, AMBER],
    [5, 10, 2, 1, AMBER],
    [4, 11, 2, 1, AMBER],
    [9, 11, 5, 1, AMBER],
    [4, 14, 9, 1, GREY],
  ]),
  notes: pixelIcon([
    ...box(2, 2, 16, 16, STICKY),
    [7, 1, 6, 3, GREY_LO],
    [5, 7, 10, 1, GREY],
    [5, 10, 10, 1, GREY],
    [5, 13, 6, 1, GREY],
    [15, 16, 2, 1, STICKY_LO],
    [16, 15, 1, 1, STICKY_LO],
    [14, 16, 1, 1, INK],
    [15, 15, 1, 1, INK],
    [16, 14, 1, 1, INK],
  ]),
  setup: pixelIcon([
    [8, 1, 4, 3, INK],
    [8, 16, 4, 3, INK],
    [1, 8, 3, 4, INK],
    [16, 8, 3, 4, INK],
    [3, 3, 3, 3, INK],
    [14, 3, 3, 3, INK],
    [3, 14, 3, 3, INK],
    [14, 14, 3, 3, INK],
    [5, 4, 10, 12, INK],
    [4, 5, 12, 10, INK],
    [9, 2, 2, 3, PAPER],
    [9, 15, 2, 3, PAPER],
    [2, 9, 3, 2, PAPER],
    [15, 9, 3, 2, PAPER],
    [4, 4, 2, 2, PAPER],
    [14, 4, 2, 2, PAPER],
    [4, 14, 2, 2, PAPER],
    [14, 14, 2, 2, PAPER],
    [6, 5, 8, 10, PAPER],
    [5, 6, 10, 8, PAPER],
    [8, 8, 4, 4, INK],
    [9, 9, 2, 2, RED],
  ]),
  about: pixelIcon([
    [2, 2, 16, 13, INK],
    [4, 14, 4, 1, INK],
    [4, 15, 3, 1, INK],
    [4, 16, 2, 1, INK],
    [4, 17, 1, 1, INK],
    [3, 3, 14, 11, BLUE],
    [5, 14, 2, 1, BLUE],
    [5, 15, 1, 1, BLUE],
    [9, 5, 2, 2, PAPER],
    [8, 8, 3, 1, PAPER],
    [9, 9, 2, 3, PAPER],
    [8, 11, 4, 1, PAPER],
  ]),
};

export const APPS = [
  { id: 'vocab', t: 'WORDS.DB' },
  { id: 'read', t: 'READER' },
  { id: 'diary', t: 'DIARY' },
  { id: 'listen', t: 'LISTEN' },
  { id: 'echo', t: 'ECHO' },
  { id: 'games', t: 'GAMES' },
  { id: 'term', t: 'TERMINAL' },
  { id: 'notes', t: 'NOTES' },
  { id: 'setup', t: 'SETUP' },
  { id: 'about', t: 'ABOUT' },
];

export function dueCount(): number {
  try {
    return dueWords().length;
  } catch {
    return 0;
  }
}

export function iconPos(): Record<string, number> {
  if (!S.icons) S.icons = {};
  return S.icons;
}
export function iconCols(): number {
  const w = window.innerWidth;
  return Math.max(3, Math.min(8, Math.floor(w / 92)));
}
export function iconCellW(): number {
  return window.innerWidth / iconCols();
}
export function iconRowH(): number {
  return 96;
}

export function renderIcons(): void {
  const pos = iconPos();
  const cols = iconCols();
  const cw = iconCellW();
  const rh = iconRowH();
  $('#icons')!.innerHTML = APPS.map((a, i) => {
    const p = pos[a.id];
    const idx = p === undefined ? i : p;
    const x = (idx % cols) * cw + (cw - 78) / 2;
    const y = Math.floor(idx / cols) * rh + 10;
    const n = a.id === 'vocab' && freqReady() ? dueCount() : 0;
    const badge = n ? '<b style="color:#FFD9A0">' + n + '</b>' : '';
    return `<button class="ic" data-app="${a.id}" data-icon="${a.id}" style="left:${x}px;top:${y}px">${ICONS[a.id]}<b>${a.t}</b>${badge}</button>`;
  }).join('');
}

interface IconDragTile {
  el: HTMLElement;
  id: string;
  ox: number;
  oy: number;
}
interface IconDrag {
  id: string;
  el: HTMLElement;
  group: IconDragTile[];
  moved: boolean;
}

let idrag: IconDrag | null = null;

export function isIconDragging(): boolean {
  return !!idrag;
}

export function iconAt(x: number, y: number): number {
  const cols = iconCols();
  const cw = iconCellW();
  const rh = iconRowH();
  const c = Math.max(0, Math.min(cols - 1, Math.floor(x / cw)));
  const r = Math.max(0, Math.floor((y - 10) / rh));
  return r * cols + c;
}

export function startIconDrag(id: string, el: HTMLElement, cx: number, cy: number): void {
  const sel = [...document.querySelectorAll<HTMLElement>('.ic.selected')];
  const group = sel.length && el.classList.contains('selected') ? sel : [el];
  idrag = {
    id,
    el,
    group: group.map((g) => ({ el: g, id: g.dataset.icon!, ox: cx - g.offsetLeft, oy: cy - g.offsetTop })),
    moved: false,
  };
  group.forEach((g) => g.classList.add('moving'));
}

export function moveIconDrag(cx: number, cy: number): void {
  if (!idrag) return;
  idrag.moved = true;
  idrag.group.forEach((g) => {
    g.el.style.left = cx - g.ox + 'px';
    g.el.style.top = cy - g.oy + 'px';
  });
}

export function endIconDrag(): boolean {
  if (!idrag) return false;
  idrag.group.forEach((g) => g.el.classList.remove('moving'));
  if (idrag.moved) {
    const pos = iconPos();
    APPS.forEach((a, i) => {
      if (pos[a.id] === undefined) pos[a.id] = i;
    });
    const base = iconAt(idrag.el.offsetLeft + 39, idrag.el.offsetTop + 44);
    const from = pos[idrag.id];
    const shift = base - from;
    const moving: Record<string, number> = {};
    idrag.group.forEach((g) => {
      moving[g.id] = Math.max(0, pos[g.id] + shift);
    });
    // resolve collisions: give a taken slot to whoever was already standing on it
    const busy: Record<number, string> = {};
    Object.keys(moving).forEach((id) => {
      let slot = moving[id];
      while (busy[slot]) slot++;
      busy[slot] = id;
      const taken = Object.keys(pos).find((k) => pos[k] === slot && !moving[k]);
      if (taken !== undefined) pos[taken] = pos[id];
      pos[id] = slot;
    });
    save();
    haptic('press');
  }
  const moved = idrag.moved;
  idrag = null;
  paint();
  return moved;
}
