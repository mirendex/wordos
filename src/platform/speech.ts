import { checkAnswer } from '../lib/text';
import { S } from '../core/persist';
import { paint } from '../core/paint';
import { dialog } from '../ui/modal';
import { vocabState } from '../domain/vocab';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CAPSR = (): any => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
  return P && P.SpeechRecognition;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
export const canVoice = (): boolean => !!(CAPSR() || SR);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recog: any = null;

export async function listen(): Promise<void> {
  const v = vocabState();
  const P = CAPSR();
  if (P) {
    try {
      const av = await P.available();
      if (!(av && (av.available || av.speechRecognition))) {
        dialog({ title: 'голос', text: 'На этом телефоне распознавание речи не работает.' });
        return;
      }
      const perm = await P.requestPermissions();
      if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') {
        dialog({ title: 'голос', text: 'Нужно разрешение на микрофон.' });
        return;
      }
      v.rec = true;
      paint(true);
      const res = await P.start({ language: 'en-US', maxResults: 3, partialResults: false, popup: false });
      v.rec = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alts: any[] = (res && res.matches) || [];
      const c = v.queue[v.i];
      const hit =
        alts.find((a) => checkAnswer(String(a).split(/\s+/).pop() as string, c.w) !== 'no') || alts[0] || '';
      const word = String(hit).trim().split(/\s+/).pop();
      const inp = document.getElementById('vans') as HTMLInputElement | null;
      if (inp && word) {
        inp.value = word;
        const b = document.querySelector('[data-vcheck]') as HTMLElement | null;
        if (b) b.click();
      } else paint(true);
    } catch (e) {
      v.rec = false;
      dialog({
        title: 'голос',
        text: 'Не расслышал: ' + (((e as Error) && (e as Error).message) || 'ошибка'),
      });
    }
    return;
  }
  if (!SR) {
    dialog({ title: 'голос', text: 'Этот браузер не умеет распознавать речь.' });
    return;
  }
  try {
    if (recog) {
      recog.abort();
      recog = null;
    }
    recog = new SR();
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.maxAlternatives = 3;
    v.rec = true;
    paint();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      const alts: string[] = [];
      for (let i = 0; i < e.results[0].length; i++) alts.push(e.results[0][i].transcript);
      const c = v.queue[v.i];
      const hit =
        alts.find((a) => checkAnswer(String(a).split(/\s+/).pop() as string, c.w) !== 'no') || alts[0];
      const word = String(hit || '')
        .trim()
        .split(/\s+/)
        .pop();
      v.rec = false;
      const inp = document.getElementById('vans') as HTMLInputElement | null;
      if (inp) {
        inp.value = word as string;
        const b = document.querySelector('[data-vcheck]') as HTMLElement | null;
        if (b) b.click();
      } else paint();
    };
    recog.onerror = () => {
      v.rec = false;
      paint();
    };
    recog.onend = () => {
      if (v.rec) {
        v.rec = false;
        paint();
      }
    };
    recog.start();
  } catch {
    v.rec = false;
    paint();
  }
}

export async function listenFree(inputId: string, submitSelector: string): Promise<void> {
  const P = CAPSR();
  const fill = (text: string) => {
    const inp = document.getElementById(inputId) as HTMLInputElement | null;
    if (inp && text) {
      inp.value = text;
      const b = document.querySelector(submitSelector) as HTMLElement | null;
      if (b) b.click();
    }
  };
  if (P) {
    try {
      const av = await P.available();
      if (!(av && (av.available || av.speechRecognition))) {
        dialog({ title: 'голос', text: 'На этом телефоне распознавание речи не работает.' });
        return;
      }
      const perm = await P.requestPermissions();
      if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') {
        dialog({ title: 'голос', text: 'Нужно разрешение на микрофон.' });
        return;
      }
      const res = await P.start({ language: 'en-US', maxResults: 1, partialResults: false, popup: false });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alts: any[] = (res && res.matches) || [];
      fill(String(alts[0] || '').trim());
    } catch (e) {
      dialog({
        title: 'голос',
        text: 'Не расслышал: ' + (((e as Error) && (e as Error).message) || 'ошибка'),
      });
    }
    return;
  }
  if (!SR) {
    dialog({ title: 'голос', text: 'Этот браузер не умеет распознавать речь.' });
    return;
  }
  try {
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => fill(String(e.results[0][0].transcript || '').trim());
    rec.start();
  } catch {
    /* ignore */
  }
}

