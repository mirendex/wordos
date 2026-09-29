import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLUS } from '../core/util';
import type { GoalItem, GoalScene } from '../apps/goal/state';
import { fillScene, loadGoalCards } from './goal';

// the model, the store and the screen are stand-ins: what's under test is what the goal does
// with a reply, not the network or the DOM
const mocks = vi.hoisted(() => ({
  S: {} as Record<string, unknown>,
  ask: vi.fn(),
  paint: vi.fn(),
  save: vi.fn(),
}));
vi.mock('../core/persist', () => ({ S: mocks.S, save: mocks.save }));
vi.mock('../core/paint', () => ({ paint: mocks.paint }));
vi.mock('../services/llm', () => ({ ask: mocks.ask }));
vi.mock('../platform/speech', () => ({ CAPSR: () => null, SR: null }));
vi.mock('../platform/haptics', () => ({ haptic: () => undefined }));
vi.mock('../ui/modal', () => ({ dialog: () => undefined }));

interface TestGoal {
  cur: {
    scenes: GoalScene[];
    items: Record<string, GoalItem>;
  };
  queue: { id: string }[];
  tab?: string;
  err?: string;
  busy?: boolean;
}

const scene = (id: string, filled = false): GoalScene => ({
  id,
  ru: 'Регистрация на рейс',
  en: 'Check-in',
  role: 'сотрудник стойки',
  task: 'зарегистрироваться',
  filled,
});

const card = (id: string, sceneId: string, en = 'window seat'): GoalItem => ({
  id,
  scene: sceneId,
  kind: 'phrase',
  en,
  gap: en,
  sentence: 'Could I have a ___, please?',
  ru: 'Можно, пожалуйста?',
  word_ru: 'перевод',
});

const reply = (en: string, sentence: string, kind = 'phrase') => ({
  kind,
  en,
  sentence,
  ru: 'перевод предложения',
  word_ru: 'перевод',
});

function goal(scenes: GoalScene[], items: GoalItem[] = [], srs: Record<string, unknown> = {}): TestGoal {
  mocks.S.goal = {
    cur: {
      title: 'Поездка',
      desc: 'отпуск',
      until: PLUS(10),
      created: '',
      scenes,
      items: Object.fromEntries(items.map((i) => [i.id, i])),
      srs,
      log: {},
      talks: {},
    },
  };
  return mocks.S.goal as TestGoal;
}

beforeEach(() => {
  mocks.ask.mockReset();
  mocks.paint.mockReset();
  mocks.save.mockReset();
  mocks.S.goal = undefined;
});

describe('fillScene', () => {
  it('stores the cards and marks the scenario filled', async () => {
    const g = goal([scene('s1')]);
    mocks.ask.mockResolvedValueOnce({ items: [reply('window seat', 'Could I have a ___, please?')] });
    await fillScene(g.cur.scenes[0]);
    expect(Object.values(g.cur.items)).toHaveLength(1);
    expect(g.cur.scenes[0].filled).toBe(true);
  });

  it('reads cards a model splits into words and phrases', async () => {
    const g = goal([scene('s1')]);
    mocks.ask.mockResolvedValueOnce({
      words: [{ en: 'passport', sentence: 'Here is my ___ and ticket.' }],
      phrases: [{ en: 'window seat', sentence: 'Could I have a ___, please?' }],
    });
    await fillScene(g.cur.scenes[0]);
    expect(Object.values(g.cur.items).map((i) => [i.en, i.kind])).toEqual([
      ['passport', 'word'],
      ['window seat', 'phrase'],
    ]);
  });

  it('brings an odd gap spelling to ___ and cuts the answer out of a sentence with no gap', async () => {
    const g = goal([scene('s1')]);
    mocks.ask.mockResolvedValueOnce({
      items: [
        reply('window seat', 'Could I have a _____, please?'),
        reply('boarding pass', 'Here is my boarding pass, thanks.'),
      ],
    });
    await fillScene(g.cur.scenes[0]);
    expect(Object.values(g.cur.items).map((i) => i.sentence)).toEqual([
      'Could I have a ___, please?',
      'Here is my ___, thanks.',
    ]);
  });

  it('drops a card whose gap leaves no real sentence around it', async () => {
    const g = goal([scene('s1')]);
    mocks.ask.mockResolvedValueOnce({
      items: [reply('the bill', '___.'), reply('window seat', 'Could I have a ___, please?')],
    });
    await fillScene(g.cur.scenes[0]);
    expect(Object.values(g.cur.items).map((i) => i.en)).toEqual(['window seat']);
  });

  it('leaves the scenario unfilled and says what came back when nothing is usable', async () => {
    const g = goal([scene('s1')]);
    mocks.ask.mockResolvedValueOnce({ items: [reply('window seat', 'Something else entirely.')] });
    await expect(fillScene(g.cur.scenes[0])).rejects.toThrow(/Регистрация на рейс.*получено 1/);
    expect(g.cur.scenes[0].filled).toBe(false);
    expect(Object.keys(g.cur.items)).toHaveLength(0);
  });

  it('reports a reply that has no list of cards at all', async () => {
    const g = goal([scene('s1')]);
    mocks.ask.mockResolvedValueOnce({ ru: 'привет' });
    await expect(fillScene(g.cur.scenes[0])).rejects.toThrow(/нет списка карточек/);
    expect(g.cur.scenes[0].filled).toBe(false);
  });
});

