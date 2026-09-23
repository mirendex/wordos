import { $ } from '../core/util';
import { dueWords } from '../domain/vocab';
import { freqReady } from '../domain/frequency';
import { S, save } from '../core/persist';
import { paint } from '../core/paint';
import { haptic } from '../platform/haptics';

export const ICONS: Record<string, string> = {
  mail: `<svg width="34" height="34" viewBox="0 0 17 17"><rect x="1" y="3" width="15" height="11" fill="#EDE7D8" stroke="#16151A"/><path d="M1 3l7.5 6L16 3" stroke="#16151A" fill="none"/><rect x="12" y="9" width="4" height="4" fill="#C1432C" stroke="#16151A"/></svg>`,
  read: `<svg width="34" height="34" viewBox="0 0 17 17"><rect x="2" y="2" width="13" height="13" fill="#EDE7D8" stroke="#16151A"/><path d="M4 5h9M4 7h9M4 9h6M4 11h8" stroke="#39479E"/></svg>`,
  notes: `<svg width="34" height="34" viewBox="0 0 17 17"><rect x="3" y="1" width="11" height="15" fill="#F5F0C9" stroke="#16151A"/><path d="M5 4h7M5 6h7M5 8h5" stroke="#7C7566"/><rect x="3" y="1" width="11" height="2" fill="#2C6B4A" stroke="#16151A"/></svg>`,
  about: `<svg width="34" height="34" viewBox="0 0 17 17"><rect x="2" y="3" width="13" height="10" fill="#39479E" stroke="#16151A"/><rect x="6" y="13" width="5" height="2" fill="#EDE7D8" stroke="#16151A"/><path d="M4 5h9M4 7h6" stroke="#EDE7D8"/></svg>`,
  games: `<svg width="34" height="34" viewBox="0 0 17 17"><rect x="1" y="3" width="15" height="11" fill="#EDE7D8" stroke="#16151A"/><rect x="2" y="4" width="4" height="4" fill="#2C6B4A"/><rect x="7" y="4" width="4" height="4" fill="#D9A404"/><rect x="12" y="4" width="3" height="4" fill="#B9B3A4"/><path d="M2 10h13M2 12h9" stroke="#7C7566"/></svg>`,
  setup: `<svg width="34" height="34" viewBox="0 0 17 17"><rect x="2" y="2" width="13" height="13" fill="#EDE7D8" stroke="#16151A"/><rect x="6" y="6" width="5" height="5" fill="#C1432C" stroke="#16151A"/><path d="M8.5 2v3M8.5 12v3M2 8.5h3M12 8.5h3" stroke="#16151A"/></svg>`,
  echo: `<svg width="34" height="34" viewBox="0 0 17 17"><path d="M6 2h5v7a2.5 2.5 0 0 1-5 0z" fill="#EDE7D8" stroke="#16151A"/><path d="M3.5 8a5 5 0 0 0 10 0" stroke="#C1432C" fill="none"/><path d="M8.5 13v2M6 15h5" stroke="#16151A"/></svg>`,
  listen: `<svg width="34" height="34" viewBox="0 0 17 17"><path d="M3 6h3l4-3v11l-4-3H3z" fill="#EDE7D8" stroke="#16151A"/><path d="M12 6c1 1 1 4 0 5M14 4c2 2 2 7 0 9" stroke="#39479E" fill="none"/></svg>`,
  diary: `<svg width="34" height="34" viewBox="0 0 17 17"><rect x="3" y="1" width="11" height="15" fill="#fff" stroke="#16151A"/><path d="M5 5h7M5 8h7M5 11h4" stroke="#39479E"/><rect x="2" y="1" width="2" height="15" fill="#C1432C" stroke="#16151A"/></svg>`,
  vocab: `<svg width="34" height="34" viewBox="0 0 17 17"><rect x="2" y="2" width="13" height="13" fill="#EDE7D8" stroke="#16151A"/><path d="M4 12l2-3 2 2 3-5 2 3" stroke="#39479E" fill="none"/><path d="M4 4v9h9" stroke="#16151A" fill="none"/></svg>`,
  term: `<svg width="34" height="34" viewBox="0 0 17 17"><rect x="1" y="2" width="15" height="12" fill="#17140F" stroke="#16151A"/><path d="M3 5l2 2-2 2M7 9h5" stroke="#F0B84A"/></svg>`,
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
