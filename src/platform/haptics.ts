import { S } from '../core/persist';
import { dialog } from '../ui/modal';

interface HapKind {
  i?: number;
  q?: number;
  s?: 'Medium';
  g?: number; // пауза между импульсами, мс (по умолчанию 62)
  r?: number[]; // сила каждого импульса от настройки: 1 — как есть, меньше — тише
}

const HAP: Record<string, HapKind> = {
  tap: { i: 1 }, // нажатие: один короткий импульс
  soft: { i: 1 }, // клавиша, чип
  tick: { i: 1, q: 1 }, // деление ползунка: самый тихий
  type: { i: 1, q: 1 }, // буква встала
  open: { i: 1 },
  close: { i: 1 },
  toggle: { i: 2 }, // переключение: два подряд
  detent: { i: 2 }, // крупное деление
  grab: { i: 1, s: 'Medium' },
  drop: { i: 2, s: 'Medium' },
  ok: { i: 2 }, // верно: щёлк-щёлк
  no: { i: 1, s: 'Medium' }, // мимо: один плотнее
  win: { i: 3 }, // победа: три щелчка
  boot: { i: 1, r: [0.6] }, // запуск: мягкий щелчок, когда окно раскрывается
};

// The slider is "off" at the far left and then HAP_STEPS positions of 5, up to 100.
export const HAP_STEPS = 20;
export const HAP_DEFAULT_STEP = 10; // 50 on the slider

// On a phone whose motor can vary its amplitude, the slider sets the strength itself: every pulse
// is the same short length and the number on the slider is the share of the motor's full strength
// (255), so 5 is 5% and 100 is all of it. Other phones only take a length, so there the slider
// stretches the pulse instead.
const PULSE_MS = 2;
const AMP_FULL = 255;

interface VibePlugin {
  info(): Promise<{ amplitude: boolean }>;
  pulse(a: { ms: number; amp: number }): Promise<void>;
}

// null until the phone has said whether it can vary the amplitude
let ampSupport: boolean | null = null;
let probe: Promise<void> | null = null;

// A pulse that comes before the answer (the first one, as the app opens) has to wait for it: the
// length-only fallback plays at full amplitude and is much stronger than the slider says. A phone
// that never answers is taken to have no amplitude control after a moment.
function askAmp(V: VibePlugin): Promise<void> {
  if (!probe) {
    const answer = V.info().then((r) => {
      ampSupport = !!(r && r.amplitude);
    });
    const giveUp = new Promise<void>((done) => setTimeout(done, 400));
    probe = Promise.race([answer, giveUp])
      .catch(() => undefined)
      .then(() => {
        if (ampSupport === null) ampSupport = false;
      });
  }
  return probe;
}

// the slider position: 0 is off, 1..HAP_STEPS are the strengths. A value saved by the old 0..100
// slider is turned into the nearest position
export function hapStep(): number {
  const c = S.cfg || {};
  let k = HAP_DEFAULT_STEP;
  if (typeof c.hapStep === 'number') k = c.hapStep;
  else if (typeof c.hapPower === 'number') k = c.hapPower <= 0 ? 0 : Math.max(1, Math.round(c.hapPower / 5));
  return Math.max(0, Math.min(HAP_STEPS, Math.round(k)));
}

// the number the slider shows: 0 when off, otherwise 5..100 in steps of 5
export function hapValue(step: number = hapStep()): number {
  return Math.max(0, step) * 5;
}

export function hapText(step: number = hapStep()): string {
  return step <= 0 ? 'сила: <b>0</b> · отклик выключен' : 'сила: <b>' + hapValue(step) + '</b> из 100';
}

// the same 0..100, on the scale the length-based fallback and the impact styles were made for
function hapPercent(): number {
  return hapValue();
}

export function hapStyle(bump?: boolean): 'Light' | 'Medium' | 'Heavy' {
  const p = hapPercent() + (bump ? 18 : 0);
  return p < 42 ? 'Light' : p < 76 ? 'Medium' : 'Heavy';
}

export function hapAmp(quiet?: boolean, bump?: boolean, scale = 1): number {
  const share = Math.min(100, hapValue() + (bump ? 18 : 0)) / 100;
  const amp = share * AMP_FULL;
  return Math.max(1, Math.round((quiet ? amp * 0.45 : amp) * scale));
}

// while this runs, haptic() does nothing: the app's start plays its own signal instead of the
// "a window opened" pulse
let muted = false;
export function withoutHaptics(fn: () => void): void {
  muted = true;
  try {
    fn();
  } finally {
    muted = false;
  }
}

export function haptic(kind: string): void {
  if (muted) return;
  if (S.cfg && S.cfg.haptic === false) return;
  const h = HAP[kind] || HAP.tap;
  if (hapStep() <= 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
  const style = hapStyle(h.s === 'Medium');
  const gap = h.g ?? 62;
  const rampAt = (k: number): number => (h.r && h.r[k] !== undefined ? h.r[k] : 1);
  const durAt = (k: number): number =>
    Math.max(2, Math.round((h.q ? 0.45 : 1) * hapPercent() * 0.3 * rampAt(k)));
  const V: VibePlugin | undefined = P && P.Vibe;
  if (ampSupport === null) {
    if (V && typeof V.info === 'function') {
      askAmp(V).then(() => haptic(kind));
      return;
    }
    ampSupport = false;
  }
  try {
    if (P && P.Haptics && (P.Haptics.impact || P.Haptics.vibrate)) {
      const legacy = (k: number) => {
        if (P.Haptics.vibrate && hapPercent() < 100)
          P.Haptics.vibrate({ duration: durAt(k) }).catch(() => {
            if (P.Haptics.impact) P.Haptics.impact({ style }).catch(() => {});
          });
        else if (P.Haptics.impact) P.Haptics.impact({ style }).catch(() => {});
      };
      const one = (k: number) => {
        if (ampSupport && V)
          V.pulse({ ms: PULSE_MS, amp: hapAmp(!!h.q, h.s === 'Medium', rampAt(k)) }).catch(() => legacy(k));
        else legacy(k);
      };
      for (let k = 0; k < (h.i || 1); k++) setTimeout(() => one(k), k * gap);
      return;
    }
    if (navigator.vibrate) {
      const pat: number[] = [];
      for (let k = 0; k < (h.i || 1); k++) {
        const d = durAt(k);
        pat.push(d);
        if (k < (h.i || 1) - 1) pat.push(gap - d);
      }
      navigator.vibrate(pat);
    }
  } catch {
    /* ignore */
  }
}

export function hapticTest(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
  const has = !!(P && P.Haptics) || !!navigator.vibrate;
  haptic('win');
  setTimeout(() => haptic('no'), 400);
  dialog({
    title: 'отклик',
    text: has
      ? 'Если телефон не отозвался, проверь системную настройку: Настройки, Звук и вибрация, Вибрация и отклик.'
      : 'Похоже, этот телефон вообще не умеет вибрировать.',
  });
}
