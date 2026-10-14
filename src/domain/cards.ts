import { hasGapSentence } from '../lib/text';
import { DAY, PLUS } from '../core/util';
import { paint } from '../core/paint';
import { BANK, save, scheduleBankSave } from '../core/persist';
import { winByApp } from '../ui/windows';
import { ask } from '../services/llm';
import { speak } from '../platform/speech';
import { freqInit, RANK } from './frequency';
import { IV, nextNew, newToday, vocabState } from './vocab';
import { BATCH, newInBatch } from '../lib/srs';
import { recalcLevel } from './progress';

export function bankSize(): number {
  return Object.keys(BANK).filter((w) => BANK[w] && BANK[w].length).length;
}

export function trimBank(): void {
  const v = vocabState();
  const keys = Object.keys(BANK);
  if (keys.length <= 130) return;
  const keep = new Set(keys.filter((w) => v.srs[w] && !v.srs[w].skip));
  nextNew(120).forEach((x) => keep.add(x.w));
  keys.forEach((w) => {
    if (!keep.has(w)) delete BANK[w];
  });
}

export function saveBank(): void {
  trimBank();
  scheduleBankSave();
}

export function markKnown(w: string): void {
  setTimeout(recalcLevel, 0);
  const v = vocabState();
  v.known[w] = 1;
  v.srs[w] = { b: IV.length - 1, due: PLUS(IV[IV.length - 1]), reps: 1, lapses: 0, first: DAY(), skip: 1 };
  delete BANK[w];
  saveBank();
  save();
}

// the words the next batches will take (see loadCards) that have no card in the bank yet: the
// ones due soon, then the next `horizon` new words of the course
export function needWords(limit: number, horizon = 60): string[] {
  const v = vocabState();
  const out: string[] = [];
  Object.keys(v.srs).forEach((w) => {
    if (v.srs[w].due <= PLUS(3) && !v.srs[w].skip && !(BANK[w] || []).length) out.push(w);
  });
  nextNew(horizon).forEach((x) => {
    if (out.length < limit && !(BANK[x.w] || []).length) out.push(x.w);
  });
  return out.slice(0, limit);
}

export async function fetchBatch(list: string[]): Promise<number> {
  const v = vocabState();
  const avoid = list
    .filter((w) => v.seen[w])
    .map((w) => w + ': "' + v.seen[w] + '"')
    .join('; ');
  const r = await ask(`Слова: ${list.join(', ')}.
Для каждого слова придумай одно предложение на английском (6-12 слов) из рабочей или бытовой речи, где это слово заменено на ___ (три подчёркивания). Слово должно однозначно подходить в пропуск.
${avoid ? 'Для этих слов нужно ДРУГОЕ предложение, не повторяй: ' + avoid : ''}
Формат ответа:
{"cards":[{"w":"слово","sentence":"текст с ___","ru":"перевод предложения","word_ru":"перевод слова","ipa":"транскрипция","forms":"формы слова или пустая строка","tip":"заметка по-русски или пустая строка"}]}`);
  let added = 0;
  (Array.isArray(r.cards) ? r.cards : []).forEach((c: Record<string, string>) => {
    if (!c || typeof c !== 'object') return;
    const w = String(c.w || '').toLowerCase();
    if (!w || !c.sentence || String(c.sentence).indexOf('___') < 0) return;
    if (!BANK[w]) BANK[w] = [];
    if (BANK[w].length < 2) {
      BANK[w].push({
        sentence: c.sentence,
        ru: c.ru || '',
        word_ru: c.word_ru || '',
        ipa: c.ipa || '',
        forms: c.forms || '',
        tip: c.tip || '',
      });
      added++;
    }
  });
  saveBank();
  save();
  return added;
}

// the words being written right now, and the request writing them
let inflight: { words: string[]; done: Promise<unknown> } | null = null;

export async function prefetch(quiet?: boolean, horizon?: number): Promise<void> {
  const v = vocabState();
  if (inflight || !navigator.onLine) return;
  const list = needWords(8, horizon);
  if (!list.length) return;
  v.err = '';
  if (!quiet) paint();
  const done = fetchBatch(list);
  inflight = { words: list, done };
  try {
    await done;
  } catch (e) {
    v.err = (e as Error).message;
  }
  inflight = null;
  paint();
}

