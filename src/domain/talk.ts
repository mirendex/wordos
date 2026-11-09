import { DAY } from '../core/util';
import { paint } from '../core/paint';
import { BANK, S, save } from '../core/persist';
import { cefr, tone } from '../lib/scale';
import { hasGapSentence } from '../lib/text';
import { newSrsCard } from '../lib/srs';
import {
  COMMON,
  FORMATS,
  FormatId,
  GUESTS,
  GUEST_TOPICS,
  MAX_TURNS,
  NAMES,
  Played,
  SETTINGS,
  TRAITS,
  fixGap,
  pick,
  pickFormat,
  usedWord,
} from '../lib/talk';
import { ask } from '../services/llm';
import { haptic } from '../platform/haptics';
import { ChatReview, ChatTurn, attachFix, chatReply, chatReview } from './chat';
import { showChatStream } from '../ui/chat';
import { freqInit, RANK } from './frequency';
import { saveBank } from './cards';
import { srsGrade, vocabState } from './vocab';

export interface TalkScene {
  id?: string; // tells the scenes apart, also two on one day
  day: string;
  format: FormatId;
  title: string;
  role: string;
  task: string;
  name: string;
  traits: string;
  extra: string; // the place of a plain scene, the guest and what to explain to it
  secret: string;
  targets: string[]; // words from the cards to say in the talk
  used: Record<string, 1>;
  turns: ChatTurn[];
  done?: boolean;
  review?: ChatReview;
  cards?: string[]; // the words of the fixes that went into the cards
}

export interface TalkState {
  cur: TalkScene | null;
  plan: Played | null; // today's kind of scene, fixed as soon as it is first asked
  played: Played[];
  done: number; // scenes finished, ever
  phrases: { day: string; en: string; ru: string }[];
  draft: string;
  err: string;
  busy: boolean;
}

export function talkState(): TalkState {
  if (!S.talk || typeof S.talk !== 'object') S.talk = {};
  const k = S.talk;
  if (k.cur === undefined) k.cur = null;
  if (k.plan === undefined) k.plan = null;
  if (!Array.isArray(k.played)) k.played = [];
  if (typeof k.done !== 'number') k.done = 0;
  if (!Array.isArray(k.phrases)) k.phrases = [];
  if (typeof k.draft !== 'string') k.draft = '';
  if (typeof k.err !== 'string') k.err = '';
  k.busy = !!k.busy;
  return k;
}

export function todayFormat(): FormatId {
  const k = talkState();
  const t = DAY();
  if (!k.plan || k.plan.day !== t) {
    k.plan = { day: t, format: pickFormat(t, k.played) };
    save();
  }
  return k.plan.format;
}

// what the day's route says of the talk step
export function talkTeaser(): string {
  const f = FORMATS[todayFormat()];
  return (f.rare ? 'сюрприз, ' : '') + 'сегодня ' + f.name.toLowerCase() + ': ' + f.teaser;
}

// today's scene, when there is one
export function todayScene(): TalkScene | null {
  const c = talkState().cur;
  return c && c.day === DAY() ? c : null;
}

