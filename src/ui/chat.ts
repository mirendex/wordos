import { esc } from '../lib/scale';
import { errHint } from '../lib/json';
import { ChatFix, ChatTurn } from '../domain/chat';

// The pieces of a role-play window, shared by GOAL and TALK

export function chatLogHtml(turns: ChatTurn[]): string {
  return `<div class="chatlog" style="margin-top:10px">${turns
    .map(
      (t) =>
        `<div class="bubble ${t.who}">
        <div>${esc(t.en)}</div>
        ${t.ru ? `<div class="sub">${esc(t.ru)}</div>` : ''}
        ${t.fix ? `<div class="sub" style="color:var(--red)">${esc(t.fix)}</div>` : ''}
        ${t.who === 'them' ? `<button class="btn sm" data-speak="${esc(t.en)}">звук</button>` : ''}
      </div>`,
    )
    .join('')}</div>`;
}

export function chatBusyHtml(label: string): string {
  return `<div class="loadbox"><div class="pix"><i></i><i></i><i></i><i></i><i></i></div><b>${esc(label)}</b><div class="scan"></div></div>`;
}

export function chatInputHtml(id: string, send: string, voice: string, value = ''): string {
  return `<div class="rowb" style="margin-top:10px">
      <input class="answ" id="${id}" value="${esc(value)}" placeholder="ответь на английском" autocomplete="off" spellcheck="false" autocapitalize="off" enterkeyhint="send">
    </div>
    <div class="rowb"><button class="btn p" ${send}="1">Отправить</button>
      <button class="btn" ${voice}="1">голос</button></div>`;
}

export function fixesHtml(fixes: ChatFix[], note?: (f: ChatFix) => string): string {
  return fixes
    .map(
      (f) =>
        `<div class="l">«${esc(f.wrong)}» → <b>${esc(f.right)}</b> · ${esc(f.why)}${note ? note(f) : ''}</div>`,
    )
    .join('');
}

export function errNoteHtml(err: string): string {
  if (!err) return '';
  return `<div class="note"><div class="l">${esc(err)}</div>${errHint(err) ? `<div class="l" style="color:var(--grey)">${esc(errHint(err))}</div>` : ''}</div>`;
}
