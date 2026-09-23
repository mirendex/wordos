import { esc, cefr } from '../../lib/scale';
import { DAY } from '../../core/util';
import { paint } from '../../core/paint';
import { S, save } from '../../core/persist';
import { ask } from '../../services/llm';
import { recalcLevel } from '../../domain/progress';
import { winByApp, Win } from '../../ui/windows';
import { diaryState } from './state';

const DTOPIC = [
  'what you worked on today',
  'something that annoyed you',
  'a small win',
  'what you plan tomorrow',
  'a person you talked to',
  'something you learned',
  'what you would change about your work',
  'a place you want to visit',
];

export function diaryView(w: Win): string {
  const d = diaryState();
  if (w.data.busy)
    return `<div class="loadbox"><div class="pix"><i></i><i></i><i></i><i></i><i></i></div>
    <b>читаю запись</b><span>ищу, что поправить</span><div class="scan"></div></div>`;
  if (w.data.res) {
    const r = w.data.res;
    return `<h3 class="h">Разобрано</h3>
      <div class="letter"><div class="txt">${esc(r.text)}</div></div>
      ${
        (r.fixes || []).length
          ? `<div class="note"><b style="font-family:var(--px);font-size:15px">Правки</b>
        ${r.fixes.map((f: { wrong: string; right: string; why?: string }) => `<div class="l"><s>${esc(f.wrong)}</s> → <em>${esc(f.right)}</em><p>${esc(f.why || '')}</p></div>`).join('')}
        <div class="rowb"><button class="btn sm" data-dsave="1">Убрать в блокнот</button></div></div>`
          : '<div class="note">Правок нет, записано чисто.</div>'
      }
      ${
        r.natural
          ? `<div class="note" style="background:#E4EDDD"><b style="font-family:var(--px);font-size:15px">Как сказал бы носитель</b>
        <div class="l">${esc(r.natural)}</div>
        <div class="rowb"><button class="btn sm" data-speak="${esc(r.natural)}">вслух</button></div></div>`
          : ''
      }
      <div class="rowb"><button class="btn p" data-dnew="1">Новая запись</button></div>`;
  }
  const topic = DTOPIC[new Date().getDate() % DTOPIC.length];
  return `<h3 class="h">Три строки о себе</h3>
    <p class="sub">Пиши как умеешь, ошибки не страшны.</p>
    <div class="note" style="margin-top:10px"><div class="l">подсказка дня: <b>${esc(topic)}</b></div></div>
    <textarea class="ta" data-diary placeholder="Write a few lines in English">${esc(d.draft || '')}</textarea>
    ${d.draft ? '<p class="sub">черновик сохранён — если выйдешь из приложения, текст никуда не денется</p>' : ''}
    <div class="rowb"><button class="btn p" data-dcheck="1">Записать</button>
      <span class="sub" style="align-self:center">записей: ${d.items.length}</span></div>
    ${d.err ? `<div class="note"><div class="l">${esc(d.err)}</div></div>` : ''}
    ${
      d.items.length
        ? `<h3 class="h" style="margin-top:18px">Раньше</h3>
      ${d.items
        .slice(-5)
        .reverse()
        .map(
          (x: { text: string; date: string; n: number }) =>
            `<div class="item"><div>
        <span class="en">${esc(x.text.slice(0, 90))}${x.text.length > 90 ? '...' : ''}</span>
        <div class="ru">${esc(x.date)} · правок: ${x.n}</div></div></div>`,
        )
        .join('')}`
        : ''
    }`;
}

export async function diaryCheck(): Promise<void> {
  const w = winByApp('diary')!;
  const d = diaryState();
  const ta = document.querySelector('textarea[data-diary]') as HTMLTextAreaElement | null;
  const text = (ta ? ta.value : '').trim();
  if (!text) {
    d.err = 'Пусто, напиши хотя бы строку.';
    paint(true);
    return;
  }
  if (ta) ta.blur();
  w.data.busy = true;
  d.err = '';
  paint(true);
  try {
    const r =
      await ask(`Ученик, изучающий английский, уровня ${cefr(S.level)}, написал запись в дневник по-английски.
Текст: """${text}"""
Мягко поправь: лови то, что мешает понять или звучит неестественно, стиль не души.
Формат ответа:
{"fixes":[{"wrong":"точная цитата","right":"исправление","why":"по-русски, до 8 слов"}],"natural":"как написал бы носитель, 1-2 предложения","level":число от 0 до 100, оценка уровня английского по этому тексту}`);
    const fixes = (Array.isArray(r.fixes) ? r.fixes : []).filter(
      (f: { wrong?: string; right?: string }) => f && f.wrong && f.right,
    );
    const lvl =
      typeof r.level === 'number' && isFinite(r.level)
        ? Math.max(0, Math.min(100, Math.round(r.level)))
        : null;
    d.items.push({ date: DAY(), text, n: fixes.length, level: lvl });
    if (d.items.length > 40) d.items = d.items.slice(-40);
    w.data.res = { text, fixes, natural: r.natural || '' };
    d.draft = '';
    recalcLevel();
    save();
  } catch (e) {
    d.err = (e as Error).message || 'не вышло';
  }
  w.data.busy = false;
  paint();
}
