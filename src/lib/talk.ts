// The day's conversation: what kind of scene it is, who the character is, and the checks on what
// the learner writes. Kept free of state so it can be tested.

export type FormatId = 'scene' | 'detective' | 'persuade' | 'twenty' | 'tourist' | 'guest';

export interface Format {
  id: FormatId;
  name: string; // what the scene is called, in the window and the day's route
  teaser: string; // a few words on what is waiting
  brief: string; // what the model is told the scene is
  secret?: boolean; // the model keeps an answer the learner has to find
  rare?: boolean;
}

export const FORMATS: Record<FormatId, Format> = {
  scene: {
    id: 'scene',
    name: 'Сцена',
    teaser: 'жизненная ситуация с понятной задачей',
    brief:
      'Обычная жизненная ситуация. У тебя свои дела и заботы, ты не знаешь, чего хочет собеседник, пока он не скажет. Отвечаешь по делу и сам что-то уточняешь, как в жизни.',
  },
  detective: {
    id: 'detective',
    name: 'Детектив',
    teaser: 'допроси свидетеля и найди виновного',
    brief:
      'Утром случилось маленькое загадочное происшествие (пропажа, странный шум, кто-то съел торт в офисе). Ты кое-что видел, но не всё; тебе самому интересно, кто это сделал, у тебя есть догадки и свои заботы. Делишься тем, что знаешь, по ходу разговора, а самое важное — когда об этом спросят. Разговор кончается, когда собеседник назовёт виновного, верно или нет.',
    secret: true,
  },
  persuade: {
    id: 'persuade',
    name: 'Убеди',
    teaser: 'персонаж против, уговори его',
    brief:
      'У тебя свои причины не соглашаться на то, о чём попросит собеседник (поменяться сменой, сделать скидку, одолжить вещь, попробовать новое). Ты вежливо возражаешь и объясняешь почему, и уступаешь, только когда доводы правда убедили.',
  },
  twenty: {
    id: 'twenty',
    name: '20 вопросов',
    teaser: 'угадай загаданное вопросами «да/нет»',
    brief:
      'Вы с собеседником, как друзья, играете в «20 вопросов»: ты загадал обычный предмет или животное. На вопрос отвечаешь yes или no и добавляешь короткую живую реплику, как в игре с другом. Разговор кончается, когда слово угадано или собеседник сдался.',
    secret: true,
  },
  tourist: {
    id: 'tourist',
    name: 'Помоги',
    teaser: 'объясни растерянному новичку',
    brief:
      'Ты растерянный турист или новичок, тебе правда нужна помощь: дорога, как что-то устроено или что выбрать. Переспрашиваешь, когда непонятно, и радуешься, когда стало ясно.',
  },
  guest: {
    id: 'guest',
    name: 'Необычный гость',
    teaser: 'сегодня в гостях кое-кто странный',
    brief:
      'Ты необычный гость в нашем мире: всему удивляешься, остаёшься в своём образе и задаёшь странные вопросы. Хочешь понять, как устроена одна вещь из современной жизни.',
    rare: true,
  },
};

export const COMMON: FormatId[] = ['scene', 'detective', 'persuade', 'twenty', 'tourist'];

export const RARE_MIN = 7; // a rare guest comes no sooner than this many days after the last one
export const RARE_SURE = 10; // and surely by this many

export interface Played {
  day: string;
  format: FormatId;
}

