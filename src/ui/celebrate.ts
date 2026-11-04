import { esc } from '../lib/scale';
import { Celebration } from '../lib/today';
import { haptic, hapticPattern, Pulse } from '../platform/haptics';

// How the day's route is marked when it is finished, four ways, each with a pattern of vibration
// that goes with it and is timed to the picture (the patterns are in platform/haptics.ts):
//   stamp     the plain day: a badge slams down like a rubber stamp, the screen jolts
//   confetti  a clean day: the card winds up, trembling, and bursts into pixels
//   wave      the week's goal: the week's days light up one after another, a tick for each
//   sunrise   a return after days away: a sun comes up, with a heartbeat
// A small toast marks each step on the way. Nothing here changes any state.

export interface CelebrationInfo {
  title: string;
  sub: string;
  cells?: boolean[]; // the week, for the wave: which days are done
}

const INK = '#16151A';
const COLORS = ['#39479E', '#C1432C', '#2C6B4A', '#D9A404', '#EDE7D8', '#8C98E0', '#F0C94A'];
const HOLD: Record<Celebration, number> = { stamp: 3300, confetti: 3800, wave: 3600, sunrise: 4000 };
const OUT_MS = 260;

let el: HTMLElement | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let toastEl: HTMLElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

function later(fn: () => void, ms: number): void {
  timers.push(setTimeout(fn, ms));
}

export function endCelebration(): void {
  timers.forEach(clearTimeout);
  timers = [];
  if (el) el.remove();
  el = null;
}

function leave(): void {
  const o = el;
  if (!o) return;
  o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: 'ease-in', fill: 'forwards' });
  later(() => {
    if (el === o) endCelebration();
  }, OUT_MS);
}

// ---- the pictures, drawn in the app's own pixels

