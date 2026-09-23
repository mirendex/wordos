import { esc, cefr, nToPct } from '../../lib/scale';
import { norm } from '../../lib/text';
import { DAY, PLUS } from '../../core/util';
import { BANK, S } from '../../core/persist';
import { cover, freqInit, FREQ, RANK } from '../../domain/frequency';
import {
  coursePos,
  dueWords,
  forecast,
  inProgress,
  learnedWords,
  myWords,
  nextNew,
  vocabState,
} from '../../domain/vocab';
import { chartSvg, demoHtml } from '../../domain/progress';
import { bankSize, wordStatus } from '../../domain/cards';
import { isBankPersisted } from '../../core/persist';
import { dueCount } from '../../ui/icons';
import { Win } from '../../ui/windows';
import { learnView } from './learn';

export function vocabView(w: Win): string {
  freqInit();
  const v = vocabState();
  const due = dueWords().length;
  const tabs = `<div class="rowb" style="margin:0 0 10px">
    <button class="btn sm ${v.tab === 'chart' ? 'p' : ''}" data-vtab="chart">Диаграмма</button>
    <button class="btn sm ${v.tab === 'learn' ? 'p' : ''}" data-vtab="learn">Учить${due ? ' (' + due + ')' : ''}</button>
    <button class="btn sm ${v.tab === 'stats' ? 'p' : ''}" data-vtab="stats">Статистика</button>
    <button class="btn sm ${v.tab === 'find' ? 'p' : ''}" data-vtab="find">Поиск</button></div>`;
  if (v.tab === 'learn') return tabs + learnView(w);
  if (v.tab === 'stats') return tabs + statsView();
  if (v.tab === 'find') return tabs + findView();
  const n = v.n;
  const pct = cover(n);
  const me = myWords();
  const next = nextNew(10).map((x) => ({ w: x.w, f: (FREQ![x.r - 1] || {}).f || 0, r: x.r }));
  const marked = Object.keys(v.srs).filter((w) => v.srs[w].skip).length;
  return (
    tabs +
    `
    <div class="tiles">
      <div class="tile acc"><b>${me}</b><span>слов в запасе</span></div>
      <div class="tile"><b>${cover(me).toFixed(0)}%</b><span>текста понятно</span></div>
      <div class="tile"><b>${dueCount()}</b><span>к повторению</span></div>
      <div class="tile"><b>${cefr(S.level)}</b><span>уровень</span></div>
    </div>
    <div class="chart">${chartSvg(n)}</div>
    <div class="pslider" data-slider>
      <div class="ptrack">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => `<i></i>`).join('')}</div>
      <div class="pfill" style="width:${(nToPct(n) * 100).toFixed(1)}%"></div>
      <div class="pknob" style="left:${(nToPct(n) * 100).toFixed(1)}%"></div>
    </div>
    <div class="pscale">${[0, 500, 1000, 2000, 3000, 4000, 5000].map((x) => `<i style="left:${(nToPct(x) * 100).toFixed(1)}%">${x >= 1000 ? x / 1000 + 'k' : x || '0'}</i>`).join('')}</div>
    <div class="cov" id="covtxt"><b>${n}</b> слов закрывают <b>${pct.toFixed(1)}%</b> любого текста</div>
    <p class="demolabel">так это выглядит в тексте</p>
    <div class="demo" id="demotxt">${demoHtml(n)}</div>
    <div class="rowb"><button class="btn sm" data-setbase="1">Знаю первые ${n}</button>
      ${me ? '<button class="btn sm" data-tome="1">К моей точке</button>' : ''}
      <button class="btn p sm" data-learn="1">Учить</button>
      ${coursePos() > myWords() + 200 ? `<button class="btn sm r" data-fixpos="1">Вернуть курс к запасу</button>` : ''}</div>
    <div class="rowb"><button class="btn sm" data-vskipstop="1">${v.skipStop ? 'Служебные слова (the, a, is): пропускать' : 'Служебные слова (the, a, is): тоже учить'}</button></div>

    <h3 class="h" style="margin-top:20px">Следующие слова${next.length ? ' · с #' + next[0].r : ''}</h3>
    <div style="margin-top:8px">${next
      .map(
        (x) => `<div class="wrow">
      <b>${esc(x.w)}</b>
      <div class="acts"><button class="btn sm" data-speak="${esc(x.w)}">звук</button>
      <button class="btn sm" data-know="${esc(x.w)}">знаю</button></div>
      <span>#${x.r} · ${(x.f / 1e4).toFixed(3)}% всех слов языка</span></div>`,
      )
      .join('')}</div>
    <p class="sub" style="margin-top:12px">Отмечено знакомыми: ${marked} · карточек в запасе: ${bankSize()}${isBankPersisted() ? '' : ' (не сохраняется)'}</p>`
  );
}

function statsView(): string {
  const v = vocabState();
  const learned = learnedWords().length;
  const prog = inProgress().length;
  const days: { d: string; n: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = PLUS(-i);
    const l = v.log[d] || { n: 0, r: 0, ok: 0 };
    days.push({ d, n: l.n + l.r });
  }
  const max = Math.max(4, ...days.map((x) => x.n));
  const fc = forecast();
  const maxf = Math.max(4, ...fc.map((x) => x.n));
  const names = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  return `<h3 class="h">Как идёт</h3>
    <div class="tiles">
      <div class="tile"><b>${prog}</b><span>в работе</span></div>
      <div class="tile acc"><b>${learned}</b><span>выучено</span></div>
      <div class="tile"><b>${dueWords().length}</b><span>сегодня</span></div>
      <div class="tile"><b>${Object.keys(v.srs).filter((w) => v.srs[w].skip).length}</b><span>знакомых</span></div>
    </div>
    <h3 class="h" style="margin-top:16px">Две недели</h3>
    <div class="bars">${days.map((x) => `<div class="bar ${x.n ? '' : 'z'}" style="height:${x.n ? Math.max(8, Math.round((x.n / max) * 50)) : 3}px" title="${x.d}: ${x.n}"></div>`).join('')}</div>
    <div class="barlab">${days.map((x, i) => `<span>${i === 0 || i === 7 || i === 13 ? new Date(x.d + 'T12:00').getDate() : ''}</span>`).join('')}</div>
    <p class="sub">карточек в день</p>
    <h3 class="h" style="margin-top:16px">Что придёт на неделе</h3>
    <div class="bars">${fc.map((x) => `<div class="bar ${x.n ? 'f' : 'z'}" style="height:${x.n ? Math.max(8, Math.round((x.n / maxf) * 50)) : 3}px" title="${x.d}: ${x.n}"></div>`).join('')}</div>
    <div class="barlab">${fc.map((x, i) => `<span>${i ? names[new Date(x.d + 'T12:00').getDay()] : 'сег'}</span>`).join('')}</div>
    <p class="sub">вернётся по расписанию</p>
    <p class="sub" style="margin-top:10px">лестница повторов: 1, 3, 7, 16, 35, 75, 150 дней</p>
    ${
      prog
        ? `<h3 class="h" style="margin-top:16px">В работе сейчас</h3>
      <div>${inProgress()
        .slice(0, 14)
        .map(
          (w) =>
            `<div class="wrow"><b>${esc(w)}</b>\n        <span>ступень ${v.srs[w].b + 1}/7 · ${v.srs[w].due <= DAY() ? 'сегодня' : v.srs[w].due}</span></div>`,
        )
        .join('')}</div>`
        : ''
    }`;
}

export function findView(): string {
  freqInit();
  const v = vocabState();
  const q = norm(v.q || '');
  const pre = q
    ? FREQ!
        .map((x, i) => ({ w: x.w, f: x.f, r: i + 1 }))
        .filter((x) => x.w.indexOf(q) === 0)
        .slice(0, 14)
    : [];
  const any =
    q && !pre.length
      ? FREQ!
          .map((x, i) => ({ w: x.w, f: x.f, r: i + 1 }))
          .filter((x) => x.w.indexOf(q) >= 0)
          .slice(0, 10)
      : [];
  const list = pre.length ? pre : any;
  const recent = S.words
    .slice(-8)
    .reverse()
    .map((x: { en: string }) => String(x.en).toLowerCase())
    .filter((x: string) => RANK![x]);
  return `<p class="sub">место по частоте и что с ним у тебя</p>
    <input class="answ" id="vq" value="${esc(v.q || '')}" placeholder="английское слово" autocomplete="off" spellcheck="false" autocapitalize="off" data-vsearch>
    ${
      !q
        ? `<div style="margin-top:12px">
      <p class="sub">${recent.length ? 'Из твоего блокнота:' : 'Например:'}</p>
      <div class="chips">${(recent.length ? recent : ['time', 'people', 'work', 'money', 'change', 'hard', 'question', 'morning']).map((x: string) => `<button class="chip" data-vpick="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    </div>`
        : ''
    }
    ${q && !list.length ? '<p class="sub" style="margin-top:10px">В топ-5000 такого нет, значит слово редкое и его можно не трогать.</p>' : ''}
    <div style="margin-top:10px">${list
      .map((x) => {
        const ru = (BANK[x.w] && BANK[x.w][0] && BANK[x.w][0].word_ru) || S.mt[x.w] || '';
        const tr = ru
          ? `<b class="wru">${esc(ru)}</b>`
          : S.mt[x.w] === ''
            ? ''
            : `<button class="btn sm" data-vtranslate="${esc(x.w)}">перевести</button>`;
        return `<div class="wrow">
      <b>${esc(x.w)}</b> ${tr}
      <div class="acts"><button class="btn sm" data-speak="${esc(x.w)}">звук</button>
        ${v.srs[x.w] ? '' : `<button class="btn sm" data-know="${esc(x.w)}">знаю</button>`}
        ${v.srs[x.w] ? '' : `<button class="btn sm" data-jump="${esc(x.w)}">учить</button>`}</div>
      <span>#${x.r} · ${(x.f / 1e4).toFixed(3)}% · ${esc(wordStatus(x.w))}</span></div>`;
      })
      .join('')}</div>`;
}