function days(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

// The kind of today's scene. Never the same as the last one; among the rest the ones not seen for
// longest come first. A rare guest comes now and then: not on the first days, not sooner than
// RARE_MIN days after the last one, and surely by RARE_SURE.
export function pickFormat(today: string, played: Played[], rnd: () => number = Math.random): FormatId {
  const before = played.filter((p) => p.day < today);
  const last = before.length ? before[before.length - 1].format : null;
  if (before.length >= 3) {
    const guests = before.filter((p) => p.format === 'guest');
    const since = days(guests.length ? guests[guests.length - 1].day : before[0].day, today);
    if (last !== 'guest' && (since >= RARE_SURE || (since >= RARE_MIN && rnd() < 0.5))) return 'guest';
  }
  const seen = (f: FormatId): number => {
    for (let i = before.length - 1; i >= 0; i--) if (before[i].format === f) return i;
    return -1;
  };
  const pool = COMMON.filter((f) => f !== last);
  const oldest = Math.min(...pool.map(seen));
  const fresh = pool.filter((f) => seen(f) === oldest);
  return fresh[Math.floor(rnd() * fresh.length)] || 'scene';
}

export const SETTINGS = [
  'кафе: заказ, а принесли не то',
  'съём квартиры: осмотр и вопросы хозяину',
  'собеседование на работу',
  'приём у врача',
  'созвон с коллегой: сорвался срок',
  'магазин электроники: возврат покупки',
  'аэропорт: потерялся багаж',
  'отель: шумные соседи',
  'банк: открыть счёт',
  'спортзал: первая тренировка',
  'ремонт телефона',
  'соседи: договориться о вечеринке',
];

export const GUESTS = [
  'путешественник во времени из 1890 года',
  'вежливый инопланетянин-турист',
  'говорящий кот, который считает себя начальником',
  'пират, проснувшийся в современном городе',
  'робот, который впервые испытывает эмоции',
];

export const GUEST_TOPICS = ['смартфон', 'доставка еды', 'метро', 'видеозвонок', 'супермаркет', 'соцсети'];

export const NAMES = [
  'Sam',
  'Mia',
  'Leo',
  'Nora',
  'Max',
  'Ruby',
  'Omar',
  'Ivy',
  'Jack',
  'Zoe',
  'Ben',
  'Ella',
];

export const TRAITS = [
  'ворчливый, но добрый',
  'болтливый и весёлый',
  'рассеянный',
  'мечтательный, любит отвлекаться на детали',
  'очень вежливый и немного старомодный',
  'с сухим чувством юмора',
  'любит точность и уточняет мелочи',
  'восторженный, всему радуется',
];

export function pick<T>(a: T[], rnd: () => number = Math.random): T {
  return a[Math.floor(rnd() * a.length)];
}

// The forms a word may take in what the learner writes: plurals, past and -ing, with the usual
// spelling changes. Irregular forms are not guessed.
export function wordForms(word: string): string[] {
  const w = word.toLowerCase();
  const out = new Set([w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', w + "'s"]);
  if (w.endsWith('e')) out.add(w.slice(0, -1) + 'ing');
  if (/[^aeiou]y$/.test(w)) {
    out.add(w.slice(0, -1) + 'ies');
    out.add(w.slice(0, -1) + 'ied');
  }
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) {
    const d = w + w.slice(-1);
    out.add(d + 'ed');
    out.add(d + 'ing');
  }
  return [...out];
}

export function tokens(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^a-z']+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

export function usedWord(word: string, text: string): boolean {
  const forms = new Set(wordForms(word));
  return tokens(text).some((t) => forms.has(t));
}

// A fix the learner can practise as a card: the one word the right version has where the wrong one
// had something else, and the right version with that word left out. Null when the fix is not a
// single word that `known` accepts (a word of the frequency list) or leaves too little around it.
export function fixGap(
  wrong: string,
  right: string,
  known: (w: string) => boolean,
): { word: string; sentence: string } | null {
  const had = new Set(tokens(wrong));
  const fresh = tokens(right).filter((t) => !had.has(t) && /^[a-z]+$/.test(t) && known(t));
  if (fresh.length !== 1) return null;
  const word = fresh[0];
  const re = new RegExp(`\\b${word}\\b`, 'i');
  if (!re.test(right)) return null;
  const sentence = right.replace(re, '___').trim();
  if (sentence.replace('___', '').replace(/[^A-Za-z]/g, '').length < 4) return null;
  return { word, sentence };
}

export const MAX_TURNS = 8; // the learner's lines, after which the character closes the scene

// whether a scene's title only says again what its kind does: a word of the kind's name, from its
// stem, shows up in it ("Двадцать вопросов с Эллой" under "20 вопросов")
export function titleRepeats(title: string, name: string): boolean {
  const stems = name
    .toLowerCase()
    .split(/[^a-zа-яё]+/)
    .filter((w) => w.length > 3)
    .map((w) => w.slice(0, 5));
  const words = title.toLowerCase().split(/[^a-zа-яё]+/);
  return !title.trim() || stems.some((s) => words.some((w) => w.startsWith(s)));
}
