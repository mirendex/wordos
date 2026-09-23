import { esc, byWordsLevel, cefr, nToPct } from '../lib/scale';
import { S } from '../core/persist';
import { APPVER } from '../platform/appinfo';
import { cover, freqInit } from '../domain/frequency';
import { myWords } from '../domain/vocab';
import { chartSvg, demoHtml } from '../domain/progress';
import { vocabState } from '../domain/vocab';

export function aboutView(): string {
  const first = !S.seenIntro;
  const eggs = S.egg || {};
  if (first) {
    freqInit();
    const v = vocabState();
    const n = v.n || 0;
    return `<h3 class="h">Привет!</h3>
      <p class="sub">Это приложение помогает учить английский на своём материале: слова, тексты, дневник и игры собраны вокруг одного словаря, который растёт вместе с тобой.</p>
      <div class="note" style="margin-top:12px">
        <div class="l"><b>Как это работает</b><p>ты учишь слова по частоте языка, а WORDS.DB, READER, LISTEN, ECHO, DIARY и GAMES все опираются на один и тот же список — прогресс в одном месте виден везде</p></div>
      </div>
      <div class="note" style="margin-top:12px">
        <div class="l"><b>С чего начнём?</b><p>потяни ползунок вправо, пока в тексте ниже не начнут появляться незнакомые слова (они спрятаны под плашками). Остановись прямо перед первым непонятным словом — это не экзамен, точку старта всегда можно сдвинуть потом в WORDS.DB → Диаграмма</p></div>
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
        <div class="l"><b>Про переводы и тексты</b><p>их придумывает ИИ, а для этого нужен свой бесплатный ключ OpenRouter — без него работают только слова и игры без перевода. Ключ вводится один раз и хранится только на телефоне</p></div>
      </div>
      <div class="rowb" style="margin-top:12px">
        <button class="btn" data-app="setup">Ключ и модель</button>
        <button class="btn p" data-intro="1">Понятно, начнём</button>
      </div>`;
  }
  return `<h3 class="h">Английский</h3>
    <p class="sub">Слова, тексты, дневник и игры на одном словаре.</p>
    <div class="note" style="margin-top:12px">
      <div class="l"><b>WORDS.DB</b><p>словарь, карточки, диаграмма</p></div>
      <div class="l"><b>READER</b><p>тексты под уровень</p></div>
      <div class="l"><b>LISTEN</b><p>диктант на слух</p></div>
      <div class="l"><b>ECHO</b><p>повтори вслух, проверка произношения</p></div>
      <div class="l"><b>DIARY</b><p>три строки о дне</p></div>
      <div class="l"><b>GAMES</b><p>пять игр на твоих словах</p></div>
      <div class="l"><b>TERMINAL</b><p>чужие машины, чтение по-английски</p></div>
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
    <p class="sub" style="margin-top:12px">Версия ${esc(APPVER || '—')}</p>`;
}
