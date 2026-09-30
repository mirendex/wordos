import { esc, cefr, tone } from '../lib/scale';
import { errHint, partialField } from '../lib/json';
import { paint } from '../core/paint';
import { BANK, S, save } from '../core/persist';
import { ask, askStream } from '../services/llm';
import { fetchFreeTranslation } from '../services/translate';
import { freqInit, RANK } from '../domain/frequency';
import { coursePos, vocabState } from '../domain/vocab';
import { winByApp, Win } from '../ui/windows';

const READTOPICS: [string, string][] = [
  ['Путешествия', 'путешествия и жизнь в новой стране'],
  ['Здоровье', 'здоровье, сон и привычки'],
  ['Технологии', 'гаджеты и новые технологии'],
  ['ИИ', 'искусственный интеллект и как он меняет работу'],
  ['Космос', 'космос и исследования планет'],
  ['Деньги', 'деньги, цены и как люди принимают решения'],
  ['История', 'неожиданный эпизод из истории'],
  ['Океан', 'океан и его обитатели'],
  ['Города', 'города и как они устроены'],
  ['Мозг', 'память, внимание и как работает мозг'],
  ['Еда', 'еда, кухни мира и продукты'],
  ['Спорт', 'спорт и выносливость'],
  ['Музыка', 'музыка и звук'],
  ['Изобретения', 'изобретения, которые появились случайно'],
  ['Животные', 'поведение животных'],
  ['Погода', 'погода и климат'],
  ['Кино', 'кино и как его снимают'],
  ['Языки', 'языки мира и как они устроены'],
  ['Дом', 'быт, ремонт и вещи вокруг'],
  ['Наугад', 'что-нибудь неожиданное и любопытное'],
];

