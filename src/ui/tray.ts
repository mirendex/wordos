import { esc } from '../lib/scale';
import { Celebration } from '../lib/today';
import { haptic, hapticPattern, Pulse } from '../platform/haptics';
import { BOOT_POINTER } from './bootlogo';
import { spring } from './spring';

// The marks of the day's route are made in the desktop's own terms, with no dimming of the screen
// and no card in the middle. The route has an indicator in the taskbar, like an icon in a system
// tray, three segments that fill as the steps are done, and when the day is done a balloon pops
// out of it, as the old systems did to tell of a finished job. It does not stop what is being
// done and goes by itself. It is told four ways, each with its own motion and its own vibration:
//   check    the plain day: the pointer of the launch animation comes in, presses a box, and a
//            check draws itself in it, in the very click of the launch
//   sparkle  a clean day: a coin-flip of a star, a shine across the words, stars that twinkle
//            and drift, each with a tick
//   wave     the week's goal: its days fill one after another, a count running up with them, and
//            today lights up with sparks
//   sunrise  a return after days away: a dawn of dithered bands, the sun coming up, birds, the
//            words typed out, with a heartbeat
// Every motion is set on the clock (a delay and a length), nothing is left to timers, so a scene
// can be taken frame by frame and the vibration, which has the same clock, is where the picture is.

export interface BalloonInfo {
  title: string;
  line: string;
  cells?: boolean[]; // the week, for the wave: which days are done
}

// where things are on the screen, measured before the balloon starts to move: while it springs up
// out of the tray icon it is scaled, and what is measured then is not where it comes to rest
interface Geo {
  o: DOMRect; // the balloon
  box: DOMRect | null; // the box the check goes in
  lastCell: DOMRect | null; // today, in the week
  tray: DOMRect | null; // the tray icon
}

const INK = '#16151A';
const GREEN = '#2C6B4A';
const GOLD = '#F0C94A';
const HOLD_MS = 7000;
const POP_MS = 420;
const STEPS = (n: number): string => `steps(${n}, end)`;

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
  document.querySelectorAll('.fx').forEach((x) => x.remove());
  if (!reduced())
    o.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.9) translateY(6px)' },
      ],
      { duration: 220, easing: STEPS(4), fill: 'forwards' },
    );
  later(
    () => {
      if (el === o) endBalloon();
    },
    reduced() ? 0 : 220,
  );
}

// A move on the clock: it waits `delay` at its first frame and stays at its last. `fill` is
// 'forwards' for a move that follows another of the same thing: it must not hold its first frame
// while it waits, or it would cover the one before it.
function move(
  node: Element,
  frames: Keyframe[],
  delay: number,
  duration: number,
  easing = 'linear',
  fill: FillMode = 'both',
): Animation {
  return node.animate(frames, { duration, delay, easing, fill });
}

// ---- pictures, in the app's pixels

type Cells = [number, number][];

function rects(cells: Cells, fill: string): string {
  return cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`).join('');
}

function svg(size: number, grid: number, body: string, cls = '', h = grid): string {
  return `<svg class="${cls}" viewBox="0 0 ${grid} ${h}" width="${size}" height="${(size * h) / grid}" shape-rendering="crispEdges">${body}</svg>`;
}

const shift = (c: Cells, dx: number, dy = dx): Cells => c.map(([x, y]) => [x + dx, y + dy]);

const CHECK: Cells = [
  [1, 4],
  [2, 5],
  [3, 6],
  [4, 5],
  [5, 4],
  [6, 3],
  [7, 2],
  [8, 1],
];
// a four-pointed star: the long arms, and the short diagonals that make it round
const STAR: Cells = [
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

function disc(r: number): Cells {
  const out: Cells = [];
  const c = r - 0.5;
  for (let y = 0; y < r * 2; y++)
    for (let x = 0; x < r * 2; x++) if ((x - c) ** 2 + (y - c) ** 2 <= r * r - 1) out.push([x, y]);
  return out;
}

function starSvg(size: number): string {
  return svg(size, 8, rects(shift(STAR, 0, 1), INK) + rects(STAR, GOLD) + rects([[3, 3]], '#fff'), 'fx-s');
}

// the pointer of the launch animation, cut out of its picture; its tip is its top left corner
const POINTER = `<svg class="b-ptr" viewBox="20 15 7 10" width="21" height="30" shape-rendering="crispEdges">${BOOT_POINTER.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;

function sunSvg(): string {
  const body =
    rects(shift(disc(5), 1), INK) +
    rects(shift(disc(4), 2), '#D9A404') +
    rects(shift(disc(3), 3), '#EBBA2C') +
    rects(
      [
        [4, 4],
        [5, 4],
        [4, 5],
      ],
      GOLD,
    );
  return svg(40, 12, body, 'b-sun');
}

// two frames of a bird: the wings up, the wings down
const BIRD_UP: Cells = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 1],
  [4, 0],
];
const BIRD_DOWN: Cells = [
  [0, 2],
  [1, 1],
  [2, 2],
  [3, 1],
  [4, 2],
];
const bird = (cells: Cells): string => svg(15, 5, rects(cells, INK), 'b-bird', 3);

