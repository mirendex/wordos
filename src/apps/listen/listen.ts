import { esc, cefr, tone } from '../../lib/scale';
import { diffHtml } from '../../lib/text';
import { paint } from '../../core/paint';
import { BANK, S, save } from '../../core/persist';
import { ask } from '../../services/llm';
import { speak } from '../../platform/speech';
import { winByApp, Win } from '../../ui/windows';
import { listenState } from './state';

const norm2 = (s: unknown) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function listenPick(): boolean {
  const l = listenState();
  const pool = Object.keys(BANK).filter((w) => (BANK[w] || []).length);
  if (pool.length) {
    const build = (w: string) => {
      const card = BANK[w][0];
      return { sentence: String(card.sentence || '').replace('___', w), ru: card.ru || '', src: 'банк' };
    };
    let w = pool[Math.floor(Math.random() * pool.length)];
    let next = build(w);
    if (pool.length > 1 && l.cur && next.sentence === l.cur.sentence) {
      w = pool.filter((x) => x !== w)[Math.floor(Math.random() * (pool.length - 1))];
      next = build(w);
    }
    l.cur = next;
    l.shown = false;
    l.text = '';
    l.err = '';
    return true;
  }
  return false;
}

export async function listenGen(): Promise<void> {
  const w = winByApp('listen')!;
  const l = listenState();
  w.data.busy = true;
  l.err = '';
  paint();
  try {
    const lvl = S.level;
    const len =
      lvl < 42
        ? 'по 4-6 слов'
        : lvl < 60
          ? 'по 6-9 слов'
          : lvl < 75
            ? 'по 8-12 слов'
            : "по 10-15 слов, с сокращениями вроде I'll и we're";
    const r = await ask(`Придумай 6 английских предложений для диктанта на слух.
Уровень ${cefr(S.level)}, ${tone(S.level)} Длина: ${len}. Обычная речь: работа, быт, разговор с коллегой. Без редких имён и цифр.
Формат ответа:
{"lines":[{"en":"предложение","ru":"перевод"}]}`);
    const lines = (Array.isArray(r.lines) ? r.lines : []).filter((x: { en?: string }) => x && x.en);
    if (!lines.length) throw new Error('пусто');
    l.pool = lines;
    l.cur = { sentence: lines[0].en, ru: lines[0].ru || '', src: 'свежее' };
    l.poolI = 0;
    l.shown = false;
    l.text = '';
    save();
  } catch (e) {
    l.err = (e as Error).message || 'не вышло';
  }
  w.data.busy = false;
  paint();
  if (l.cur) setTimeout(() => speak(l.cur.sentence), 250);
}

export function listenNext(): void {
  const l = listenState();
  if (l.pool && l.poolI < l.pool.length - 1) {
    l.poolI++;
    const x = l.pool[l.poolI];
    l.cur = { sentence: x.en, ru: x.ru || '', src: 'свежее' };
    l.shown = false;
    l.text = '';
    paint();
    setTimeout(() => speak(l.cur.sentence), 200);
    return;
  }
  if (listenPick()) {
    paint();
    setTimeout(() => speak(l.cur.sentence), 200);
    return;
  }
  listenGen();
}

export function listenCheck(): void {
  const l = listenState();
  const ta = document.querySelector('textarea[data-listen]') as HTMLTextAreaElement | null;
  const said = (ta ? ta.value : '').trim();
  if (!said) {
    l.err = 'Напиши, что услышал.';
    paint();
    return;
  }
  if (ta) ta.blur();
  l.text = said;
  l.shown = true;
  const a = norm2(said).split(' ').filter(Boolean);
  const b = norm2(l.cur.sentence).split(' ').filter(Boolean);
  let hit = 0;
  b.forEach((x, i) => {
    if (a[i] === x) hit++;
  });
  l.last = Math.round((hit / Math.max(1, b.length)) * 100);
  l.acc.push(l.last);
  if (l.acc.length > 50) l.acc = l.acc.slice(-50);
  l.done++;
  save();
  paint();
}

export function listenView(w: Win): string {
  const l = listenState();
  if (w.data.busy)
    return `<div class="loadbox"><div class="pix"><i></i><i></i><i></i><i></i><i></i></div>
    <b>диктую</b><span>придумываю фразы под твой уровень</span><div class="scan"></div></div>`;
  const avg = l.acc.length ? Math.round(l.acc.reduce((a: number, b: number) => a + b, 0) / l.acc.length) : 0;
  if (!l.cur)
    return `<h3 class="h">Диктант</h3>
    <p class="sub">Фраза звучит, текста нет. Пишешь, что услышал.</p>
    <div class="tiles">
      <div class="tile acc"><b>${l.done}</b><span>фраз пройдено</span></div>
      <div class="tile"><b>${avg}%</b><span>средняя точность</span></div>
    </div>
    <div class="rowb"><button class="btn p" data-lnext="1">Начать</button></div>
    ${l.err ? `<div class="note"><div class="l">${esc(l.err)}</div></div>` : ''}`;
  return `<div class="rowsplit"><h3 class="h">Слушай и пиши</h3>
      <span class="sub">${l.done} фраз · точность ${avg}%</span></div>
    <div class="earbox">
      <div class="ear">${'<svg width="52" height="52" viewBox="0 0 17 17"><path d="M3 6h3l4-3v11l-4-3H3z" fill="#EDE7D8" stroke="#16151A"/><path d="M12 6c1 1 1 4 0 5M14 4c2 2 2 7 0 9" stroke="#39479E" fill="none"/></svg>'}</div>
      <div class="rowb" style="margin:0">
        <button class="btn p" data-lsay="1">Ещё раз</button>
        <button class="btn" data-lslow="1">Медленно</button>
      </div>
    </div>
    ${
      l.shown
        ? `
      <p class="sub" style="margin-top:12px"><span class="wrong">зачёркнуто</span> — то, что у тебя лишнее, <span class="right">жирным</span> — то, что нужно было написать</p>
      <div class="diff">${diffHtml(l.text, l.cur.sentence)}</div>
      <div class="note"><div class="l">точность этой фразы: <b>${l.last}%</b>
        <p>${esc(l.cur.ru || '')}</p></div>
        <div class="rowb"><button class="btn sm" data-lsave="1">в блокнот</button></div></div>
      <div class="rowb"><button class="btn p" data-lnext="1">Следующая фраза</button></div>`
        : `<textarea class="ta" data-listen placeholder="Type what you hear"></textarea>
      <div class="rowb"><button class="btn p" data-lcheck="1">Проверить</button>
        <button class="btn" data-lskip="1">Показать</button></div>
      ${l.err ? `<div class="note"><div class="l">${esc(l.err)}</div></div>` : ''}`
    }`;
}
