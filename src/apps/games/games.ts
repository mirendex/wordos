import { hangView } from './hangman';
import { orderView } from './order';
import { fwView } from './letters';
import { pairsView } from './pairs';
import { fiveView } from './five';
import { Win } from '../../ui/windows';

export function gamesView(w: Win): string {
  const tab = w.data.tab || 'five';
  const tabs = `<div class="rowb" style="margin:0 0 12px">
    ${[
      ['five', 'Пять букв'],
      ['fw', 'Буквы'],
      ['order', 'Порядок'],
      ['pairs', 'Пары'],
      ['hang', 'Виселица'],
    ]
      .map(([k, t]) => `<button class="btn sm ${tab === k ? 'p' : ''}" data-gtab="${k}">${t}</button>`)
      .join('')}</div>`;
  if (tab === 'hang') return tabs + hangView();
  if (tab === 'order') return tabs + orderView(w);
  if (tab === 'fw') return tabs + fwView();
  if (tab === 'pairs') return tabs + pairsView();
  return tabs + fiveView();
}
