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
const SPRING_MS = 130; // the window springs back past its size
const ZOOM_MS = 280; // and the logo grows over the first real window
const FADE_MS = 200; // while the desk fades away from in front of it

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
  // the window springs back a little past its size and the pointer lets go
  win.animate(
    [
      { transform: `scale(${BOOT_PRESS_WIN})` },
      { transform: 'scale(1.045)', offset: 0.6 },
      { transform: 'scale(1)' },
    ],
    { duration: SPRING_MS + 90, easing: 'ease-out', fill: 'forwards' },
  );
  ptr.animate(
    [
      { transform: `translate(${BOOT_PRESS_PTR[0] * PX}px, ${BOOT_PRESS_PTR[1] * PX}px)`, opacity: 1 },
      { transform: 'translate(0, 0)', opacity: 1, offset: 0.5 },
      { transform: 'translate(0, 0)', opacity: 0 },
    ],
    { duration: SPRING_MS + 90, easing: 'ease-out', fill: 'forwards' },
  );
  // then the whole logo grows until its window is as wide as the real one, and is over it
  const k = to.width / (BOOT_WIN_COLS * unit);
  const dx = to.left + to.width / 2 - (box.left + (BOOT_WIN_COLS * unit) / 2);
  const dy = to.top + to.height / 2 - (box.top + (BOOT_WIN_ROWS * unit) / 2);
  logo.style.transformOrigin = `${(BOOT_WIN_COLS / 2 / BOOT_COLS) * 100}% ${(BOOT_WIN_ROWS / 2 / BOOT_ROWS) * 100}%`;
  // it thins out while it grows, so the big pixels never sit over the app
  logo.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      {
        transform: `translate(${dx * 0.4}px, ${dy * 0.4}px) scale(${1 + (k - 1) * 0.3})`,
        opacity: 0.75,
        offset: 0.4,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0, offset: 0.65 },
      { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0 },
    ],
    { duration: ZOOM_MS, delay: SPRING_MS, easing: 'cubic-bezier(0.45, 0, 0.15, 1)', fill: 'forwards' },
  );
  later(() => {
    if (!el) return;
    o.classList.add('out');
    later(endBoot, FADE_MS + 60);
  }, SPRING_MS + 40);
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
