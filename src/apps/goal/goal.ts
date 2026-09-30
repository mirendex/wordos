import { esc } from '../../lib/scale';
import { errHint } from '../../lib/json';
import { maskPhrase } from '../../lib/text';
import { daysLeft, goalProgress } from '../../lib/plan';
import { DAY } from '../../core/util';
import { GoalCard, GoalScene, goalState } from './state';
import { Win } from '../../ui/windows';
import { talkView } from './talk';
import { dealHtml } from '../../ui/deal';
import { fillingGoal } from '../../domain/goal';
import { dictView, pronView } from './practice';

function planView(): string {
  const g = goalState();
  if (g.busy)
    return `<div class="loadbox"><div class="pix"><i></i><i></i><i></i><i></i><i></i></div>
    <b>составляю план</b><span>подбираю сценарии</span><div class="scan"></div></div>`;
  if (!g.cur) {
    return `<h3 class="h">Цель</h3>
      <p class="sub">Опиши, к чему готовишься, и дату. Появятся сценарии, слова и фразы под них, и можно потренировать разговор.</p>
      <textarea class="ta" id="gdesc" data-gdesc placeholder="К чему готовишься?">${esc(g.draft || '')}</textarea>
      ${g.draft ? '<p class="sub">черновик сохранён — если выйдешь из приложения, текст никуда не денется</p>' : ''}
      <div class="rowb" style="margin-top:8px"><input type="date" class="answ" id="guntil" data-guntil value="${esc(g.draftUntil || '')}" min="${DAY()}"></div>
      <div class="rowb" style="margin-top:8px"><button class="btn p" data-gmake="1">Составить план</button></div>
      ${g.err ? `<div class="note"><div class="l">${esc(g.err)}</div>${errHint(g.err) ? `<div class="l" style="color:var(--grey)">${esc(errHint(g.err))}</div>` : ''}</div>` : ''}
      ${
        g.archive.length
          ? `<h3 class="h" style="margin-top:18px">Прошлые цели</h3>
        <div>${g.archive
          .slice()
          .reverse()
          .map(
            (a: { title: string; until: string; learned: number; total: number }) =>
              `<div class="wrow"><b>${esc(a.title)}</b><span>${esc(a.until)} · ${a.learned}/${a.total}</span></div>`,
          )
          .join('')}</div>`
          : ''
      }`;
  }
  const left = daysLeft(DAY(), g.cur.until);
  const prog = goalProgress(g.cur.items, g.cur.srs);
  const pct = prog.total ? Math.round((prog.learned / prog.total) * 100) : 0;
  return `<h3 class="h">${esc(g.cur.title)}</h3>
    <div class="tiles">
      <div class="tile acc"><b>${left >= 0 ? left : 0}</b><span>${left >= 0 ? 'дней осталось' : 'дата прошла'}</span></div>
      <div class="tile"><b>${pct}%</b><span>готово</span></div>
    </div>
    <div class="pslider" data-slider style="pointer-events:none">
      <div class="ptrack">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => `<i></i>`).join('')}</div>
      <div class="pfill" style="width:${pct}%"></div>
    </div>
    <h3 class="h" style="margin-top:18px">Сценарии</h3>
    <div style="margin-top:8px">${g.cur.scenes
      .map((s: GoalScene) => {
        const ids = Object.keys(g.cur.items).filter((id) => g.cur.items[id].scene === s.id);
        const sp = goalProgress(Object.fromEntries(ids.map((id) => [id, g.cur.items[id]])), g.cur.srs);
        const talks = g.cur.talks[s.id] || 0;
        return `<div class="wrow">
        <b>${esc(s.ru)}</b>
        <div class="acts"><button class="btn sm" data-gtalk="${s.id}">диалог${talks ? ' · ' + talks : ''}</button>
        <button class="btn sm r" data-gscenedel="${s.id}">убрать</button></div>
        <span>${s.filled ? sp.learned + '/' + sp.total + ' слов' : fillingGoal() ? 'пишу карточки…' : 'ещё не заполнено'}</span></div>`;
      })
      .join('')}</div>
    <div class="rowb" style="margin-top:12px"><button class="btn p" data-glearn="1">Учить</button>
      <button class="btn sm r" data-garchive="1">В архив</button></div>`;
}

