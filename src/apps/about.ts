import { esc, byWordsLevel, cefr, nToPct } from '../lib/scale';
import { S } from '../core/persist';
import { APPVER } from '../platform/appinfo';
import { available } from '../services/update';
import { cover, freqInit } from '../domain/frequency';
import { myWords, vocabState } from '../domain/vocab';
import { chartSvg, demoHtml } from '../domain/progress';
import { ICONS } from '../ui/icons';

function introView(): string {
  freqInit();
  const v = vocabState();
  const n = v.n || 0;
  return `<h3 class="h">Привет!</h3>
      <p class="sub">Один словарь на всё приложение: WORDS.DB, READER, LISTEN, ECHO, DIARY и GAMES
      растут вместе с ним, и прогресс в любом из них виден везде.</p>
      <div class="note" style="margin-top:12px">
        <div class="l"><b>Шаг 1 · где ты сейчас</b>
          <p>подвигай ползунок, пока в примере ниже не начнут появляться подчёркнутые (незнакомые) слова.
          Останови прямо перед первым непонятным — это не экзамен, точку старта всегда можно сдвинуть
          позже в WORDS.DB → Диаграмма.</p></div>
        <div class="chart" style="margin-top:8px">${chartSvg(n)}</div>
        <div class="pslider" data-slider>
          <div class="ptrack">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => '<i></i>').join('')}</div>
          <div class="pfill" style="width:${(nToPct(n) * 100).toFixed(1)}%"></div>
          <div class="pknob" style="left:${(nToPct(n) * 100).toFixed(1)}%"></div>
        </div>
        <div class="pscale">${[0, 500, 1000, 2000, 3000, 4000, 5000].map((x) => `<i style="left:${(nToPct(x) * 100).toFixed(1)}%">${x >= 1000 ? x / 1000 + 'k' : x || '0'}</i>`).join('')}</div>
        <div class="cov" id="covtxt"><b>${n}</b> слов закрывают <b>${cover(n).toFixed(1)}%</b> любого текста</div>
        <div class="demo" id="demotxt">${demoHtml(n)}</div>
        <p class="sub" id="lvlpreview" style="margin-top:8px">это примерно уровень ${cefr(byWordsLevel(n))}</p>
        <div class="rowb" style="margin-top:8px"><button class="btn p sm" data-onboardlevel="1">Вот здесь, начинаем отсюда</button></div>
        ${S.onboardedLevel ? `<p class="sub" style="margin-top:8px">записал: уровень ${cefr(S.level)}, начали с #${vocabState().base + 1}</p>` : ''}
      </div>
      <div class="note" style="margin-top:12px">
        <div class="l"><b>Шаг 2 · бесплатный ключ для ИИ</b>
          <p>тексты, переводы и разборы придумывает языковая модель через OpenRouter — у них есть
          бесплатные модели. Без ключа всё равно работают слова, карточки и игры, просто без перевода
          и без генерации новых текстов. Ключ вводится один раз и хранится только на телефоне.</p></div>
      </div>
      <div class="rowb" style="margin-top:12px">
        <button class="btn" data-app="setup">Ключ и модель</button>
        <button class="btn p" data-intro="1">Понятно, начнём</button>
      </div>`;
}

const APP_LIST: { id: string; name: string; desc: string }[] = [
  { id: 'vocab', name: 'WORDS.DB', desc: 'словарь, карточки, диаграмма запаса' },
  { id: 'read', name: 'READER', desc: 'тексты под твой уровень, слово по тапу' },
  { id: 'listen', name: 'LISTEN', desc: 'диктант на слух' },
  { id: 'echo', name: 'ECHO', desc: 'повтори вслух, проверка произношения' },
  { id: 'diary', name: 'DIARY', desc: 'три строки о дне, с разбором ошибок' },
  { id: 'games', name: 'GAMES', desc: 'пять игр на твоих же словах' },
  { id: 'term', name: 'TERMINAL', desc: 'чужие компьютеры, чтение по-английски' },
];

function homeView(): string {
  const upd = available();
  const eggs = S.egg || {};
  return `<h3 class="h">Английский</h3>
    <p class="sub">Слова, тексты, дневник и игры — всё растёт из одного словаря.</p>
    <div class="note applist" style="margin-top:12px">
      ${APP_LIST.map((a) => `<div class="l approw">${ICONS[a.id] || ''}<span><b>${a.name}</b><p>${a.desc}</p></span></div>`).join('')}
    </div>
    <div class="note" style="margin-top:12px">
      <div class="l">уровень: <b>${cefr(S.level)}</b> (${Math.round(S.level)}/100)</div>
      <div class="l">слов в запасе: ${myWords()} · покрытие ${cover(myWords()).toFixed(1)}%</div>
      <div class="l">в блокноте: ${S.words.length} · заметок: ${S.notes.length}</div>
    </div>
    <div class="rowb" style="margin-top:12px">
      <button class="btn" data-app="setup">Ключ и модель</button>
      <button class="btn sm ${S.cfg && S.cfg.notify ? 'p' : ''}" data-notify="1">Напоминание ${S.cfg && S.cfg.notify ? 'в ' + (S.cfg.notifyHour || 19) + ':30' : 'выключено'}</button>
    </div>
    ${
      Object.keys(eggs).length
        ? `<div class="note" style="margin-top:12px;background:#E4EDDD">
      <div class="l"><b style="font-family:var(--px);font-size:15px">Найдено</b></div>
      ${eggs.atlas ? '<div class="l">три машины в терминале разобраны</div>' : ''}
      ${eggs.five ? '<div class="l">пять слов подряд в FIVE</div>' : ''}
      ${eggs.streak10 ? '<div class="l">десять карточек подряд без ошибки</div>' : ''}
      ${eggs.letters ? '<div class="l">поле букв без единого промаха</div>' : ''}
      ${eggs.echo ? '<div class="l">три фразы подряд сказаны чисто</div>' : ''}
      ${eggs.night ? '<div class="l">карточки в четыре утра, ну ладно</div>' : ''}
      ${eggs.hundred ? '<div class="l">сто слов в запасе</div>' : ''}
    </div>`
        : ''
    }
    <p class="sub" style="margin-top:12px">Версия ${esc(APPVER || '—')}</p>
    ${upd ? `<p class="sub">Доступна версия ${esc(upd.version)} <button class="btn sm p" data-upd="1">обновить</button></p>` : ''}`;
}

export function aboutView(): string {
  return S.seenIntro ? homeView() : introView();
}
