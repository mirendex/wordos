import { esc } from '../../lib/scale';
import { errHint } from '../../lib/json';
import { mask } from '../../lib/text';
import { DAY } from '../../core/util';
import { SR } from '../../platform/speech';
import { RANK } from '../../domain/frequency';
import { dueWords, newToday, vocabState } from '../../domain/vocab';
import { BATCH, newInBatch } from '../../lib/srs';
import { bankSplit, dealingWords } from '../../domain/cards';
import { dealHtml } from '../../ui/deal';
import { Win } from '../../ui/windows';

// "6 слов", "1 слова": how many cards are being written, never which words, as those are the answers
function words(n: number): string {
  return n + (n % 10 === 1 && n % 100 !== 11 ? ' слова' : ' слов');
}

export function learnView(w: Win): string {
  const v = vocabState();
  const dealing = dealingWords();
  if (w.data.busy) return dealHtml('тасую колоду', 'пишу примеры для ' + words(dealing.length));
  const c = v.queue[v.i];
  if (!c && dealing.length) return dealHtml('ещё пара карточек', 'дописываю ' + words(dealing.length));
  if (!c) {
    const due = dueWords().length;
    if (v.err) {
      const hint = errHint(v.err);
      return `<h3 class="h">Не собралось</h3>
      <p class="sub">${esc(v.err)}</p>
      ${hint ? `<p class="sub" style="margin-top:8px">${esc(hint)}</p>` : ''}
      <div class="rowb"><button class="btn p" data-more="1">Повторить</button>
        <button class="btn" data-app="setup">Сменить модель</button></div>`;
    }
    const fresh = newInBatch(due, newToday());
    const bank = bankSplit();
    const why =
      due > BATCH
        ? `новые слова добавятся, когда повторений останется не больше ${BATCH}`
        : !due && !fresh
          ? `новых слов сегодня: ${newToday()}, на день хватит`
          : '';
    return `<h3 class="h">${v.queue.length ? 'Пачка пройдена' : 'Карточки'}</h3>
      <p class="sub">${due ? 'К повторению готово слов: ' + due : 'Повторять нечего, всё придёт по расписанию.'}</p>
      ${why ? `<p class="sub">${why}</p>` : ''}
      <p class="sub">наготове новых: ${bank.fresh} · для повторений: ${bank.review}${navigator.onLine ? '' : ' · офлайн'}</p>
      <div class="rowb">${
        due
          ? `<button class="btn p" data-more="1">${fresh ? 'Повторить и добрать' : 'Повторить'}</button>`
          : fresh
            ? `<button class="btn p" data-more="1">Взять слова</button>`
            : `<button class="btn" data-more="new">Ещё новых слов</button>`
      }
        <button class="btn" data-vtab="stats">Статистика</button></div>`;
  }
  const parts = String(c.sentence || '').split('___');
  const s2 = v.srs[c.w];
  const audio = v.mode === 'audio' && !v.shown;
  const prog = Math.round((v.i / Math.max(1, v.queue.length)) * 100);
  return `
  <div class="cardhead">
    <div class="cprog"><i style="width:${prog}%"></i></div>
    <div class="crow">
      <span class="ctag ${c.rev ? 'rev' : 'new'}">${c.rev ? 'повтор ' + (s2 ? s2.reps : 1) : 'новое'}</span>
      <span class="ctag">#${RANK![c.w] || '?'}</span>
      ${dealing.length ? `<span class="ctag wip">+${dealing.length} пишутся</span>` : ''}
      <span class="cnum">${v.i + 1}/${v.queue.length}</span>
    </div>
  </div>

  ${
    audio
      ? `<div class="earbox" style="margin-top:12px">
      <div class="ear"><svg width="44" height="44" viewBox="0 0 17 17"><path d="M3 6h3l4-3v11l-4-3H3z" fill="#EDE7D8" stroke="#16151A"/><path d="M12 6c1 1 1 4 0 5M14 4c2 2 2 7 0 9" stroke="#39479E" fill="none"/></svg></div>
      <div><div class="sub">предложение звучит целиком</div>
      <div class="rowb" style="margin-top:8px"><button class="btn sm" data-say="${esc(String(c.sentence || '').replace('___', c.w))}">ещё раз</button></div></div>
    </div>`
      : `<div class="sentence">${esc(parts[0] || '')}${
          v.shown
            ? `<em>${esc(c.w)}</em>`
            : `<input class="inline" id="vans" size="${Math.max(4, c.w.length)}" style="width:${Math.max(4, c.w.length) + 1}ch"
          placeholder="${esc(mask(c.w, v.hint || 0).replace(/ /g, ''))}" autocomplete="off" spellcheck="false"
          autocapitalize="off" autocorrect="off" enterkeyhint="done">`
        }${esc(parts[1] || '')}</div>
    <div class="trans">${esc(c.ru || '')}</div>`
  }

  ${
    v.shown
      ? `
    <div class="answer ${v.res === 'no' ? 'bad' : v.res === 'peek' ? '' : 'good'}">
      <div class="aword">${esc(c.w)}${c.ipa ? ` <span class="ipa">[${esc(c.ipa)}]</span>` : ''}
        <button class="btn sm" data-speak="${esc(c.w)}">звук</button></div>
      <div class="aru">${esc(c.word_ru || '')}</div>
      <div class="averdict">${v.res === 'ok' ? 'верно' : v.res === 'typo' ? 'почти, только опечатка' : v.res === 'peek' ? 'вот это слово. Знаешь его?' : 'правильный ответ'}</div>
    </div>
    ${
      c.forms || c.tip
        ? `<div class="grammar">
      ${c.forms ? `<div><span>формы</span>${esc(c.forms)}</div>` : ''}
      ${c.tip ? `<div><span>заметка</span>${esc(c.tip)}</div>` : ''}</div>`
        : ''
    }
    ${
      v.mode === 'audio'
        ? `<div class="sentence sm">${esc(String(c.sentence || '').replace('___', c.w))}</div>
      <div class="trans">${esc(c.ru || '')}</div>`
        : ''
    }
    ${v.res === 'peek' ? '' : `<div class="sub" style="margin-top:10px">следующий раз: ${v.srs[c.w] ? (v.srs[c.w].due === DAY() ? 'сегодня же' : v.srs[c.w].due) : ''}</div>`}
    <div class="actions">
      ${
        v.res === 'peek'
          ? `<button class="btn p big" data-vknow="1">Знаю, убрать</button>
          <button class="btn" data-vnotknow="1">Не знаю</button>`
          : `<button class="btn p big" data-vnext="1">Дальше</button>
          <button class="btn" data-speak="${esc(String(c.sentence || '').replace('___', c.w))}">звук</button>`
      }
    </div>`
      : `<div class="actions">
      <button class="btn p big" data-vcheck="1">Проверить</button>
      <button class="btn" data-vhint="1">Буква</button>
      ${SR ? '<button class="btn" data-voice="1">' + (v.rec ? 'слушаю' : 'голос') + '</button>' : ''}
    </div>
    <div class="minor">
      <button class="btn sm" data-vskip="1">Не знаю</button>
      <button class="btn sm" data-vpeek="1">Уже знаю</button>
      <button class="btn sm ${v.mode === 'audio' ? 'p' : ''}" data-vmode="${v.mode === 'audio' ? 'text' : 'audio'}">${v.mode === 'audio' ? 'вернуть текст' : 'на слух'}</button>
    </div>`
  }`;
}