export function textWords(body: string): { w: string; r: number }[] {
  freqInit();
  const v = vocabState();
  const seen: Record<string, 1> = {};
  const out: { w: string; r: number }[] = [];
  String(body || '')
    .split(/\s+/)
    .forEach((raw) => {
      const c = raw.replace(/[^A-Za-z']/g, '').toLowerCase();
      if (!c || c.length < 3 || seen[c]) return;
      seen[c] = 1;
      const r = RANK![c];
      if (!r) return; // вне топ-5000: слишком редкое
      if (v.known[c] || v.srs[c]) return; // уже знаешь
      if (r <= coursePos()) return; // курс это уже прошёл
      out.push({ w: c, r });
    });
  return out.sort((a, b) => a.r - b.r).slice(0, 14);
}

export function harvestHtml(w: Win): string {
  const list = w.data.harvest || [];
  const picked = w.data.hpick || {};
  if (!list.length)
    return `<div class="note"><div class="l">В тексте нет слов, которых ещё нет в твоём курсе.</div></div>`;
  const chosen = Object.keys(picked).filter((k) => picked[k]).length;
  return `<div class="note" style="margin-top:12px">
    <b style="font-family:var(--px);font-size:15px">Слова из текста</b>
    <div class="sub">нажми на слова, которые хочешь учить, — они уйдут в карточки</div>
    <div class="chips" style="margin-top:10px">${list
      .map(
        (x: { w: string; r: number }, i: number) =>
          `<button class="chip" data-hpick="${i}" aria-pressed="${picked[i] ? 'true' : 'false'}">${esc(x.w)} <span style="color:var(--grey);font-size:11px">#${x.r}</span></button>`,
      )
      .join('')}</div>
    <div class="rowb"><button class="btn p sm" data-hadd="1"${chosen ? '' : ' disabled'}>В курс (${chosen})</button>
      <button class="btn sm" data-hall="1">${chosen === list.length ? 'Снять все' : 'Все'}</button>
      <button class="btn sm" data-hclose="1">Закрыть</button></div></div>`;
}

export function readView(w: Win): string {
  const t = w.data.text;
  if (w.data.stream) return `<div data-stream>${streamHtml(w.data.stream)}</div>`;
  if (!t)
    return `${
      w.data.err
        ? `<div class="note"><b style="font-family:var(--px);font-size:15px">Не получилось</b>
      <div class="l">${esc(w.data.err)}</div>
      ${errHint(w.data.err) ? `<div class="l" style="color:var(--grey)">${esc(errHint(w.data.err))}</div>` : ''}
      <div class="rowb"><button class="btn sm" data-app="setup">Сменить модель</button></div></div>`
        : ''
    }
      <h3 class="h">Читалка</h3><p class="sub">Тапни по слову, чтобы увидеть перевод.</p>
      <div class="chips">${READTOPICS.map((t) => `<button class="chip" data-topic="${esc(t[1])}">${esc(t[0])}</button>`).join('')}</div>
      <div class="rowb"><button class="btn sm" data-owntopic="1">Своя тема</button>
      ${S.read.last ? `<button class="btn sm" data-again="1">Вернуться к прошлому тексту</button>` : ''}</div>`;
  return `<h3 class="h">${esc(t.title || '')}</h3>
      <div class="read" style="margin-top:10px">${t.body
        .split(/\s+/)
        .map(
          (word: string, i: number) =>
            `<w data-w="${i}" class="${S.words.find((x: { en: string }) => x.en.toLowerCase() === word.replace(/[^A-Za-z'-]/g, '').toLowerCase()) ? 'saved' : ''}">${esc(word)}</w>`,
        )
        .join(' ')}</div>
      ${
        w.data.pop
          ? `<div class="pop"><b>${esc(w.data.pop.en)}</b> · ${esc(w.data.pop.ru)}
        <p class="sub" style="margin-top:4px">${esc(w.data.pop.note || (w.data.pop.wip ? 'уточняю по контексту…' : ''))}</p>
        <div class="rowb"><button class="btn sm" data-saveword="1">В блокнот</button>
        <button class="btn sm" data-speak="${esc(w.data.pop.en)}">Вслух</button></div></div>`
          : ''
      }
      <div class="rowb"><button class="btn sm" data-speak="${esc(t.body)}">Прочитать вслух</button>
      <button class="btn sm" data-newtext="1">Другой текст</button>
      <button class="btn p sm" data-harvest="1">Забрать слова</button></div>
      ${w.data.harvest ? harvestHtml(w) : ''}`;
}

function textPrompt(topic: string): string {
  return `Напиши короткий текст на английском для того, кто учит язык. Тема: ${topic}.
Уровень ${cefr(S.level)}, подача: ${tone(S.level)}. Длина ${S.level < 42 ? '50-70' : S.level < 60 ? '80-110' : S.level < 75 ? '110-140' : '140-180'} слов. Интересный факт, история или наблюдение, не учебный пересказ.
Формат ответа:
{"title":"заголовок на английском до 5 слов","body":"текст одним абзацем"}`;
}

// the text as it is being written, the title first and then the body, with a caret at its end;
// until the first words come, the usual loading box
function streamHtml(st: { title: string; body: string }): string {
  if (!st.title && !st.body)
    return `<div class="loadbox"><div class="pix"><i></i><i></i><i></i><i></i><i></i></div>
      <b>пишу текст</b><span>под твой уровень</span><div class="scan"></div></div>`;
  return `<h3 class="h">${esc(st.title)}${st.body ? '' : '<span class="caret"></span>'}</h3>
      <div class="read" style="margin-top:10px">${st.body ? esc(st.body) + '<span class="caret"></span>' : ''}</div>`;
}

// puts the growing text straight into the window, so the rest of the screen isn't redrawn with
// every word
function showStream(w: Win): void {
  const el = document.querySelector(`.win[data-k="${CSS.escape(w.key)}"] [data-stream]`);
  if (el) el.innerHTML = streamHtml(w.data.stream);
  else paint();
}

export async function getText(topic: string): Promise<void> {
  const w = winByApp('read')!;
  w.data.err = '';
  w.data.pop = null;
  w.data.harvest = null;
  w.data.text = null;
  w.data.stream = { title: '', body: '' };
  paint();
  try {
    const r = await askStream(textPrompt(topic), (raw) => {
      if (!w.data.stream) return;
      w.data.stream.title = partialField(raw, 'title') || '';
      w.data.stream.body = partialField(raw, 'body') || '';
      showStream(w);
    });
    if (!r || !r.body) throw new Error('модель не вернула текст');
    w.data.text = r;
    S.read.last = r;
    save();
  } catch (e) {
    w.data.err = (e as Error).message || 'не вышло';
  }
  w.data.stream = null;
  paint();
}

// The word shows up at once with whatever translation is already known (the cards, the free
// dictionary), and the model's reading of it in this very sentence replaces it when it comes
export async function lookup(word: string, sentence: string): Promise<void> {
  const w = winByApp('read')!;
  const clean = word.replace(/[^A-Za-z'-]/g, '');
  if (!clean) return;
  const lc = clean.toLowerCase();
  const known = (BANK[lc] && BANK[lc][0] && BANK[lc][0].word_ru) || S.mt[lc] || '';
  w.data.pop = { en: clean, ru: known || '...', note: '', wip: true };
  paint();
  const same = () => w.data.pop && w.data.pop.en === clean;
  if (!known)
    fetchFreeTranslation(lc).then((t) => {
      if (t && same() && w.data.pop.wip) {
        w.data.pop.ru = t;
        paint();
      }
    });
  try {
    const r = await ask(`Слово "${clean}" в предложении: "${sentence}".
Формат ответа:
{"ru":"перевод в этом контексте, 1-3 слова","note":"короткая заметка по-русски до 12 слов или пустая строка"}`);
    if (same()) w.data.pop = { en: clean, ru: r.ru || w.data.pop.ru, note: r.note || '' };
  } catch {
    if (same())
      w.data.pop =
        w.data.pop.ru && w.data.pop.ru !== '...'
          ? { en: clean, ru: w.data.pop.ru, note: '' }
          : { en: clean, ru: 'перевод не пришёл', note: 'попробуй ещё раз' };
  }
  paint();
}
