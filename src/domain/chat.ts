import { ask } from '../services/llm';

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

// `context` says who the model plays and what the learner is after; `finish` asks it to close the
// scene with this line
export async function chatReply(
  context: string,
  turns: ChatTurn[],
  finish = false,
): Promise<{ reply: string; ru: string; fix: string; done: boolean }> {
  const r = await ask(`${context}
История диалога:
${history(turns)}
Отвечай короткой репликой в роли собеседника на английском, живой разговорной речью. Если задача уже выполнена, закончи сцену.${
    finish ? '\nСцена подходит к концу: закончи её этой репликой, done: true.' : ''
  }
Формат ответа:
{"reply":"реплика собеседника на английском","ru":"перевод реплики","fix":"если в реплике ученика была ошибка - короткая поправка по-русски, иначе пустая строка","done":true или false}`);
  return { reply: r.reply || '', ru: r.ru || '', fix: r.fix || '', done: !!r.done || finish };
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
