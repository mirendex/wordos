import { hasGapSentence, echoScore } from '../lib/text';
import { newSrsCard, srsStep } from '../lib/srs';
import { daysLeft, dailyQuota } from '../lib/plan';
import { DAY, PLUS } from '../core/util';
import { paint } from '../core/paint';
import { save } from '../core/persist';
import { ask } from '../services/llm';
import { CAPSR, SR } from '../platform/speech';
import { haptic } from '../platform/haptics';
import { dialog } from '../ui/modal';
import { goalState, Goal, GoalItem, GoalScene, GoalChat, GoalPhrase } from '../apps/goal/state';

function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function makeGoal(desc: string, until: string): Promise<void> {
  const g = goalState();
  g.busy = true;
  g.err = '';
  paint();
  try {
    const r = await ask(`Ученик готовится к событию и хочет разговорный английский к конкретной дате.
Описание: ${desc}
Придумай 6-10 разговорных сценариев, которые пригодятся именно для этого. Каждый — конкретная бытовая ситуация с ролью собеседника и короткой задачей.
Формат ответа:
{"title":"короткое название цели на русском, до 6 слов","scenes":[{"ru":"название сценария на русском, до 5 слов","en":"название на английском","role":"кто собеседник, по-русски","task":"что нужно сделать в диалоге, по-русски, до 12 слов"}]}`);
    const scenes: GoalScene[] = (Array.isArray(r.scenes) ? r.scenes : [])
      .filter((s: { en?: string }) => s && s.en)
      .map((s: { ru?: string; en?: string; role?: string; task?: string }) => ({
        id: uid('s'),
        ru: s.ru || s.en || '',
        en: s.en || '',
        role: s.role || '',
        task: s.task || '',
      }));
    if (!scenes.length) throw new Error('модель не предложила сценарии');
    g.cur = {
      title: r.title || desc.slice(0, 40),
      desc,
      until,
      created: DAY(),
      scenes,
      items: {},
      srs: {},
      log: {},
      talks: {},
    } as Goal;
    g.chat = null;
    g.queue = [];
    g.i = 0;
    g.tab = 'plan';
    save();
  } catch (e) {
    g.err = (e as Error).message;
  }
  g.busy = false;
  paint();
}

export function dropScene(id: string): void {
  const g = goalState();
  if (!g.cur) return;
  g.cur.scenes = g.cur.scenes.filter((s: GoalScene) => s.id !== id);
  Object.keys(g.cur.items).forEach((k) => {
    if (g.cur.items[k].scene === id) delete g.cur.items[k];
  });
  save();
  paint();
}

export function archiveGoal(): void {
  const g = goalState();
  if (!g.cur) return;
  const ids = Object.keys(g.cur.items);
  const learned = ids.filter((id) => g.cur.srs[id] && g.cur.srs[id].b >= 3).length;
  g.archive.push({ title: g.cur.title, until: g.cur.until, learned, total: ids.length });
  g.cur = null;
  g.chat = null;
  g.queue = [];
  g.i = 0;
  save();
  paint();
}

export async function fillScene(scene: GoalScene): Promise<void> {
  const g = goalState();
  if (!g.cur) return;
  const r =
    await ask(`Сценарий подготовки к событию: "${scene.en}" (${scene.ru}). Собеседник: ${scene.role}. Задача: ${scene.task}.
Дай 8 отдельных слов и 6 разговорных фраз-шаблонов, которые реально пригодятся именно в этой ситуации. Слова и фразы должны быть теми, что говорит или слышит сам ученик.
Для каждого — предложение на английском (6-14 слов), где нужное слово или блок заменён на ___ (три подчёркивания), и оно должно однозначно подходить в пропуск.
Формат ответа:
{"items":[{"kind":"word","en":"слово или фраза для пропуска","sentence":"текст с ___","ru":"перевод предложения","word_ru":"перевод слова или фразы","ipa":"транскрипция или пустая строка","tip":"заметка по-русски или пустая строка"}]}`);
  const items = Array.isArray(r.items) ? r.items : [];
  items.forEach((c: Record<string, string>) => {
    if (!c || typeof c !== 'object') return;
    const en = String(c.en || '').trim();
    if (!en || !c.sentence || String(c.sentence).indexOf('___') < 0) return;
    const id = uid('i');
    const item: GoalItem = {
      id,
      scene: scene.id,
      kind: c.kind === 'phrase' ? 'phrase' : 'word',
      en,
      gap: en,
      sentence: c.sentence,
      ru: c.ru || '',
      word_ru: c.word_ru || '',
      ipa: c.ipa || '',
      tip: c.tip || '',
    };
    g.cur.items[id] = item;
  });
  scene.filled = true;
  save();
}

export function goalDaysLeft(): number {
  const g = goalState();
  if (!g.cur) return 0;
  return daysLeft(DAY(), g.cur.until);
}

function dueGoalIds(): string[] {
  const g = goalState();
  if (!g.cur) return [];
  const t = DAY();
  return Object.keys(g.cur.srs).filter((id) => g.cur.srs[id].due <= t && !g.cur.srs[id].skip);
}

