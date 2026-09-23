export interface BankCard {
  w?: string;
  sentence?: string;
  [key: string]: unknown;
}

export function objects(s: string): string[] {
  // все объекты {...} на любом уровне вложенности, даже если хвост обрезан
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
  if (/batch api|only available through/i.test(msg as string))
    return 'Эта модель работает только через пакетную обработку (Batch API) и не годится для обычных запросов. Выбери другую модель в SETUP.';
  if (/json|response_format|schema|пустой ответ|не JSON/i.test(msg as string))
    return 'Обычно виновата модель: мелкие не держат формат. Смени её в SETUP.';
  if (/ключ не принят|нет средств|слишком часто|нет ключа/i.test(msg as string)) return '';
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
    /* ответ оборвался: собираем то, что успело прийти */
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
  const whole = parts.find((o) => Object.keys(o).length > 1);
  if (whole) return whole;
  // последний шанс: собираем пары "ключ":"значение" из оборванного объекта
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
