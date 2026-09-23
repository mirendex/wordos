import { esc, cefr, tone } from '../../lib/scale';
import { paint } from '../../core/paint';
import { S, save } from '../../core/persist';
import { ask } from '../../services/llm';
import { haptic } from '../../platform/haptics';
import { winByApp, Win } from '../../ui/windows';
import { orderSource } from './sources';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function orderState(): any {
  if (!S.order || typeof S.order !== 'object')
    S.order = { pool: [], src: '', words: [], picked: [], done: 0, perfect: 0, msg: '', ru: '', err: '' };
  if (!Array.isArray(S.order.pool)) S.order.pool = [];
  if (!Array.isArray(S.order.words)) S.order.words = [];
  if (!Array.isArray(S.order.picked)) S.order.picked = [];
  return S.order;
}

export function orderRange(): [number, number] {
  const v = S.level;
  if (v < 42) return [4, 7];
  if (v < 60) return [5, 9];
  if (v < 75) return [7, 12];
  return [9, 16];
}

export async function orderGen(): Promise<void> {
  const w = winByApp('games')!;
  const g = orderState();
  const [lo, hi] = orderRange();
  w.data.busy = true;
  g.err = '';
  paint(true);
  try {
    const r = await ask(`Придумай 8 английских предложений для сборки из слов.
Уровень ${cefr(S.level)}, ${tone(S.level)} Длина ${lo}-${hi} слов. Обычная речь: работа, быт, разговор. Без редких имён и цифр. Порядок слов должен быть однозначным, без вариантов перестановки — не должно получиться собрать грамматически верное предложение из этих же слов в другом порядке.
Формат ответа:
{"lines":[{"en":"предложение","ru":"перевод"}]}`);
    const lines = (Array.isArray(r.lines) ? r.lines : []).filter((x: { en?: string }) => x && x.en);
    if (!lines.length) throw new Error('пусто');
    g.pool = lines;
    save();
    orderNew();
  } catch (e) {
    g.err = (e as Error).message || 'не вышло';
  }
  w.data.busy = false;
  paint(true);
}

export function orderNew(): boolean {
  const g = orderState();
  let src = orderSource();
  if (!src.length) {
    g.words = [];
    g.src = '';
    return false;
  }
  if (src.length > 1 && g.src) src = src.filter((x) => x.en !== g.src);
  const p = src[Math.floor(Math.random() * src.length)];
  g.src = p.en;
  g.ru = p.ru;
  g.words = p.en
    .trim()
    .split(/\s+/)
    .map((t: string, i: number) => ({ i, t }))
    .sort(() => Math.random() - 0.5);
  g.picked = [];
  g.msg = '';
  save();
  return true;
}

export function orderTap(i: number): void {
  const g = orderState();
  if (g.msg) return;
  const at = g.picked.indexOf(i);
  if (at >= 0) {
    g.picked.splice(at, 1);
    haptic('soft');
    paint();
    return;
  }
  g.picked.push(i);
  haptic('type');
  if (g.picked.length === g.words.length) {
    const said = g.picked.map((k: number) => g.words[k].t).join(' ');
    const ok = said === g.src.trim();
    g.done++;
    if (ok) {
      g.perfect++;
      g.msg = 'Точно так';
      haptic('win');
    } else {
      g.msg = 'Правильный порядок ниже';
      haptic('no');
    }
  }
  save();
  paint();
}

export function orderView(w?: Win): string {
  const g = orderState();
  if (w && w.data.busy)
    return `<div class="loadbox"><div class="pix"><i></i><i></i><i></i><i></i><i></i></div>
    <b>придумываю предложения</b><span>под уровень ${cefr(S.level)}</span><div class="scan"></div></div>`;
  if (!g.words.length && !orderNew())
    return `<h3 class="h">Порядок слов</h3>
    <p class="sub">Нет предложений на уровень ${cefr(S.level)}.</p>
    ${g.err ? `<div class="note"><div class="l">${esc(g.err)}</div></div>` : ''}
    <div class="rowb"><button class="btn p" data-ogen="1">Придумать</button>
      <button class="btn" data-go="vocab">К словам</button></div>`;
  const picked = g.picked.map((k: number) => g.words[k].t);
  return `<div class="rowsplit"><h3 class="h">Порядок слов</h3>
      <span class="sub">${g.perfect} из ${g.done} без ошибок</span></div>
    <p class="sub">Уровень ${cefr(S.level)} · ${orderRange()[0]}-${orderRange()[1]} слов</p>
    <div class="oline">${
      picked.length
        ? g.picked
            .map(
              (k: number, pos: number) =>
                `<button class="otok" data-oback="${pos}">${esc(g.words[k].t)}</button>`,
            )
            .join('')
        : '<i>здесь соберётся предложение</i>'
    }</div>
    <div class="obank">${g.words
      .map((x: { t: string }, i: number) =>
        g.picked.indexOf(i) >= 0 ? '' : `<button class="otile" data-otap="${i}">${esc(x.t)}</button>`,
      )
      .join('')}</div>
    ${
      g.msg
        ? `<div class="note"><div class="l"><b>${esc(g.msg)}</b>
        <p style="font-family:var(--mo);color:var(--ink);font-size:14px;margin-top:6px">${esc(g.src)}</p>
        ${g.ru ? '<p>' + esc(g.ru) + '</p>' : ''}</div>
      <div class="rowb"><button class="btn sm" data-speak="${esc(g.src)}">послушать</button>
        <button class="btn p sm" data-onew="1">Следующее</button></div></div>`
        : `<div class="rowb"><button class="btn sm" data-oclear="1">Сбросить</button>
      <button class="btn sm" data-onew="1">Другое</button>
      <button class="btn sm" data-ogen="1">Свежие</button></div>`
    }`;
}
