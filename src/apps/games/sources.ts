import { BANK, S } from '../../core/persist';
import { freqInit, FREQ, RANK } from '../../domain/frequency';
import { coursePos, skipWord } from '../../domain/vocab';
import { diaryState } from '../diary/state';

export function wordLimit(): number {
  freqInit();
  return Math.max(600, Math.min(FREQ!.length, coursePos() + 400));
}

export function inRange(w: string): boolean {
  const r = RANK![w];
  return !r || r <= wordLimit();
}

export function gamePool(minLen: number, maxLen: number): string[] {
  freqInit();
  const top = wordLimit();
  return FREQ!
    .slice(0, top)
    .map((x) => x.w)
    .filter((w) => {
      if (!/^[a-z]+$/.test(w)) return false;
      return w.length >= minLen && w.length <= maxLen && !skipWord(w);
    });
}

export function pairsSource(): { en: string; ru: string }[] {
  const out: { en: string; ru: string }[] = [];
  S.words.forEach((x: { en: string; ru: string }) => {
    const w = String(x.en || '').toLowerCase();
    if (x.en && x.ru && /^[a-z' -]+$/i.test(x.en) && x.en.split(' ').length <= 2 && inRange(w))
      out.push({ en: x.en, ru: x.ru });
  });
  Object.keys(BANK).forEach((w) => {
    const c = (BANK[w] || [])[0];
    if (c && c.word_ru && inRange(w) && !out.find((x) => String(x.en).toLowerCase() === w))
      out.push({ en: w, ru: c.word_ru });
  });
  return out;
}

export function diarySentences(): string[] {
  const d = diaryState();
  const out: string[] = [];
  d.items.forEach((it: { text?: string }) => {
    String(it.text || '')
      .split(/(?<=[.!?])\s+/)
      .forEach((s: string) => {
        s = s.trim();
        if (s.split(/\s+/).length >= 2) out.push(s);
      });
  });
  return out.slice(-20);
}

export function orderSource(): { en: string; ru: string }[] {
  const out: { en: string; ru: string }[] = [];
  const push = (en: string, ru?: string) => {
    const s = String(en || '').trim();
    if (s) out.push({ en: s, ru: ru || '' });
  };
  diarySentences().forEach((s) => push(s, ''));
  Object.keys(BANK).forEach((w) => {
    (BANK[w] || []).forEach((c: { sentence?: string; ru?: string }) =>
      push(String(c.sentence || '').replace('___', w), c.ru),
    );
  });
  const l = S.listen && S.listen.pool;
  if (Array.isArray(l)) l.forEach((x: { en: string; ru: string }) => push(x.en, x.ru));
  if (S.order && Array.isArray(S.order.pool))
    S.order.pool.forEach((x: { en: string; ru: string }) => push(x.en, x.ru));
  return out.slice(-20);
}

export function fwSource(): { w: string; ru: string }[] {
  const out: { w: string; ru: string }[] = [];
  const seen: Record<string, 1> = {};
  const add = (en: string, ru?: string) => {
    const w = String(en || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    const t = String(ru || '').trim();
    if (w.length < 3 || w.length > 9 || !t || seen[w]) return;
    if (!inRange(w)) return;
    seen[w] = 1;
    out.push({ w, ru: t });
  };
  S.words.forEach((x: { en: string; ru: string }) => add(x.en, x.ru));
  Object.keys(BANK).forEach((w) => {
    const c = (BANK[w] || [])[0];
    if (c) add(w, c.word_ru);
  });
  return out;
}