function newGoalIds(limit: number): string[] {
  const g = goalState();
  if (!g.cur) return [];
  return Object.keys(g.cur.items)
    .filter((id) => !g.cur.srs[id] && hasGapSentence(g.cur.items[id].sentence))
    .slice(0, limit);
}

export async function loadGoalCards(): Promise<void> {
  const g = goalState();
  if (!g.cur) return;
  g.err = '';
  const due = dueGoalIds();
  const unseen = Object.keys(g.cur.items).filter((id) => !g.cur.srs[id]).length;
  const quota = dailyQuota(unseen, Math.max(1, goalDaysLeft()));
  const fresh = newGoalIds(Math.max(0, quota - due.length));

  const emptyScenes = g.cur.scenes.filter((s: GoalScene) => !s.filled);
  if (!due.length && !fresh.length && emptyScenes.length) {
    g.busy = true;
    paint();
    try {
      await fillScene(emptyScenes[0]);
    } catch (e) {
      g.err = (e as Error).message;
    }
    g.busy = false;
    g.queue = [];
    g.i = 0;
    paint();
    return loadGoalCards();
  }

  g.queue = due.concat(fresh).map((id) => Object.assign({ rev: due.indexOf(id) >= 0 }, g.cur.items[id]));
  g.i = 0;
  g.shown = false;
  g.hint = 0;
  g.res = null;
  g.tab = 'cards';
  save();
  paint();
}

export function gradeGoal(id: string, res: 'ok' | 'typo' | 'no'): void {
  const g = goalState();
  if (!g.cur) return;
  const s = g.cur.srs[id] || (g.cur.srs[id] = newSrsCard(DAY()));
  const was = srsStep(s, res, DAY(), PLUS);
  const t = DAY();
  if (!g.cur.log[t]) g.cur.log[t] = { n: 0, r: 0, ok: 0 };
  if (res !== 'no') g.cur.log[t].ok++;
  g.cur.log[t][was ? 'n' : 'r']++;
  save();
}

export function markGoalKnown(id: string): void {
  const g = goalState();
  if (!g.cur) return;
  g.cur.srs[id] = { b: 6, due: PLUS(150), reps: 1, lapses: 0, first: DAY(), skip: 1 };
  save();
}

export async function talkTurn(text: string): Promise<void> {
  const g = goalState();
  if (!g.chat || !g.cur) return;
  const scene = g.cur.scenes.find((s: GoalScene) => s.id === g.chat!.scene);
  if (!scene) return;
  const chat = g.chat as GoalChat;
  chat.turns.push({ who: 'me', en: text });
  g.busy = true;
  paint();
  try {
    const history = chat.turns.map((t) => (t.who === 'me' ? 'Ученик: ' : 'Собеседник: ') + t.en).join('\n');
    const r =
      await ask(`Ролевой диалог для подготовки к событию. Ты играешь роль: ${scene.role}. Сценарий: ${scene.en} (${scene.ru}). Задача ученика: ${scene.task}.
История диалога:
${history}
Отвечай короткой репликой в роли собеседника на английском, живой разговорной речью. Если задача уже выполнена, закончи сцену.
Формат ответа:
{"reply":"реплика собеседника на английском","ru":"перевод реплики","fix":"если в реплике ученика была ошибка - короткая поправка по-русски, иначе пустая строка","done":true или false}`);
    if (r.reply) chat.turns.push({ who: 'them', en: r.reply, ru: r.ru || '', fix: r.fix || '' });
    if (r.done) {
      chat.done = true;
      const sum = await ask(`Ролевой диалог закончен. Сценарий: ${scene.en}. Полная история:
${chat.turns.map((t) => (t.who === 'me' ? 'Ученик: ' : 'Собеседник: ') + t.en).join('\n')}
Дай короткий разбор для ученика.
Формат ответа:
{"summary":"как прошло, по-русски, 1-2 предложения","fixes":[{"wrong":"цитата ученика","right":"исправление","why":"по-русски, до 8 слов"}],"phrases":[{"en":"удачная фраза из диалога","ru":"перевод"}]}`);
      chat.summary = sum.summary || '';
      chat.fixes = Array.isArray(sum.fixes) ? sum.fixes : [];
      chat.phrases = Array.isArray(sum.phrases) ? sum.phrases : [];
      g.cur.talks[scene.id] = (g.cur.talks[scene.id] || 0) + 1;
    }
  } catch (e) {
    g.err = (e as Error).message;
  }
  g.busy = false;
  save();
  paint();
}

export function startTalk(sceneId: string): void {
  const g = goalState();
  g.chat = { scene: sceneId, turns: [] } as GoalChat;
  g.err = '';
  g.tab = 'talk';
  save();
  paint();
}

export function addGoalPhrase(scene: string, en: string, ru: string): void {
  const g = goalState();
  if (!g.cur) return;
  const id = uid('i');
  g.cur.items[id] = {
    id,
    scene,
    kind: 'phrase',
    en,
    gap: en,
    sentence: '___',
    ru: en,
    word_ru: ru,
  };
  save();
}