function rects(cells: [number, number][], fill: string): string {
  return cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`).join('');
}

const CHECK: [number, number][] = [];
[
  [1, 6],
  [2, 7],
  [3, 8],
  [4, 9],
  [5, 8],
  [6, 7],
  [7, 6],
  [8, 5],
  [9, 4],
  [10, 3],
  [11, 2],
].forEach(([x, y]) => CHECK.push([x, y], [x, y + 1]));

function badge(): string {
  return `<svg class="cele-badge" viewBox="0 0 14 13" shape-rendering="crispEdges" width="96" height="89">
    <rect x="0" y="0" width="14" height="13" fill="${INK}"/>
    <rect x="1" y="1" width="12" height="11" fill="#EDE7D8"/>
    ${rects(CHECK, '#2C6B4A')}</svg>`;
}

function disc(r: number): [number, number][] {
  const out: [number, number][] = [];
  const c = r - 0.5;
  for (let y = 0; y < r * 2; y++)
    for (let x = 0; x < r * 2; x++) if ((x - c) ** 2 + (y - c) ** 2 <= r * r - 1) out.push([x, y]);
  return out;
}

function sun(): string {
  const r = 6;
  const shift = (cells: [number, number][], d: number): [number, number][] =>
    cells.map(([x, y]) => [x + d, y + d]);
  return `<svg class="cele-sun" viewBox="0 0 ${r * 2 + 2} ${r * 2 + 2}" shape-rendering="crispEdges" width="108" height="108">
    ${rects(
      shift(
        disc(r + 1).filter(([, y]) => y < r * 2 + 1),
        0,
      ),
      INK,
    )}
    ${rects(shift(disc(r), 1), '#D9A404')}
    ${rects(shift(disc(r - 2), 3), '#F0C94A')}</svg>`;
}

function week(cells: boolean[]): string {
  return `<div class="cele-week">${cells.map((on) => `<i class="${on ? 'on' : ''}"></i>`).join('')}</div>`;
}

function art(kind: Celebration, info: CelebrationInfo): string {
  if (kind === 'sunrise') return `<div class="cele-sunbox">${sun()}</div>`;
  if (kind === 'wave') return week(info.cells || []);
  return badge();
}

// ---- the four

// the badge flies in from large, lands with a squash, a ring runs out from it and the whole
// screen jolts, all at the moment of the thud (230 ms in)
function stamp(o: HTMLElement): void {
  const card = o.querySelector('.cele-card') as HTMLElement;
  const b = o.querySelector('.cele-badge') as SVGElement;
  card.animate(
    [
      { opacity: 0, transform: 'scale(1.9) rotate(-8deg)' },
      { opacity: 1, transform: 'scale(1) rotate(0)' },
    ],
    { duration: 230, easing: 'cubic-bezier(0.55, 0, 0.9, 0.5)', fill: 'backwards' },
  );
  card.animate(
    [
      { transform: 'scale(1.12, 0.86)' },
      { transform: 'scale(0.97, 1.04)' },
      { transform: 'scale(1.02, 0.99)' },
      { transform: 'scale(1)' },
    ],
    { duration: 380, delay: 230, easing: 'ease-out' },
  );
  b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], {
    duration: 260,
    delay: 230,
  });
  const ring = document.createElement('div');
  ring.className = 'cele-ring';
  o.appendChild(ring);
  ring.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0.9 },
      { transform: 'translate(-50%, -50%) scale(3.2)', opacity: 0 },
    ],
    { duration: 620, delay: 230, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', fill: 'backwards' },
  );
  o.animate(
    [
      { transform: 'translate(0, 0)' },
      { transform: 'translate(-5px, 3px)' },
      { transform: 'translate(4px, -3px)' },
      { transform: 'translate(-2px, 2px)' },
      { transform: 'translate(0, 0)' },
    ],
    { duration: 220, delay: 230, easing: 'linear' },
  );
  fadeText(o, 330);
  haptic('stamp');
}

// the card trembles harder and harder, in step with the quickening ticks, and at the blow
// (500 ms) bursts into pieces that fly out and fall
function confetti(o: HTMLElement): void {
  const card = o.querySelector('.cele-card') as HTMLElement;
  const shake: Keyframe[] = [];
  for (let i = 0; i <= 10; i++) {
    const k = (i / 10) ** 1.6 * 5;
    shake.push({
      transform: `translate(${i % 2 ? k : -k}px, ${i % 3 ? -k / 2 : k / 2}px) scale(${0.82 + i * 0.018})`,
    });
  }
  card.animate(shake, { duration: 500, easing: 'linear', fill: 'backwards' });
  card.animate([{ transform: 'scale(1.16)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], {
    duration: 340,
    delay: 500,
    easing: 'ease-out',
  });
  const fx = document.createElement('div');
  fx.className = 'cele-fx';
  o.appendChild(fx);
  const W = innerWidth;
  const H = innerHeight;
  const cx = W / 2;
  const cy = H / 2;
  for (let i = 0; i < 56; i++) {
    const p = document.createElement('i');
    const size = 5 + Math.floor(Math.random() * 3) * 3;
    p.style.cssText = `width:${size}px;height:${size}px;background:${COLORS[i % COLORS.length]};left:${cx}px;top:${cy}px`;
    fx.appendChild(p);
    const ang = -Math.PI * (0.08 + Math.random() * 0.84);
    const speed = 300 + Math.random() * 520;
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    const g = 1100;
    const spin = (Math.random() - 0.5) * 900;
    const T = 1.35 + Math.random() * 0.5;
    const frames: Keyframe[] = [];
    for (let t = 0; t <= T + 1e-6; t += 0.05) {
      frames.push({
        transform: `translate(${(vx * t).toFixed(1)}px, ${(vy * t + 0.5 * g * t * t).toFixed(1)}px) rotate(${(spin * t).toFixed(0)}deg)`,
        opacity: t > T - 0.3 ? Math.max(0, (T - t) / 0.3) : 1,
      });
    }
    p.animate(frames, { duration: T * 1000, delay: 500, easing: 'linear', fill: 'both' });
  }
  fadeText(o, 560);
  haptic('confetti');
}

// the days of the week light up one after another, each with a pop and a tick that is a little
// firmer than the last, and a blow at the end for today
function wave(o: HTMLElement): void {
  const cells = [...o.querySelectorAll<HTMLElement>('.cele-week i')];
  const step = 120;
  const ticks: Pulse[] = [];
  let n = 0;
  const total = cells.filter((c) => c.classList.contains('on')).length;
  cells.forEach((c, i) => {
    const on = c.classList.contains('on');
    c.animate(
      [
        { transform: 'scale(0.4)', opacity: 0 },
        { transform: 'scale(1.28)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 300, delay: 160 + i * step, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)', fill: 'backwards' },
    );
    if (on) {
      n++;
      const last = i === cells.length - 1;
      ticks.push([
        160 + i * step,
        last ? 1 : 0.3 + (0.45 * n) / Math.max(1, total),
        last,
        last ? 22 : undefined,
      ]);
    }
  });
  const end = 160 + cells.length * step;
  ticks.push([end + 80, 0.4], [end + 170, 0.2]);
  hapticPattern(ticks);
  o.querySelector('.cele-card')!.animate(
    [
      { transform: 'scale(0.9)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1 },
    ],
    { duration: 220, easing: 'ease-out', fill: 'backwards' },
  );
  fadeText(o, end - 60);
}

// a glow spreads up from the bottom of the screen and the sun rises from behind the card, slowly,
// with two heartbeats
function sunrise(o: HTMLElement): void {
  const glow = document.createElement('div');
  glow.className = 'cele-glow';
  // behind the card, or the card would be washed out by it
  o.insertBefore(glow, o.querySelector('.cele-card'));
  glow.animate(
    [
      { opacity: 0, transform: 'scale(0.4)' },
      { opacity: 1, transform: 'scale(1)' },
    ],
    {
      duration: 1500,
      easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)',
      fill: 'backwards',
    },
  );
  o.querySelector('.cele-sunbox')!.animate(
    [
      { transform: 'translateY(46px)', opacity: 0.2 },
      { transform: 'translateY(0)', opacity: 1 },
    ],
    { duration: 1500, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'backwards' },
  );
  const sunSvg = o.querySelector('.cele-sun') as SVGElement;
  // the beats: the sun swells a little on each
  [0, 120, 800, 920].forEach((t, i) =>
    sunSvg.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(${i % 2 ? 1.1 : 1.05})` }, { transform: 'scale(1)' }],
      {
        duration: 260,
        delay: t,
      },
    ),
  );
  o.querySelector('.cele-card')!.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 700,
    easing: 'ease-out',
    fill: 'backwards',
  });
  fadeText(o, 700);
  haptic('sunrise');
}

