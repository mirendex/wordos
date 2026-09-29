import { DAY, PLUS } from '../core/util';
import { S, save } from '../core/persist';
import { IV, srsStep } from '../lib/srs';
import { cover, freqInit, FREQ, RANK } from './frequency';
import { recalcLevel } from './progress';

export { IV };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function vocabState(): any {
  if (!S.vocab || typeof S.vocab !== 'object') S.vocab = {};
  const v = S.vocab;
  ['known', 'srs', 'log', 'seen'].forEach((k) => {
    if (!v[k] || typeof v[k] !== 'object') v[k] = {};
  });
  if (!Array.isArray(v.queue)) v.queue = [];
  if (typeof v.n !== 'number') v.n = 0;
  if (typeof v.base !== 'number') v.base = 0;
  if (v.n === undefined) v.n = 0;
  if (!v.touched && v.n === 800 && !v.base) v.n = 0; // old default: the course used to start at word 800
  if (v.base === undefined) v.base = 0;
  if (!v.known) v.known = {};
  if (!v.srs) v.srs = {};
  if (!v.log) v.log = {};
  if (!v.seen) v.seen = {};
  if (!v.queue) v.queue = [];
  if (v.i === undefined) v.i = 0;
  if (!v.tab) v.tab = 'chart';
  return v;
}

export function myWords(): number {
  freqInit();
  const v = vocabState();
  const extra: Record<string, 1> = {};
  Object.keys(v.known).forEach((w) => {
    const r = RANK![w];
    if (r && r > v.base) extra[w] = 1;
  });
  Object.keys(v.srs).forEach((w) => {
    const r = RANK![w];
    if (r && r > v.base && v.srs[w].b > 0) extra[w] = 1;
  });
  S.words.forEach((x: { en: string }) => {
    const r = RANK![String(x.en).toLowerCase()];
    if (r && r > v.base) extra[String(x.en).toLowerCase()] = 1;
  });
  return v.base + Object.keys(extra).length;
}

// For the level estimate (not for the coverage stats — myWords() stays as the raw exposure
// count there): a word barely reviewed once shouldn't count as much as one actually retained.
export function masteryWeightedWords(): number {
  freqInit();
  const v = vocabState();
  const weight: Record<string, number> = {};
  const consider = (w: string, ww: number) => {
    const r = RANK![w];
    if (!r || r <= v.base) return;
    if ((weight[w] || 0) < ww) weight[w] = ww;
  };
  Object.keys(v.known).forEach((w) => consider(w, 1));
  Object.keys(v.srs).forEach((w) => consider(w, Math.min(1, (v.srs[w].b + 1) / IV.length)));
  S.words.forEach((x: { en: string }) => consider(String(x.en).toLowerCase(), 0.4));
  const total = Object.values(weight).reduce((a, b) => a + b, 0);
  return v.base + total;
}

export function nextPct(me: number): number {
  freqInit();
  const target = Math.floor(cover(me)) + 1;
  for (let i = me; i < FREQ!.length; i++) if (cover(i + 1) >= target) return i + 1 - me;
  return 0;
}

export function coursePos(): number {
  const v = vocabState();
  freqInit();
  // course start: the marked vocabulary size, but never past what was actually covered
  return Math.max(0, Math.min(FREQ!.length - 1, v.base || 0));
}

export function nextNew(limit: number): { w: string; r: number }[] {
  freqInit();
  const v = vocabState();
  const out: { w: string; r: number }[] = [];
  for (let i = coursePos(); i < FREQ!.length && out.length < limit; i++) {
    const w = FREQ![i].w;
    if (v.known[w] || v.srs[w]) continue;
    out.push({ w, r: i + 1 });
  }
  return out;
}

export function dueWords(): string[] {
  const v = vocabState();
  const t = DAY();
  return Object.keys(v.srs).filter((w) => v.srs[w].due <= t && !v.srs[w].skip);
}
export function learnedWords(): string[] {
  const v = vocabState();
  return Object.keys(v.srs).filter((w) => v.srs[w].b >= 4);
}
export function inProgress(): string[] {
  const v = vocabState();
  return Object.keys(v.srs).filter((w) => v.srs[w].b < 4 && !v.srs[w].skip);
}

export function forecast(): { d: string; n: number }[] {
  const v = vocabState();
  const out: { d: string; n: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = PLUS(i);
    out.push({
      d,
      n: Object.keys(v.srs).filter((w) => (i === 0 ? v.srs[w].due <= d : v.srs[w].due === d)).length,
    });
  }
  return out;
}

export function logDay(kind: 'n' | 'r' | 'ok'): void {
  const v = vocabState();
  const t = DAY();
  if (!v.log[t]) v.log[t] = { n: 0, r: 0, ok: 0 };
  v.log[t][kind]++;
}

export function srsGrade(w: string, res: 'ok' | 'typo' | 'no'): void {
  setTimeout(recalcLevel, 0);
  const hh = new Date().getHours();
  if (hh >= 3 && hh < 6) S.egg = Object.assign({}, S.egg || {}, { night: 1 });
  if (myWords() >= 100) S.egg = Object.assign({}, S.egg || {}, { hundred: 1 });
  const v = vocabState();
  const s = v.srs[w] || (v.srs[w] = { b: 0, due: DAY(), reps: 0, lapses: 0, first: DAY() });
  const was = srsStep(s, res, DAY(), PLUS);
  if (res !== 'no') logDay('ok');
  logDay(was ? 'n' : 'r');
  save();
}
