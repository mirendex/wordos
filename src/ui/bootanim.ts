import {
  BOOT_COLS,
  BOOT_POINTER,
  BOOT_PRESS_PTR,
  BOOT_PRESS_WIN,
  BOOT_ROWS,
  BOOT_WIN_COLS,
  BOOT_WIN_ROWS,
  BOOT_WINDOW,
} from './bootlogo';

// The launch animation is the system splash: the window is there, the pointer comes out and clicks
// it, and the window is pressed in (drawable/splash_logo.xml). It ends on that pressed frame, and
// this draws the same frame at the same place the moment the web part is up, so the two run into
// each other. Then the window springs back, and the logo grows over the first real window while the
// desk fades away, so the app seems to come up out of the window that was clicked.

const PX = 240 / 72; // css px per pixel of the logo: the splash draws its icon 240dp wide over 72 units
const HOLD = 50; // ms on the pressed frame
const SPRING_MS = 420; // the window springs back, overshoots and settles
const ZOOM_DELAY = 110; // and the logo grows over the first real window
const ZOOM_MS = 420;
const FADE_AT = 190; // while the desk fades away from in front of it
const FADE_MS = 240;
const GONE_MS = 2500; // if the phone never says the splash is gone, go on anyway

// a damped spring from 0 to 1 as a CSS easing: `zeta` is the damping (less is springier), `swings`
// how many times it goes back and forth. A browser without linear() gets an overshooting curve.
function spring(zeta: number, swings: number, n = 48): string {
  if (!CSS.supports('animation-timing-function', 'linear(0, 1)')) return 'cubic-bezier(0.34, 1.5, 0.64, 1)';
  const w = 2 * Math.PI * swings;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const v = 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
    pts.push((i === n ? 1 : v).toFixed(4));
  }
  return `linear(${pts.join(',')})`;
}

let el: HTMLElement | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];

function later(fn: () => void, ms: number): void {
  timers.push(setTimeout(fn, ms));
}

export function endBoot(): void {
  timers.forEach(clearTimeout);
  timers = [];
  if (el) el.remove();
  el = null;
}

const origin = (x: number, y: number): string => `${(x / BOOT_COLS) * 100}% ${(y / BOOT_ROWS) * 100}%`;

// up the moment this module runs, so nothing but the end of the splash is on screen while the app loads
function showBoot(): void {
  el = document.createElement('div');
  el.id = 'boot';
  el.innerHTML =
    `<div class="boot-logo" style="width:${BOOT_COLS * PX}px">` +
    `<div class="boot-win" style="transform:scale(${BOOT_PRESS_WIN});transform-origin:${origin(BOOT_WIN_COLS / 2, BOOT_WIN_ROWS / 2)}">${BOOT_WINDOW}</div>` +
    `<div class="boot-ptr" style="transform:translate(${BOOT_PRESS_PTR[0] * PX}px,${BOOT_PRESS_PTR[1] * PX}px)">${BOOT_POINTER}</div></div>`;
  document.body.appendChild(el);
  el.addEventListener('pointerdown', endBoot);
  // if the app never gets as far as playing it, the desk still shows up
  later(endBoot, 8000);
}

function open(): void {
  const o = el;
  const logo = o && (o.querySelector('.boot-logo') as HTMLElement | null);
  const win = o && o.querySelector('.boot-win');
  const ptr = o && o.querySelector('.boot-ptr');
  if (!o || !logo || !win || !ptr) return;
  const box = logo.getBoundingClientRect();
  const unit = box.width / BOOT_COLS;
  const real = document.querySelector('.win');
  const to = real
    ? real.getBoundingClientRect()
    : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  // the window springs back from the click, past its size and settling, and the pointer lets go
  win.animate([{ transform: `scale(${BOOT_PRESS_WIN})` }, { transform: 'scale(1)' }], {
    duration: SPRING_MS,
    easing: spring(0.42, 1.3),
    fill: 'forwards',
  });
  const sunk = `translate(${BOOT_PRESS_PTR[0] * PX}px, ${BOOT_PRESS_PTR[1] * PX}px)`;
  ptr.animate([{ transform: sunk }, { transform: 'translate(0, 0)' }], {
    duration: 300,
    easing: spring(0.5, 1),
    fill: 'forwards',
  });
  ptr.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 140,
    delay: 130,
    easing: 'ease-in',
    fill: 'forwards',
  });
  // then the whole logo grows until its window is as wide as the real one, and is over it
  const k = to.width / (BOOT_WIN_COLS * unit);
  const dx = to.left + to.width / 2 - (box.left + (BOOT_WIN_COLS * unit) / 2);
  const dy = to.top + to.height / 2 - (box.top + (BOOT_WIN_ROWS * unit) / 2);
  logo.style.transformOrigin = `${(BOOT_WIN_COLS / 2 / BOOT_COLS) * 100}% ${(BOOT_WIN_ROWS / 2 / BOOT_ROWS) * 100}%`;
  logo.animate(
    [{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
    { duration: ZOOM_MS, delay: ZOOM_DELAY, easing: spring(0.8, 0.8), fill: 'forwards' },
  );
  // it thins out while it grows, so the big pixels never sit over the app
  logo.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 230,
    delay: ZOOM_DELAY + 40,
    easing: 'ease-in',
    fill: 'forwards',
  });
  later(() => {
    if (!el) return;
    o.classList.add('out');
    later(endBoot, FADE_MS + 60);
  }, FADE_AT);
}

// The web part is up while the system splash is still on screen, so its half of the animation
// waits for the phone to say the splash is gone (MainActivity does), and starts on the frame the
// splash ended on.
let release: (() => void) | null = null;
let gone = !!window.__splashGone || !(window as unknown as { Capacitor?: unknown }).Capacitor;
let started = false;

function go(): void {
  if (started || !release || !gone || !el) return;
  started = true;
  const rel = release;
  later(() => {
    rel();
    open();
  }, HOLD);
}

window.__splashDone = () => {
  gone = true;
  go();
};

// call once the first window is open. `rel` is the haptic for the window springing back
export function playBoot(rel: () => void): void {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    rel();
    endBoot();
    return;
  }
  release = rel;
  later(() => {
    gone = true;
    go();
  }, GONE_MS);
  go();
}

showBoot();
