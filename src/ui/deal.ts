import { esc } from '../lib/scale';

// What a window shows while its cards are still being written: a deck being dealt, one card at a
// time, each with one of the words the model is writing examples for, and its sentence
// being written under the word before the card flies off into the batch
export function dealHtml(words: string[], title: string, sub: string): string {
  const list = words.length ? words : ['...'];
  const cards = [0, 1, 2, 3]
    .map(
      (i) => `<div class="dcard" style="--d:${(i * 0.8).toFixed(1)}s">
      <b>${esc(list[i % list.length])}</b><i></i><i></i><i></i></div>`,
    )
    .join('');
  return `<div class="deal"><div class="deck"><s></s><s></s>${cards}</div>
    <b class="dtitle">${esc(title)}</b><span class="dsub">${esc(sub)}</span></div>`;
}
