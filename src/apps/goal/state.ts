import { S } from '../../core/persist';

export interface GoalScene {
  id: string;
  ru: string;
  en: string;
  role: string;
  task: string;
  filled?: boolean;
}

export interface GoalItem {
  id: string;
  scene: string;
  kind: 'word' | 'phrase';
  en: string;
  gap: string;
  sentence: string;
  ru: string;
  word_ru: string;
  ipa?: string;
  tip?: string;
}

export interface GoalCard {
  b: number;
  due: string;
  reps: number;
  lapses: number;
  first: string;
  skip?: 1;
}

export interface Goal {
  title: string;
  desc: string;
  until: string;
  created: string;
  scenes: GoalScene[];
  items: Record<string, GoalItem>;
  srs: Record<string, GoalCard>;
  log: Record<string, { n: number; r: number; ok: number }>;
  talks: Record<string, number>;
}

export interface GoalTalkTurn {
  who: 'them' | 'me';
  en: string;
  ru?: string;
  fix?: string;
}

export interface GoalChat {
  scene: string;
  turns: GoalTalkTurn[];
  done?: boolean;
  summary?: string;
  fixes?: { wrong: string; right: string; why: string }[];
  phrases?: { en: string; ru: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function goalState(): any {
  if (!S.goal || typeof S.goal !== 'object') S.goal = {};
  const g = S.goal;
  if (!g.tab) g.tab = 'plan';
  if (g.cur === undefined) g.cur = null;
  if (!Array.isArray(g.queue)) g.queue = [];
  if (typeof g.i !== 'number') g.i = 0;
  if (g.chat === undefined) g.chat = null;
  if (!Array.isArray(g.archive)) g.archive = [];
  return g;
}
