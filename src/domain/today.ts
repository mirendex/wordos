import { DAY } from '../core/util';
import { S, save } from '../core/persist';
import { cover, freqInit } from './frequency';
import { dueWords, myWords, newToday, vocabState } from './vocab';
import { newInBatch } from '../lib/srs';
import {
  TARGET,
  Counters,
  Route,
  Step,
  StepKind,
  emptyCounters,
  newRoute,
  stepDone,
  swapStep,
  weekDays,
  WEEK_GOAL,
} from '../lib/today';

export { WEEK_GOAL };

function counters(): Counters {
  const v = vocabState();
  const total = Object.keys(v.log).reduce((a, d) => a + (v.log[d].n || 0) + (v.log[d].r || 0), 0);
  return {
    ...emptyCounters(),
    // cards answered ever, so only the ones after the route was made count
    cards: total,
    listen: (S.listen && S.listen.done) || 0,
    echo: (S.echo && S.echo.done) || 0,
    order: (S.order && S.order.done) || 0,
    diary: ((S.diary && S.diary.items) || []).length,
  };
}

export function route(): Route {
  const t = S.today as Route | undefined;
  if (t && t.day === DAY() && Array.isArray(t.steps) && t.steps.length === 3) return t;
  freqInit();
  S.today = newRoute(DAY(), counters(), cover(myWords()));
  if (!Array.isArray(S.daysDone)) S.daysDone = [];
  save();
  return S.today;
}

export function daysDone(): string[] {
  if (!Array.isArray(S.daysDone)) S.daysDone = [];
  return S.daysDone;
}

// how far a step is: what was done since the route was made and what fills it
export function progress(s: Step): { did: number; target: number } {
  const r = route();
  const did = Math.max(
    0,
    (counters()[s.kind as keyof Counters] || 0) - (r.base[s.kind as keyof Counters] || 0),
  );
  return { did: Math.min(did, TARGET[s.kind]), target: TARGET[s.kind] };
}

// the reading step is waiting to be marked
export function readStepOpen(): boolean {
  return route().steps.some((s) => s.kind === 'read' && !s.done);
}

let seenDay: string | null | undefined;

// true once for each day, the first time it is asked: the day the app was last used on is
// taken from the saved route, so it must be asked before anything paints
export function newDay(): boolean {
  if (seenDay === undefined) seenDay = (S.today && S.today.day) || null;
  const day = DAY();
  const fresh = seenDay !== day;
  seenDay = day;
  route();
  return fresh;
}

export function isFinished(): boolean {
  return route().steps.every((s) => s.done);
}

export function stepsDone(): number {
  return route().steps.filter((s) => s.done).length;
}

// whether there is nothing to do in the cards step today: no reviews due and the day's new
// words are all taken
export function cardsAllDone(): boolean {
  return !dueWords().length && !newInBatch(0, newToday());
}

// Marks the steps the counters have filled. Cheap and safe to call on every paint: it changes
// nothing and saves nothing unless a step has just been filled.
export function syncToday(): void {
  const r = route();
  const now = counters();
  const v = vocabState();
  const queueDone = v.queue.length > 0 && v.i >= v.queue.length;
  let changed = false;
  r.steps.forEach((s) => {
    if (s.done) return;
    const ok =
      s.kind === 'cards'
        ? cardsAllDone() || stepDone('cards', now, r.base, queueDone)
        : stepDone(s.kind, now, r.base);
    if (ok) {
      s.done = true;
      changed = true;
    }
  });
  if (changed) finish(r);
}

function finish(r: Route): void {
  const days = daysDone();
  if (r.steps.every((s) => s.done) && days.indexOf(r.day) < 0) {
    days.push(r.day);
    if (days.length > 30) S.daysDone = days.slice(-30);
  }
  save();
}

// the reader's "read it" button: the reading step has no counter of its own
export function markRead(): void {
  const r = route();
  const s = r.steps.find((x) => x.kind === 'read');
  if (!s || s.done) return;
  s.done = true;
  finish(r);
}

export function swap(i: number): void {
  const r = route();
  if (!r.steps[i]) return;
  r.steps[i] = swapStep(r.steps[i]);
  save();
}

export function weekRow(): { day: string; done: boolean }[] {
  return weekDays(daysDone(), DAY());
}

export function weekCount(): number {
  return weekRow().filter((x) => x.done).length;
}

// what the day came to
export function summary(): { cards: number; right: number; learned: number; cover0: number; cover1: number } {
  const v = vocabState();
  const l = v.log[DAY()] || { n: 0, r: 0, ok: 0, up: 0 };
  return {
    cards: (l.n || 0) + (l.r || 0),
    right: l.ok || 0,
    learned: l.up || 0,
    cover0: route().cover0,
    cover1: cover(myWords()),
  };
}

// the words started most recently and not yet learned, to be worked into the day's text
export function recentWords(limit = 5): string[] {
  const v = vocabState();
  return Object.keys(v.srs)
    .filter((w) => !v.srs[w].skip && v.srs[w].b < 4 && /^[a-z']+$/.test(w))
    .sort((a, b) => String(v.srs[b].first).localeCompare(String(v.srs[a].first)))
    .slice(0, limit);
}

export type { Step, StepKind };
