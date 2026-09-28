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
