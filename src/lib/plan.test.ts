import { describe, expect, it } from 'vitest';
import { daysLeft, dailyQuota, goalProgress } from './plan';

describe('daysLeft', () => {
  it('counts whole days to the target date', () => {
    expect(daysLeft('2026-09-28', '2026-10-12')).toBe(14);
  });

  it('is zero on the day itself', () => {
    expect(daysLeft('2026-09-28', '2026-09-28')).toBe(0);
  });

  it('goes negative once the date has passed', () => {
    expect(daysLeft('2026-09-28', '2026-09-20')).toBe(-8);
  });
});

describe('dailyQuota', () => {
  it('spreads new cards evenly over the remaining days', () => {
    expect(dailyQuota(40, 10)).toBe(5);
    expect(dailyQuota(100, 10)).toBe(10);
  });

  it('never drops below 5 while there are cards left', () => {
    expect(dailyQuota(3, 30)).toBe(5);
  });

  it('never exceeds 20 a day even close to the deadline', () => {
    expect(dailyQuota(200, 2)).toBe(20);
  });

  it('is zero once nothing new is left', () => {
    expect(dailyQuota(0, 10)).toBe(0);
  });

  it('treats a past deadline the same as one day left', () => {
    expect(dailyQuota(10, -3)).toBe(10);
  });
});

describe('goalProgress', () => {
  it('counts a card learned from step 3 or marked known', () => {
    const items = { a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' } };
    const srs = { a: { b: 3 }, b: { b: 1 }, c: { b: 0, skip: 1 as const } };
    expect(goalProgress(items, srs)).toEqual({ learned: 2, total: 3 });
  });

  it('handles an empty goal', () => {
    expect(goalProgress({}, {})).toEqual({ learned: 0, total: 0 });
  });
});
