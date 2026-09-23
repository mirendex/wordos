import { byWordsLevel, cefr } from '../lib/scale';
import { paint } from '../core/paint';
import { S, save } from '../core/persist';
import { haptic, hapPower } from '../platform/haptics';
import { nToPct, pctToN } from '../lib/scale';
import { cover } from '../domain/frequency';
import { vocabState } from '../domain/vocab';
import { chartSvg, demoHtml } from '../domain/progress';
import { fwEnd, fwMove, fwStart, isFwDragging } from '../apps/games/letters';
import { bringToFront, findWin, MIN_WIN_H, MIN_WIN_W, Win } from './windows';
import { endIconDrag, isIconDragging, moveIconDrag, startIconDrag } from './icons';

function sliderSet(clientX: number, el: HTMLElement, commit: boolean): void {
  const r = el.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  if (el.dataset.slider === 'hap') {
    const val = Math.round((pct * 100) / 5) * 5;
    if (!S.cfg) S.cfg = {};
    const was = hapPower();
    S.cfg.hapPower = val;
    (el.querySelector('.pfill') as HTMLElement).style.width = val + '%';
    (el.querySelector('.pknob') as HTMLElement).style.left = val + '%';
    const t = document.getElementById('haptxt');
    if (t) t.innerHTML = 'сила: <b>' + val + '</b> из 100' + (val <= 0 ? ' · отклик выключен' : '');
    if (val !== was && val > 0) haptic('tick');
    if (commit) {
      save();
      haptic('ok');
      paint();
    }
    return;
  }
  const n = Math.round(pctToN(pct) / 25) * 25;
  const v = vocabState();
  if (v.n !== n) {
    const big = Math.floor(n / 500);
    const bigOld = Math.floor((v.n || 0) / 500);
    const small = Math.floor(n / 100);
    const smallOld = Math.floor((v.n || 0) / 100);
    if (big !== bigOld) haptic('detent');
    else if (small !== smallOld) haptic('tick');
  }
  v.n = n;
  v.touched = 1;
  (el.querySelector('.pfill') as HTMLElement).style.width = (nToPct(n) * 100).toFixed(1) + '%';
  (el.querySelector('.pknob') as HTMLElement).style.left = (nToPct(n) * 100).toFixed(1) + '%';
  const ct = document.getElementById('covtxt');
  if (ct) ct.innerHTML = '<b>' + n + '</b> слов закрывают <b>' + cover(n).toFixed(1) + '%</b> любого текста';
  const ch = document.querySelector('.chart');
  if (ch) ch.innerHTML = chartSvg(n);
  const dt = document.getElementById('demotxt');
  if (dt) dt.innerHTML = demoHtml(n);
  const sb = document.querySelector('[data-setbase]');
  if (sb) sb.textContent = 'Знаю первые ' + n;
  const lp = document.getElementById('lvlpreview');
  if (lp) lp.textContent = 'это примерно уровень ' + cefr(byWordsLevel(n));
  if (commit) {
    save();
    paint();
  }
}

let sdrag: HTMLElement | null = null;
let marq: { x0: number; y0: number; x1: number; y1: number } | null = null;
let marqPend: { x: number; y: number } | null = null;
let drag: { w: Win; dx: number; dy: number } | null = null;
let resize: { w: Win; startX: number; startY: number; startW: number; startH: number } | null = null;
let ipress: ReturnType<typeof setTimeout> | null = null;
let lastX = 0;

function startWindowDrag(w: Win, cx: number, cy: number): void {
  bringToFront(w);
  drag = { w, dx: cx - w.x, dy: cy - w.y };
  paint();
}
function moveWindowDrag(cx: number, cy: number): void {
  if (!drag) return;
  drag.w.x = Math.max(0, Math.min(window.innerWidth - 90, cx - drag.dx));
  drag.w.y = Math.max(0, Math.min(window.innerHeight - 70, cy - drag.dy));
  const el = document.querySelector<HTMLElement>('.win[data-k="' + CSS.escape(drag.w.key) + '"]');
  if (el) {
    el.style.left = drag.w.x + 'px';
    el.style.top = drag.w.y + 'px';
  }
}
function startWindowResize(w: Win, cx: number, cy: number): void {
  resize = { w, startX: cx, startY: cy, startW: w.w, startH: w.h };
}
function moveWindowResize(cx: number, cy: number): void {
  if (!resize) return;
  const { w } = resize;
  w.w = Math.max(MIN_WIN_W, Math.min(window.innerWidth - w.x, resize.startW + (cx - resize.startX)));
  w.h = Math.max(MIN_WIN_H, Math.min(window.innerHeight - w.y, resize.startH + (cy - resize.startY)));
  const el = document.querySelector<HTMLElement>('.win[data-k="' + CSS.escape(w.key) + '"]');
  if (el) {
    el.style.width = w.w + 'px';
    el.style.height = w.h + 'px';
  }
}

