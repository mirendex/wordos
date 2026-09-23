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

export function hapPower(): number {
  const v = S.cfg && typeof S.cfg.hapPower === 'number' ? S.cfg.hapPower : 18;
  return Math.max(0, Math.min(100, v));
}

export function hapStyle(bump?: boolean): 'Light' | 'Medium' | 'Heavy' {
  const p = hapPower() + (bump ? 18 : 0);
  return p < 42 ? 'Light' : p < 76 ? 'Medium' : 'Heavy';
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
  try {
    if (P && P.Haptics && (P.Haptics.impact || P.Haptics.vibrate)) {
      const one = () => {
        if (P.Haptics.vibrate && hapPower() < 100)
          P.Haptics.vibrate({ duration: dur }).catch(() => {
            if (P.Haptics.impact) P.Haptics.impact({ style }).catch(() => {});
          });
        else if (P.Haptics.impact) P.Haptics.impact({ style }).catch(() => {});
      };
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
