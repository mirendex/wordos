import FREQRAW from '../data/freq.txt?raw';

export interface FreqEntry {
  w: string;
  f: number;
}

export let FREQ: FreqEntry[] | null = null;
export let CUM: number[] | null = null;
export let RANK: Record<string, number> | null = null;

export function freqInit(): void {
  if (FREQ) return;
  FREQ = FREQRAW.split('|').map((s) => {
    const i = s.lastIndexOf(' ');
    return { w: s.slice(0, i), f: +s.slice(i + 1) / 100 };
  });
  CUM = [];
  RANK = {};
  let c = 0;
  FREQ.forEach((x, i) => {
    c += x.f;
    CUM!.push(c);
    RANK![x.w] = i + 1;
  });
}

export function freqReady(): boolean {
  return !!FREQ;
}

export function cover(n: number): number {
  freqInit();
  return n <= 0 ? 0 : (CUM![Math.min(n, CUM!.length) - 1] / 1e6) * 100;
}

export const DEMO =
  "Last summer we got lost on a hiking trail that the map insisted was easy. The sun was setting, our water bottles were almost empty, and my brother kept joking that we'd end up sleeping under a tree. Just when I started to worry, we heard music coming from somewhere behind the hill. It turned out to be a small farm where an old couple was celebrating their anniversary with the whole village. They invited us to sit down, fed us more food than we could finish, and gave us directions back to the car. We still laugh about it every time someone suggests a shortcut. Sometimes the wrong turn teaches you more than the plan ever could, and strangers become the best part of the story.";
