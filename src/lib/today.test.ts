import { describe, expect, it } from 'vitest';
import { addDays, emptyCounters, newRoute, stepDone, swapStep, weekDays } from './today';

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
