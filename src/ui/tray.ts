import { esc } from '../lib/scale';
import { Celebration } from '../lib/today';
import { haptic, hapticPattern, Pulse } from '../platform/haptics';

// The marks of the day's route are made in the desktop's own terms, with no dimming of the screen
// and no card in the middle: the route has an indicator in the taskbar, like an icon in a system
// tray, three segments that fill as the steps are done, and when the day is done a balloon comes
// up out of it, as the old systems did to tell of a finished job. It does not stop what is being
// done and leaves by itself. The balloon is told four ways, each with its own vibration:
//   stamp    the plain day: a rubber stamp comes down on the balloon and the taskbar jolts
//   sparkle  a clean day: stars flash around it, a tick of vibration for each
//   wave     the week's goal: the week's days fill one after another, a tick for each
//   sunrise  a return after days away: a sun comes up in it, and the words are typed, with a heartbeat

export interface BalloonInfo {
  title: string;
  line: string;
  cells?: boolean[]; // the week, for the wave: which days are done
}

const INK = '#16151A';
const STEP_MS = 'steps(5, end)'; // stepped motion, as old as the look of it
const HOLD_MS = 7000;

let el: HTMLElement | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

function later(fn: () => void, ms: number): void {
  timers.push(setTimeout(fn, ms));
}

export function endBalloon(): void {
  timers.forEach(clearTimeout);
  timers = [];
  document.querySelectorAll('.fx').forEach((x) => x.remove());
  if (el) el.remove();
  el = null;
}

function leave(): void {
  const o = el;
  if (!o) return;
  if (!reduced())
    o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'steps(4, end)', fill: 'forwards' });
  later(
    () => {
      if (el === o) endBalloon();
    },
    reduced() ? 0 : 240,
  );
}

// ---- pictures, in the app's pixels

