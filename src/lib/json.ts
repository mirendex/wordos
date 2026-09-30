export interface BankCard {
  w?: string;
  sentence?: string;
  [key: string]: unknown;
}

export function objects(s: string): string[] {
  // every {...} object at any nesting level, even if the tail got cut off
  const out: string[] = [];
  const st: number[] = [];
  let q = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') q = false;
      continue;
    }
    if (c === '"') {
      q = true;
      continue;
    }
    if (c === '{') st.push(i);
    else if (c === '}' && st.length) {
      const a = st.pop()!;
      out.push(s.slice(a, i + 1));
    }
  }
  return out;
}

export function errHint(msg: unknown): string {
  msg = String(msg || '');
  if (/failed to fetch|network ?error|load failed|networkrequest/i.test(msg as string))
    return 'Не получилось подключиться к OpenRouter — проверь интернет-соединение и попробуй ещё раз. Дело не в модели.';
  if (/batch api|only available through/i.test(msg as string))
    return 'Эта модель работает только через пакетную обработку (Batch API) и не годится для обычных запросов. Выбери другую модель в SETUP.';
  if (/json|response_format|schema|пустой ответ|не JSON/i.test(msg as string))
    return 'Обычно виновата модель: мелкие не держат формат. Смени её в SETUP.';
  if (/ключ не принят|нет средств|слишком часто|нет ключа|опиши, к чему|выбери дату/i.test(msg as string))
    return '';
  return 'Если это повторяется — попробуй другую модель в SETUP.';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cutJson(s: string): any {
  s = String(s || '')
    .replace(/```json/gi, '')
    .replace(/```/gi, '')
    .trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  const body = a >= 0 && b > a ? s.slice(a, b + 1) : s;
  try {
    return JSON.parse(body);
  } catch {
    /* the response got cut off: salvage whatever made it through */
  }
  const parts = objects(s)
    .map((x) => {
      try {
        return JSON.parse(x);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Record<string, unknown>[];
  const cards: BankCard[] = [];
  const seen: Record<string, 1> = {};
  parts.forEach((o) => {
    const add = (c: BankCard) => {
      if (c && c.w && c.sentence && !seen[String(c.w).toLowerCase()]) {
        seen[String(c.w).toLowerCase()] = 1;
        cards.push(c);
      }
    };
    if (Array.isArray(o.cards)) o.cards.forEach(add);
    else add(o as BankCard);
  });
  if (cards.length) return { cards, _partial: true };
  // a goal scenario's items are keyed by `en`, not `w`
  const items = parts.filter((o) => o && o.en && o.sentence);
  if (items.length) return { items, _partial: true };
  const whole = parts.find((o) => Object.keys(o).length > 1);
  if (whole) return whole;
  // last resort: scrape "key":"value" pairs out of the truncated object
  const pairs: Record<string, string> = {};
  let mm: RegExpExecArray | null;
  const re = /"([A-Za-z_]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  while ((mm = re.exec(s))) {
    try {
      pairs[mm[1]] = JSON.parse('"' + mm[2] + '"');
    } catch {
      pairs[mm[1]] = mm[2];
    }
  }
  if (Object.keys(pairs).length) return pairs;
  throw new Error('модель вернула не JSON');
}

// the text of a string field in a JSON object that is still being written: as much of it as has
// come so far, or null if the field hasn't started
export function partialField(raw: string, key: string): string | null {
  const m = new RegExp('"' + key + '"\\s*:\\s*"').exec(raw);
  if (!m) return null;
  let out = '';
  for (let i = m.index + m[0].length; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') break;
    if (c !== '\\') {
      out += c;
      continue;
    }
    const n = raw[i + 1];
    if (n === undefined) break;
    if (n === 'u') {
      const hex = raw.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '' : n;
      i++;
    }
  }
  return out;
}
