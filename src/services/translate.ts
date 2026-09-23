import { S, save } from '../core/persist';

export async function fetchFreeTranslation(w: string): Promise<string> {
  if (S.mt[w] !== undefined) return S.mt[w];
  try {
    const res = await fetch(
      'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(w) + '&langpair=en|ru',
    );
    const d = await res.json();
    const t =
      d && d.responseData && d.responseData.translatedText
        ? String(d.responseData.translatedText).trim()
        : '';
    S.mt[w] = t;
    save();
    return t;
  } catch {
    return '';
  }
}
