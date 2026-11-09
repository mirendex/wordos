import { esc } from '../lib/scale';
import { FORMATS, titleRepeats } from '../lib/talk';
import { S } from '../core/persist';
import { makingScene, talkState, talkStream, todayFormat, todayScene } from '../domain/talk';
import { chatBusyHtml, chatInputHtml, chatLogHtml, errNoteHtml, fixesHtml } from '../ui/chat';

export function talkView(): string {
  const k = talkState();
  const c = todayScene();
  const f = FORMATS[c ? c.format : todayFormat()];
  if (!(S.cfg && S.cfg.key))
    return `<h3 class="h">Разговор дня</h3>
      <p class="sub">Нужен ключ OpenRouter: открой SETUP.</p>`;
  if (!c)
    return `<h3 class="h">Разговор дня</h3>
      <div class="tkfmt ${f.rare ? 'rare' : ''}"><b>${esc(f.name)}</b><span>${esc(f.teaser)}</span></div>
      ${
        k.busy || makingScene()
          ? chatBusyHtml('персонаж готовится')
          : `<div class="rowb" style="margin-top:10px"><button class="btn p" data-tkstart="1">Начать</button></div>`
      }
      ${errNoteHtml(k.err)}`;
  const r = c.review;
  const chips = c.targets.length
    ? `<div class="tkwords"><span>скажи в разговоре:</span>${c.targets
        .map((w) => `<i class="${c.used[w] ? 'on' : ''}">${esc(w)}</i>`)
        .join('')}</div>`
    : '';
  const stream = talkStream();
  const last = c.turns[c.turns.length - 1];
  return `<div class="tkfmt ${f.rare ? 'rare' : ''}"><b>${esc(f.name)}</b>${
    titleRepeats(c.title, f.name) ? '' : `<span>${esc(c.title)}</span>`
  }</div>
    <p class="sub"><b>${esc(c.name)}</b>${c.role ? ' · ' + esc(c.role) : ''}<br><span style="color:var(--grey)">${esc(c.traits)}</span></p>
    <p class="sub">задача: ${esc(c.task)}</p>
    ${chips}
    ${chatLogHtml(c.turns, 'talk:' + (c.id || c.day + c.title), k.busy ? stream : null)}
    ${
      k.busy
        ? stream !== null
          ? ''
          : chatBusyHtml(c.done || (last && last.who === 'them') ? 'разбираю' : 'отвечает')
        : c.done && r
          ? `<div class="note" style="margin-top:10px"><b style="font-family:var(--px);font-size:15px">Разбор</b>
          <div class="l">${esc(r.summary)}</div>
          ${fixesHtml(r.fixes)}
          ${(c.cards || []).length ? `<div class="l">в карточки ушли: ${(c.cards || []).map(esc).join(', ')}. Вернутся в повторениях</div>` : ''}
          ${r.phrases.map((p) => `<div class="wrow"><b>${esc(p.en)}</b><span>${esc(p.ru)}</span></div>`).join('')}
          <div class="l" style="color:var(--grey)">новый собеседник завтра</div>
          <div class="rowb" style="margin-top:8px"><button class="btn" data-tkmore="1">Ещё разговор</button></div></div>`
          : `${chatInputHtml('tkin', 'data-tksend', 'data-tkvoice', k.draft)}
          <div class="rowb"><button class="btn sm" data-tkend="1">закончить</button></div>`
    }
    ${errNoteHtml(k.err)}`;
}
