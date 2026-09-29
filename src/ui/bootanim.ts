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
const PRESS_MS = 90; // the pointer going down and the window giving under it
const PRESS_WIN = 0.92;
const PRESS_PTR = [0.5, 0.8]; // how far the pointer sinks, in pixels of the logo
const HOLD = 70; // ms held down
const SPRING_MS = 460; // the window springs back, overshoots and settles
const ZOOM_DELAY = 120; // after the release, the logo grows over the first real window
const ZOOM_MS = 440;
const FADE_AT = 210; // after the release, the desk fades away from in front of it
const FADE_MS = 240;
const GONE_MS = 4500; // if the phone never says the splash is gone, go on anyway

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

function later(fn: () => void, ms: number): void {
  timers.push(setTimeout(fn, ms));
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
  el.addEventListener('pointerdown', endBoot);
  // if the app never gets as far as playing it, the desk still shows up
  later(endBoot, 10000);
  // two frames on, it is on screen under the splash, which may now go
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
      if (P && P.SplashGate) P.SplashGate.ready().catch(() => {});
    }),
  );
}

function play(click: () => void): void {
  const o = el;
  const logo = o && (o.querySelector('.boot-logo') as HTMLElement | null);
  const win = o && (o.querySelector('.boot-win') as HTMLElement | null);
  const ptr = o && o.querySelector('.boot-ptr');
  const ring = o && o.querySelector('.boot-ring');
  if (!o || !logo || !win || !ptr || !ring) return;
  const box = logo.getBoundingClientRect();
  const unit = box.width / BOOT_COLS;
  win.style.transformOrigin = `${pct(BOOT_WIN_COLS / 2, BOOT_COLS)} ${pct(BOOT_WIN_ROWS / 2, BOOT_ROWS)}`;
  const sunk = `translate(${PRESS_PTR[0] * unit}px, ${PRESS_PTR[1] * unit}px)`;

  // the click: the pointer goes down, the window gives under it, a ring spreads from the tip
  click();
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
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
    ],
    { duration: 420, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', fill: 'forwards' },
  );

  // the release: the window springs back past its size and settles, the pointer lets go
  const up = PRESS_MS + HOLD;
  later(() => {
    if (!el) return;
    const real = document.querySelector('.win');
    const to = real
      ? real.getBoundingClientRect()
      : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    win.animate([{ transform: `scale(${PRESS_WIN})` }, { transform: 'scale(1)' }], {
      duration: SPRING_MS,
      easing: spring(0.4, 1.3),
      fill: 'forwards',
    });
    ptr.animate([{ transform: sunk }, { transform: 'translate(0, 0)' }], {
      duration: 320,
      easing: spring(0.5, 1),
      fill: 'forwards',
    });
    ptr.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 150,
      delay: 140,
      easing: 'ease-in',
      fill: 'forwards',
    });
    // then the whole logo grows until its window is as wide as the real one, and is over it,
    // thinning out as it goes so the big pixels never sit over the app
    const k = to.width / (BOOT_WIN_COLS * unit);
    const dx = to.left + to.width / 2 - (box.left + (BOOT_WIN_COLS * unit) / 2);
    const dy = to.top + to.height / 2 - (box.top + (BOOT_WIN_ROWS * unit) / 2);
    logo.style.transformOrigin = win.style.transformOrigin;
    logo.animate(
      [{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
      { duration: ZOOM_MS, delay: ZOOM_DELAY, easing: spring(0.8, 0.8), fill: 'forwards' },
    );
    logo.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 240,
      delay: ZOOM_DELAY + 40,
      easing: 'ease-in',
      fill: 'forwards',
    });
    later(() => {
      if (!el) return;
      o.classList.add('out');
      later(endBoot, FADE_MS + 60);
    }, FADE_AT);
  }, up);
}

// The animation goes on once the splash is gone and the app is up, whichever is later
let click: (() => void) | null = null;
let gone = !!window.__splashGone || !(window as unknown as { Capacitor?: unknown }).Capacitor;
let started = false;

function go(): void {
  if (started || !click || !gone || !el) return;
  started = true;
  play(click);
}

// MainActivity calls this as the splash goes, with where the splash drew the logo
window.__splashDone = (box?: Box | null) => {
  if (box && box.w > 0) place(box);
  gone = true;
  go();
};

// call once the first window is open. `haptic` is played with the click
export function playBoot(haptic: () => void): void {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    haptic();
    endBoot();
    return;
  }
  click = haptic;
  later(() => {
    gone = true;
    go();
  }, GONE_MS);
  go();
}

showBoot();
