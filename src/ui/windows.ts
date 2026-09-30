import { haptic } from '../platform/haptics';
import { paint } from '../core/paint';
import { WKEY } from '../core/keys';

export interface Win {
  key: string;
  app: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
  minimized?: boolean;
  maximized?: boolean;
  restore?: { x: number; y: number; w: number; h: number };
}

export const MIN_WIN_W = 280;
export const MIN_WIN_H = 200;

let W: Win[] = [];
let z = 10;

const APPS = ['read', 'games', 'term', 'vocab', 'goal', 'setup', 'diary', 'listen', 'echo', 'notes', 'about'];

// what is kept of a window between launches: where it is and how it is shown, not what is in it —
// the app's own state lives in S, and what a window holds in `data` is only half-done work
function layout(): string {
  return JSON.stringify(
    W.map((w) => ({
      key: w.key,
      app: w.app,
      z: w.z,
      x: Math.round(w.x),
      y: Math.round(w.y),
      w: Math.round(w.w),
      h: Math.round(w.h),
      minimized: !!w.minimized,
      maximized: !!w.maximized,
      restore: w.restore,
    })),
  );
}

let saved = '';
let restored = false;

// writes the windows down if they changed; cheap enough to call on every paint
export function saveWins(): void {
  if (!restored) return; // nothing to write over the saved windows until they are back
  const s = layout();
  if (s === saved) return;
  saved = s;
  window.storage!.set(WKEY, s).catch(() => {});
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d);

// puts back the windows as they were when the app was closed; false if there is nothing to put back
export function restoreWins(raw: string | null | undefined): boolean {
  restored = true;
  if (!raw) return false;
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!Array.isArray(list)) return false;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const seen = new Set<string>();
  W = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list.forEach((o: any) => {
    if (!o || typeof o !== 'object' || APPS.indexOf(o.app) < 0) return;
    const key = typeof o.key === 'string' ? o.key : o.app + ':';
    if (seen.has(key)) return;
    seen.add(key);
    // the screen may be another size now: keep each window on it and no bigger than it
    const w = Math.max(MIN_WIN_W, Math.min(vw, num(o.w, 480)));
    const h = Math.max(MIN_WIN_H, Math.min(vh, num(o.h, 460)));
    const x = Math.max(0, Math.min(vw - 90, num(o.x, 40)));
    const y = Math.max(0, Math.min(vh - 70, num(o.y, 24)));
    const r = o.restore;
    W.push({
      key,
      app: o.app,
      data: {},
      z: num(o.z, 10),
      x,
      y,
      w,
      h,
      minimized: !!o.minimized,
      maximized: !!o.maximized,
      restore:
        r && typeof r === 'object'
          ? {
              x: Math.max(0, Math.min(vw - 90, num(r.x, x))),
              y: Math.max(0, Math.min(vh - 70, num(r.y, y))),
              w: Math.max(MIN_WIN_W, Math.min(vw, num(r.w, w))),
              h: Math.max(MIN_WIN_H, Math.min(vh, num(r.h, h))),
            }
          : undefined,
    });
  });
  // the stacking order is kept, renumbered from the bottom so the counter starts low again
  W.slice()
    .sort((a, b) => a.z - b.z)
    .forEach((w, i) => (w.z = 11 + i));
  z = 10 + W.length;
  saved = layout();
  W.forEach(() => pushNav());
  syncBackGate();
  return true;
}

export function windows(): Win[] {
  return W;
}

export function visibleWindows(): Win[] {
  return W.filter((w) => !w.minimized);
}

export function findWin(pred: (w: Win) => boolean): Win | undefined {
  return W.find(pred);
}

export function winByApp(app: string): Win | undefined {
  return W.find((w) => w.app === app);
}

export function winByKey(key: string): Win | undefined {
  return W.find((w) => w.key === key);
}

export function topWin(): Win | undefined {
  const vis = visibleWindows();
  if (!vis.length) return undefined;
  return vis.reduce((a, b) => (a.z > b.z ? a : b));
}

export function topZ(): number {
  return z;
}

export function bringToFront(w: Win): void {
  w.z = ++z;
}

export function toggleMinimize(w: Win): void {
  w.minimized = !w.minimized;
  syncBackGate();
}