function rects(cells: [number, number][], fill: string): string {
  return cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`).join('');
}

function svg(size: number, grid: number, body: string, cls = ''): string {
  return `<svg class="${cls}" viewBox="0 0 ${grid} ${grid}" width="${size}" height="${size}" shape-rendering="crispEdges">${body}</svg>`;
}

const CHECK: [number, number][] = [
  [1, 5],
  [2, 6],
  [3, 7],
  [4, 6],
  [5, 5],
  [6, 4],
  [7, 3],
  [8, 2],
];
// a four-pointed star: the long arms, and the short diagonals that make it round
const STAR: [number, number][] = [
  [3, 0],
  [3, 1],
  [3, 2],
  [3, 4],
  [3, 5],
  [3, 6],
  [0, 3],
  [1, 3],
  [2, 3],
  [4, 3],
  [5, 3],
  [6, 3],
  [2, 2],
  [4, 2],
  [2, 4],
  [4, 4],
];

function disc(r: number): [number, number][] {
  const out: [number, number][] = [];
  const c = r - 0.5;
  for (let y = 0; y < r * 2; y++)
    for (let x = 0; x < r * 2; x++) if ((x - c) ** 2 + (y - c) ** 2 <= r * r - 1) out.push([x, y]);
  return out;
}

const shift = (c: [number, number][], dx: number, dy = dx): [number, number][] =>
  c.map(([x, y]) => [x + dx, y + dy]);

function icon(kind: Celebration): string {
  if (kind === 'sunrise')
    return svg(
      28,
      10,
      rects(shift(disc(4), 1), INK) +
        rects(shift(disc(3), 2), '#D9A404') +
        rects(
          [
            [4, 4],
            [5, 4],
            [4, 5],
          ],
          '#F0C94A',
        ),
      'b-sun',
    );
  if (kind === 'sparkle')
    return svg(
      24,
      8,
      rects(shift(STAR, 0, 1), INK) + rects(STAR, '#F0C94A') + rects([[3, 3]], '#fff'),
      'b-ico',
    );
  return svg(24, 10, rects(shift(CHECK, 0, 1), INK) + rects(CHECK, '#2C6B4A'), 'b-ico');
}

function weekCells(cells: boolean[]): string {
  return `<div class="b-week">${cells.map((on) => `<i class="${on ? 'on' : ''}"></i>`).join('')}</div>`;
}

function star(size: number): HTMLElement {
  const s = document.createElement('div');
  s.className = 'fx fx-star';
  s.innerHTML = svg(
    size,
    8,
    rects(shift(STAR, 0, 1), INK) + rects(STAR, '#F0C94A') + rects([[3, 3]], '#fff'),
  );
  return s;
}

// ---- the four

// A stamp, rubber and red, comes down on the balloon: a tick as it is lifted, the blow as it lands,
// when the balloon is pressed flat for a moment, the taskbar jolts and flecks fly from the edge
function stamp(o: HTMLElement): void {
  const st = o.querySelector('.b-stamp') as HTMLElement;
  const LAND = 380;
  st.animate(
    [
      { opacity: 0, transform: 'translate(-12px, -26px) scale(2.5) rotate(-18deg)' },
      { opacity: 1, transform: 'translate(0, 0) scale(1) rotate(-8deg)' },
    ],
    { duration: 220, delay: LAND - 220, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)', fill: 'backwards' },
  );
  o.animate(
    [
      { transform: 'scale(1, 1)' },
      { transform: 'scale(1.03, 0.9)' },
      { transform: 'scale(0.99, 1.02)' },
      { transform: 'scale(1, 1)' },
    ],
    { duration: 300, delay: LAND, easing: 'ease-out' },
  );
  const bar = document.getElementById('taskbar');
  if (bar)
    bar.animate(
      [
        { transform: 'translateY(0)' },
        { transform: 'translateY(3px)' },
        { transform: 'translateY(-1px)' },
        { transform: 'translateY(0)' },
      ],
      { duration: 200, delay: LAND, easing: 'steps(4, end)' },
    );
  // flecks off the stamp's edge
  const r = st.getBoundingClientRect();
  for (let i = 0; i < 7; i++) {
    const f = document.createElement('i');
    f.className = 'fx fx-fleck';
    f.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`;
    document.body.appendChild(f);
    const a = (Math.PI * 2 * i) / 7 + 0.3;
    const d = 26 + (i % 3) * 8;
    f.animate(
      [
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`, opacity: 0 },
      ],
      { duration: 360, delay: LAND, easing: 'steps(5, end)', fill: 'both' },
    );
  }
  haptic('stamp');
}

// Stars flash around the balloon and the tray's icon, each appearing with a tick: the bigger the
// star, the firmer the tick, so the vibration is the sparkle felt
function sparkle(o: HTMLElement): void {
  const r = o.getBoundingClientRect();
  const tray = document.querySelector('.tray')?.getBoundingClientRect();
  const spots: [number, number, number, number][] = [
    // x, y, size, when
    [r.left + 14, r.top - 10, 18, 140],
    [r.right - 24, r.top - 16, 24, 260],
    [r.left + r.width * 0.55, r.top - 22, 15, 400],
    [r.left - 2, r.top + r.height * 0.5, 15, 520],
    [tray ? tray.left + 4 : r.right - 40, tray ? tray.top - 18 : r.bottom, 21, 660],
    [r.right - 2, r.top + r.height * 0.45, 15, 800],
    [r.left + r.width * 0.3, r.top - 14, 12, 920],
  ];
  const ticks: Pulse[] = [];
  spots.forEach(([x, y, size, at]) => {
    const s = star(size);
    s.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px`;
    document.body.appendChild(s);
    s.animate(
      [
        { transform: 'scale(0)', opacity: 1 },
        { transform: 'scale(1.3)', opacity: 1 },
        { transform: 'scale(0.9)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0)', opacity: 0 },
      ],
      { duration: 560, delay: at, easing: 'steps(4, end)', fill: 'both' },
    );
    ticks.push([at, Math.min(0.9, 0.2 + size / 34), size >= 21]);
  });
  // a flash of the balloon's own edge as the first star lights
  o.animate(
    [
      { boxShadow: '3px 3px 0 #16151a, 0 0 0 0 #F0C94A' },
      { boxShadow: '3px 3px 0 #16151a, 0 0 0 4px #F0C94A' },
      { boxShadow: '3px 3px 0 #16151a, 0 0 0 0 #F0C94A' },
    ],
    {
      duration: 420,
      delay: 140,
      easing: 'steps(3, end)',
    },
  );
  ticks.push([1050, 0.5]);
  hapticPattern(ticks);
}