function cardsView(w: Win): string {
  const g = goalState();
  if (w.data.busy || g.busy) {
    const left = g.cur ? g.cur.scenes.filter((s: GoalScene) => !s.filled) : [];
    return dealHtml(
      'тасую колоду',
      left.length ? 'слова и фразы для «' + left[0].ru + '»' : 'модель придумывает примеры',
    );
  }
  if (!g.cur) return `<p class="sub">Сначала составь план на вкладке «План».</p>`;
  const c = g.queue[g.i];
  if (!c) {
    if (g.err) {
      const hint = errHint(g.err);
      return `<h3 class="h">Не собралось</h3>
      <p class="sub">${esc(g.err)}</p>
      ${hint ? `<p class="sub" style="margin-top:8px">${esc(hint)}</p>` : ''}
      <div class="rowb"><button class="btn p" data-glearn="1">Повторить</button></div>`;
    }
    const next = Object.values(g.cur.srs as Record<string, GoalCard>)
      .filter((s) => !s.skip)
      .map((s) => s.due)
      .sort()[0];
    const note = !Object.keys(g.cur.items).length
      ? 'Пока нет ни одной карточки — нажми «Ещё», модель соберёт их под сценарии.'
      : next && next > DAY()
        ? `На сегодня всё пройдено. Следующее повторение — ${next}.`
        : 'Слова и фразы под твои сценарии, с повторами по расписанию.';
    return `<h3 class="h">${g.queue.length ? 'Пачка пройдена' : 'Карточки цели'}</h3>
      <p class="sub">${esc(note)}</p>
      <div class="rowb"><button class="btn p" data-glearn="1">Ещё</button></div>`;
  }
  const parts = String(c.sentence || '').split('___');
  const s2 = g.cur.srs[c.id];
  const prog = Math.round((g.i / Math.max(1, g.queue.length)) * 100);
  return `
  <div class="cardhead">
    <div class="cprog"><i style="width:${prog}%"></i></div>
    <div class="crow">
      <span class="ctag ${c.rev ? 'rev' : 'new'}">${c.rev ? 'повтор ' + (s2 ? s2.reps : 1) : 'новое'}</span>
      <span class="ctag">${c.kind === 'phrase' ? 'фраза' : 'слово'}</span>
      <span class="cnum">${g.i + 1}/${g.queue.length}</span>
    </div>
  </div>
  <div class="sentence">${esc(parts[0] || '')}${
    g.shown
      ? `<em>${esc(c.gap)}</em>`
      : `<input class="inline" id="gans" size="${Math.max(4, c.gap.length)}" style="width:${Math.max(4, c.gap.length) + 1}ch"
        placeholder="${esc(maskPhrase(c.gap, g.hint || 0))}" autocomplete="off" spellcheck="false"
        autocapitalize="off" autocorrect="off" enterkeyhint="done">`
  }${esc(parts[1] || '')}</div>
  <div class="trans">${esc(c.ru || '')}</div>
  ${
    g.shown
      ? `
    <div class="answer ${g.res === 'no' ? 'bad' : 'good'}">
      <div class="aword">${esc(c.gap)}${c.ipa ? ` <span class="ipa">[${esc(c.ipa)}]</span>` : ''}
        <button class="btn sm" data-speak="${esc(c.gap)}">звук</button></div>
      <div class="aru">${esc(c.word_ru || '')}</div>
      <div class="averdict">${g.res === 'ok' ? 'верно' : g.res === 'typo' ? 'почти, только опечатка' : 'правильный ответ'}</div>
    </div>
    ${c.tip ? `<div class="grammar"><div><span>заметка</span>${esc(c.tip)}</div></div>` : ''}
    <div class="actions">
      <button class="btn p big" data-gnext="1">Дальше</button>
      <button class="btn" data-speak="${esc(String(c.sentence || '').replace('___', c.gap))}">звук</button>
    </div>`
      : `<div class="actions">
      <button class="btn p big" data-gcheck="1">Проверить</button>
      <button class="btn" data-ghint="1">Буква</button>
    </div>
    <div class="minor"><button class="btn sm" data-gskip="1">Не знаю</button></div>`
  }`;
}

export function goalView(w: Win): string {
  const g = goalState();
  const tabs = `<div class="rowb" style="margin:0 0 10px">
    <button class="btn sm ${g.tab === 'plan' ? 'p' : ''}" data-gtab2="plan">План</button>
    <button class="btn sm ${g.tab === 'cards' ? 'p' : ''}" data-gtab2="cards">Карточки</button>
    <button class="btn sm ${g.tab === 'talk' ? 'p' : ''}" data-gtab2="talk">Диалог</button>
    <button class="btn sm ${g.tab === 'dict' ? 'p' : ''}" data-gtab2="dict">Слух</button>
    <button class="btn sm ${g.tab === 'pron' ? 'p' : ''}" data-gtab2="pron">Произношение</button></div>`;
  if (g.tab === 'cards') return tabs + cardsView(w);
  if (g.tab === 'talk') return tabs + talkView();
  if (g.tab === 'dict') return tabs + dictView();
  if (g.tab === 'pron') return tabs + pronView();
  return tabs + planView();
}