function pixelBurst(
  x: number,
  y: number,
  at: number,
  n = 7,
  reach = 26,
  colors = ['#C1432C', GOLD, '#fff'],
): void {
  for (let i = 0; i < n; i++) {
    const f = document.createElement('i');
    f.className = 'fx fx-fleck';
    f.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]}`;
    document.body.appendChild(f);
    const a = (Math.PI * 2 * i) / n + 0.35;
    const d = reach + (i % 3) * 8;
    move(
      f,
      [
        { transform: 'translate(0, 0) scale(1.2)', opacity: 1 },
        {
          transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d * 0.9}px) scale(0.6)`,
          opacity: 1,
          offset: 0.7,
        },
        {
          transform: `translate(${Math.cos(a) * d * 1.1}px, ${Math.sin(a) * d + 6}px) scale(0.3)`,
          opacity: 0,
        },
      ],
      at,
      420,
      STEPS(6),
      'forwards',
    );
  }
}

// ---- the four, each laid out on the clock (ms from the balloon coming up)

// The pointer of the launch animation glides in with a little overshoot, presses a box, which
// gives under it, lets go, and the check draws itself in one cell after another, with a ring
// running out of the box, pixels flying and the balloon swelling at the click.
function check(o: HTMLElement, g: Geo): Pulse[] {
  const box = o.querySelector('.b-box') as HTMLElement;
  const ptr = o.querySelector('.b-ptr') as SVGElement;
  const cells = [...o.querySelectorAll<SVGElement>('.b-cell')];
  const GLIDE = 200;
  const PRESS = 760;
  const CLICK = 840;
  move(
    ptr,
    [
      { transform: 'translate(-150px, 52px) rotate(-10deg)' },
      { transform: 'translate(-56px, -16px) rotate(-4deg)', offset: 0.55 },
      { transform: 'translate(0, 0) rotate(0)' },
    ],
    GLIDE,
    PRESS - GLIDE - 40,
    'cubic-bezier(0.3, 0.65, 0.3, 1.08)',
  );
  move(ptr, [{ opacity: 0 }, { opacity: 1 }], GLIDE, 120, 'steps(3, end)');
  move(
    ptr,
    [{ transform: 'translate(0, 0)' }, { transform: 'translate(2px, 3px)' }],
    PRESS,
    60,
    'ease-out',
    'forwards',
  );
  move(
    ptr,
    [{ transform: 'translate(2px, 3px)' }, { transform: 'translate(0, 0)' }],
    CLICK,
    160,
    spring(0.45, 1),
    'forwards',
  );
  // and away, as if it had somewhere else to be
  move(
    ptr,
    [
      { transform: 'translate(0, 0)', opacity: 1 },
      { transform: 'translate(34px, -30px)', opacity: 0 },
    ],
    1250,
    380,
    'cubic-bezier(0.5, 0, 0.9, 0.4)',
    'forwards',
  );
  move(box, [{ transform: 'scale(1)' }, { transform: 'scale(0.88)' }], PRESS, 70, 'ease-out');
  move(
    box,
    [{ transform: 'scale(0.88)' }, { transform: 'scale(1)' }],
    CLICK,
    320,
    spring(0.32, 1.6),
    'forwards',
  );
  cells.forEach((c, i) =>
    move(
      c,
      [
        { opacity: 0, transform: 'scale(0.2)' },
        { opacity: 1, transform: 'scale(1.5)', offset: 0.55 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      CLICK + 70 + i * 46,
      150,
      'ease-out',
    ),
  );
  const r = g.box!;
  const ring = document.createElement('i');
  ring.className = 'fx fx-ring';
  ring.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`;
  document.body.appendChild(ring);
  move(
    ring,
    [
      { transform: 'translate(-50%, -50%) scale(0.25)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
    ],
    CLICK,
    480,
    'cubic-bezier(0.1, 0.7, 0.3, 1)',
    'forwards',
  );
  pixelBurst(r.left + r.width / 2, r.top + r.height / 2, CLICK, 8, 30);
  move(
    o,
    [{ transform: 'scale(1.04, 0.95)' }, { transform: 'scale(1)' }],
    CLICK,
    360,
    spring(0.3, 1.5),
    'forwards',
  );
  // the title lifts a pixel as the check lands, like a letter pressed down
  move(
    o.querySelector('.b-head b')!,
    [{ transform: 'translateY(0)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }],
    CLICK + 300,
    240,
    STEPS(3),
    'forwards',
  );
  haptic('check');
  return [];
}

// A coin-flip of the star, a shine that crosses the words, and stars twinkling around and
// drifting up, each with a tick as big as itself: the sparkle is what is felt.
function sparkle(o: HTMLElement, g: Geo): Pulse[] {
  const ico = o.querySelector('.b-ico') as SVGElement;
  // the flip of the star, twice, as a coin
  move(
    ico,
    [
      { transform: 'scaleX(1)' },
      { transform: 'scaleX(0.12)', offset: 0.25 },
      { transform: 'scaleX(1)', offset: 0.5 },
      { transform: 'scaleX(0.12)', offset: 0.75 },
      { transform: 'scaleX(1) scale(1.25)' },
    ],
    200,
    620,
    STEPS(12),
  );
  move(ico, [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], 820, 300, spring(0.4, 1), 'forwards');
  // the shine, twice, the second a little slower and fainter
  const shine = o.querySelector('.b-shine i') as HTMLElement;
  const w = g.o.width;
  move(
    shine,
    [
      { transform: 'translateX(-60px) skewX(-22deg)', opacity: 0.9 },
      { transform: `translateX(${w + 20}px) skewX(-22deg)`, opacity: 0.9 },
    ],
    520,
    520,
    'cubic-bezier(0.4, 0, 0.6, 1)',
  );
  move(
    shine,
    [
      { transform: 'translateX(-60px) skewX(-22deg)', opacity: 0.5 },
      { transform: `translateX(${w + 20}px) skewX(-22deg)`, opacity: 0.5 },
    ],
    1500,
    640,
    'cubic-bezier(0.4, 0, 0.6, 1)',
    'forwards',
  );
  // stars: x, y (from the balloon's top left), size, when
  const r = g.o;
  const tray = g.tray;
  const spots: [number, number, number, number][] = [
    [r.left + 16, r.top - 8, 20, 200],
    [r.right - 22, r.top - 16, 26, 330],
    [r.left + r.width * 0.5, r.top - 20, 16, 470],
    [r.left - 4, r.top + r.height * 0.55, 18, 620],
    [tray ? tray.left + 6 : r.right - 40, tray ? tray.top - 22 : r.bottom, 24, 760],
    [r.right + 0, r.top + r.height * 0.4, 17, 900],
    [r.left + r.width * 0.3, r.top - 16, 13, 1040],
    [r.left + r.width * 0.75, r.top - 6, 15, 1180],
    [r.left + 6, r.top + r.height * 0.25, 12, 1320],
  ];
  const ticks: Pulse[] = [];
  spots.forEach(([x, y, size, at]) => {
    const s = document.createElement('div');
    s.className = 'fx fx-star';
    s.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px`;
    s.innerHTML = starSvg(size);
    document.body.appendChild(s);
    move(
      s,
      [
        { transform: 'translateY(0) scale(0)', opacity: 1 },
        { transform: 'translateY(-3px) scale(0.5)', opacity: 1, offset: 0.12 },
        { transform: 'translateY(-6px) scale(1.35)', opacity: 1, offset: 0.3 },
        { transform: 'translateY(-9px) scale(1)', opacity: 1, offset: 0.55 },
        { transform: 'translateY(-13px) scale(0.6)', opacity: 1, offset: 0.8 },
        { transform: 'translateY(-16px) scale(0)', opacity: 0 },
      ],
      at,
      640,
      STEPS(10),
    );
    ticks.push([at + 150, Math.min(0.9, 0.18 + size / 34), size >= 24]);
  });
  // a gold edge flashes as the shine crosses
  move(
    o,
    [
      { boxShadow: `3px 3px 0 ${INK}, 0 0 0 0 ${GOLD}` },
      { boxShadow: `3px 3px 0 ${INK}, 0 0 0 4px ${GOLD}`, offset: 0.4 },
      { boxShadow: `3px 3px 0 ${INK}, 0 0 0 0 ${GOLD}` },
    ],
    520,
    520,
    STEPS(5),
    'forwards',
  );
  // the shine is felt too: five ticks that grow as it crosses
  for (let i = 0; i < 5; i++) ticks.push([540 + i * 85, 0.14 + i * 0.07]);
  ticks.push([1900, 0.3], [2000, 0.16]);
  ticks.sort((a, b) => a[0] - b[0]);
  hapticPattern(ticks);
  return ticks;
}

