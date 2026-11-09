import { ask, askStream, Prompt } from '../services/llm';
import { partialField } from '../lib/json';

// A role-play with the model, shared by GOAL's scenarios and TALK's scene of the day: the
// character's next line, and the review once the scene is over.

export interface ChatTurn {
  who: 'them' | 'me';
  en: string;
  ru?: string;
  fix?: string;
}

export interface ChatFix {
  wrong: string;
  right: string;
  why: string;
  ru?: string;
}

export interface ChatReview {
  summary: string;
  fixes: ChatFix[];
  phrases: { en: string; ru: string }[];
}

export function history(turns: ChatTurn[]): string {
  return turns.map((t) => (t.who === 'me' ? 'Ученик: ' : 'Собеседник: ') + t.en).join('\n');
}

// The character's next line. The model gets the scene as its instructions and the talk as real
// turns of a chat (the learner's lines as the user's, the character's as its own), and some room
// to word things freely. `finish` asks it to close the scene with this line.
export async function chatReply(
  context: string,
  turns: ChatTurn[],
  finish = false,
  onText?: (reply: string) => void,
): Promise<{ reply: string; ru: string; fix: string; done: boolean }> {
  const prompt: Prompt = {
    system: `${context}
Отвечай одной короткой репликой на английском, живой разговорной речью. Если задача ученика уже выполнена, закончи сцену своей репликой.${
      finish ? '\nСцена подходит к концу: закончи её этой репликой, done: true.' : ''
    }
Формат ответа:
{"reply":"твоя реплика на английском","ru":"перевод реплики","fix":"если в последней реплике ученика была ошибка - как правильно, до 10 слов, например: Where did you see it?; иначе пустая строка","done":true или false}`,
    messages: turns.map((t) => ({
      role: t.who === 'me' ? ('user' as const) : ('assistant' as const),
      content: t.who === 'me' ? t.en : JSON.stringify({ reply: t.en }),
    })),
    temperature: 0.9,
  };
  // the reply comes first in the answer, so it can be shown as it is written
  const r = onText
    ? await askStream(prompt, (raw) => onText(partialField(raw, 'reply') || ''))
    : await ask(prompt);
  return { reply: r.reply || '', ru: r.ru || '', fix: r.fix || '', done: !!r.done || finish };
}

// the learner's last line gets the fix of it, under its own bubble
export function attachFix(turns: ChatTurn[], fix: string): void {
  if (!fix) return;
  for (let i = turns.length - 1; i >= 0; i--)
    if (turns[i].who === 'me') {
      turns[i].fix = fix;
      return;
    }
}

export async function chatReview(context: string, turns: ChatTurn[]): Promise<ChatReview> {
  const r = await ask(`Ролевой диалог закончен. ${context}
Полная история:
${history(turns)}
Дай короткий разбор для ученика.
Формат ответа:
{"summary":"как прошло, по-русски, 1-2 предложения","fixes":[{"wrong":"цитата ученика","right":"исправление","why":"по-русски, до 8 слов","ru":"перевод исправленной фразы"}],"phrases":[{"en":"удачная фраза из диалога","ru":"перевод"}]}`);
  return {
    summary: r.summary || '',
    fixes: (Array.isArray(r.fixes) ? r.fixes : []).filter((f: ChatFix) => f && f.wrong && f.right),
    phrases: (Array.isArray(r.phrases) ? r.phrases : []).filter((p: { en?: string }) => p && p.en),
  };
}
