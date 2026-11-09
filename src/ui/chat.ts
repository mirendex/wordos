import { esc } from '../lib/scale';
import { paint } from '../core/paint';
import { errHint } from '../lib/json';
import { ChatFix, ChatTurn } from '../domain/chat';

// The pieces of a role-play window, shared by GOAL and TALK

// the character's lines whose translation is shown, as "<chat>:<line>"; a translation always in
// sight gets read instead of the English, so each one is opened by hand
const OPEN = new Set<string>();

export function toggleRu(id: string): void {
  if (OPEN.has(id)) OPEN.delete(id);
  else OPEN.add(id);
}

// `stream`: the character's next line while it is being written, null when there is none
export function chatLogHtml(turns: ChatTurn[], key: string, stream: string | null = null): string {
  return `<div class="chatlog" style="margin-top:10px">${turns
    .map((t, i) => {
      const id = key + ':' + i;
      const shown = OPEN.has(id);
      return `<div class="bubble ${t.who}">
        <div>${esc(t.en)}</div>
        ${t.ru && shown ? `<div class="sub">${esc(t.ru)}</div>` : ''}
        ${t.fix ? `<div class="sub" style="color:var(--red)">${esc(t.fix)}</div>` : ''}
        ${
          t.who === 'them'
            ? `<div class="rowb"><button class="btn sm" data-speak="${esc(t.en)}">звук</button>${
                t.ru
                  ? `<button class="btn sm" data-chatru="${esc(id)}">${shown ? 'скрыть' : 'перевод'}</button>`
                  : ''
              }</div>`
            : ''
        }
      </div>`;
    })
    .join('')}${
    stream !== null
      ? `<div class="bubble them"><div data-chatstream>${esc(stream)}<span class="caret"></span></div></div>`
      : ''
  }</div>`;
}

// the line being written grows in its bubble without the window being painted again
export function showChatStream(winKey: string, text: string): void {
  const win = document.querySelector(`.win[data-k="${CSS.escape(winKey)}"]`);
  const el = win && win.querySelector('[data-chatstream]');
  if (!el) return paint();
  el.innerHTML = esc(text) + '<span class="caret"></span>';
  const b = win!.querySelector('.body');
  if (b) b.scrollTop = b.scrollHeight;
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
