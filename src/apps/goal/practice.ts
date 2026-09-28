import { esc } from '../../lib/scale';
import { diffHtml } from '../../lib/text';
import { goalPracticePool } from '../../domain/goal';
import { goalState } from './state';

const EAR = `<svg width="52" height="52" viewBox="0 0 17 17"><path d="M3 6h3l4-3v11l-4-3H3z" fill="#EDE7D8" stroke="#16151A"/><path d="M12 6c1 1 1 4 0 5M14 4c2 2 2 7 0 9" stroke="#39479E" fill="none"/></svg>`;
const MIC = `<svg width="40" height="40" viewBox="0 0 17 17"><path d="M6 3h5v6a2.5 2.5 0 0 1-5 0z" fill="#EDE7D8" stroke="#16151A"/><path d="M4 8a4.5 4.5 0 0 0 9 0M8.5 13v2" stroke="#39479E" fill="none"/></svg>`;

function noGoal(): string {
  return `<p class="sub">Сначала составь план на вкладке «План».</p>`;
}

function noPool(): string {
  return `<p class="sub">Фразы для практики берутся из твоих карточек — сначала пройди «Карточки».</p>`;
}

export function dictView(): string {
  const g = goalState();
  if (!g.cur) return noGoal();
  if (!goalPracticePool().length) return noPool();
  const avg = g.dict.acc.length
    ? Math.round(g.dict.acc.reduce((a: number, b: number) => a + b, 0) / g.dict.acc.length)
    : 0;
  if (!g.dict.cur)
    return `<h3 class="h">Слух</h3>
    <p class="sub">Фраза из твоих сценариев звучит, текста нет — пишешь, что услышал.</p>
    <div class="tiles">
      <div class="tile acc"><b>${g.dict.done}</b><span>фраз пройдено</span></div>
      <div class="tile"><b>${avg}%</b><span>средняя точность</span></div>
    </div>
    <div class="rowb"><button class="btn p" data-gdictnext="1">Начать</button></div>`;
  return `<div class="rowsplit"><h3 class="h">Слушай и пиши</h3>
      <span class="sub">${g.dict.done} фраз · точность ${avg}%</span></div>
    <div class="earbox">
      <div class="ear">${EAR}</div>
      <div class="rowb" style="margin:0">
        <button class="btn p" data-say="${esc(g.dict.cur.en)}">Ещё раз</button>
        <button class="btn" data-gdictslow="1">Медленно</button>
      </div>
    </div>
    ${
      g.dict.shown
        ? `
      <p class="sub" style="margin-top:12px"><span class="wrong">зачёркнуто</span> — лишнее, <span class="right">жирным</span> — то, что нужно было написать</p>
      <div class="diff">${diffHtml(g.dict.text, g.dict.cur.en)}</div>
      <div class="note"><div class="l">точность этой фразы: <b>${g.dict.last}%</b>
        <p>${esc(g.dict.cur.ru || '')}</p></div></div>
      <div class="rowb"><button class="btn p" data-gdictnext="1">Следующая фраза</button></div>`
        : `<textarea class="ta" data-gdict placeholder="Что услышал?"></textarea>
      <div class="rowb"><button class="btn p" data-gdictcheck="1">Проверить</button>
        <button class="btn" data-gdictskip="1">Показать</button></div>
      ${g.dict.err ? `<div class="note"><div class="l">${esc(g.dict.err)}</div></div>` : ''}`
    }`;
}

export function pronView(): string {
  const g = goalState();
  if (!g.cur) return noGoal();
  if (!goalPracticePool().length) return noPool();
  const avg = g.pron.acc.length
    ? Math.round(g.pron.acc.reduce((a: number, b: number) => a + b, 0) / g.pron.acc.length)
    : 0;
  if (!g.pron.cur)
    return `<h3 class="h">Произношение</h3>
    <p class="sub">Фраза из твоих сценариев, ты повторяешь её вслух.</p>
    <div class="tiles">
      <div class="tile acc"><b>${g.pron.done}</b><span>чисто сказано</span></div>
      <div class="tile"><b>${avg}%</b><span>средняя точность</span></div>
    </div>
    <div class="rowb"><button class="btn p" data-gpronnext="1">Начать</button></div>`;
  const L = g.pron.last;
  return `<div class="rowsplit"><h3 class="h">Произношение</h3>
      <span class="sub">точность ${avg}% · чисто ${g.pron.done}</span></div>
    <div class="sentence" style="font-size:17px">${
      L
        ? L.words
            .map(
              (x: { w: string; ok: true | false | 'close' }) =>
                `<em class="sp ${x.ok === true ? 'y' : x.ok === 'close' ? 'm' : 'n'}">${esc(x.w)}</em>`,
            )
            .join(' ')
        : esc(g.pron.cur.en)
    }</div>
    <div class="trans">${esc(g.pron.cur.ru || '')}</div>

    <div class="earbox" style="margin-top:12px">
      <div class="ear">${MIC}</div>
      <div style="flex:1">
        <div class="rowb" style="margin:0">
          <button class="btn" data-say="${esc(g.pron.cur.en)}">Послушать</button>
          <button class="btn p ${g.pron.rec ? 'r' : ''}" data-gpronsay="1" ${g.pron.rec ? 'disabled' : ''}>${g.pron.rec ? 'слушаю...' : 'Сказать'}</button>
        </div>
        ${g.pron.heard ? `<div class="sub" style="margin-top:8px">услышал: ${esc(g.pron.heard)}</div>` : ''}
      </div>
    </div>

    ${
      L
        ? `<div class="note"><div class="l">точность: <b>${L.pct}%</b>${L.pct >= 85 ? ' · чисто' : L.pct >= 60 ? ' · почти' : ' · попробуй ещё'}
      <p>зелёное услышано верно, жёлтое почти, красное не разобрано</p></div>
      <div class="rowb"><button class="btn sm" data-gpronslow="1">Медленно</button>
        <button class="btn p sm" data-gpronnext="1">Следующая</button></div></div>`
        : `<div class="rowb"><button class="btn sm" data-gpronslow="1">Медленно</button>
      <button class="btn sm" data-gpronnext="1">Другая фраза</button></div>`
    }
    ${g.pron.err ? `<div class="note"><div class="l">${esc(g.pron.err)}</div></div>` : ''}`;
}