export function toggleMaximize(w: Win): void {
  if (w.maximized) {
    if (w.restore) {
      w.x = w.restore.x;
      w.y = w.restore.y;
      w.w = w.restore.w;
      w.h = w.restore.h;
    }
    w.maximized = false;
  } else {
    w.restore = { x: w.x, y: w.y, w: w.w, h: w.h };
    w.maximized = true;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function open(app: string, data?: any): void {
  const ex = W.find((w) => w.app === app && !data);
  if (ex) {
    ex.minimized = false;
    bringToFront(ex);
    paint();
    syncBackGate();
    return;
  }
  pushNav();
  haptic('open');
  const n = W.length;
  W.push({
    key: app + ':' + ((data && data.id) || ''),
    app,
    data: data || {},
    z: ++z,
    x: 40 + n * 26,
    y: 24 + n * 22,
    w: 480,
    h: app === 'about' ? 320 : 460,
  });
  paint();
  syncBackGate();
}

export function close(k: string): void {
  W = W.filter((w) => w.key !== k);
  haptic('close');
  paint();
  syncBackGate();
}

export function title(w: Win): string {
  if (w.app === 'read') return 'READER.EXE';
  if (w.app === 'games') return 'GAMES';
  if (w.app === 'term') return 'TERMINAL';
  if (w.app === 'vocab') return 'WORDS.DB';
  if (w.app === 'goal') return 'GOAL.EXE';
  if (w.app === 'setup') return 'SETUP';
  if (w.app === 'diary') return 'DIARY.TXT';
  if (w.app === 'listen') return 'LISTEN.EXE';
  if (w.app === 'echo') return 'ECHO.EXE';
  if (w.app === 'notes') return 'NOTES.TXT';
  return 'ABOUT';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CAP = (window as any).Capacitor && (window as any).Capacitor.Plugins;
const NATIVE_BACK = !!(CAP && CAP.App && CAP.App.addListener);
const BACKGATE = CAP && CAP.BackGate;

export function syncBackGate(): void {
  if (!BACKGATE || !BACKGATE.setEnabled) return;
  const isOpen = visibleWindows().length > 0;
  // the native @capacitor/app callback is always on and intercepts the gesture before ours —
  // we hand the gesture to our plugin only while a window is open, otherwise give control back
  // so exiting the app (and the system animation) still works as before
  if (CAP && CAP.App && CAP.App.toggleBackButtonHandler)
    CAP.App.toggleBackButtonHandler({ enabled: !isOpen });
  BACKGATE.setEnabled({ enabled: isOpen });
}

export function pushNav(): void {
  if (NATIVE_BACK) return; // в приложении кнопку назад отдаёт плагин
  try {
    history.pushState({ os: 1 }, '');
  } catch {
    /* ignore */
  }
}

export function backPressed(): boolean {
  const top = topWin();
  if (top) {
    close(top.key);
    return true;
  }
  return false;
}

window.__appBack = backPressed;

// the app may be closed from the background without another word, so the windows are written
// down every time it goes there
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveWins();
});
window.addEventListener('pagehide', saveWins);

export function topWinEl(): Element | null {
  const top = topWin();
  if (!top) return null;
  return document.querySelector('.win[data-k="' + CSS.escape(top.key) + '"]');
}

if (BACKGATE && BACKGATE.addListener) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BACKGATE.addListener('backGesture', (e: any) => {
    const el = topWinEl() as HTMLElement | null;
    if (!el) return;
    if (e.phase === 'start' || e.phase === 'progress') {
      const p = Math.max(0, Math.min(1, e.progress || 0));
      const dir = e.swipeEdge === 0 ? 1 : -1;
      el.style.transition = 'none';
      el.style.transformOrigin = dir > 0 ? 'left center' : 'right center';
      el.style.transform = 'translateX(' + dir * p * 26 + 'px) scale(' + (1 - p * 0.06) + ')';
      el.style.opacity = String(1 - p * 0.35);
    } else if (e.phase === 'cancel') {
      el.style.transition = 'transform .18s ease,opacity .18s ease';
      el.style.transform = '';
      el.style.opacity = '';
    } else {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
    }
  });
}

let lastW = window.innerWidth;
window.addEventListener('resize', () => {
  if (window.innerWidth === lastW) return; // изменилась только высота: это клавиатура
  lastW = window.innerWidth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clearTimeout((window as any).__rz);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__rz = setTimeout(paint, 150);
});
window.addEventListener('popstate', () => {
  if (!NATIVE_BACK) backPressed();
});
if (NATIVE_BACK) {
  CAP.App.addListener('backButton', () => {
    if (!backPressed()) {
      if (CAP.App.minimizeApp) CAP.App.minimizeApp();
      else if (CAP.App.exitApp) CAP.App.exitApp();
    }
  });
}
