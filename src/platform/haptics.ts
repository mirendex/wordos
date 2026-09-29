import { S } from '../core/persist';
import { dialog } from '../ui/modal';

interface HapKind {
  i?: number;
  q?: number;
  s?: 'Medium';
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
};

export const HAP_DEFAULT = 5;

// On a phone whose motor can vary its amplitude, the slider sets the strength itself: every pulse
// is the same short length and the slider's 0..100 becomes an amplitude of AMP_MIN..AMP_MAX out
// of 255, so even the top is well short of full strength. Other phones only take a length, so
// there the slider stretches the pulse instead.
const PULSE_MS = 2;
const AMP_MIN = 24;
const AMP_MAX = 160;

interface VibePlugin {
  info(): Promise<{ amplitude: boolean }>;
  pulse(a: { ms: number; amp: number }): Promise<void>;
}

// null until the phone has said whether it can vary the amplitude
let ampSupport: boolean | null = null;
let asking = false;

function askAmp(V: VibePlugin | undefined): void {
  if (ampSupport !== null || asking) return;
  if (!V || !V.info) {
    ampSupport = false;
    return;
  }
  asking = true;
  V.info()
    .then((r) => {
      ampSupport = !!(r && r.amplitude);
      asking = false;
    })
    .catch(() => {
      ampSupport = false;
      asking = false;
    });
}

export function hapPower(): number {
  const v = S.cfg && typeof S.cfg.hapPower === 'number' ? S.cfg.hapPower : HAP_DEFAULT;
  return Math.max(0, Math.min(100, v));
}

export function hapStyle(bump?: boolean): 'Light' | 'Medium' | 'Heavy' {
  const p = hapPower() + (bump ? 18 : 0);
  return p < 42 ? 'Light' : p < 76 ? 'Medium' : 'Heavy';
}

export function hapAmp(quiet?: boolean, bump?: boolean): number {
  const p = Math.min(100, hapPower() + (bump ? 18 : 0));
  const amp = AMP_MIN + (p / 100) * (AMP_MAX - AMP_MIN);
  return Math.max(1, Math.round(quiet ? amp * 0.45 : amp));
}

export function haptic(kind: string): void {
  if (S.cfg && S.cfg.haptic === false) return;
  const h = HAP[kind] || HAP.tap;
  if (hapPower() <= 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
  const style = hapStyle(h.s === 'Medium');
  const gap = 62;
  const dur = Math.max(2, Math.round((h.q ? 0.45 : 1) * hapPower() * 0.3));
  const V: VibePlugin | undefined = P && P.Vibe;
  askAmp(V);
  try {
    if (P && P.Haptics && (P.Haptics.impact || P.Haptics.vibrate)) {
      const legacy = () => {
        if (P.Haptics.vibrate && hapPower() < 100)
          P.Haptics.vibrate({ duration: dur }).catch(() => {
            if (P.Haptics.impact) P.Haptics.impact({ style }).catch(() => {});
          });
        else if (P.Haptics.impact) P.Haptics.impact({ style }).catch(() => {});
      };
      const amp = hapAmp(!!h.q, h.s === 'Medium');
      const one =
        ampSupport && V
          ? () => {
              V.pulse({ ms: PULSE_MS, amp }).catch(legacy);
            }
          : legacy;
      for (let k = 0; k < (h.i || 1); k++) setTimeout(one, k * gap);
      return;
    }
    if (navigator.vibrate) {
      const d = dur;
      const pat: number[] = [];
      for (let k = 0; k < (h.i || 1); k++) {
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