/* --- marquee selection on the desktop --- */
function marqStart(x: number, y: number): void {
  marq = { x0: x, y0: y, x1: x, y1: y };
  const el = document.getElementById('marquee');
  if (el) {
    el.style.display = 'block';
    marqDraw();
  }
}
function marqDraw(): void {
  const el = document.getElementById('marquee');
  if (!el || !marq) return;
  const x = Math.min(marq.x0, marq.x1);
  const y = Math.min(marq.y0, marq.y1);
  const wd = Math.abs(marq.x1 - marq.x0);
  const ht = Math.abs(marq.y1 - marq.y0);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = wd + 'px';
  el.style.height = ht + 'px';
  document.querySelectorAll<HTMLElement>('.ic').forEach((ic) => {
    const l = ic.offsetLeft;
    const t = ic.offsetTop;
    const r = l + ic.offsetWidth;
    const b = t + ic.offsetHeight;
    ic.classList.toggle('selected', !(r < x || l > x + wd || b < y || t > y + ht));
  });
}
function marqEnd(): void {
  const el = document.getElementById('marquee');
  if (el) el.style.display = 'none';
  const n = document.querySelectorAll('.ic.selected').length;
  if (n) haptic('ok');
  marq = null;
}

export function installGestures(): void {
  document.addEventListener(
    'touchstart',
    (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-fw]')) {
        const t = e.touches[0];
        if (fwStart(t.clientX, t.clientY)) e.preventDefault();
        return;
      }
      const rk = target.closest('[data-resizek]') as HTMLElement | null;
      if (rk) {
        const w = findWin((x) => x.key === rk.dataset.resizek);
        if (w && !w.maximized) {
          const t = e.touches[0];
          startWindowResize(w, t.clientX, t.clientY);
          e.preventDefault();
        }
        return;
      }
      const dk = target.closest('[data-dragk]') as HTMLElement | null;
      if (dk && !target.closest('.min,.max,.x')) {
        const w = findWin((x) => x.key === dk.dataset.dragk);
        if (w && !w.maximized) {
          const t = e.touches[0];
          startWindowDrag(w, t.clientX, t.clientY);
          e.preventDefault();
        }
        return;
      }
      if (target.id === 'desk' || target.id === 'icons' || target.id === 'wins') {
        const t0 = e.touches[0];
        const r = document.getElementById('desk')!.getBoundingClientRect();
        marqPend = { x: t0.clientX - r.left, y: t0.clientY - r.top };
        return;
      }
      const sl = target.closest('[data-slider]') as HTMLElement | null;
      if (sl) {
        sdrag = sl;
        sl.classList.add('grab');
        haptic('grab');
        sliderSet(e.touches[0].clientX, sl, false);
        return;
      }
      const ic = target.closest('[data-icon]') as HTMLElement | null;
      if (!ic) return;
      const t = e.touches[0];
      ipress = setTimeout(() => {
        ipress = null;
        startIconDrag(ic.dataset.icon!, ic, t.clientX, t.clientY);
        haptic('grab');
      }, 380);
    },
    { passive: true },
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (isFwDragging()) {
        const t = e.touches[0];
        fwMove(t.clientX, t.clientY);
        e.preventDefault();
        return;
      }
      if (resize) {
        const t = e.touches[0];
        moveWindowResize(t.clientX, t.clientY);
        e.preventDefault();
        return;
      }
      if (drag) {
        const t = e.touches[0];
        moveWindowDrag(t.clientX, t.clientY);
        e.preventDefault();
        return;
      }
      if (marqPend && !marq) {
        const r = document.getElementById('desk')!.getBoundingClientRect();
        const x = e.touches[0].clientX - r.left;
        const y = e.touches[0].clientY - r.top;
        if (Math.abs(x - marqPend.x) > 6 || Math.abs(y - marqPend.y) > 6) {
          document.querySelectorAll('.ic.selected').forEach((i) => i.classList.remove('selected'));
          marqStart(marqPend.x, marqPend.y);
          haptic('grab');
        }
      }
      if (marq) {
        const r = document.getElementById('desk')!.getBoundingClientRect();
        marq.x1 = e.touches[0].clientX - r.left;
        marq.y1 = e.touches[0].clientY - r.top;
        marqDraw();
        e.preventDefault();
        return;
      }
      if (sdrag) {
        lastX = e.touches[0].clientX;
        sliderSet(lastX, sdrag, false);
        e.preventDefault();
        return;
      }
      if (ipress) {
        clearTimeout(ipress);
        ipress = null;
      }
      if (!isIconDragging()) return;
      const t = e.touches[0];
      moveIconDrag(t.clientX, t.clientY);
      e.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener('touchend', (e) => {
    marqPend = null;
    if (isFwDragging()) {
      fwEnd();
      return;
    }
    if (resize) {
      resize = null;
      return;
    }
    if (drag) {
      drag = null;
      return;
    }
    if (marq) {
      marqEnd();
      return;
    }
    if (sdrag) {
      sdrag.classList.remove('grab');
      haptic('drop');
      sliderSet(lastX || 0, sdrag, true);
      sdrag = null;
      return;
    }
    if (ipress) {
      clearTimeout(ipress);
      ipress = null;
    }
    if (isIconDragging()) {
      const moved = endIconDrag();
      if (moved) e.preventDefault();
    }
  });

  document.addEventListener('touchcancel', () => {
    marqPend = null;
    if (isFwDragging()) {
      fwEnd();
      return;
    }
    if (resize) {
      resize = null;
      return;
    }
    if (drag) {
      drag = null;
      return;
    }
    if (marq) {
      marqEnd();
      return;
    }
    if (sdrag) {
      sdrag.classList.remove('grab');
      sdrag = null;
      return;
    }
    if (ipress) {
      clearTimeout(ipress);
      ipress = null;
    }
    if (isIconDragging()) endIconDrag();
  });

  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-fw]')) {
      if (fwStart(e.clientX, e.clientY)) e.preventDefault();
      return;
    }
    if (target.id === 'desk' || target.id === 'icons' || target.id === 'wins') {
      document.querySelectorAll('.ic.selected').forEach((i) => i.classList.remove('selected'));
      const r = document.getElementById('desk')!.getBoundingClientRect();
      marqStart(e.clientX - r.left, e.clientY - r.top);
      e.preventDefault();
      return;
    }
    const sl = target.closest('[data-slider]') as HTMLElement | null;
    if (sl) {
      sdrag = sl;
      sl.classList.add('grab');
      lastX = e.clientX;
      sliderSet(e.clientX, sl, false);
      e.preventDefault();
      return;
    }
    const ic = target.closest('[data-icon]') as HTMLElement | null;
    if (ic) {
      ipress = setTimeout(() => {
        ipress = null;
        startIconDrag(ic.dataset.icon!, ic, e.clientX, e.clientY);
      }, 380);
      return;
    }
    const rk = target.closest('[data-resizek]') as HTMLElement | null;
    if (rk) {
      const w = findWin((x) => x.key === rk.dataset.resizek);
      if (w && !w.maximized) {
        startWindowResize(w, e.clientX, e.clientY);
        e.preventDefault();
      }
      return;
    }
    const b = target.closest('[data-dragk]') as HTMLElement | null;
    if (!b || target.closest('.min,.max,.x')) return;
    const w = findWin((x) => x.key === b.dataset.dragk);
    if (!w || w.maximized) return;
    startWindowDrag(w, e.clientX, e.clientY);
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isFwDragging()) {
      fwMove(e.clientX, e.clientY);
      return;
    }
    if (marq) {
      const r = document.getElementById('desk')!.getBoundingClientRect();
      marq.x1 = e.clientX - r.left;
      marq.y1 = e.clientY - r.top;
      marqDraw();
      return;
    }
    if (sdrag) {
      lastX = e.clientX;
      sliderSet(e.clientX, sdrag, false);
      return;
    }
    if (ipress) {
      clearTimeout(ipress);
      ipress = null;
    }
    if (isIconDragging()) {
      moveIconDrag(e.clientX, e.clientY);
      return;
    }
    if (resize) {
      moveWindowResize(e.clientX, e.clientY);
      return;
    }
    if (!drag) return;
    moveWindowDrag(e.clientX, e.clientY);
  });

  document.addEventListener('mouseup', () => {
    if (isFwDragging()) {
      fwEnd();
      return;
    }
    if (marq) marqEnd();
    if (sdrag) {
      sdrag.classList.remove('grab');
      sliderSet(lastX, sdrag, true);
      sdrag = null;
    }
    drag = null;
    resize = null;
    if (ipress) {
      clearTimeout(ipress);
      ipress = null;
    }
    if (isIconDragging()) endIconDrag();
  });
}
