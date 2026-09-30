import { esc } from '../lib/scale';

// What a window shows while its cards are still being written: a deck being dealt, one card at a
// time, its sentence being written before the card flies off into the batch. Without `labels`
// the card keeps its word covered, for cards whose word is the answer to be guessed
export function dealHtml(title: string, sub: string, labels: string[] = []): string {
  const cards = [0, 1, 2, 3]
    .map(
      (i) => `<div class="dcard" style="--d:${(i * 0.8).toFixed(1)}s">
      ${labels.length ? `<b>${esc(labels[i % labels.length])}</b>` : `<b class="hid" style="width:${[46, 62, 38, 54][i]}%"></b>`}<i></i><i></i><i></i></div>`,
    )
    .join('');
  return `<div class="deal"><div class="deck"><s></s><s></s>${cards}</div>
    <b class="dtitle">${esc(title)}</b><span class="dsub">${esc(sub)}</span></div>`;
}
