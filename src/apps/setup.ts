import { esc } from '../lib/scale';
import { S } from '../core/persist';
import { HAP_STEPS, hapStep, hapText } from '../platform/haptics';
import { MERR, MFREE, MLOAD, MODELS, MQ } from '../services/models';
import { Win } from '../ui/windows';

export function setupView(w: Win): string {
  const cfg = S.cfg || {};
  const vl = (w && w.data && w.data.voices) || null;
  const q = MQ.trim().toLowerCase();
  let list = MODELS;
  if (MFREE) list = list.filter((m) => (m.pin === 0 && m.pout === 0) || m.id.indexOf(':free') >= 0);
  if (q)
    list = list.filter((m) => m.id.toLowerCase().indexOf(q) >= 0 || m.name.toLowerCase().indexOf(q) >= 0);
  const cur = MODELS.find((m) => m.id === cfg.model);
  return `<h3 class="h">Ключ OpenRouter</h3>
    <p class="sub">Хранится только у тебя на телефоне. Взять ключ можно на openrouter.ai, в разделе Keys.</p>
    <input class="answ" id="orkey" value="${esc(cfg.key || '')}" placeholder="sk-or-v1-..." autocomplete="off" spellcheck="false">
    <div class="rowb"><button class="btn p" data-savekey="1">Сохранить ключ</button>
      ${cfg.key ? '<button class="btn sm" data-clearkey="1">Стереть</button>' : ''}</div>

    <h3 class="h" style="margin-top:18px">Голос</h3>
    <div class="rowb">
      <button class="btn sm" data-speak="This is how the voice sounds.">Послушать</button>
      <button class="btn sm" data-voices="1">Выбрать голос</button>
      ${[0.8, 0.9, 1.0, 1.1].map((r) => `<button class="btn sm ${(cfg.rate || 1.0) === r ? 'p' : ''}" data-rate="${r}">${r.toFixed(1)}x</button>`).join('')}
    </div>
    ${cfg.voice ? `<p class="sub">сейчас: ${esc(cfg.voice)}</p>` : ''}
    ${
      vl
        ? `<div class="note"><b style="font-family:var(--px);font-size:15px">Голоса в системе</b>
      ${vl
        .map(
          (v: { name?: string; voiceURI?: string; lang?: string }, i: number) =>
            `<div class="wrow"><b>${esc(v.name || v.voiceURI || 'голос ' + i)}</b>
        <div class="acts"><button class="btn sm" data-pickvoice="${i}">выбрать</button></div>
        <span>${esc(v.lang || '')}</span></div>`,
        )
        .join('')}</div>`
        : ''
    }

    <h3 class="h" style="margin-top:18px">Отклик</h3>
    <p class="sub">Ноль слева выключает.</p>
    <div class="pslider" data-slider="hap">
      <div class="ptrack">${'<i></i>'.repeat(10)}</div>
      <div class="pfill" style="width:${(hapStep() / HAP_STEPS) * 100}%"></div>
      <div class="pknob" style="left:${(hapStep() / HAP_STEPS) * 100}%"></div>
    </div>
    <div class="pscale"><i style="left:0%">тихо</i><i style="left:50%">средне</i><i style="left:100%">сильно</i></div>
    <div class="cov" id="haptxt">${hapText()}</div>
    <div class="rowb"><button class="btn sm" data-haptest="1">Проверить</button>
      <button class="btn sm" data-hapdef="1">Сбросить</button></div>

    <h3 class="h" style="margin-top:18px">Напоминание</h3>
    <p class="sub">Одно напоминание в день, не больше.</p>
    <div class="rowb">
      <button class="btn sm ${cfg.notify ? 'p' : ''}" data-notify="1">${cfg.notify ? 'включено' : 'выключено'}</button>
      ${[9, 13, 19, 21].map((x) => `<button class="btn sm ${(cfg.notifyHour || 19) === x ? 'p' : ''}" data-nhour="${x}">${x}:30</button>`).join('')}
    </div>

    <h3 class="h" style="margin-top:18px">Модель</h3>
    <div class="note"><div class="l">сейчас: <b style="font-family:var(--mo)">${esc(cfg.model || 'не выбрана')}</b>
      ${cur ? `<p>${cur.ctx ? Math.round(cur.ctx / 1000) + 'k контекст · ' : ''}${cur.pin === 0 && cur.pout === 0 ? 'бесплатная' : '$' + cur.pin.toFixed(2) + ' / $' + cur.pout.toFixed(2) + ' за 1М токенов'}</p>` : ''}</div></div>
    <input class="answ" id="mq" value="${esc(MQ)}" placeholder="поиск по моделям: gemini, claude, free..." autocomplete="off" data-msearch>
    <div class="rowb">
      <button class="btn sm ${MFREE ? 'p' : ''}" data-mfree="1">только бесплатные</button>
      <button class="btn sm" data-mreload="1">${MLOAD ? 'обновляю...' : 'обновить список'}</button>
      <span class="sub" style="align-self:center">${MODELS.length ? 'моделей: ' + MODELS.length : ''}</span>
    </div>
    ${MERR ? `<div class="note" style="margin-top:10px"><div class="l">${esc(MERR)}</div></div>` : ''}
    ${
      MLOAD && !MODELS.length
        ? `<div class="loadbox"><div class="pix"><i></i><i></i><i></i><i></i><i></i></div>
      <b>тяну список моделей</b><span>openrouter.ai</span><div class="scan"></div></div>`
        : ''
    }
    <div style="margin-top:10px">${list
      .slice(0, 40)
      .map(
        (m) => `<div class="wrow">
      <b style="min-width:0;flex:1">${esc(m.name)}<div class="sub" style="font-size:11px">${esc(m.id)}</div></b>
      <span>${m.ctx ? Math.round(m.ctx / 1000) + 'k · ' : ''}${m.pin === 0 && m.pout === 0 ? 'free' : '$' + m.pin.toFixed(2) + '/$' + m.pout.toFixed(2)}</span>
      <button class="btn sm ${cfg.model === m.id ? 'p' : ''}" data-pickmodel="${esc(m.id)}">${cfg.model === m.id ? 'выбрана' : 'выбрать'}</button>
    </div>`,
      )
      .join('')}</div>
    ${list.length > 40 ? `<p class="sub">первые 40 из ${list.length}</p>` : ''}
    ${!list.length && MODELS.length ? '<p class="sub">Ничего не нашлось.</p>' : ''}`;
}
