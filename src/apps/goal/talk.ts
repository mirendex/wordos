import { esc } from '../../lib/scale';
import { errHint } from '../../lib/json';
import { GoalScene, GoalTalkTurn, goalState } from './state';

export function talkView(): string {
  const g = goalState();
  if (!g.cur) return `<p class="sub">Сначала составь план на вкладке «План».</p>`;
  if (!g.chat) {
    if (!g.cur.scenes.length) return `<p class="sub">Нет сценариев для диалога.</p>`;
    return `<h3 class="h">Разговор</h3>
      <p class="sub">Модель играет роль собеседника, ты отвечаешь на английском.</p>
      <div style="margin-top:8px">${g.cur.scenes
        .map(
          (s: GoalScene) =>
            `<div class="wrow"><b>${esc(s.ru)}</b><span>${esc(s.role)}</span>
        <button class="btn sm p" data-gtalk="${s.id}">начать</button></div>`,
        )
        .join('')}</div>`;
  }
  const scene = g.cur.scenes.find((s: GoalScene) => s.id === g.chat.scene);
  const turns: GoalTalkTurn[] = g.chat.turns;
  return `<h3 class="h">${esc(scene ? scene.ru : '')}</h3>
    <p class="sub">${esc(scene ? scene.task : '')}</p>
    <div class="chatlog" style="margin-top:10px">${turns
      .map(
        (t) =>
          `<div class="bubble ${t.who}">
        <div>${esc(t.en)}</div>
        ${t.ru ? `<div class="sub">${esc(t.ru)}</div>` : ''}
        ${t.fix ? `<div class="sub" style="color:var(--red)">${esc(t.fix)}</div>` : ''}
        ${t.who === 'them' ? `<button class="btn sm" data-speak="${esc(t.en)}">звук</button>` : ''}
      </div>`,
      )
      .join('')}</div>
    ${
      g.busy
        ? `<div class="loadbox"><div class="pix"><i></i><i></i><i></i><i></i><i></i></div><b>отвечает</b><div class="scan"></div></div>`
        : g.chat.done
          ? `<div class="note" style="margin-top:10px"><b style="font-family:var(--px);font-size:15px">Разбор</b>
          <div class="l">${esc(g.chat.summary || '')}</div>
          ${(g.chat.fixes || [])
            .map(
              (f: { wrong: string; right: string; why: string }) =>
                `<div class="l">«${esc(f.wrong)}» → <b>${esc(f.right)}</b> · ${esc(f.why)}</div>`,
            )
            .join('')}
          ${(g.chat.phrases || [])
            .map(
              (p: { en: string; ru: string }) =>
                `<div class="wrow"><b>${esc(p.en)}</b><span>${esc(p.ru)}</span>
              <button class="btn sm" data-gaddphrase="${esc(scene ? scene.id : '')}|${esc(p.en)}|${esc(p.ru)}">в карточки</button></div>`,
            )
            .join('')}
          <div class="rowb" style="margin-top:8px"><button class="btn p" data-gtalk="${esc(scene ? scene.id : '')}">ещё раз</button>
            <button class="btn" data-gtalkclose="1">К списку</button></div></div>`
          : `<div class="rowb" style="margin-top:10px">
          <input class="answ" id="gtalkin" placeholder="ответь на английском" autocomplete="off" spellcheck="false" autocapitalize="off" enterkeyhint="send">
        </div>
        <div class="rowb"><button class="btn p" data-gsend="1">Отправить</button>
          <button class="btn" data-gvoice="1">голос</button></div>`
    }
    ${g.err ? `<div class="note"><div class="l">${esc(g.err)}</div>${errHint(g.err) ? `<div class="l" style="color:var(--grey)">${esc(errHint(g.err))}</div>` : ''}</div>` : ''}`;
}