// the words come up from below a moment after the picture
function fadeText(o: HTMLElement, delay: number): void {
  o.querySelectorAll('.cele-t, .cele-s, .cele-go').forEach((t, i) =>
    t.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 280, delay: delay + i * 90, easing: 'ease-out', fill: 'backwards' },
    ),
  );
}

export function celebrate(kind: Celebration, info: CelebrationInfo): void {
  endCelebration();
  const o = document.createElement('div');
  o.id = 'cele';
  o.className = 'cele k-' + kind;
  o.innerHTML = `<div class="cele-dim"></div>
    <div class="cele-card">${art(kind, info)}
      <b class="cele-t">${esc(info.title)}</b>
      <span class="cele-s">${esc(info.sub)}</span>
      <button class="btn p sm cele-go" data-go="today">Итог дня</button></div>`;
  document.body.appendChild(o);
  el = o;
  o.addEventListener('click', leave);
  if (reduced()) {
    // no motion: the card is there, with the same pattern of vibration
    haptic(kind === 'wave' ? 'stamp' : kind);
  } else {
    o.querySelector('.cele-dim')!.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      fill: 'backwards',
    });
    if (kind === 'stamp') stamp(o);
    else if (kind === 'confetti') confetti(o);
    else if (kind === 'wave') wave(o);
    else sunrise(o);
  }
  later(leave, HOLD[kind]);
}

// a small note at the top that a step of the route is done, with its two soft clicks a moment
// after, so they do not run into the click of the answer that finished it
export function stepToast(text: string): void {
  if (toastTimer) clearTimeout(toastTimer);
  if (toastEl) toastEl.remove();
  const t = document.createElement('div');
  t.className = 'cele-toast';
  t.textContent = text;
  document.body.appendChild(t);
  toastEl = t;
  if (!reduced())
    t.animate(
      [
        { transform: 'translate(-50%, -140%)', opacity: 0 },
        { transform: 'translate(-50%, 0)', opacity: 1 },
      ],
      { duration: 260, easing: 'cubic-bezier(0.2, 1.2, 0.4, 1)', fill: 'backwards' },
    );
  setTimeout(() => haptic('step'), 280);
  toastTimer = setTimeout(() => {
    if (toastEl !== t) return;
    t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' }).onfinish = () => {
      t.remove();
      if (toastEl === t) toastEl = null;
    };
  }, 2000);
}
