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

export function newRoute(day: string, base: Counters, cover0: number): Route {
  return { day, steps: SLOTS.map((s) => ({ kind: s[0], done: false })), base: { ...base }, cover0 };
}

// the next kind in the step's slot, round and round; a step that is done stays as it is
export function swapStep(step: Step): Step {
  if (step.done) return step;
  const slot = SLOTS.find((s) => s.indexOf(step.kind) >= 0);
  if (!slot) return step;
  return { kind: slot[(slot.indexOf(step.kind) + 1) % slot.length], done: false };
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
