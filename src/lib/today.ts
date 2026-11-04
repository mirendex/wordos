export type StepKind = 'cards' | 'read' | 'diary' | 'listen' | 'echo' | 'order';

export interface Counters {
  cards: number; // cards answered
  listen: number; // dictation phrases checked
  echo: number; // phrases said clearly
  order: number; // sentences put together
  diary: number; // diary entries checked
}

export interface Step {
  kind: StepKind;
  done: boolean;
  why?: string; // why this step is on the route today, in a few words; empty for a step picked by hand
}

export interface Route {
  day: string;
  steps: Step[];
  base: Counters; // the counters when the route was made, so only what is done after it counts
  cover0: number; // how much of a text was understood when the day began
}

// the kinds a step can be swapped between, the first is the default
export const SLOTS: StepKind[][] = [['cards'], ['read', 'diary'], ['listen', 'echo', 'order']];

// how much of each kind makes the step done; 'read' has no number, it is marked by the reader
export const TARGET: Record<StepKind, number> = {
  cards: 10,
  read: 0,
  diary: 1,
  listen: 3,
  echo: 2,
  order: 3,
};

export const WEEK_GOAL = 5;

export function newRoute(day: string, base: Counters, cover0: number, steps?: Step[]): Route {
  return {
    day,
    steps: steps || SLOTS.map((s) => ({ kind: s[0], done: false })),
    base: { ...base },
    cover0,
  };
}

// the next kind in the step's slot, round and round; a step that is done stays as it is
export function swapStep(step: Step): Step {
  if (step.done) return step;
  const slot = SLOTS.find((s) => s.indexOf(step.kind) >= 0);
  if (!slot) return step;
  return { kind: slot[(slot.indexOf(step.kind) + 1) % slot.length], done: false, why: '' };
}

// whether what has been done since the route was made fills the step; `queueDone` is a batch of
// cards gone through to its end, which also fills the cards step when it was a short one
export function stepDone(kind: StepKind, now: Counters, base: Counters, queueDone = false): boolean {
  if (kind === 'read') return false;
  const did = (now[kind] || 0) - (base[kind] || 0);
  if (kind === 'cards') return did >= TARGET.cards || (queueDone && did > 0);
  return did >= TARGET[kind];
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

// the last seven days, the oldest first, each with whether the route was finished that day
export function weekDays(done: string[], today: string): { day: string; done: boolean }[] {
  const out: { day: string; done: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, done: done.indexOf(day) >= 0 });
  }
  return out;
}

export function emptyCounters(): Counters {
  return { cards: 0, listen: 0, echo: 0, order: 0, diary: 0 };
}

// What is known of how a kind of work goes: when it was last done and how it went, as scores out
// of 100 (the share of a dictation phrase right, how many fixes a diary entry needed...). A kind
// with no score of its own, like reading, is only known by when it was done.
export interface SkillInfo {
  last: string | null;
  count: number;
  scores: number[];
}
export type Skills = Partial<Record<StepKind, SkillInfo>>;

const RECENT = 10; // how many of the latest scores count
const MIN_SCORES = 3; // fewer than this says nothing yet
const ASSUMED = 0.3; // how weak a kind with no score is taken to be
const STALE_DAYS = 14; // after this long every kind is as forgotten as it gets

export function avgScore(scores: number[]): number | null {
  const r = scores.slice(-RECENT);
  return r.length < MIN_SCORES ? null : Math.round(r.reduce((a, b) => a + b, 0) / r.length);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

// how long ago, as a share of STALE_DAYS; a kind that was done but whose day is not known counts
// as half forgotten
function forgotten(k: SkillInfo | undefined, today: string): number {
  if (!k || (!k.count && !k.last)) return 0.7;
  if (!k.last) return 0.5;
  return Math.min(STALE_DAYS, Math.max(0, daysBetween(k.last, today))) / STALE_DAYS;
}

// Of the kinds of a slot, the one the work is most wanted in: the one not done for longest and
// the one that goes worst, the first counting more. The reason is said only when there is one.
export function pickKind(slot: StepKind[], skills: Skills, today: string): { kind: StepKind; why: string } {
  const avgs = slot.map((k) => avgScore((skills[k] && skills[k]!.scores) || []));
  const known = avgs.filter((a): a is number => a !== null);
  let best = 0;
  let bestScore = -1;
  slot.forEach((k, i) => {
    const weak = avgs[i] === null ? ASSUMED : (100 - avgs[i]!) / 100;
    const score = 0.6 * forgotten(skills[k], today) + 0.4 * weak;
    if (score > bestScore + 1e-9) {
      best = i;
      bestScore = score;
    }
  });
  const kind = slot[best];
  const info = skills[kind];
  const avg = avgs[best];
  const days = info && info.last ? daysBetween(info.last, today) : null;
  // the weak spot is named when it is the worst of those that have a score and is not a good one
  if (avg !== null && avg < 80 && (known.length < 2 || avg === Math.min(...known)))
    return { kind, why: `в нём у тебя ${avg}% верно, меньше, чем в другом` };
  if (!info || (!info.count && !info.last)) return { kind, why: 'ещё не пробовал' };
  if (days !== null && days >= 3) return { kind, why: `не делал ${days} дн.` };
  if (days === null) return { kind, why: 'давно не делал' };
  return { kind, why: '' };
}

export function pickSteps(skills: Skills, today: string): Step[] {
  return SLOTS.map((slot) => {
    if (slot.length === 1) return { kind: slot[0], done: false, why: '' };
    const p = pickKind(slot, skills, today);
    return { kind: p.kind, done: false, why: p.why };
  });
}

export type Celebration = 'check' | 'sparkle' | 'wave' | 'sunrise';

export const COMEBACK_DAYS = 4; // a route finished after being away this long is a comeback
export const CLEAN_SHARE = 0.9; // the share of cards right that makes a clean day
export const CLEAN_MIN = 8; // and the least cards it is counted from

// How the finished route is marked, the most special first: the week's goal met, a return after
// some days away, a day with nearly everything right, and otherwise the plain stamp. `gap` is the
// days since the last finished route before today, null when there was none.
export function pickCelebration(info: {
  weekCount: number;
  gap: number | null;
  cards: number;
  right: number;
}): Celebration {
  if (info.weekCount === WEEK_GOAL) return 'wave';
  if (info.gap !== null && info.gap >= COMEBACK_DAYS) return 'sunrise';
  if (info.cards >= CLEAN_MIN && info.right / info.cards >= CLEAN_SHARE) return 'sparkle';
  return 'check';
}

// days from the last of `done` before `today` to `today`; null when there is none
export function gapSince(done: string[], today: string): number | null {
  const before = done.filter((d) => d < today).sort();
  return before.length ? daysBetween(before[before.length - 1], today) : null;
}
