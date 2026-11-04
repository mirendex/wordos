import { describe, expect, it } from 'vitest';
import {
  addDays,
  avgScore,
  emptyCounters,
  gapSince,
  pickCelebration,
  newRoute,
  pickKind,
  pickSteps,
  stepDone,
  swapStep,
  weekDays,
} from './today';

const c = (o: Partial<ReturnType<typeof emptyCounters>>) => ({ ...emptyCounters(), ...o });

describe('newRoute', () => {
  it('has a cards, a reading and an ear step, none done', () => {
    const r = newRoute('2026-11-04', c({ listen: 5 }), 71.2);
    expect(r.steps.map((s) => s.kind)).toEqual(['cards', 'read', 'listen']);
    expect(r.steps.every((s) => !s.done)).toBe(true);
    expect(r.base.listen).toBe(5);
  });
});

describe('swapStep', () => {
  it('goes round the kinds of its slot', () => {
    let s = { kind: 'listen' as const, done: false };
    const seen: string[] = [s.kind];
    for (let i = 0; i < 3; i++) {
      s = swapStep(s) as typeof s;
      seen.push(s.kind);
    }
    expect(seen).toEqual(['listen', 'echo', 'order', 'listen']);
  });
  it('leaves the cards step and a finished step alone', () => {
    expect(swapStep({ kind: 'cards', done: false }).kind).toBe('cards');
    expect(swapStep({ kind: 'read', done: true })).toEqual({ kind: 'read', done: true });
    expect(swapStep({ kind: 'read', done: false, why: 'x' }).why).toBe('');
  });
});

describe('stepDone', () => {
  it('counts only what came after the route was made', () => {
    expect(stepDone('listen', c({ listen: 12 }), c({ listen: 10 }))).toBe(false);
    expect(stepDone('listen', c({ listen: 13 }), c({ listen: 10 }))).toBe(true);
    expect(stepDone('echo', c({ echo: 2 }), c({}))).toBe(true);
    expect(stepDone('diary', c({ diary: 1 }), c({}))).toBe(true);
  });
  it('fills the cards step with a batch of ten, or a short batch gone through to its end', () => {
    expect(stepDone('cards', c({ cards: 9 }), c({}))).toBe(false);
    expect(stepDone('cards', c({ cards: 10 }), c({}))).toBe(true);
    expect(stepDone('cards', c({ cards: 4 }), c({}), true)).toBe(true);
    expect(stepDone('cards', c({}), c({}), true)).toBe(false);
  });
  it('never fills the reading step by counters', () => {
    expect(stepDone('read', c({ cards: 99 }), c({}))).toBe(false);
  });
});

describe('weekDays', () => {
  it('lists seven days ending today with the finished ones marked', () => {
    const w = weekDays(['2026-11-04', '2026-11-02', '2026-10-20'], '2026-11-04');
    expect(w).toHaveLength(7);
    expect(w[0].day).toBe('2026-10-29');
    expect(w[6]).toEqual({ day: '2026-11-04', done: true });
    expect(w.filter((x) => x.done).map((x) => x.day)).toEqual(['2026-11-02', '2026-11-04']);
  });
  it('crosses a month end', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });
});

const used = (last: string, scores: number[] = []) => ({ last, count: scores.length || 1, scores });
const EAR = ['listen', 'echo', 'order'] as const;
const T = '2026-11-10';

describe('avgScore', () => {
  it('says nothing from fewer than three scores and counts only the latest ten', () => {
    expect(avgScore([90, 80])).toBeNull();
    expect(avgScore([0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100])).toBe(100);
  });
});

describe('pickKind', () => {
  it('takes the first of a slot and says it is new when nothing is known', () => {
    expect(pickKind([...EAR], {}, T)).toEqual({ kind: 'listen', why: 'ещё не пробовал' });
  });
  it('takes the one left alone longest', () => {
    const skills = { listen: used(T), echo: used('2026-11-05'), order: used('2026-11-09') };
    expect(pickKind([...EAR], skills, T)).toEqual({ kind: 'echo', why: 'не делал 5 дн.' });
  });
  it('takes the one that goes worst when all were done lately, and says how it goes', () => {
    const skills = {
      listen: used('2026-11-09', [60, 62, 58, 61]),
      echo: used('2026-11-09', [90, 92, 88]),
      order: used('2026-11-09', [80, 85, 90]),
    };
    const p = pickKind([...EAR], skills, T);
    expect(p.kind).toBe('listen');
    expect(p.why).toContain('60%');
  });
  it('gives no reason when nothing stands out', () => {
    const skills = { read: used('2026-11-09'), diary: used('2026-11-09', [90, 90, 90]) };
    const p = pickKind(['read', 'diary'], skills, T);
    expect(p.why).toBe('');
  });
  it('does not count a kind as weak on fewer than three scores', () => {
    const skills = { listen: used('2026-11-09', [10, 10]), echo: used('2026-11-09', [90, 90, 90]) };
    expect(pickKind(['listen', 'echo'], skills, T).why).not.toContain('%');
  });
});

describe('pickSteps', () => {
  it('always starts with the cards and has one step for each slot', () => {
    const steps = pickSteps({}, T);
    expect(steps.map((x) => x.kind)).toEqual(['cards', 'read', 'listen']);
    expect(steps.every((x) => !x.done)).toBe(true);
  });
  it('moves to the diary when reading was done yesterday and the diary has not been for a week', () => {
    const steps = pickSteps({ read: used('2026-11-09'), diary: used('2026-11-03', [80, 80, 80]) }, T);
    expect(steps[1].kind).toBe('diary');
  });
});

describe('pickCelebration', () => {
  const base = { weekCount: 2, gap: 1, cards: 10, right: 6 };
  it('stamps an ordinary day', () => {
    expect(pickCelebration(base)).toBe('stamp');
  });
  it('rains confetti on a clean day, but only from enough cards', () => {
    expect(pickCelebration({ ...base, right: 9 })).toBe('confetti');
    expect(pickCelebration({ ...base, cards: 5, right: 5 })).toBe('stamp');
  });
  it('greets a return after days away', () => {
    expect(pickCelebration({ ...base, gap: 4 })).toBe('sunrise');
    expect(pickCelebration({ ...base, gap: 3 })).toBe('stamp');
  });
  it('marks the week goal above all', () => {
    expect(pickCelebration({ weekCount: 5, gap: 9, cards: 10, right: 10 })).toBe('wave');
  });
});

describe('gapSince', () => {
  it('counts from the last finished day before today', () => {
    expect(gapSince(['2026-11-01', '2026-11-05', '2026-11-10'], '2026-11-10')).toBe(5);
    expect(gapSince(['2026-11-10'], '2026-11-10')).toBeNull();
    expect(gapSince([], '2026-11-10')).toBeNull();
  });
});