// Words from the cards for the talk: ones being learned, the ones due today and the ones started
// most recently first, a few of them at random
function pickTargets(n = 3): string[] {
  const v = vocabState();
  const t = DAY();
  const cand = Object.keys(v.srs).filter(
    (w) => /^[a-z]+$/.test(w) && w.length > 2 && !v.srs[w].skip && v.srs[w].b >= 1 && v.srs[w].b <= 4,
  );
  cand.sort((a, b) => {
    const da = v.srs[a].due <= t ? 1 : 0;
    const db = v.srs[b].due <= t ? 1 : 0;
    if (da !== db) return db - da;
    return String(v.srs[b].first).localeCompare(String(v.srs[a].first));
  });
  const pool = cand.slice(0, 15);
  const out: string[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

function scenePrompt(f: FormatId, name: string, traits: string, extra: string, targets: string[]): string {
  const fm = FORMATS[f];
  return `Придумай короткую ролевую сцену для разговорной практики английского. Уровень ученика ${cefr(S.level)}, подача: ${tone(S.level)}.
Роль персонажа (написано ему): ${fm.brief}${extra ? '\n' + (f === 'guest' ? 'Гость: ' : 'Ситуация: ') + extra : ''}
Персонаж: ${name}, характер: ${traits}. Он живой человек в этой ситуации, а не ведущий игры: не объясняет правил и не говорит, что можно спросить; разговор без давления.${
    targets.length
      ? `\nСитуация должна давать ученику повод самому сказать слова: ${targets.join(', ')}. Сам персонаж эти слова не произносит.`
      : ''
  }
Персонаж начинает разговор: первая реплика короткая, до 25 слов, в его характере и сразу втягивает ученика${
    f === 'twenty' ? ', с правилами игры' : ''
  }.
Формат ответа:
{"title":"название сцены по-русски, до 4 слов, без имени персонажа и без названия формата","role":"кто персонаж, по-русски, до 6 слов, без имени и без характера","task":"что нужно сделать ученику, по-русски, до 10 слов","secret":"${
    fm.secret ? 'разгадка или загаданное слово, по-английски' : 'пустая строка'
  }","opening":{"en":"первая реплика","ru":"перевод"}}`;
}

function context(c: TalkScene): string {
  const f = FORMATS[c.format];
  return `Ты ${c.name}, ${c.role}. Собеседник учит английский, уровень ${cefr(S.level)}: говори просто, как с иностранцем, но естественно.
${f.brief}${c.extra ? '\n' + (c.format === 'guest' ? 'Кто ты: ' : 'Где вы: ') + c.extra : ''}
Чего хочет собеседник: ${c.task}.${c.secret ? `\nЧто знаешь только ты: ${c.secret}. Прямо не говори.` : ''}
Как говорить:
- ты живой человек в этой ситуации, а не ведущий, учитель или помощник; никогда не говори о правилах, задании, уроке, о том, что собеседник может спросить или сделать; не хвали и не успокаивай его;
- реагируй по-человечески: удивление, шутка, своё мнение, встречный вопрос, иногда сам расскажи что-то своё;
- если собеседник застрял, ушёл от темы или ответил невпопад, ответь в образе и сам продвинь разговор новой деталью;
- характер (${c.traits}) проявляется слегка, не в каждой реплике; темп обычного разговора, без давления;
- не повторяй свои прежние фразы; реплика короткая, до 25 слов.${
    c.targets.length ? `\nНе произноси слова ${c.targets.join(', ')}: их собеседник скажет сам.` : ''
  }`;
}

// the chat scrolled to its last line
function toEnd(): void {
  const b = document.querySelector('.win[data-k="talk:"] .body');
  if (b) b.scrollTop = b.scrollHeight;
}

// the character's line while it is being written
let stream: string | null = null;

export function talkStream(): string | null {
  return stream;
}

let making: Promise<void> | null = null;

async function makeScene(format: FormatId): Promise<void> {
  const k = talkState();
  const name = pick(NAMES);
  const traits = pick(TRAITS);
  const extra =
    format === 'guest'
      ? `${pick(GUESTS)}; объяснить ему нужно: ${pick(GUEST_TOPICS)}`
      : format === 'scene'
        ? pick(SETTINGS)
        : '';
  const targets = pickTargets();
  const r = await ask(scenePrompt(format, name, traits, extra, targets));
  const open = r && r.opening && r.opening.en ? r.opening : null;
  if (!open) throw new Error('модель не придумала сцену');
  const day = DAY();
  k.cur = {
    id: Date.now().toString(36),
    day,
    format,
    title: r.title || FORMATS[format].name,
    role: r.role || '',
    task: r.task || '',
    name,
    traits,
    extra,
    secret: r.secret || '',
    targets,
    used: {},
    turns: [{ who: 'them', en: open.en, ru: open.ru || '' }],
  };
  k.draft = '';
  k.played.push({ day, format });
  if (k.played.length > 30) k.played = k.played.slice(-30);
  save();
}

// Gets today's scene ready, in the background or for the window. Nothing is asked while one is
// already being made, or when today's is there.
export async function ensureScene(quiet = false): Promise<void> {
  const k = talkState();
  if (todayScene() || !(S.cfg && S.cfg.key) || !navigator.onLine) return;
  if (making) return making;
  if (!quiet) {
    k.err = '';
    k.busy = true;
    paint();
  }
  making = makeScene(todayFormat())
    .catch((e) => {
      if (!quiet) k.err = (e as Error).message || 'не вышло';
    })
    .finally(() => {
      making = null;
      k.busy = false;
      paint();
    });
  return making;
}

export function makingScene(): boolean {
  return !!making;
}

// one more scene the same day, of a kind not played today
export async function moreTalk(): Promise<void> {
  const k = talkState();
  if (making) return;
  const t = DAY();
  const today = k.played.filter((p) => p.day === t).map((p) => p.format);
  const pool = COMMON.filter((f) => today.indexOf(f) < 0);
  k.err = '';
  k.busy = true;
  paint();
  making = makeScene(pick(pool.length ? pool : COMMON))
    .catch((e) => {
      k.err = (e as Error).message || 'не вышло';
    })
    .finally(() => {
      making = null;
      k.busy = false;
      paint();
    });
  return making;
}

// a card word said in the talk: when it is due, saying it is its review
function creditWord(w: string): void {
  const v = vocabState();
  const s = v.srs[w];
  if (s && !s.skip && s.due <= DAY()) srsGrade(w, 'ok');
}

export async function talkSend(text: string): Promise<void> {
  const k = talkState();
  const c = todayScene();
  if (!c || c.done || k.busy) return;
  c.turns.push({ who: 'me', en: text });
  let hit = false;
  c.targets.forEach((w) => {
    if (!c.used[w] && usedWord(w, text)) {
      c.used[w] = 1;
      creditWord(w);
      hit = true;
    }
  });
  if (hit) haptic('ok');
  k.busy = true;
  k.err = '';
  k.draft = '';
  save();
  paint();
  toEnd();
  try {
    const mine = c.turns.filter((t) => t.who === 'me').length;
    stream = '';
    paint();
    const r = await chatReply(context(c), c.turns, mine >= MAX_TURNS, (t) => {
      stream = t;
      showChatStream('talk:', t);
    });
    stream = null;
    attachFix(c.turns, r.fix);
    if (r.reply) c.turns.push({ who: 'them', en: r.reply, ru: r.ru });
    if (r.done) await finishTalk(c);
  } catch (e) {
    stream = null;
    k.err = (e as Error).message || 'не вышло';
    // the line goes back to the input, to be sent again
    if (!c.done && c.turns[c.turns.length - 1]?.who === 'me') {
      c.turns.pop();
      k.draft = text;
    }
  }
  k.busy = false;
  save();
  paint();
  toEnd();
}

// the learner ends the scene before the character does
export async function endTalk(): Promise<void> {
  const k = talkState();
  const c = todayScene();
  if (!c || c.done || k.busy) return;
  k.busy = true;
  k.err = '';
  paint();
  try {
    await finishTalk(c);
  } catch (e) {
    k.err = (e as Error).message || 'не вышло';
  }
  k.busy = false;
  save();
  paint();
  toEnd();
}

async function finishTalk(c: TalkScene): Promise<void> {
  const k = talkState();
  const said = c.turns.some((t) => t.who === 'me');
  const review = said
    ? await chatReview(
        `Сцена: ${c.title} (${FORMATS[c.format].name}). Задача ученика: ${c.task}.${c.secret ? ` Разгадка: ${c.secret}.` : ''} В разборе скажи, справился ли ученик${c.secret ? ', и назови разгадку' : ''}.`,
        c.turns,
      )
    : { summary: 'Сцена закончилась без ответов.', fixes: [], phrases: [] };
  c.review = review;
  c.done = true;
  c.cards = fixCards(review);
  if (said) k.done++;
  const t = DAY();
  k.phrases = k.phrases
    .concat(review.phrases.slice(0, 4).map((p) => ({ day: t, en: p.en, ru: p.ru || '' })))
    .slice(-12);
  save();
}

// The fixes that come down to one word become cards for it, due now, with the slip as their note
function fixCards(review: ChatReview): string[] {
  freqInit();
  const v = vocabState();
  const out: string[] = [];
  review.fixes.forEach((f) => {
    if (out.length >= 3) return;
    const g = fixGap(f.wrong, f.right, (w) => !!RANK![w]);
    if (!g || out.indexOf(g.word) >= 0) return;
    const w = g.word;
    const old = (BANK[w] || []).filter((x: { sentence?: string }) => hasGapSentence(x.sentence));
    const card = {
      sentence: g.sentence,
      ru: f.ru || '',
      word_ru: (old[0] && old[0].word_ru) || S.mt[w] || '',
      ipa: (old[0] && old[0].ipa) || '',
      forms: (old[0] && old[0].forms) || '',
      tip: `в разговоре было: «${f.wrong}»`,
    };
    BANK[w] = [card].concat(old).slice(0, 2);
    const s = v.srs[w];
    if (!s || s.skip) v.srs[w] = newSrsCard(DAY());
    else s.due = DAY();
    out.push(w);
  });
  if (out.length) saveBank();
  return out;
}

// a few good lines from the last talk before today, for the dictation and the echo to bring back
export function recentTalkPhrases(n = 3): string[] {
  const t = DAY();
  const before = talkState().phrases.filter((p) => p.day < t);
  if (!before.length) return [];
  const last = before[before.length - 1].day;
  return before
    .filter((p) => p.day === last)
    .map((p) => p.en)
    .slice(0, n);
}

// what today's talk came to, for the day's summary
export function talkSummary(): { name: string; used: number; targets: number; cards: number } | null {
  const c = todayScene();
  if (!c || !c.done) return null;
  return {
    name: FORMATS[c.format].name,
    used: Object.keys(c.used).length,
    targets: c.targets.length,
    cards: (c.cards || []).length,
  };
}
