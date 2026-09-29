import {
  BOOT_COLS,
  BOOT_POINTER,
  BOOT_PRESS_PTR,
  BOOT_PRESS_WIN,
  BOOT_ROWS,
  BOOT_TIP,
  BOOT_WIN_COLS,
  BOOT_WIN_ROWS,
  BOOT_WINDOW,
} from './bootlogo';

// The launch animation is the system splash: the window is there, the pointer comes out and clicks
// it, and the window is pressed in (drawable/splash_logo.xml). It ends on that pressed frame, and
// this draws the same frame at the same place the moment the web part is up, so the two run into
// each other. Then the window springs back and opens into the first real window the way windows
// opened on old desktops, as a few outlines stepping from one to the other.

const PX = 240 / 72; // css px per pixel of the logo: the splash draws its icon 240dp wide over 72 units
const HOLD = 60; // ms on the pressed frame
const SPRING_MS = 110;
const STEP = 34; // ms between the outlines of the opening
const GHOSTS = 3;
const OUT = 120; // ms of the fade at the end

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
    `<div class="boot-ptr" style="transform:scale(${BOOT_PRESS_PTR});transform-origin:${origin(BOOT_TIP[0], BOOT_TIP[1])}">${BOOT_POINTER}</div></div>`;
  document.body.appendChild(el);
  el.addEventListener('pointerdown', endBoot);
  // if the app never gets as far as playing it, the desk still shows up
  later(endBoot, 8000);
}

function open(): void {
  const o = el;
  const logo = o && o.querySelector('.boot-logo');
  const win = o && o.querySelector('.boot-win');
  const ptr = o && o.querySelector('.boot-ptr');
  if (!o || !logo || !win || !ptr) return;
  const box = logo.getBoundingClientRect();
  const unit = box.width / BOOT_COLS;
  const from = { left: box.left, top: box.top, width: BOOT_WIN_COLS * unit, height: BOOT_WIN_ROWS * unit };
  const real = document.querySelector('.win');
  const to = real
    ? real.getBoundingClientRect()
    : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  // the window springs back a little past its size, then the outlines take over
  win.animate([{ transform: `scale(${BOOT_PRESS_WIN})` }, { transform: 'scale(1.05)' }], {
    duration: SPRING_MS,
    easing: 'ease-out',
    fill: 'forwards',
  });
  ptr.animate([{ transform: `scale(${BOOT_PRESS_PTR})` }, { transform: 'scale(1)' }], {
    duration: SPRING_MS,
    easing: 'ease-out',
    fill: 'forwards',
  });
  later(() => {
    if (!el) return;
    o.classList.add('going');
    for (let i = 1; i <= GHOSTS; i++) {
      const t = 1 - (1 - i / (GHOSTS + 1)) ** 2;
      const at = (a: number, b: number) => a + (b - a) * t;
      later(
        () => {
          if (!el) return;
          const g = document.createElement('div');
          g.className = 'boot-ghost';
          g.style.cssText = `left:${at(from.left, to.left)}px;top:${at(from.top, to.top)}px;width:${at(from.width, to.width)}px;height:${at(from.height, to.height)}px`;
          el.appendChild(g);
          later(() => g.remove(), STEP * 2);
        },
        STEP * (i - 1),
      );
    }
    later(
      () => {
        if (!el) return;
        el.classList.add('out');
        later(endBoot, OUT + 40);
      },
      STEP * GHOSTS + 30,
    );
  }, SPRING_MS);
}

// call once the first window is open. `release` is the haptic for the window springing back
export function playBoot(release: () => void): void {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    release();
    endBoot();
    return;
  }
  later(() => {
    release();
    open();
  }, HOLD);
}

showBoot();
