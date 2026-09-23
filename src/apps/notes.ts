import { esc } from '../lib/scale';
import { S } from '../core/persist';
import { Win } from '../ui/windows';

export function notesView(w: Win): string {
  const tab = w.data.tab || 'words';
  return `<div class="rowb" style="margin:0 0 10px">
      <button class="btn sm ${tab === 'words' ? 'p' : ''}" data-tab="words">Слова (${S.words.length})</button>
      <button class="btn sm ${tab === 'notes' ? 'p' : ''}" data-tab="notes">Заметки (${S.notes.length})</button></div>
      ${
        tab === 'words'
          ? S.words.length
            ? S.words
                .slice()
                .reverse()
                .map(
                  (x: { en: string; ru: string }, i: number) =>
                    `<div class="nrow">
        <div class="ntext"><span class="en">${esc(x.en)}</span>${x.ru ? `<span class="ru">${esc(x.ru)}</span>` : ''}</div>
        <div class="acts"><button class="btn sm" data-speak="${esc(x.en)}">звук</button>
        <button class="btn sm" data-del="${S.words.length - 1 - i}">×</button></div></div>`,
                )
                .join('')
            : '<p class="sub">Пусто. Тапни слово в читалке, отгадай в играх или пройди карточку, и слова появятся здесь.</p>'
          : S.notes.length
            ? S.notes
                .slice()
                .reverse()
                .map(
                  (n: { wrong: string; right: string; why?: string }) =>
                    `<div class="nrow">
        <div class="ntext"><span class="en"><s>${esc(n.wrong)}</s> → <em>${esc(n.right)}</em></span>
        ${n.why ? `<span class="ru">${esc(n.why)}</span>` : ''}</div></div>`,
                )
                .join('')
            : '<p class="sub">Пусто. Правки из дневника приходят сюда.</p>'
      }`;
}