interface Voice {
  name?: string;
  voiceURI?: string;
  lang?: string;
  voiceIndex?: number;
  index?: number;
}

let ttsWarned = false;
let VOICES: Voice[] | null = null;

export async function ttsVoices(): Promise<Voice[]> {
  if (VOICES) return VOICES;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
  try {
    if (P && P.TextToSpeech && P.TextToSpeech.getSupportedVoices) {
      const r = await P.TextToSpeech.getSupportedVoices();
      VOICES = (r.voices || []).filter((v: Voice) => /^en/i.test(v.lang || ''));
      return VOICES!;
    }
  } catch {
    /* ignore */
  }
  try {
    VOICES = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter((v) =>
      /^en/i.test(v.lang || ''),
    );
  } catch {
    VOICES = [];
  }
  return VOICES!;
}

export function pickVoice(list: Voice[]): Voice | null {
  if (S.cfg && S.cfg.voice != null) {
    const byName = list.find((v) => (v.name || v.voiceURI) === S.cfg.voice);
    if (byName) return byName;
  }
  const score = (v: Voice) => {
    const n = ((v.name || '') + ' ' + (v.voiceURI || '')).toLowerCase();
    let s = 0;
    if (/en[-_]us/i.test(v.lang || '')) s += 6;
    else if (/en[-_]gb/i.test(v.lang || '')) s += 4;
    if (/neural|natural|enhanced|premium|wavenet/.test(n)) s += 8;
    if (/google/.test(n)) s += 5;
    if (/network/.test(n)) s += 3;
    if (/compact|espeak|pico/.test(n)) s -= 6;
    return s;
  };
  return list.slice().sort((a, b) => score(b) - score(a))[0] || null;
}

export function speak(x: string): void {
  const text = String(x || '').trim();
  if (!text) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
  const rate = (S.cfg && S.cfg.rate) || (S.level < 42 ? 0.85 : S.level < 60 ? 0.95 : 1.0);
  if (P && P.TextToSpeech) {
    P.TextToSpeech.stop().catch(() => {});
    ttsVoices().then((list) => {
      const v = pickVoice(list || []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts: any = {
        text,
        lang: (v && v.lang) || 'en-US',
        rate,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      };
      if (v && typeof v.voiceIndex === 'number') opts.voice = v.voiceIndex;
      else if (v && typeof v.index === 'number') opts.voice = v.index;
      P.TextToSpeech.speak(opts).catch((e: Error) => {
        if (!ttsWarned) {
          ttsWarned = true;
          dialog({
            title: 'звук',
            text:
              'Не получилось озвучить: ' +
              ((e && e.message) || 'нет английского голоса') +
              '. Зайди в настройки Android → Язык и ввод → Синтез речи и скачай English (US).',
          });
        }
      });
    });
    return;
  }
  try {
    if (!window.speechSynthesis) throw new Error('нет синтеза речи');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = 1;
    const list = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang || ''));
    const v = pickVoice(list);
    if (v) {
      u.voice = v as SpeechSynthesisVoice;
      u.lang = v.lang!;
    } else u.lang = 'en-US';
    speechSynthesis.speak(u);
  } catch {
    if (!ttsWarned) {
      ttsWarned = true;
      dialog({ title: 'звук', text: 'На этом телефоне озвучка не работает.' });
    }
  }
}