// The week's days pop in one after another, a light running along them, and the count in the
// title running up with them; today lights up last, with sparks and a blow.
function wave(o: HTMLElement, g: Geo): Pulse[] {
  const cells = [...o.querySelectorAll<HTMLElement>('.b-week i')];
  const nums = [...o.querySelectorAll<HTMLElement>('.b-count span')];
  const START = 260;
  const STEP = 120;
  const ticks: Pulse[] = [];
  const total = cells.filter((c) => c.classList.contains('on')).length;
  let n = 0;
  cells.forEach((c, i) => {
    const at = START + i * STEP;
    const on = c.classList.contains('on');
    // the light that runs along: each cell flashes white as it comes up
    move(
      c,
      [
        { transform: 'scale(0.2)', opacity: 0 },
        { transform: 'scale(1.4)', opacity: 1, offset: 0.5 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      at,
      320,
      spring(0.35, 1.4),
    );
    if (on) {
      move(c, [{ filter: 'brightness(3)' }, { filter: 'brightness(1)' }], at, 260, STEPS(4));
      n++;
      const last = i === cells.length - 1;
      ticks.push([at + 40, last ? 1 : 0.22 + (0.5 * n) / Math.max(1, total), last, last ? 16 : undefined]);
      const num = nums[n - 1];
      if (num)
        move(
          num,
          [
            { opacity: 0, transform: 'translateY(6px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          at,
          160,
          STEPS(3),
        );
    }
  });
  const lastAt = START + (cells.length - 1) * STEP;
  const lastCell = cells[cells.length - 1];
  if (lastCell && lastCell.classList.contains('on')) {
    const r = g.lastCell!;
    // today shakes and throws sparks
    move(
      lastCell,
      [
        { transform: 'translate(0, 0)' },
        { transform: 'translate(-2px, 1px)' },
        { transform: 'translate(2px, -1px)' },
        { transform: 'translate(0, 0)' },
      ],
      lastAt + 160,
      220,
      STEPS(4),
      'forwards',
    );
    pixelBurst(r.left + r.width / 2, r.top + r.height / 2, lastAt + 60, 8, 26, [GOLD, '#fff', '#8C98E0']);
    move(
      o,
      [{ transform: 'scale(1.035, 0.95)' }, { transform: 'scale(1)' }],
      lastAt + 40,
      340,
      spring(0.3, 1.5),
      'forwards',
    );
  }
  ticks.push([lastAt + 150, 0.4], [lastAt + 240, 0.2]);
  hapticPattern(ticks);
  return ticks;
}

// A dawn comes up from the taskbar in dithered bands, the sun rises behind the words (and swells
// with each beat of the heartbeat), birds cross, and the words are typed out letter by letter.
function sunrise(o: HTMLElement, g: Geo): Pulse[] {
  const bands = [
    'rgba(226,120,60,0.55)',
    'rgba(236,160,70,0.5)',
    'rgba(240,190,80,0.45)',
    'rgba(245,215,120,0.4)',
    'rgba(250,236,170,0.3)',
  ];
  const br = g.o;
  bands.forEach((c, i) => {
    const b = document.createElement('div');
    b.className = 'fx fx-band';
    b.style.cssText = `bottom:${innerHeight - br.bottom - 10 + i * 12}px;height:12px;background:${c}`;
    document.body.appendChild(b);
    move(
      b,
      [
        { transform: 'translateY(40px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      120 + i * 130,
      600,
      STEPS(6),
    );
    move(b, [{ opacity: 1 }, { opacity: 0 }], 5200 + i * 80, 600, STEPS(5), 'forwards');
  });
  const sun = o.querySelector('.b-sun') as SVGElement;
  move(sun, [{ transform: 'translateY(30px)' }, { transform: 'translateY(0)' }], 150, 1300, STEPS(13));
  // the beats: the sun swells a little on each
  [0, 120, 800, 920].forEach((t, i) =>
    move(
      sun,
      [{ transform: 'scale(1)' }, { transform: `scale(${i % 2 ? 1.2 : 1.1})` }, { transform: 'scale(1)' }],
      1400 + t,
      260,
      STEPS(3),
      'forwards',
    ),
  );
  // birds, two, one behind the other, wings flapping on a two-frame beat
  [0, 1].forEach((k) => {
    const wrap = document.createElement('div');
    wrap.className = 'fx fx-bird';
    wrap.style.cssText = `left:${br.right - 10 - k * 4}px;top:${br.top - 30 - k * 18}px`;
    wrap.innerHTML = `<span>${bird(BIRD_UP)}</span><span>${bird(BIRD_DOWN)}</span>`;
    document.body.appendChild(wrap);
    move(
      wrap,
      [
        { transform: 'translate(40px, 0)', opacity: 1 },
        { transform: `translate(${-br.width - 70}px, ${-10 - k * 6}px)`, opacity: 1 },
      ],
      900 + k * 380,
      2800,
      'linear',
      'forwards',
    );
    const [a, b] = wrap.querySelectorAll('span');
    a.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 360,
      iterations: 9,
      easing: 'steps(1, end)',
      delay: 900 + k * 380,
      fill: 'both',
    });
    b.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 360,
      iterations: 9,
      easing: 'steps(1, end)',
      delay: 900 + k * 380,
      fill: 'both',
    });
  });
  // the words, a letter at a time
  const letters = [...o.querySelectorAll<HTMLElement>('.b-line span')];
  letters.forEach((l, i) => move(l, [{ opacity: 0 }, { opacity: 1 }], 700 + i * 34, 1, 'steps(1, end)'));
  later(() => el === o && o.querySelector('.b-line')?.classList.add('done'), 700 + letters.length * 34);
  move(
    o,
    [{ transform: 'scale(1.03, 0.97)' }, { transform: 'scale(1)' }],
    150,
    420,
    spring(0.35, 1.2),
    'forwards',
  );
  haptic('sunrise');
  return [];
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
  const head =
    kind === 'check'
      ? `<span class="b-box">${svg(30, 10, `<rect x="0" y="0" width="10" height="10" fill="${INK}"/><rect x="1" y="1" width="8" height="8" fill="#fff"/>${CHECK.map(([x, y], i) => `<g class="b-cell" data-i="${i}">${rects([[x, y + 1]], INK)}${rects([[x, y]], GREEN)}</g>`).join('')}`)}</span>${POINTER}`
      : kind === 'sparkle'
        ? svg(28, 8, rects(shift(STAR, 0, 1), INK) + rects(STAR, GOLD) + rects([[3, 3]], '#fff'), 'b-ico')
        : kind === 'sunrise'
          ? `<span class="b-sunwin">${sunSvg()}</span>`
          : '';
  const line =
    kind === 'sunrise' ? [...info.line].map((c) => `<span>${esc(c)}</span>`).join('') : esc(info.line);
  const count =
    kind === 'wave'
      ? `<span class="b-count">${[1, 2, 3, 4, 5, 6, 7].map((k) => `<span>${k}</span>`).join('')}</span>`
      : '';
  o.innerHTML = `<div class="b-shine"><i></i></div>
    <div class="b-head">${head}<b>${esc(info.title)}</b>${count}</div>
    <div class="b-line">${line}</div>
    ${kind === 'wave' ? `<div class="b-week">${(info.cells || []).map((on) => `<i class="${on ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    <i class="b-tail"></i>`;
  document.body.appendChild(o);
  el = o;
  // above the taskbar, its tail on the tray icon, and it comes out of that spot
  const br = bar.getBoundingClientRect();
  const tr = tray ? tray.getBoundingClientRect() : br;
  o.style.bottom = innerHeight - br.top + 10 + 'px';
  const w = o.getBoundingClientRect();
  const tailX = Math.max(10, Math.min(w.width - 22, tr.left + tr.width / 2 - w.left - 6));
  (o.querySelector('.b-tail') as HTMLElement).style.left = tailX + 'px';
  o.style.transformOrigin = `${tailX + 6}px 100%`;
  const geo: Geo = {
    o: o.getBoundingClientRect(),
    box: (o.querySelector('.b-box') as HTMLElement | null)?.getBoundingClientRect() ?? null,
    lastCell: [...o.querySelectorAll('.b-week i')].pop()?.getBoundingClientRect() ?? null,
    tray: tray ? tray.getBoundingClientRect() : null,
  };
  o.addEventListener('click', leave);
  if (reduced()) {
    // no motion: the balloon is there, with a plain click of vibration
    o.classList.add('still');
    o.querySelector('.b-line')?.classList.add('done');
    haptic(kind === 'sunrise' ? 'sunrise' : 'check');
  } else {
    move(
      o,
      [
        { transform: 'scale(0.15) translateY(12px)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      0,
      POP_MS,
      spring(0.42, 1.25),
    );
    // a puff of pixels from the icon as it comes out
    pixelBurst(tr.left + tr.width / 2, tr.top + 4, 0, 6, 16, ['#8a8576', '#c9c2ae', '#fff']);
    move(
      tray!,
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }],
      0,
      260,
      STEPS(4),
    );
    // the balloon rests with a slow bob, as if it breathed
    o.animate([{ translate: '0 0' }, { translate: '0 -2px' }], {
      duration: 900,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'steps(1, end)',
      delay: 1800,
    });
    // the scenes start a moment after, when the balloon is up
    const at = 160;
    later(() => {
      if (el !== o) return;
      if (kind === 'check') check(o, geo);
      else if (kind === 'sparkle') sparkle(o, geo);
      else if (kind === 'wave') wave(o, geo);
      else sunrise(o, geo);
    }, at);
  }
  later(leave, HOLD_MS);
}

// A step of the route has been filled: its segment in the tray icon flashes and swells, the whole
// icon hops, a few pixels fly up, and the two soft clicks of a latch follow a moment after the
// answer's own, so they do not run into it
export function pingStep(i: number): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const tray = document.querySelector('.tray') as HTMLElement | null;
      const seg = document.querySelectorAll('.tray i')[i] as HTMLElement | undefined;
      if (!tray || !seg || reduced()) return;
      move(
        seg,
        [
          { transform: 'scale(1)', filter: 'brightness(4)' },
          { transform: 'scale(1.9)', filter: 'brightness(3)', offset: 0.3 },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        0,
        480,
        spring(0.4, 1.3),
      );
      move(
        tray,
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(-4px)', offset: 0.35 },
          { transform: 'translateY(0)' },
        ],
        0,
        380,
        spring(0.35, 1.2),
      );
      const r = seg.getBoundingClientRect();
      pixelBurst(r.left + r.width / 2, r.top, 60, 5, 12, [GOLD, '#fff', '#8C98E0']);
    }),
  );
  setTimeout(() => haptic('step'), 280);
}
