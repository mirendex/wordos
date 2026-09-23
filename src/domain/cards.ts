import { DAY, PLUS } from '../core/util';
import { paint } from '../core/paint';
import { BANK, save, scheduleBankSave } from '../core/persist';
import { winByApp } from '../ui/windows';
import { ask } from '../services/llm';
import { speak } from '../platform/speech';
import { freqInit, FREQ, RANK } from './frequency';
import { IV, nextNew, skipWord, vocabState } from './vocab';
import { recalcLevel } from './progress';

export function bankSize(): number {
  return Object.keys(BANK).filter((w) => BANK[w] && BANK[w].length).length;
}

export function trimBank(): void {
  const v = vocabState();
  const keys = Object.keys(BANK);
  if (keys.length <= 130) return;
  const keep = new Set(keys.filter((w) => v.srs[w] && !v.srs[w].skip));
  freqInit();
  for (let i = v.n; i < v.n + 120 && i < FREQ!.length; i++) keep.add(FREQ![i].w);
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

export function needWords(limit: number): string[] {
  freqInit();
  const v = vocabState();
  const out: string[] = [];
  Object.keys(v.srs).forEach((w) => {
    if (v.srs[w].due <= PLUS(3) && !v.srs[w].skip && !(BANK[w] || []).length) out.push(w);
  });
  for (let i = v.n; i < FREQ!.length && out.length < limit; i++) {
    const w = FREQ![i].w;
    if (!v.known[w] && !v.srs[w] && !skipWord(w) && !(BANK[w] || []).length) out.push(w);
  }
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

export async function prefetch(quiet?: boolean): Promise<void> {
  const v = vocabState();
  if (v.loading) return;
  if (!navigator.onLine) return;
  const list = needWords(5);
  if (!list.length) return;
  v.loading = true;
  v.err = '';
  if (!quiet) paint();
  try {
    await fetchBatch(list);
  } catch (e) {
    v.err = (e as Error).message;
  }
  v.loading = false;
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

export async function loadCards(): Promise<void> {
  const win = winByApp('vocab')!;
  const v = vocabState();
  v.err = '';
  freqInit();
  const t = DAY();
  const due = Object.keys(v.srs)
    .filter((w) => v.srs[w].due <= t && !v.srs[w].skip)
    .sort((a, b) => (RANK![a] || 0) - (RANK![b] || 0))
    .slice(0, 7);
  const fresh = nextNew(Math.max(3, 10 - due.length)).map((x) => x.w);
  const all = due.concat(fresh);
  v.tab = 'learn';
  if (!all.length) {
    v.queue = [];
    v.i = 0;
    paint();
    return;
  }

  const miss = all.filter((w) => !(BANK[w] || []).length);
  if (miss.length) {
    if (!navigator.onLine) {
      const have = all.filter((w) => (BANK[w] || []).length);
      if (!have.length) {
        v.queue = [];
        v.i = 0;
        v.offline = 1;
        paint();
        return;
      }
    } else {
      win.data.busy = true;
      paint();
      try {
        await fetchBatch(miss.slice(0, 6));
      } catch (e) {
        v.err = (e as Error).message;
      }
      win.data.busy = false;
    }
  }
  v.offline = 0;
  v.queue = all
    .filter((w) => (BANK[w] || []).length)
    .map((w) => {
      const card = BANK[w].length > 1 ? BANK[w].shift() : BANK[w][0];
      v.seen[w] = card.sentence;
      return Object.assign({ w, rev: due.indexOf(w) >= 0 }, card);
    });
  v.i = 0;
  v.shown = false;
  v.hint = 0;
  v.res = null;
  saveBank();
  save();
  paint();
  if (v.mode === 'audio' && v.queue[0]) speak(String(v.queue[0].sentence || '').replace('___', v.queue[0].w));
  setTimeout(() => prefetch(true), 400);
}
