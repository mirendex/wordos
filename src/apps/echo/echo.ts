import { esc, cefr } from '../../lib/scale';
import { echoScore } from '../../lib/text';
import { paint } from '../../core/paint';
import { BANK, S, save } from '../../core/persist';
import { ask } from '../../services/llm';
import { CAPSR, SR, speak } from '../../platform/speech';
import { haptic } from '../../platform/haptics';
import { dialog } from '../../ui/modal';
import { winByApp, Win } from '../../ui/windows';
import { echoLen, echoState } from './state';

export function echoPick(): boolean {
  const e = echoState();
  const [lo, hi] = echoLen();
  const out: { en: string; ru: string }[] = [];
  Object.keys(BANK).forEach((w) => {
    (BANK[w] || []).forEach((c: { sentence?: string; ru?: string }) => {
      const s = String(c.sentence || '')
        .replace('___', w)
        .trim();
      const n = s.split(/\s+/).length;
      if (n >= lo && n <= hi) out.push({ en: s, ru: c.ru || '' });
    });
  });
  ((S.listen && S.listen.pool) || []).forEach((x: { en: string; ru: string }) => {
    const n = String(x.en || '').split(/\s+/).length;
    if (n >= lo && n <= hi) out.push(x);
  });
  e.pool.forEach((x: { en: string; ru: string }) => out.push(x));
  if (!out.length) return false;
  let pool = out;
  if (pool.length > 1 && e.cur) pool = pool.filter((x) => x.en !== e.cur.en);
  e.cur = pool[Math.floor(Math.random() * pool.length)];
  e.tries = 0;
  e.last = null;
  e.heard = '';
  e.err = '';
  save();
  return true;
}

export async function echoGen(): Promise<void> {
  const w = winByApp('echo')!;
  const e = echoState();
  const [lo, hi] = echoLen();
  w.data.busy = true;
  e.err = '';
  paint(true);
  try {
    const r = await ask(`Придумай 8 английских фраз для тренировки произношения вслух.
Уровень ${cefr(S.level)}. Длина ${lo}-${hi} слов. Живая разговорная речь: рабочие созвоны, быт, короткие реплики. Без редких имён и цифр.
Формат ответа:
{"lines":[{"en":"фраза","ru":"перевод"}]}`);
    const lines = (Array.isArray(r.lines) ? r.lines : []).filter((x: { en?: string }) => x && x.en);
    if (!lines.length) throw new Error('пусто');
    e.pool = lines;
    save();
    echoPick();
  } catch (err) {
    e.err = (err as Error).message || 'не вышло';
  }
  w.data.busy = false;
  paint(true);
  if (e.cur) setTimeout(() => speak(e.cur.en), 300);
}

export async function echoSay(): Promise<void> {
  const e = echoState();
  if (e.rec) return;
  const P = CAPSR();
  if (!P && !SR) {
    dialog({ title: 'голос', text: 'На этом телефоне распознавание речи не работает.' });
    return;
  }
  e.err = '';
  try {
    if (P) {
      const av = await P.available();
      if (!(av && (av.available || av.speechRecognition))) {
        dialog({ title: 'голос', text: 'Не вышло включить распознавание речи.' });
        return;
      }
      const perm = await P.requestPermissions();
      if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') {
        dialog({ title: 'голос', text: 'Нужно разрешение на микрофон.' });
        return;
      }
      e.rec = true;
      paint(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let res: any;
      try {
        res = await P.start({ language: 'en-US', maxResults: 5, partialResults: false, popup: false });
      } catch {
        // первый запуск распознавания на телефоне часто не успевает включиться вовремя — тихо пробуем второй раз
        res = await P.start({ language: 'en-US', maxResults: 5, partialResults: false, popup: false });
      }
      e.rec = false;
      const alts: string[] = (res && res.matches) || [];
      let best = { pct: -1, words: [] as unknown[] };
      let heard = '';
      alts.forEach((a) => {
        const s = echoScore(a, e.cur.en);
        if (s.pct > best.pct) {
          best = s;
          heard = a;
        }
      });
      e.heard = heard;
      e.last = best;
      e.tries++;
      e.acc.push(best.pct);
      if (e.acc.length > 60) e.acc = e.acc.slice(-60);
      if (best.pct >= 85) {
        e.done++;
        haptic('win');
        if (e.acc.slice(-3).every((x: number) => x >= 85))
          S.egg = Object.assign({}, S.egg || {}, { echo: 1 });
      } else haptic(best.pct >= 60 ? 'ok' : 'no');
      save();
      paint(true);
      return;
    }
    // браузерный путь
    const rec = new SR();
    rec.lang = 'en-US';
    rec.maxAlternatives = 5;
    rec.interimResults = false;
    e.rec = true;
    paint(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      const alts: string[] = [];
      for (let i = 0; i < ev.results[0].length; i++) alts.push(ev.results[0][i].transcript);
      let best = { pct: -1, words: [] as unknown[] };
      let heard = '';
      alts.forEach((a) => {
        const s = echoScore(a, e.cur.en);
        if (s.pct > best.pct) {
          best = s;
          heard = a;
        }
      });
      e.rec = false;
      e.heard = heard;
      e.last = best;
      e.tries++;
      e.acc.push(best.pct);
      save();
      paint(true);
    };
    rec.onerror = () => {
      e.rec = false;
      e.err = 'не расслышал';
      paint(true);
    };
    rec.onend = () => {
      if (e.rec) {
        e.rec = false;
        paint(true);
      }
    };
    rec.start();
  } catch (err) {
    e.rec = false;
    e.err = (err as Error)?.message || 'ошибка';
    paint(true);
  }
}

