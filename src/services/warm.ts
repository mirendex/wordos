import { S } from '../core/persist';
import { prefetchAhead } from '../domain/cards';
import { fillGoalAhead } from '../domain/goal';
import { listenTopUp } from '../apps/listen/listen';
import { listenState } from '../apps/listen/state';
import { spareQuest } from '../apps/terminal/terminal';
import { QUESTS } from '../apps/terminal/state';

// While the app is open and online, what the model will be asked for next is asked for ahead, one
// request at a time: cards for the next batches, the goal's scenes, the next dictation phrases
// for those who take dictations, the next machine for those who have solved the last one
let running = false;
let last = 0;

export async function warm(force?: boolean): Promise<void> {
  if (running || !navigator.onLine || !(S.cfg && S.cfg.key) || document.hidden) return;
  if (!force && Date.now() - last < 60000) return;
  running = true;
  last = Date.now();
  try {
    await prefetchAhead(15);
    await fillGoalAhead();
    if (listenState().done > 0) await listenTopUp();
    const t = S.term;
    if (t && Array.isArray(t.solved) && t.qi >= QUESTS.length - 1 && t.solved.indexOf(QUESTS[t.qi]?.id) >= 0)
      await spareQuest();
  } catch {
    /* each of these says its own errors where it is used */
  }
  running = false;
}

export function installWarm(): void {
  setTimeout(warm, 2500);
  addEventListener('online', () => warm(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) warm();
  });
}