describe('loadGoalCards', () => {
  it('builds the queue from cards that are waiting, without asking the model', async () => {
    const g = goal([scene('s1', true)], [card('a', 's1'), card('b', 's1', 'boarding pass')]);
    await loadGoalCards();
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(g.tab).toBe('cards');
    expect(g.queue.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('keeps an item that is only a gap out of the cards', async () => {
    const g = goal(
      [scene('s1', true)],
      [{ ...card('a', 's1'), sentence: '___' }, card('b', 's1', 'boarding pass')],
    );
    await loadGoalCards();
    expect(g.queue.map((c) => c.id)).toEqual(['b']);
  });

  it('fills the first empty scenario when nothing is due, then shows its cards', async () => {
    const g = goal([scene('s1'), scene('s2')]);
    mocks.ask.mockResolvedValueOnce({ items: [reply('window seat', 'Could I have a ___, please?')] });
    await loadGoalCards();
    expect(mocks.ask).toHaveBeenCalledTimes(1);
    expect(g.cur.scenes.map((s) => s.filled)).toEqual([true, false]);
    expect(g.queue).toHaveLength(1);
  });

  it('fills a scenario again that an earlier run marked filled but left without cards', async () => {
    const g = goal([scene('s1', true)]);
    mocks.ask.mockResolvedValueOnce({ items: [reply('window seat', 'Could I have a ___, please?')] });
    await loadGoalCards();
    expect(mocks.ask).toHaveBeenCalledTimes(1);
    expect(g.queue).toHaveLength(1);
  });

  it('stops with the error instead of going through every scenario when the model gives nothing usable', async () => {
    const g = goal([scene('s1'), scene('s2')]);
    mocks.ask.mockResolvedValue({ items: [] });
    await loadGoalCards();
    expect(mocks.ask).toHaveBeenCalledTimes(1);
    expect(g.err).toMatch(/не вернула подходящих карточек/);
    expect(g.busy).toBe(false);
    expect(g.queue).toEqual([]);
    expect(g.cur.scenes.some((s) => s.filled)).toBe(false);
  });

  it('stops with the error when the request itself fails', async () => {
    const g = goal([scene('s1')]);
    mocks.ask.mockRejectedValueOnce(new Error('слишком часто, подожди минуту'));
    await loadGoalCards();
    expect(mocks.ask).toHaveBeenCalledTimes(1);
    expect(g.err).toBe('слишком часто, подожди минуту');
    expect(g.busy).toBe(false);
  });

  it('has nothing to show and asks nothing when every card is learned and none is due', async () => {
    const srs = { a: { b: 4, due: PLUS(5), reps: 2, lapses: 0, first: PLUS(-3) } };
    const g = goal([scene('s1', true)], [card('a', 's1')], srs);
    await loadGoalCards();
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(g.queue).toEqual([]);
    expect(g.err).toBe('');
  });
});
