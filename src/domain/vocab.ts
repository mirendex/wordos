import { DAY, PLUS } from '../core/util';
import { S, save } from '../core/persist';
import { cover, freqInit, FREQ, RANK, STOP } from './frequency';
import { recalcLevel } from './progress';

export const IV = [1, 3, 7, 16, 35, 75, 150];

export function skipWord(w: string): boolean {
  const v = vocabState();
  return v.skipStop !== false && STOP.has(w);
}

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
  if (!v.touched && v.n === 800 && !v.base) v.n = 0; // старый дефолт: курс начинался с 800-го слова
  if (v.base === undefined) v.base = 0;
  if (!v.known) v.known = {};
  if (!v.srs) v.srs = {};
  if (!v.log) v.log = {};
  if (!v.seen) v.seen = {};
  if (!v.queue) v.queue = [];
  if (v.i === undefined) v.i = 0;
  if (!v.tab) v.tab = 'chart';
  if (typeof v.skipStop !== 'boolean') v.skipStop = false;
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

export function nextPct(me: number): number {
  freqInit();
  const target = Math.floor(cover(me)) + 1;
  for (let i = me; i < FREQ!.length; i++) if (cover(i + 1) >= target) return i + 1 - me;
  return 0;
}

export function coursePos(): number {
  const v = vocabState();
  freqInit();
  // старт курса: отмеченный запас, но не дальше реально пройденного
  return Math.max(0, Math.min(FREQ!.length - 1, v.base || 0));
}

export function nextNew(limit: number): { w: string; r: number }[] {
  freqInit();
  const v = vocabState();
  const out: { w: string; r: number }[] = [];
  for (let i = coursePos(); i < FREQ!.length && out.length < limit; i++) {
    const w = FREQ![i].w;
    if (v.known[w] || v.srs[w] || skipWord(w)) continue;
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
  const was = s.reps === 0;
  s.reps++;
  if (res === 'ok') {
    s.b = Math.min(IV.length - 1, s.b + 1);
    s.due = PLUS(IV[s.b]);
    logDay('ok');
  } else if (res === 'typo') {
    s.due = PLUS(IV[Math.max(0, s.b)]);
    logDay('ok');
  } else {
    s.b = Math.max(0, s.b - 2);
    s.lapses++;
    s.due = DAY();
  }
  logDay(was ? 'n' : 'r');
  save();
}
