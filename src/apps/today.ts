import { esc } from '../lib/scale';
import { SLOTS, StepKind } from '../lib/today';
import {
  cardsAllDone,
  progress,
  route,
  stepsDone,
  summary,
  weekCount,
  weekRow,
  WEEK_GOAL,
} from '../domain/today';
import { DAY } from '../core/util';
import { paint } from '../core/paint';
import { loadCards } from '../domain/cards';
import { dueWords, vocabState } from '../domain/vocab';
import { BATCH } from '../lib/srs';
import { recentWords } from '../domain/today';
import { open, winByApp } from '../ui/windows';
import { getText, randomTopic } from './reader';
import { listenNext } from './listen/listen';
import { listenState } from './listen/state';
import { echoGen, echoPick } from './echo/echo';
import { echoState } from './echo/state';

const INFO: Record<StepKind, [string, string]> = {
  cards: ['Карточки', 'пачка слов, около 3 минут'],
  read: ['Читать', 'короткий текст с твоими новыми словами, около 2 минут'],
  diary: ['Дневник', 'пара строк о дне, около 3 минут'],
  listen: ['Диктант', '3 фразы на слух, около 2 минут'],
  echo: ['Повтори вслух', '2 фразы вслух, около 2 минут'],
  order: ['Порядок слов', '3 предложения, около 2 минут'],
};

const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function weekHtml(): string {
  const today = DAY();
  return `<div class="tweek">${weekRow()
    .map(
      (x) =>
        `<div class="tday ${x.done ? 'on' : ''} ${x.day === today ? 'now' : ''}"><i></i><span>${DAYS[new Date(x.day + 'T12:00').getDay()]}</span></div>`,
    )
    .join('')}</div>
    <p class="sub">на этой неделе: ${weekCount()} из ${WEEK_GOAL} дней. Пропуск ничего не ломает, неделя считается целиком</p>`;
}

function summaryHtml(): string {
  const s = summary();
  const pct = s.cards ? Math.round((s.right / s.cards) * 100) : 0;
  const grew = s.cover1 - s.cover0;
  const note =
    grew > 0.04
      ? ''
      : grew < -0.04
        ? 'слова, на которых ошибся, вернулись в повторение: так и задумано'
        : 'растёт медленно, это нормально';
  return `<div class="note tsum">
    <span class="tt">Итог дня</span>
    ${s.cards ? `<div class="l">карточек: <u>${s.cards}</u>, верно <u>${pct}%</u></div>` : ''}
    <div class="l">слов стало выученными: <u>${s.learned}</u></div>
    <div class="l">понятно в любом тексте: <u>${s.cover0.toFixed(1)}%</u> → <u>${s.cover1.toFixed(1)}%</u>${note ? `<br><span class="sub">${note}</span>` : ''}</div>
  </div>`;
}

// why the cards come first, said from what is due now
function cardsWhy(): string {
  const due = dueWords().length;
  if (due > BATCH) return `повторений ${due}: сначала их, новые слова подождут`;
  if (due) return `к повторению ${due}: пока не забылись`;
  return cardsAllDone() ? '' : 'повторять нечего: берём новые слова';
}

export function todayView(): string {
  const r = route();
  const n = stepsDone();
  const active = r.steps.findIndex((s) => !s.done);
  const rows = r.steps
    .map((s, i) => {
      const [name, hint] = INFO[s.kind];
      const slot = SLOTS.find((x) => x.indexOf(s.kind) >= 0)!;
      const p = s.kind === 'read' || s.kind === 'cards' ? null : progress(s);
      const prog = p && p.did && !s.done ? ` · ${p.did}/${p.target}` : '';
      const auto = s.kind === 'cards' && s.done && cardsAllDone() ? ' · на сегодня всё' : '';
      const cls = s.done ? 'done' : i === active ? 'cur' : '';
      const why = s.done ? '' : s.kind === 'cards' ? cardsWhy() : s.why || '';
      return `<div class="tstep ${cls}">
        <div class="tmark">${s.done ? '✓' : i + 1}</div>
        <div class="tbody"><b>${name}</b><span>${esc(hint)}${prog}${auto}</span>
          ${why ? `<span class="why">${esc(why)}</span>` : ''}
          ${
            s.done
              ? ''
              : `<div class="rowb">
            <button class="btn sm ${i === active ? 'p' : ''}" data-tstart="${i}">Начать</button>
            ${s.kind === 'read' && winByApp('read')?.data.text ? `<button class="btn sm" data-tread="1">Прочитал</button>` : ''}
            ${slot.length > 1 ? `<button class="btn sm" data-tswap="${i}">заменить</button>` : ''}</div>`
          }</div></div>`;
    })
    .join('');
  return `<h3 class="h">Сегодня</h3>
    <p class="sub">три шага по паре минут. Порядок любой, любой шаг можно заменить</p>
    <div class="cprog" style="margin-top:10px"><i style="width:${Math.round((n / 3) * 100)}%"></i></div>
    <div class="tsteps">${rows}</div>
    ${n === 3 ? summaryHtml() : ''}
    <div style="margin-top:14px">${weekHtml()}</div>`;
}

// opens the program of the step and gets it going, so the step starts with something to do
export function startStep(i: number): void {
  const s = route().steps[i];
  if (!s) return;
  if (s.kind === 'cards') {
    open('vocab');
    const v = vocabState();
    // a batch that is already going is carried on, not thrown away
    if (v.queue.length && v.i < v.queue.length) {
      v.tab = 'learn';
      paint();
    } else loadCards();
  } else if (s.kind === 'read') {
    open('read');
    if (!winByApp('read')!.data.text) getText(randomTopic(), recentWords(5));
  } else if (s.kind === 'diary') {
    open('diary');
  } else if (s.kind === 'listen') {
    open('listen');
    if (!listenState().cur) listenNext();
  } else if (s.kind === 'echo') {
    open('echo');
    if (!echoState().cur && !echoPick()) echoGen();
  } else {
    open('games');
    winByApp('games')!.data.tab = 'order';
    paint();
  }
}
