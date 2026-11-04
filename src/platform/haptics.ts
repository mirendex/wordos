import { S } from '../core/persist';
import { dialog } from '../ui/modal';

// one pulse of a pattern: when it comes (ms from the start), how strong it is against the setting
// (1 as is, less is softer), whether it is a firmer one, and how long it runs when it is longer
// than the short click (a thud rather than a tick)
export type Pulse = [at: number, strength: number, firm?: boolean, ms?: number];

interface HapKind {
  i?: number;
  q?: number;
  s?: 'Medium';
  g?: number; // gap between pulses, ms (default 62)
  r?: number[]; // strength of each pulse relative to the setting: 1 as is, less is softer
  seq?: Pulse[]; // a pattern with its own timing, instead of i pulses g apart
}

const HAP: Record<string, HapKind> = {
  tap: { i: 1 }, // press: one short pulse
  soft: { i: 1 }, // key, chip
  tick: { i: 1, q: 1 }, // slider step: the softest
  type: { i: 1, q: 1 }, // a letter placed
  open: { i: 1 },
  close: { i: 1 },
  toggle: { i: 2 }, // toggle: two in a row
  detent: { i: 2 }, // major slider step
  grab: { i: 1, s: 'Medium' },
  drop: { i: 2, s: 'Medium' },
  ok: { i: 2 }, // correct: click-click
  no: { i: 1, s: 'Medium' }, // wrong: one firmer pulse
  win: { i: 3 }, // win: three clicks
  boot: { i: 1 }, // launch: the pointer clicks the window
  // A step of the day's route done: two soft clicks, the second a little firmer, like a latch.
  step: {
    seq: [
      [0, 0.5],
      [75, 0.85],
    ],
  },
  // The route done, the stamp: a tick as it is lifted, the blow as it lands (the firmest and
  // longest pulse there is, but short, as it happens once a day), then a dying echo
  stamp: {
    seq: [
      [160, 0.3],
      [380, 1, true, 16],
      [460, 0.4],
      [530, 0.2],
    ],
  },
  // The sun coming up, a comeback: a heartbeat, two soft beats and a pause, again, and a long
  // light swell at the end, slow on purpose
  sunrise: {
    seq: [
      [0, 0.4],
      [120, 0.75, false, 10],
      [800, 0.4],
      [920, 0.75, false, 10],
      [1600, 0.18],
      [1750, 0.12],
      [1900, 0.08],
    ],
  },
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

// null until the device reports whether it supports amplitude control
let ampSupport: boolean | null = null;
let probe: Promise<void> | null = null;

// A pulse requested before the device has answered (the first one, at launch) waits for it: the
// length-only fallback plays at full amplitude and is much stronger than the slider says. A device
// that never answers is assumed to have no amplitude control after a short timeout.
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

// while this runs, haptic() is a no-op: the launch animation plays its own pulse instead of the
// "window opened" one
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
  play(pulsesOf(h), () => haptic(kind));
}

// a pattern made on the spot, such as the ticks of the week filling cell by cell
export function hapticPattern(seq: Pulse[]): void {
  if (muted || (S.cfg && S.cfg.haptic === false)) return;
  play(
    seq.map(([at, strength, firm, ms]) => ({ at, ramp: strength, medium: !!firm, quiet: false, ms })),
    () => hapticPattern(seq),
  );
}

interface Play {
  at: number;
  ramp: number;
  medium: boolean;
  quiet: boolean;
  ms?: number;
}

function pulsesOf(h: HapKind): Play[] {
  if (h.seq)
    return h.seq.map(([at, strength, firm, ms]) => ({
      at,
      ramp: strength,
      medium: !!firm || h.s === 'Medium',
      quiet: !!h.q,
      ms,
    }));
  const gap = h.g ?? 62;
  const out: Play[] = [];
  for (let k = 0; k < (h.i || 1); k++)
    out.push({
      at: k * gap,
      ramp: h.r && h.r[k] !== undefined ? h.r[k] : 1,
      medium: h.s === 'Medium',
      quiet: !!h.q,
    });
  return out;
}

// `again` plays the same once the device has said whether it can vary the strength
function play(pulses: Play[], again: () => void): void {
  if (hapStep() <= 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
  const V: VibePlugin | undefined = P && P.Vibe;
  if (ampSupport === null) {
    if (V && typeof V.info === 'function') {
      askAmp(V).then(again);
      return;
    }
    ampSupport = false;
  }
  // how long a pulse runs where only the length can be set
  const durAt = (p: Play): number =>
    Math.max(p.ms || 2, Math.round((p.quiet ? 0.45 : 1) * hapPercent() * 0.3 * p.ramp));
  try {
    if (P && P.Haptics && (P.Haptics.impact || P.Haptics.vibrate)) {
      const legacy = (p: Play) => {
        // a soft pulse is the light impact, however strong the setting
        const style = p.ramp < 0.5 ? 'Light' : hapStyle(p.medium);
        if (P.Haptics.vibrate && hapPercent() < 100)
          P.Haptics.vibrate({ duration: durAt(p) }).catch(() => {
            if (P.Haptics.impact) P.Haptics.impact({ style }).catch(() => {});
          });
        else if (P.Haptics.impact) P.Haptics.impact({ style }).catch(() => {});
      };
      const one = (p: Play) => {
        if (ampSupport && V)
          V.pulse({ ms: Math.min(60, p.ms || PULSE_MS), amp: hapAmp(p.quiet, p.medium, p.ramp) }).catch(() =>
            legacy(p),
          );
        else legacy(p);
      };
      pulses.forEach((p) => setTimeout(() => one(p), p.at));
      return;
    }
    if (navigator.vibrate) {
      const pat: number[] = [];
      let end = 0;
      [...pulses]
        .sort((a, b) => a.at - b.at)
        .forEach((p) => {
          const d = durAt(p);
          pat.push(Math.max(0, p.at - end), d);
          end = Math.max(end, p.at) + d;
        });
      // the pattern starts with a pulse, so a first pause is dropped
      navigator.vibrate(pat.slice(1));
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