export function wordStatus(w: string): string {
  const v = vocabState();
  const s = v.srs[w];
  if (s && s.skip) return 'отмечено как знакомое';
  if (s && s.b >= 4) return 'выучено, ступень ' + (s.b + 1) + '/7';
  if (s) return 'в работе, ступень ' + (s.b + 1) + '/7, возврат ' + (s.due <= DAY() ? 'сегодня' : s.due);
  if (v.known[w]) return 'в блокноте';
  return 'ещё не бралось';
}

const hasUsable = (w: string) =>
  (BANK[w] || []).some((c: { sentence?: string }) => hasGapSentence(c.sentence));

// takes a card for `w` out of the bank for the queue, dropping any stale malformed ones
function takeCard(w: string, rev: boolean) {
  const v = vocabState();
  BANK[w] = (BANK[w] || []).filter((c: { sentence?: string }) => hasGapSentence(c.sentence));
  const card = BANK[w].length > 1 ? BANK[w].shift() : BANK[w][0];
  v.seen[w] = card.sentence;
  return Object.assign({ w, rev }, card);
}

// words whose cards are being written while the queue is already going
let dealing: string[] = [];
let run = 0;

export function dealingWords(): string[] {
  return dealing;
}

// The batch starts at once with the cards already in the bank; the ones still missing are asked
// for in the background and join the end of the queue as they come. Only a batch with nothing
// in the bank at all waits, and then the window deals the deck while it does
// `more`: the learner asked for new words past the day's limit (see newInBatch)
export async function loadCards(more = false): Promise<void> {
  const win = winByApp('vocab')!;
  const v = vocabState();
  const my = ++run;
  v.err = '';
  freqInit();
  const t = DAY();
  const dueAll = Object.keys(v.srs)
    .filter((w) => v.srs[w].due <= t && !v.srs[w].skip)
    .sort((a, b) => (RANK![a] || 0) - (RANK![b] || 0));
  const due = dueAll.slice(0, BATCH);
  const fresh = nextNew(newInBatch(dueAll.length, newToday(), more)).map((x) => x.w);
  const all = due.concat(fresh);
  v.tab = 'learn';
  v.i = 0;
  v.shown = false;
  v.hint = 0;
  v.res = null;
  if (!all.length) {
    v.queue = [];
    dealing = [];
    paint();
    return;
  }
  const ready = all.filter(hasUsable);
  const miss = all.filter((w) => !hasUsable(w));
  v.offline = !ready.length && miss.length && !navigator.onLine ? 1 : 0;
  v.queue = ready.map((w) => takeCard(w, due.indexOf(w) >= 0));
  dealing = navigator.onLine ? miss.slice(0, 6) : [];
  win.data.busy = !v.queue.length && dealing.length > 0;
  saveBank();
  save();
  paint();
  if (v.mode === 'audio' && v.queue[0]) speak(String(v.queue[0].sentence || '').replace('___', v.queue[0].w));
  if (!dealing.length) {
    setTimeout(() => prefetchAhead(), 400);
    return;
  }
  try {
    // the words the background is already writing are waited for, not asked for again
    if (inflight && dealing.some((x) => inflight!.words.indexOf(x) >= 0)) await inflight.done.catch(() => {});
    const still = dealing.filter((x) => !hasUsable(x));
    if (still.length && my === run) await fetchBatch(still);
  } catch (e) {
    if (my === run && !v.queue.length) v.err = (e as Error).message;
  }
  if (my !== run) return;
  const came = dealing.filter(hasUsable);
  const wasEmpty = !v.queue.length;
  v.queue = v.queue.concat(came.map((w) => takeCard(w, due.indexOf(w) >= 0)));
  dealing = [];
  win.data.busy = false;
  saveBank();
  save();
  paint();
  if (wasEmpty && v.mode === 'audio' && v.queue[0])
    speak(String(v.queue[0].sentence || '').replace('___', v.queue[0].w));
  setTimeout(() => prefetchAhead(), 400);
}

// keeps cards in the bank for the next two batches, a few words per request, and asks for nothing
// once they are there
export async function prefetchAhead(words = 20): Promise<void> {
  for (let n = 0; n < words; n += 8) {
    if (inflight || !needWords(1, words).length) return;
    await prefetch(true, words);
    if (vocabState().err) return;
  }
}
