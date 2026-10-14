import './storage';
import { BKEY, KEY, MKEY, WKEY } from './keys';
import { restoreModelsCache } from '../services/models';

export const FRESH = {
  v: 2,
  level: 40,
  words: [] as { en: string; ru: string }[],
  notes: [] as { wrong: string; right: string; why?: string }[],
  read: {} as Record<string, unknown>,
  mt: {} as Record<string, string>,
  cfg: { key: '', model: 'openai/gpt-4o-mini', haptic: true } as Record<string, unknown>,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let S: any = JSON.parse(JSON.stringify(FRESH));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let BANK: any = {};
// the windows as they were left, for the desk to put back (see restoreWins)
export let WINS: string | null = null;

let bt: ReturnType<typeof setTimeout> | null = null;
let bankOk = true;
let bankFails = 0;

export function scheduleBankSave(): void {
  if (!bankOk) return;
  if (bt) clearTimeout(bt);
  bt = setTimeout(async () => {
    try {
      await window.storage!.set(BKEY, JSON.stringify(BANK));
      bankFails = 0;
    } catch {
      bankFails++;
      if (bankFails < 3) {
        setTimeout(scheduleBankSave, 2000);
        return;
      }
      bankOk = false; // from now on keep the bank in memory only, without spamming the console
    }
  }, 1200);
}

export function isBankPersisted(): boolean {
  return bankOk;
}

export function bankBytes(): number {
  try {
    return JSON.stringify(BANK).length;
  } catch {
    return 0;
  }
}

let tm: ReturnType<typeof setTimeout> | null = null;
export function save(): void {
  if (tm) clearTimeout(tm);
  tm = setTimeout(async () => {
    try {
      await window.storage!.set(KEY, JSON.stringify(S));
    } catch {
      /* ignore */
    }
  }, 300);
}

export async function load(): Promise<void> {
  const [r, b, m, w] = await Promise.all(
    [KEY, BKEY, MKEY, WKEY].map((k) => window.storage!.get(k).catch(() => null)),
  );
  WINS = (w && w.value) || null;
  try {
    if (r && r.value) S = Object.assign(JSON.parse(JSON.stringify(FRESH)), JSON.parse(r.value));
  } catch {
    /* ignore */
  }
  try {
    if (b && b.value) BANK = JSON.parse(b.value);
  } catch {
    /* ignore */
  }
  if (!S.cfg || typeof S.cfg !== 'object') S.cfg = { key: '', model: 'openai/gpt-4o-mini' };
  if (!Array.isArray(S.words)) S.words = [];
  if (!Array.isArray(S.notes)) S.notes = [];
  if (!S.read || typeof S.read !== 'object') S.read = {};
  delete S.read.spare; // left by a version that wrote the next text ahead
  if (!S.icons || typeof S.icons !== 'object') S.icons = {};
  if (!S.mt || typeof S.mt !== 'object') S.mt = {};
  if (typeof S.level !== 'number') S.level = 40;
  if (!BANK || typeof BANK !== 'object') BANK = {};
  try {
    if (m && m.value) {
      const j = JSON.parse(m.value);
      if (j.at && Date.now() - j.at < 86400000 && j.list && j.list.length) restoreModelsCache(j.list);
    }
  } catch {
    /* ignore */
  }
  // in-flight flags never mean anything after a reload — the request that set them died
  // with the old page, so a leftover `true` here would just wedge the UI in a loading state
  // forever with nothing left running to ever clear it
  if (S.vocab && typeof S.vocab === 'object') S.vocab.loading = false;
  if (S.goal && typeof S.goal === 'object') {
    S.goal.busy = false;
    if (S.goal.pron && typeof S.goal.pron === 'object') S.goal.pron.rec = false;
  }
  if (S.vocab && S.vocab.bank) {
    Object.keys(S.vocab.bank).forEach((k) => {
      if (!BANK[k]) BANK[k] = S.vocab.bank[k];
    });
    delete S.vocab.bank;
    scheduleBankSave();
    save();
  }
}
