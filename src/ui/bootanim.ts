import {
  BOOT_COLS,
  BOOT_ICON,
  BOOT_POINTER,
  BOOT_ROWS,
  BOOT_TIP,
  BOOT_WIN_COLS,
  BOOT_WIN_ROWS,
  BOOT_WINDOW,
} from './bootlogo';

// The launch animation starts in the system splash (drawable/splash_logo.xml): the window stands
// still and the pointer glides in and comes to rest on its corner. This draws that last frame
// under the splash, and MainActivity takes the splash away once it is there, at the very spot the
// splash drew it. From there it goes on: the pointer clicks, the window gives under it and springs
// back, and the logo grows over the first real window while the desk fades away, so the app seems
// to come up out of the window that was clicked.

const ICON_CSS = 288; // how wide the splash draws its icon, until the phone says where it really is
const PRESS_MS = 85; // the pointer going down and the window giving under it
const PRESS_WIN = 0.97;
const PRESS_PTR = [0.4, 0.6]; // how far the pointer sinks, in pixels of the logo
const HOLD = 30; // ms held down
const SPRING_MS = 300; // the window springs back, overshoots and settles
const ZOOM_DELAY = 65; // after the release, once the pointer is gone, the window grows over the first real one
const ZOOM_MS = 320;
const LOGO_FADE_AT = 40; // into the zoom, the logo thins out while the real window comes up under it
const LOGO_FADE_MS = 220;
const FADE_AT = 90; // into the zoom, the desk fades away from in front of the real window
const FADE_MS = 200;
const WIN_IN_MS = 260; // the real window settling in from a little smaller
const WIN_FROM = 0.94;
const GONE_MS = 2000; // if the phone never says the splash is gone, go on anyway
const LIMIT_MS = 5000; // if the app never gets as far as playing it, the desk still shows up

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
let leaving = false;

function later(fn: () => void, ms: number): void {
  timers.push(setTimeout(fn, ms));
}

// a tap sends the desk away at once instead of cutting the animation off
function skip(): void {
  if (!el || leaving) return;
  leaving = true;
  timers.forEach(clearTimeout);
  timers = [];
  el.classList.add('out');
  later(endBoot, FADE_MS + 60);
}

export function endBoot(): void {
  timers.forEach(clearTimeout);
  timers = [];
  if (el) el.remove();
  el = null;
}

const pct = (x: number, of: number): string => `${(x / of) * 100}%`;

// puts the logo's box (window and pointer, BOOT_COLS x BOOT_ROWS) where the splash drew it
function place(box: Box): void {
  const logo = el && (el.querySelector('.boot-logo') as HTMLElement | null);
  if (!logo) return;
  logo.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
}

// where the splash draws it, going by the drawable: the window centred in an icon ICON_CSS wide
function guessBox(): Box {
  const u = ICON_CSS / BOOT_ICON;
  const x = innerWidth / 2 - (BOOT_WIN_COLS / 2) * u;
  const y = innerHeight / 2 - (BOOT_WIN_ROWS / 2) * u;
  return { x, y, w: BOOT_COLS * u, h: BOOT_ROWS * u };
}

// up the moment this module runs, drawing the splash's last frame under it
function showBoot(): void {
  el = document.createElement('div');
  el.id = 'boot';
  el.innerHTML =
    `<div class="boot-logo"><div class="boot-win">${BOOT_WINDOW}</div>` +
    `<div class="boot-ptr">${BOOT_POINTER}</div>` +
    `<div class="boot-ring" style="left:${pct(BOOT_TIP[0], BOOT_COLS)};top:${pct(BOOT_TIP[1], BOOT_ROWS)}"></div></div>`;
  document.body.appendChild(el);
  place(guessBox());
  el.addEventListener('pointerdown', skip);
  later(endBoot, LIMIT_MS);
  // two frames on, it is on screen under the splash, which may now go
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
      if (P && P.SplashGate) P.SplashGate.ready().catch(() => {});
    }),
  );
}

// The click starts as soon as the splash is gone, and the growing over the first window as soon as
// that window is up and the click is over, so a slow start of the app never holds the click back
let click: (() => void) | null = null;
let gone = !!window.__splashGone || !(window as unknown as { Capacitor?: unknown }).Capacitor;
let ready = false;
let pressed = false;
let released = false;
let clicked = false;
let zoomed = false;
let press: { logo: HTMLElement; win: HTMLElement; box: DOMRect; unit: number } | null = null;

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

function leave(): void {
  if (!el || leaving) return;
  leaving = true;
  el.classList.add('out');
  later(endBoot, FADE_MS + 60);
}

