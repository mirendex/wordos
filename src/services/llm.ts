import { cutJson } from '../lib/json';
import { S, save } from '../core/persist';
import { open } from '../ui/windows';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ask(p: string, tries?: number): Promise<any> {
  const cfg = S.cfg || {};
  if (!cfg.key) {
    open('setup');
    throw new Error('нет ключа OpenRouter');
  }
  tries = tries || 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
    model: cfg.model || 'openai/gpt-4o-mini',
    max_tokens: 3000,
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
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + cfg.key,
      'HTTP-Referer': 'https://diffen.app',
      'X-Title': 'Angliyskiy',
    },
    body: JSON.stringify(body),
  });
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
      return ask(p, tries);
    }
    throw new Error('OpenRouter ' + res.status + (t ? ': ' + t.slice(0, 120) : ''));
  }
  const d = await res.json();
  const ch = (d.choices || [])[0] || {};
  const m = ch.message || {};
  const raw = m.content || m.reasoning || ch.text || '';
  if (!raw) {
    if (tries < 1) return ask(p, tries + 1);
    throw new Error('модель вернула пустой ответ, попробуй другую в SETUP');
  }
  try {
    return cutJson(raw);
  } catch (e) {
    if (tries < 1)
      return ask(
        p +
          '\n\nВАЖНО: предыдущая попытка вернула не JSON. Ответь ТОЛЬКО объектом JSON, без единого слова вокруг.',
        tries + 1,
      );
    throw e;
  }
}