export function echoView(w: Win): string {
  const e = echoState();
  if (w.data.busy)
    return `<div class="loadbox"><div class="pix"><i></i><i></i><i></i><i></i><i></i></div>
    <b>подбираю фразы</b><span>под уровень ${cefr(S.level)}</span><div class="scan"></div></div>`;
  const avg = e.acc.length ? Math.round(e.acc.reduce((a: number, b: number) => a + b, 0) / e.acc.length) : 0;
  if (!e.cur && !echoPick())
    return `<h3 class="h">Повтори вслух</h3>
    <p class="sub">Фраза звучит, ты повторяешь её вслух, приложение слушает и показывает, какие слова не разобрало.</p>
    <div class="tiles">
      <div class="tile acc"><b>${e.done}</b><span>чисто сказано</span></div>
      <div class="tile"><b>${avg}%</b><span>средняя точность</span></div>
    </div>
    <div class="rowb"><button class="btn p" data-echogen="1">Начать</button></div>
    ${e.err ? `<div class="note"><div class="l">${esc(e.err)}</div></div>` : ''}`;
  const L = e.last;
  return `<div class="rowsplit"><h3 class="h">Повтори вслух</h3>
      <span class="sub">точность ${avg}% · чисто ${e.done}</span></div>
    <div class="sentence" style="font-size:17px">${
      L
        ? L.words
            .map(
              (x: { w: string; ok: true | false | 'close' }) =>
                `<em class="sp ${x.ok === true ? 'y' : x.ok === 'close' ? 'm' : 'n'}">${esc(x.w)}</em>`,
            )
            .join(' ')
        : esc(e.cur.en)
    }</div>
    <div class="trans">${esc(e.cur.ru || '')}</div>

    <div class="earbox" style="margin-top:12px">
      <div class="ear"><svg width="40" height="40" viewBox="0 0 17 17"><path d="M6 3h5v6a2.5 2.5 0 0 1-5 0z" fill="#EDE7D8" stroke="#16151A"/><path d="M4 8a4.5 4.5 0 0 0 9 0M8.5 13v2" stroke="#39479E" fill="none"/></svg></div>
      <div style="flex:1">
        <div class="rowb" style="margin:0">
          <button class="btn" data-say="${esc(e.cur.en)}">Послушать</button>
          <button class="btn p ${e.rec ? 'r' : ''}" data-echosay="1" ${e.rec ? 'disabled' : ''}>${e.rec ? 'слушаю...' : 'Сказать'}</button>
        </div>
        ${e.heard ? `<div class="sub" style="margin-top:8px">услышал: ${esc(e.heard)}</div>` : ''}
      </div>
    </div>

    ${
      L
        ? `<div class="note"><div class="l">точность: <b>${L.pct}%</b>${L.pct >= 85 ? ' · чисто' : L.pct >= 60 ? ' · почти' : ' · попробуй ещё'}
      <p>зелёное услышано верно, жёлтое почти, красное не разобрано</p></div>
      <div class="rowb"><button class="btn sm" data-echoslow="1">Медленно</button>
        <button class="btn p sm" data-echonext="1">Следующая</button></div></div>`
        : `<div class="rowb"><button class="btn sm" data-echoslow="1">Медленно</button>
      <button class="btn sm" data-echonext="1">Другая фраза</button>
      <button class="btn sm" data-echogen="1">Свежие</button></div>`
    }
    ${e.err ? `<div class="note"><div class="l">${esc(e.err)}</div></div>` : ''}`;
}