// listening/pronunciation drills draw straight from the goal's own scenario sentences —
// no separate generation, no mixing with LISTEN/ECHO's pools
export function goalPracticePool(): GoalPhrase[] {
  const g = goalState();
  if (!g.cur) return [];
  return Object.values(g.cur.items as Record<string, GoalItem>)
    .filter((i) => hasGapSentence(i.sentence))
    .map((i) => ({ en: String(i.sentence).replace('___', i.gap), ru: i.ru || '' }));
}

function pickPhrase(pool: GoalPhrase[], avoid?: GoalPhrase | null): GoalPhrase {
  let next = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && avoid && next.en === avoid.en) {
    const rest = pool.filter((x) => x.en !== avoid.en);
    next = rest[Math.floor(Math.random() * rest.length)];
  }
  return next;
}

export function dictPick(): boolean {
  const g = goalState();
  const pool = goalPracticePool();
  if (!pool.length) return false;
  g.dict.cur = pickPhrase(pool, g.dict.cur);
  g.dict.shown = false;
  g.dict.text = '';
  g.dict.err = '';
  return true;
}

const dictNorm = (s: unknown): string[] =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

export function dictCheck(said: string): void {
  const g = goalState();
  if (!g.dict.cur) return;
  const s = said.trim();
  if (!s) {
    g.dict.err = 'Напиши, что услышал.';
    paint();
    return;
  }
  g.dict.text = s;
  g.dict.shown = true;
  g.dict.err = '';
  const a = dictNorm(s);
  const b = dictNorm(g.dict.cur.en);
  let hit = 0;
  b.forEach((x, i) => {
    if (a[i] === x) hit++;
  });
  const pct = Math.round((hit / Math.max(1, b.length)) * 100);
  g.dict.last = pct;
  g.dict.acc.push(pct);
  if (g.dict.acc.length > 50) g.dict.acc = g.dict.acc.slice(-50);
  g.dict.done++;
  save();
  paint();
}

export function pronPick(): boolean {
  const g = goalState();
  const pool = goalPracticePool();
  if (!pool.length) return false;
  g.pron.cur = pickPhrase(pool, g.pron.cur);
  g.pron.last = null;
  g.pron.heard = '';
  g.pron.err = '';
  return true;
}

export async function pronSay(): Promise<void> {
  const g = goalState();
  if (g.pron.rec || !g.pron.cur) return;
  const P = CAPSR();
  if (!P && !SR) {
    dialog({ title: 'голос', text: 'На этом телефоне распознавание речи не работает.' });
    return;
  }
  g.pron.err = '';
  try {
    if (P) {
      const av = await P.available();
      if (!(av && (av.available || av.speechRecognition))) {
        dialog({ title: 'голос', text: 'Не вышло включить распознавание речи.' });
        return;
      }
      const perm = await P.requestPermissions();
      if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') {
        dialog({ title: 'голос', text: 'Нужно разрешение на микрофон.' });
        return;
      }
      g.pron.rec = true;
      paint(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let res: any;
      try {
        res = await P.start({ language: 'en-US', maxResults: 5, partialResults: false, popup: false });
      } catch {
        res = await P.start({ language: 'en-US', maxResults: 5, partialResults: false, popup: false });
      }
      g.pron.rec = false;
      const alts: string[] = (res && res.matches) || [];
      let best = { pct: -1, words: [] as unknown[] };
      let heard = '';
      alts.forEach((a) => {
        const s = echoScore(a, g.pron.cur.en);
        if (s.pct > best.pct) {
          best = s;
          heard = a;
        }
      });
      g.pron.heard = heard;
      g.pron.last = best;
      g.pron.acc.push(best.pct);
      if (g.pron.acc.length > 50) g.pron.acc = g.pron.acc.slice(-50);
      if (best.pct >= 85) {
        g.pron.done++;
        haptic('win');
      } else haptic(best.pct >= 60 ? 'ok' : 'no');
      save();
      paint(true);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.maxAlternatives = 5;
    rec.interimResults = false;
    g.pron.rec = true;
    paint(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      const alts: string[] = [];
      for (let i = 0; i < ev.results[0].length; i++) alts.push(ev.results[0][i].transcript);
      let best = { pct: -1, words: [] as unknown[] };
      let heard = '';
      alts.forEach((a) => {
        const s = echoScore(a, g.pron.cur.en);
        if (s.pct > best.pct) {
          best = s;
          heard = a;
        }
      });
      g.pron.rec = false;
      g.pron.heard = heard;
      g.pron.last = best;
      g.pron.acc.push(best.pct);
      if (best.pct >= 85) g.pron.done++;
      save();
      paint(true);
    };
    rec.onerror = () => {
      g.pron.rec = false;
      g.pron.err = 'не расслышал';
      paint(true);
    };
    rec.onend = () => {
      if (g.pron.rec) {
        g.pron.rec = false;
        paint(true);
      }
    };
    rec.start();
  } catch (e) {
    g.pron.rec = false;
    g.pron.err = (e as Error)?.message || 'ошибка';
    paint(true);
  }
}
