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

export const STOP = new Set(
  "a an the i you he she it we they me him her us them my your his its our their this that these those and or but so if because as of in on at to for with from by about into over after before under again then than there here when where why how all any both each few more most other some such no nor not only own same too very can will just don don't should now is am are was were be been being have has had having do does did doing would could shall may might must ve ll re s t d m o y ain aren couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn i'm it's that's what who whom which what's yes yeah ok okay oh hi hey please thanks thank".split(
    ' ',
  ),
);