function buzz(): void {
  if (clicked || !click) return;
  clicked = true;
  click();
}

// the pointer goes down, the window gives under it, a ring spreads from the tip; then the release:
// the window springs back past its size and settles, the pointer lifts and is gone at once
function startPress(): void {
  const o = el;
  const logo = o && (o.querySelector('.boot-logo') as HTMLElement | null);
  const win = o && (o.querySelector('.boot-win') as HTMLElement | null);
  const ptr = o && o.querySelector('.boot-ptr');
  const ring = o && o.querySelector('.boot-ring');
  if (!o || !logo || !win || !ptr || !ring) return;
  pressed = true;
  const box = logo.getBoundingClientRect();
  const unit = box.width / BOOT_COLS;
  press = { logo, win, box, unit };
  win.style.transformOrigin = `${pct(BOOT_WIN_COLS / 2, BOOT_COLS)} ${pct(BOOT_WIN_ROWS / 2, BOOT_ROWS)}`;
  const sunk = `translate(${PRESS_PTR[0] * unit}px, ${PRESS_PTR[1] * unit}px)`;

  buzz();
  ptr.animate([{ transform: 'translate(0, 0)' }, { transform: sunk }], {
    duration: PRESS_MS,
    easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
    fill: 'forwards',
  });
  win.animate([{ transform: 'scale(1)' }, { transform: `scale(${PRESS_WIN})` }], {
    duration: PRESS_MS + 20,
    easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
    fill: 'forwards',
  });
  ring.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1.3)', opacity: 0 },
    ],
    { duration: 340, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', fill: 'forwards' },
  );

  later(() => {
    if (!el) return;
    win.animate([{ transform: `scale(${PRESS_WIN})` }, { transform: 'scale(1)' }], {
      duration: SPRING_MS,
      easing: spring(0.4, 1.3),
      fill: 'forwards',
    });
    ptr.animate([{ transform: sunk }, { transform: 'translate(0, 0)' }], {
      duration: 200,
      easing: spring(0.5, 1),
      fill: 'forwards',
    });
    ptr.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 60, easing: 'ease-in', fill: 'forwards' });
    later(() => {
      released = true;
      step();
    }, ZOOM_DELAY);
  }, PRESS_MS + HOLD);
}

// with only the window left, the logo grows until the window is as wide as the real one and is
// over it, thinning out as it goes while the real window comes up under it. Where the real
// window is is read now, not when the click began, as it may have moved since
function zoom(): void {
  const o = el;
  if (!o || !press) return;
  zoomed = true;
  const { logo, win, box, unit } = press;
  const real = document.querySelector('.win');
  const to = real
    ? real.getBoundingClientRect()
    : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const k = to.width / (BOOT_WIN_COLS * unit);
  const dx = to.left + to.width / 2 - (box.left + (BOOT_WIN_COLS * unit) / 2);
  const dy = to.top + to.height / 2 - (box.top + (BOOT_WIN_ROWS * unit) / 2);
  logo.style.transformOrigin = win.style.transformOrigin;
  logo.animate(
    [{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
    { duration: ZOOM_MS, easing: spring(0.8, 0.8), fill: 'forwards' },
  );
  logo.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: LOGO_FADE_MS,
    delay: LOGO_FADE_AT,
    easing: 'ease-in',
    fill: 'forwards',
  });
  if (real)
    real.animate(
      [
        { opacity: 0, transform: `scale(${WIN_FROM})` },
        { opacity: 1, transform: 'scale(1)' },
      ],
      {
        duration: WIN_IN_MS,
        delay: FADE_AT - 20,
        easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
        fill: 'backwards',
      },
    );
  later(leave, FADE_AT);
}

function step(): void {
  if (!el || zoomed || !ready || !released) return;
  zoom();
}

function go(): void {
  if (!el || !gone || pressed) return;
  if (reduced()) {
    // no motion: the desk just fades away once the app is up
    pressed = released = true;
    if (ready) {
      buzz();
      leave();
    }
    return;
  }
  startPress();
}

// MainActivity calls this as the splash goes, with where the splash drew the logo
window.__splashDone = (box?: Box | null) => {
  if (box && box.w > 0) place(box);
  gone = true;
  go();
};

// call once the first window is open. `haptic` is played with the click
export function playBoot(haptic: () => void): void {
  if (!el) {
    haptic();
    return;
  }
  click = haptic;
  ready = true;
  if (reduced()) {
    go();
    return;
  }
  if (pressed) buzz();
  go();
  step();
}

showBoot();
later(() => {
  gone = true;
  go();
}, GONE_MS);