// The week's days, in the balloon, fill one after another, each with a pop and a tick that is a
// little firmer than the last, and the last, today, with a blow
function wave(o: HTMLElement): void {
  const cells = [...o.querySelectorAll<HTMLElement>('.b-week i')];
  const step = 110;
  const start = 220;
  const ticks: Pulse[] = [];
  const total = cells.filter((c) => c.classList.contains('on')).length;
  let n = 0;
  cells.forEach((c, i) => {
    c.animate(
      [
        { transform: 'scale(0.3)', opacity: 0 },
        { transform: 'scale(1.35)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 280, delay: start + i * step, easing: 'steps(4, end)', fill: 'backwards' },
    );
    if (c.classList.contains('on')) {
      n++;
      const last = i === cells.length - 1;
      ticks.push([
        start + i * step,
        last ? 1 : 0.25 + (0.5 * n) / Math.max(1, total),
        last,
        last ? 16 : undefined,
      ]);
    }
  });
  const end = start + cells.length * step;
  ticks.push([end + 90, 0.35], [end + 180, 0.18]);
  hapticPattern(ticks);
}

// The sun comes up inside the balloon and swells with each beat; the words are typed out
function sunrise(o: HTMLElement): void {
  const sun = o.querySelector('.b-sun') as SVGElement;
  sun.animate([{ transform: 'translateY(26px)' }, { transform: 'translateY(0)' }], {
    duration: 1300,
    easing: 'steps(10, end)',
    fill: 'backwards',
  });
  [0, 120, 800, 920].forEach((t, i) =>
    sun.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(${i % 2 ? 1.18 : 1.1})` }, { transform: 'scale(1)' }],
      {
        duration: 260,
        delay: t,
        easing: 'steps(3, end)',
      },
    ),
  );
  const line = o.querySelector('.b-line') as HTMLElement;
  const text = line.textContent || '';
  line.textContent = '';
  line.classList.add('typing');
  let k = 0;
  const type = (): void => {
    if (!el || el !== o) return;
    line.textContent = text.slice(0, ++k);
    if (k < text.length) later(type, 34);
    else later(() => line.classList.remove('typing'), 900);
  };
  later(type, 500);
  haptic('sunrise');
}

// ---- the balloon

export function balloon(kind: Celebration, info: BalloonInfo): void {
  endBalloon();
  const bar = document.getElementById('taskbar');
  const tray = document.querySelector('.tray');
  if (!bar) return;
  const o = document.createElement('div');
  o.id = 'balloon';
  o.className = 'balloon k-' + kind;
  o.dataset.app = 'today';
  o.innerHTML = `<div class="b-head">${icon(kind)}<b>${esc(info.title)}</b></div>
    <div class="b-line">${esc(info.line)}</div>
    ${kind === 'wave' ? weekCells(info.cells || []) : ''}
    ${kind === 'stamp' ? '<span class="b-stamp">ГОТОВО</span>' : ''}
    <i class="b-tail"></i>`;
  document.body.appendChild(o);
  el = o;
  // above the taskbar, its tail on the tray icon
  const br = bar.getBoundingClientRect();
  const tr = tray ? tray.getBoundingClientRect() : br;
  o.style.bottom = innerHeight - br.top + 10 + 'px';
  const w = o.getBoundingClientRect();
  (o.querySelector('.b-tail') as HTMLElement).style.left =
    Math.max(10, Math.min(w.width - 22, tr.left + tr.width / 2 - w.left - 6)) + 'px';
  o.addEventListener('click', leave);
  if (reduced()) {
    haptic(kind === 'wave' || kind === 'sparkle' ? 'stamp' : kind);
  } else {
    o.animate(
      [
        { transform: 'translateY(16px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      { duration: 220, easing: STEP_MS, fill: 'backwards' },
    );
    if (kind === 'stamp') stamp(o);
    else if (kind === 'sparkle') sparkle(o);
    else if (kind === 'wave') wave(o);
    else sunrise(o);
  }
  later(leave, HOLD_MS);
}

// A step of the route has been filled: its segment in the tray icon flashes and swells, and the
// two soft clicks of a latch follow a moment after the answer's own, so they do not run into it
export function pingStep(i: number): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const seg = document.querySelectorAll('.tray i')[i] as HTMLElement | undefined;
      if (seg && !reduced())
        seg.animate(
          [
            { transform: 'scale(1)', background: '#fff' },
            { transform: 'scale(1.9)', background: '#fff' },
            { transform: 'scale(1.3)' },
            { transform: 'scale(1)' },
          ],
          { duration: 420, easing: 'steps(5, end)' },
        );
    }),
  );
  setTimeout(() => haptic('step'), 280);
}
