export const IV = [1, 3, 7, 16, 35, 75, 150];

export type AnswerCheck = 'ok' | 'typo' | 'no';

export interface SrsCard {
  b: number;
  due: string;
  reps: number;
  lapses: number;
  first: string;
  skip?: 1;
}

export function newSrsCard(today: string): SrsCard {
  return { b: 0, due: today, reps: 0, lapses: 0, first: today };
}

export function srsStep(s: SrsCard, res: AnswerCheck, today: string, plus: (n: number) => string): boolean {
  const was = s.reps === 0;
  s.reps++;
  if (res === 'ok') {
    s.b = Math.min(IV.length - 1, s.b + 1);
    s.due = plus(IV[s.b]);
  } else if (res === 'typo') {
    s.due = plus(IV[Math.max(0, s.b)]);
  } else {
    s.b = Math.max(0, s.b - 2);
    s.lapses++;
    s.due = today;
  }
  return was;
}

export const BATCH = 10; // cards in a batch
export const NEW_PER_DAY = 10;

// How many new words a batch takes. While more reviews are due than fit in one batch it takes
// none, so the words already being learned are caught up with before more are started; then only
// the places the reviews leave free, up to what is left of the day's new words. `more` is the
// learner asking for new words with nothing left to review: a whole batch of them, limit or not
export function newInBatch(due: number, newToday: number, more = false): number {
  if (more) return due ? 0 : BATCH;
  if (due > BATCH) return 0;
  return Math.max(0, Math.min(BATCH - due, NEW_PER_DAY - newToday));
}
