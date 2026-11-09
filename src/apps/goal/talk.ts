import { esc } from '../../lib/scale';
import { chatBusyHtml, chatInputHtml, chatLogHtml, errNoteHtml, fixesHtml } from '../../ui/chat';
import { GoalScene, GoalTalkTurn, goalState } from './state';
import { goalStream } from '../../domain/goal';

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
    ${chatLogHtml(turns, 'goal', g.busy ? goalStream() : null)}
    ${
      g.busy
        ? goalStream() !== null
          ? ''
          : chatBusyHtml(
              g.chat.turns.length && g.chat.turns[g.chat.turns.length - 1].who === 'them'
                ? 'разбираю'
                : 'отвечает',
            )
        : g.chat.done
          ? `<div class="note" style="margin-top:10px"><b style="font-family:var(--px);font-size:15px">Разбор</b>
          <div class="l">${esc(g.chat.summary || '')}</div>
          ${fixesHtml(g.chat.fixes || [])}
          ${(g.chat.phrases || [])
            .map((p: { en: string; ru: string }) => {
              const added = !!(g.chat.added && g.chat.added[p.en]);
              return `<div class="wrow"><b>${esc(p.en)}</b><span>${esc(p.ru)}</span>
              ${
                added
                  ? `<button class="btn sm" disabled>в карточках ✓</button>`
                  : `<button class="btn sm" data-gaddphrase="${esc(scene ? scene.id : '')}|${esc(p.en)}|${esc(p.ru)}">в карточки</button>`
              }</div>`;
            })
            .join('')}
          <div class="rowb" style="margin-top:8px"><button class="btn p" data-gtalk="${esc(scene ? scene.id : '')}">ещё раз</button>
            <button class="btn" data-gtalkclose="1">К списку</button></div></div>`
          : chatInputHtml('gtalkin', 'data-gsend', 'data-gvoice')
    }
    ${errNoteHtml(g.err)}`;
}
