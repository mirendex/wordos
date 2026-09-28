import { describe, expect, it } from 'vitest';
import { IV, newSrsCard, srsStep } from './srs';

const plus = (n: number) => 'd+' + n;

describe('srsStep', () => {
  it('advances the ladder and returns due on a correct answer', () => {
    const s = newSrsCard('d0');
    const was = srsStep(s, 'ok', 'd0', plus);
    expect(was).toBe(true);
    expect(s.b).toBe(1);
    expect(s.due).toBe(plus(IV[1]));
    expect(s.reps).toBe(1);
  });

  it('keeps the current step but still schedules on a typo', () => {
    const s = { ...newSrsCard('d0'), b: 2 };
    srsStep(s, 'typo', 'd0', plus);
    expect(s.b).toBe(2);
    expect(s.due).toBe(plus(IV[2]));
  });

  it('drops two steps and puts the card back today on a miss', () => {
    const s = { ...newSrsCard('d0'), b: 3 };
    srsStep(s, 'no', 'd0', plus);
    expect(s.b).toBe(1);
    expect(s.lapses).toBe(1);
    expect(s.due).toBe('d0');
  });

  it('never drops the step below zero', () => {
    const s = newSrsCard('d0');
    srsStep(s, 'no', 'd0', plus);
    expect(s.b).toBe(0);
  });

  it('caps the step at the top of the ladder', () => {
    const s = { ...newSrsCard('d0'), b: IV.length - 1 };
    srsStep(s, 'ok', 'd0', plus);
    expect(s.b).toBe(IV.length - 1);
  });

  it('reports a repeat once the card has already been reviewed', () => {
    const s = { ...newSrsCard('d0'), reps: 1 };
    const was = srsStep(s, 'ok', 'd0', plus);
    expect(was).toBe(false);
  });
});
