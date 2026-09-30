import { cutJson } from '../lib/json';
import { S, save } from '../core/persist';
import { open } from '../ui/windows';

function post(p: string, maxTokens: number, stream: boolean): Promise<Response> {
  const cfg = S.cfg || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
    model: cfg.model || 'openai/gpt-4o-mini',
    max_tokens: maxTokens,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content:
          'Ты возвращаешь только валидный JSON. Никакого текста до или после, никаких markdown-заборов, никаких пояснений. Строго один объект JSON.',
      },
      { role: 'user', content: p },
    ],
  };
  if (!cfg.noJsonMode) body.response_format = { type: 'json_object' };
  if (stream) body.stream = true;
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + cfg.key,
      'HTTP-Referer': 'https://wordos.app',
      'X-Title': 'Angliyskiy',
    },
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ask(p: string, tries?: number, maxTokens = 3000): Promise<any> {
  const cfg = S.cfg || {};
  if (!cfg.key) {
    open('setup');
    throw new Error('нет ключа OpenRouter');
  }
  tries = tries || 0;
  const res = await post(p, maxTokens, false);
  if (res.status === 401) {
    open('setup');
    throw new Error('ключ не принят, проверь его в SETUP');
  }
  if (res.status === 402) throw new Error('на балансе OpenRouter нет средств');
  if (res.status === 429) throw new Error('слишком часто, подожди минуту');
  if (!res.ok) {
    let t = '';
    try {
      t = (await res.json()).error.message || '';
    } catch {
      /* ignore */
    }
    // the model doesn't support json_object mode - retry without it
    if (!cfg.noJsonMode && /json|response_format|schema/i.test(t)) {
      S.cfg.noJsonMode = true;
      save();
      return ask(p, tries, maxTokens);
    }
    throw new Error('OpenRouter ' + res.status + (t ? ': ' + t.slice(0, 120) : ''));
  }
  const d = await res.json();
  const ch = (d.choices || [])[0] || {};
  const m = ch.message || {};
  const raw = m.content || m.reasoning || ch.text || '';
  // the reply ran into the token limit (a long answer, or a thinking model spending it on
  // reasoning): asking the same thing again would be cut off in the same place, so give the
  // retry more room
  const cut = ch.finish_reason === 'length';
  const roomier = cut ? Math.min(maxTokens * 2, 8000) : maxTokens;
  if (!raw) {
    if (tries < 1) return ask(p, tries + 1, roomier);
    throw new Error('модель вернула пустой ответ, попробуй другую в SETUP');
  }
  try {
    return cutJson(raw);
  } catch (e) {
    if (tries < 1)
      return ask(
        cut
          ? p
          : p +
              '\n\nВАЖНО: предыдущая попытка вернула не JSON. Ответь ТОЛЬКО объектом JSON, без единого слова вокруг.',
        tries + 1,
        roomier,
      );
    // say what actually came back, so a bad model shows up as such instead of a bare "not JSON"
    const head = String(raw).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    throw new Error(
      'модель вернула не JSON' +
        (cut ? ' (ответ оборвался по лимиту длины)' : '') +
        (head ? ': «' + head + '»' : ''),
    );
  }
}

// The same request as ask(), but the reply comes in pieces and `onText` sees it grow, so a long
// answer can be shown while it is still being written. Anything the stream can't do (an error
// status, a body that can't be read, a reply that doesn't parse) goes through ask() instead,
// which knows how to report it or try again
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function askStream(p: string, onText: (raw: string) => void, maxTokens = 3000): Promise<any> {
  if (!(S.cfg && S.cfg.key) || typeof ReadableStream === 'undefined') return ask(p, 0, maxTokens);
  let raw = '';
  try {
    const res = await post(p, maxTokens, true);
    if (!res.ok || !res.body) return ask(p, 0, maxTokens);
    const rd = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const t = JSON.parse(data).choices?.[0]?.delta?.content;
          if (t) {
            raw += t;
            onText(raw);
          }
        } catch {
          /* a keep-alive or a line cut in two */
        }
      }
    }
    return cutJson(raw);
  } catch {
    return ask(p, 0, maxTokens);
  }
}
