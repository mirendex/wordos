import { cefr } from '../lib/scale';
import { checkAnswer } from '../lib/text';
import { DAY } from '../core/util';
import { paint } from '../core/paint';
import { S, save } from '../core/persist';
import { HAP_DEFAULT_STEP, haptic, hapticTest } from '../platform/haptics';
import { listen, listenFree, speak, ttsVoices } from '../platform/speech';
import { notifyPlan } from '../platform/notify';
import { APPVER } from '../platform/appinfo';
import { fetchFreeTranslation } from '../services/translate';
import { loadModels, MFREE, setModelFreeOnly } from '../services/models';
import { cover, FREQ, RANK } from '../domain/frequency';
import { inProgress, learnedWords, myWords, srsGrade, vocabState } from '../domain/vocab';
import { recalcLevel } from '../domain/progress';
import { loadCards, markKnown, prefetch } from '../domain/cards';
import { warm } from '../services/warm';
import {
  bringToFront,
  close,
  findWin,
  open,
  syncBackGate,
  toggleMaximize,
  toggleMinimize,
  winByApp,
} from './windows';
import { closeModal, dialog, takeModalOk } from './modal';
import { requestAutoFocus } from './render';
import { isIconDragging } from './icons';

import { hangGuess, hangNew, hangRu } from '../apps/games/hangman';
import { pairsNew, pairsTap } from '../apps/games/pairs';
import { orderGen, orderNew, orderState, orderTap } from '../apps/games/order';
import { fwHint, fwNew, fwState, fwTap } from '../apps/games/letters';
import { fiveGiveUp, fiveKey, fiveNew, fiveReveal, fiveState } from '../apps/games/five';

import { diaryCheck } from '../apps/diary/diary';

import { echoGen, echoPick, echoSay } from '../apps/echo/echo';
import { echoState } from '../apps/echo/state';

import { listenCheck, listenNext } from '../apps/listen/listen';
import { listenState } from '../apps/listen/state';

import { termRun, termTranslate } from '../apps/terminal/terminal';

import { getText, lookup, textWords } from '../apps/reader';

import {
  addGoalPhrase,
  archiveGoal,
  dictCheck,
  dictPick,
  dropScene,
  gradeGoal,
  loadGoalCards,
  makeGoal,
  pronPick,
  pronSay,
  startTalk,
  talkTurn,
} from '../domain/goal';
import { goalState } from '../apps/goal/state';

const SELECTOR =
  '[data-app],[data-close],[data-winmin],[data-winmax],[data-mclose],[data-mok],[data-shade],[data-focus],[data-topic],[data-newtext],[data-harvest],[data-hpick],[data-hall],[data-hclose],[data-hadd],[data-again],[data-w],[data-saveword],[data-tab],[data-del],[data-speak],[data-gtab],[data-fwnew],[data-fwhint],[data-fwtap],[data-fwclear],[data-otap],[data-oback],[data-onew],[data-ogen],[data-oclear],[data-hkey],[data-hnew],[data-hru],[data-ptap],[data-pnew],[data-fkey],[data-fnew],[data-fru],[data-fsave],[data-tcmd],[data-tr],[data-reset],[data-echogen],[data-echosay],[data-echonext],[data-echoslow],[data-lnext],[data-lsay],[data-lslow],[data-lcheck],[data-lskip],[data-lsave],[data-sys],[data-dcheck],[data-dnew],[data-dsave],[data-intro],[data-notify],[data-nhour],[data-haptic],[data-haptest],[data-hapdef],[data-rate],[data-voices],[data-pickvoice],[data-savekey],[data-clearkey],[data-pickmodel],[data-mfree],[data-mreload],[data-setbase],[data-tome],[data-fixpos],[data-learn],[data-more],[data-back],[data-vcheck],[data-vskip],[data-vnext],[data-vpeek],[data-vnotknow],[data-vtab],[data-vhint],[data-know],[data-vknow],[data-prefetch],[data-vpick],[data-vmode],[data-say],[data-voice],[data-jump],[data-vsearch],[data-go],[data-vtranslate],[data-fgiveup],[data-owntopic],[data-onboardlevel],[data-gtab2],[data-gmake],[data-gscenedel],[data-garchive],[data-glearn],[data-ghint],[data-gcheck],[data-gskip],[data-gnext],[data-gtalk],[data-gtalkclose],[data-gsend],[data-gvoice],[data-gaddphrase],[data-gdictnext],[data-gdictslow],[data-gdictcheck],[data-gdictskip],[data-gpronnext],[data-gpronsay],[data-gpronslow]';

export function installActions(): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(SELECTOR);
    if (!el) return;
    const d = el.dataset;
    haptic(
      el.classList.contains('key') || el.classList.contains('chip')
        ? 'soft'
        : d.vtab || d.gtab || d.gtab2 || d.tab || d.vmode || d.haptic || d.notify
          ? 'toggle'
          : 'tap',
    );
    if (d.mclose || d.shade !== undefined) {
      closeModal();
      return;
    }
    if (d.go) {
      open(d.go);
      return;
    }
    if (d.vtranslate) {
      fetchFreeTranslation(d.vtranslate).then(() => paint());
      return;
    }
    if (d.mok) {
      const i = document.getElementById('mdin') as HTMLInputElement | null;
      const cb = takeModalOk();
      const val = i ? i.value : '';
      closeModal();
      if (cb) cb(val);
      return;
    }
    if (d.speak !== undefined) {
      speak(d.speak);
      return;
    }
    if (d.gtab) {
      const w = winByApp('games')!;
      w.data.tab = d.gtab;
      paint();
      return;
    }
    if (d.otap !== undefined) {
      orderTap(+d.otap);
      return;
    }
    if (d.oback !== undefined) {
      const g = orderState();
      if (!g.msg) {
        g.picked.splice(+d.oback, 1);
        haptic('soft');
        save();
        paint();
      }
      return;
    }
    if (d.fwnew) {
      fwNew();
      paint();
      return;
    }
    if (d.fwtap !== undefined) {
      fwTap(+d.fwtap);
      return;
    }
    if (d.fwclear) {
      const g = fwState();
      g.picked = [];
      save();
      paint();
      return;
    }
    if (d.fwhint) {
      fwHint();
      return;
    }
    if (d.onew) {
      if (!orderNew()) orderGen();
      else paint();
      return;
    }
    if (d.ogen) {
      orderGen();
      return;
    }
    if (d.oclear) {
      const g = orderState();
      g.picked = [];
      g.msg = '';
      paint();
      return;
    }
    if (d.hkey) {
      hangGuess(d.hkey);
      return;
    }
    if (d.hnew) {
      hangNew();
      paint();
      return;
    }
    if (d.hru) {
      hangRu();
      return;
    }
    if (d.ptap !== undefined) {
      pairsTap(+d.ptap);
      return;
    }
    if (d.pnew) {
      pairsNew();
      paint();
      return;
    }
    if (d.fkey) {
      fiveKey(d.fkey);
      return;
    }
    if (d.fgiveup) {
      fiveGiveUp();
      return;
    }
    if (d.fnew) {
      fiveNew();
      paint();
      return;
    }
    if (d.fru) {
      fiveReveal();
      return;
    }
    if (d.fsave) {
      const g = fiveState();
      if (!S.words.find((x: { en: string }) => x.en === g.word))
        S.words.push({ en: g.word, ru: (g.ru || '').split(' · ')[0] || '' });
      save();
      g.msg = 'сохранено в NOTES';
      paint();
      return;
    }
    if (d.vtab) {
      const v = vocabState();
      v.tab = d.vtab;
      save();
      paint();
      return;
    }
    if (d.setbase) {
      const v = vocabState();
      v.base = v.n;
      v.touched = 1;
      save();
      paint();
      return;
    }
    if (d.fixpos) {
      const v = vocabState();
      v.base = Math.max(0, myWords() - 20);
      save();
      paint();
      return;
    }
    if (d.tome) {
      const v = vocabState();
      v.n = Math.min(5000, Math.round(myWords() / 25) * 25);
      v.touched = 1;
      save();
      paint();
      return;
    }
    if (d.learn || d.more) {
      loadCards();
      return;
    }
    if (d.back) {
      const v = vocabState();
      v.tab = 'chart';
      save();
      paint();
      return;
    }
    if (d.know) {
      markKnown(d.know);
      paint();
      return;
    }
    if (d.prefetch) {
      prefetch(false);
      return;
    }
    if (d.vpeek) {
      const v = vocabState();
      v.peek = true;
      v.shown = true;
      v.res = 'peek';
      paint();
      return;
    }
    if (d.vknow) {
      const v = vocabState();
      const c = v.queue[v.i];
      markKnown(String(c.w).toLowerCase());
      v.i++;
      v.shown = false;
      v.hint = 0;
      v.res = null;
      v.peek = false;
      save();
      paint();
      return;
    }
    if (d.vnotknow) {
      const v = vocabState();
      const c = v.queue[v.i];
      v.peek = false;
      v.res = 'no';
      srsGrade(c.w, 'no');
      save();
      paint();
      return;
    }
    if (d.vmode) {
      const v = vocabState();
      v.mode = d.vmode;
      save();
      paint();
      if (d.vmode === 'audio') {
        const c = v.queue[v.i];
        if (c) speak(String(c.sentence || '').replace('___', c.w));
      }
      return;
    }
    if (d.say !== undefined) {
      speak(d.say);
      return;
    }
    if (d.voice) {
      listen();
      return;
    }
    if (d.vpick) {
      const v = vocabState();
      v.q = d.vpick;
      save();
      paint();
      return;
    }
    if (d.jump) {
      const v = vocabState();
      const w = d.jump;
      if (!v.srs[w]) v.srs[w] = { b: 0, due: DAY(), reps: 0, lapses: 0, first: DAY() };
      save();
      recalcLevel();
      paint();
      setTimeout(() => prefetch(true), 300);
      return;
    }
    if (d.vhint) {
      const v = vocabState();
      const c = v.queue[v.i];
      v.hint = Math.min(String(c.w).length - 1, (v.hint || 0) + 1);
      paint();
      const i = document.getElementById('vans');
      if (i) i.focus();
      return;
    }
    if (d.vcheck || d.vskip) {
      const v = vocabState();
      const c = v.queue[v.i];
      const inp = document.getElementById('vans') as HTMLInputElement | null;
      v.res = d.vskip ? 'no' : checkAnswer(inp ? inp.value : '', c.w);
      v.shown = true;
      if (inp) inp.blur();
      srsGrade(c.w, v.res);
      haptic(v.res === 'no' ? 'no' : 'ok');
      v.streak = v.res === 'no' ? 0 : (v.streak || 0) + 1;
      if (v.streak >= 10) S.egg = Object.assign({}, S.egg || {}, { streak10: 1 });
      if (v.res !== 'no') {
        v.known[c.w] = 1;
        if (!S.words.find((x: { en: string }) => x.en.toLowerCase() === String(c.w).toLowerCase()))
          S.words.push({ en: c.w, ru: c.word_ru || '' });
      }
      save();
      paint();
      return;
    }
    if (d.vnext) {
      const v = vocabState();
      v.i++;
      v.shown = false;
      v.hint = 0;
      v.res = null;
      requestAutoFocus();
      if (v.mode === 'audio' && v.queue[v.i])
        setTimeout(() => speak(String(v.queue[v.i].sentence || '').replace('___', v.queue[v.i].w)), 250);
      if (v.i >= v.queue.length) {
        const last = v.queue
          .filter((c: { rev?: boolean }) => !c.rev)
          .map((c: { w: string }) => RANK![c.w] || 0)
          .filter(Boolean);
        if (last.length) v.base = Math.min(FREQ!.length, Math.max(v.base || 0, Math.max.apply(null, last)));
      }
      save();
      paint();
      return;
    }
    if (d.gtab2) {
      const g = goalState();
      g.tab = d.gtab2;
      save();
      paint();
      return;
    }
    if (d.gmake) {
      const g = goalState();
      const ta = document.getElementById('gdesc') as HTMLTextAreaElement | null;
      const di = document.getElementById('guntil') as HTMLInputElement | null;
      const desc = (ta ? ta.value : '').trim();
      const until = di ? di.value : '';
      if (!desc) {
        g.err = 'Опиши, к чему готовишься.';
        paint();
        return;
      }
      if (!until) {
        g.err = 'Выбери дату.';
        paint();
        return;
      }
      makeGoal(desc, until);
      return;
    }
    if (d.gscenedel) {
      dropScene(d.gscenedel);
      return;
    }
    if (d.garchive) {
      archiveGoal();
      return;
    }
    if (d.glearn) {
      loadGoalCards();
      return;
    }
    if (d.ghint) {
      const g = goalState();
      const c = g.queue[g.i];
      g.hint = Math.min(String(c.gap).length - 1, (g.hint || 0) + 1);
      paint();
      const i = document.getElementById('gans');
      if (i) (i as HTMLInputElement).focus();
      return;
    }
    if (d.gcheck || d.gskip) {
      const g = goalState();
      const c = g.queue[g.i];
      const inp = document.getElementById('gans') as HTMLInputElement | null;
      g.res = d.gskip ? 'no' : checkAnswer(inp ? inp.value : '', c.gap);
      g.shown = true;
      if (inp) inp.blur();
      gradeGoal(c.id, g.res);
      haptic(g.res === 'no' ? 'no' : 'ok');
      save();
      paint();
      return;
    }
    if (d.gnext) {
      const g = goalState();
      g.i++;
      g.shown = false;
      g.hint = 0;
      g.res = null;
      requestAutoFocus();
      save();
      paint();
      return;
    }
    if (d.gtalk) {
      startTalk(d.gtalk);
      return;
    }
    if (d.gtalkclose) {
      const g = goalState();
      g.chat = null;
      save();
      paint();
      return;
    }
    if (d.gsend) {
      const i = document.getElementById('gtalkin') as HTMLInputElement | null;
      const text = (i ? i.value : '').trim();
      if (!text) return;
      if (i) i.value = '';
      talkTurn(text);
      return;
    }
    if (d.gvoice) {
      listenFree('gtalkin', '[data-gsend]');
      return;
    }
    if (d.gaddphrase) {
      const [scene, en, ru] = d.gaddphrase.split('|');
      const g = goalState();
      addGoalPhrase(scene, en, ru);
      if (g.chat) g.chat.added = Object.assign({}, g.chat.added, { [en]: true });
      haptic('ok');
      paint();
      return;
    }
    if (d.gdictnext) {
      const g = goalState();
      if (dictPick()) {
        paint();
        setTimeout(() => speak(g.dict.cur.en), 200);
      }
      return;
    }
    if (d.gdictslow) {
      const g = goalState();
      if (g.dict.cur) {
        const r = (S.cfg && S.cfg.rate) || 1;
        S.cfg.rate = 0.6;
        speak(g.dict.cur.en);
        S.cfg.rate = r;
      }
      return;
    }
    if (d.gdictcheck) {
      const ta = document.querySelector('textarea[data-gdict]') as HTMLTextAreaElement | null;
      if (ta) ta.blur();
      dictCheck(ta ? ta.value : '');
      return;
    }
    if (d.gdictskip) {
      const g = goalState();
      g.dict.text = '';
      g.dict.shown = true;
      g.dict.last = 0;
      paint();
      return;
    }
    if (d.gpronnext) {
      const g = goalState();
      if (pronPick()) {
        paint();
        setTimeout(() => speak(g.pron.cur.en), 250);
      }
      return;
    }
    if (d.gpronsay) {
      pronSay();
      return;
    }
    if (d.gpronslow) {
      const g = goalState();
      if (g.pron.cur) {
        const r = (S.cfg && S.cfg.rate) || 1;
        S.cfg.rate = 0.7;
        speak(g.pron.cur.en);
        S.cfg.rate = r;
      }
      return;
    }
    if (d.savekey) {
      const i = document.getElementById('orkey') as HTMLInputElement | null;
      S.cfg.key = (i ? i.value : '').trim();
      if (i) i.blur();
      save();
      if (S.cfg.key) setTimeout(() => warm(true), 500);
      dialog({ title: 'ключ', text: S.cfg.key ? 'Ключ сохранён у тебя на телефоне.' : 'Ключ убран.' });
      return;
    }
    if (d.clearkey) {
      S.cfg.key = '';
      save();
      paint();
      return;
    }
    if (d.pickmodel) {
      S.cfg.model = d.pickmodel;
      save();
      paint();
      return;
    }
    if (d.mfree) {
      setModelFreeOnly(!MFREE);
      paint();
      return;
    }
    if (d.mreload) {
      loadModels(true);
      return;
    }
    if (d.onboardlevel) {
      const v = vocabState();
      v.base = v.n || 0;
      v.touched = 1;
      S.onboardedLevel = 1;
      recalcLevel();
      save();
      paint();
      return;
    }
    if (d.intro) {
      S.seenIntro = 1;
      save();
      const a = winByApp('about');
      if (a) close(a.key);
      open('vocab');
      return;
    }
    if (d.notify) {
      S.cfg.notify = !S.cfg.notify;
      save();
      notifyPlan();
      paint();
      return;
    }
    if (d.hapdef) {
      S.cfg.hapStep = HAP_DEFAULT_STEP;
      save();
      haptic('ok');
      paint();
      return;
    }
    if (d.rate) {
      S.cfg.rate = +d.rate;
      save();
      speak('This is how the voice sounds.');
      paint();
      return;
    }
    if (d.voices) {
      ttsVoices().then((list) => {
        if (!list || !list.length) {
          dialog({
            title: 'голос',
            text: 'На телефоне нет ни одного английского голоса. Зайди в настройки Android → Язык и ввод → Синтез речи.',
          });
          return;
        }
        const w = winByApp('setup');
        if (w) {
          w.data.voices = list.slice(0, 12);
          paint();
        }
      });
      return;
    }
    if (d.pickvoice !== undefined) {
      const w = winByApp('setup')!;
      const v = (w.data.voices || [])[+d.pickvoice];
      if (v) {
        S.cfg.voice = v.name || v.voiceURI;
        save();
        speak('Voice selected. This is how it sounds.');
      }
      w.data.voices = null;
      paint();
      return;
    }
    if (d.haptest) {
      hapticTest();
      return;
    }

    if (d.nhour) {
      S.cfg.notifyHour = +d.nhour;
      S.cfg.notify = true;
      save();
      notifyPlan();
      paint();
      return;
    }
    if (d.echogen) {
      echoGen();
      return;
    }
    if (d.echosay) {
      echoSay();
      return;
    }
    if (d.echonext) {
      const e = echoState();
      echoPick();
      paint();
      setTimeout(() => speak(e.cur && e.cur.en), 250);
      return;
    }
    if (d.echoslow) {
      const e = echoState();
      if (e.cur) {
        const r = (S.cfg && S.cfg.rate) || 1;
        S.cfg.rate = 0.7;
        speak(e.cur.en);
        S.cfg.rate = r;
      }
      return;
    }
    if (d.lnext) {
      listenNext();
      return;
    }
    if (d.lsay) {
      const l = listenState();
      if (l.cur) speak(l.cur.sentence);
      return;
    }
    if (d.lslow) {
      const l = listenState();
      if (l.cur) {
        const r = (S.cfg && S.cfg.rate) || 1;
        S.cfg.rate = 0.6;
        speak(l.cur.sentence);
        S.cfg.rate = r;
      }
      return;
    }
    if (d.lcheck) {
      listenCheck();
      return;
    }
    if (d.lskip) {
      const l = listenState();
      l.text = '';
      l.shown = true;
      l.last = 0;
      paint();
      return;
    }
    if (d.lsave) {
      const l = listenState();
      if (l.cur && !S.words.find((x: { en: string }) => x.en === l.cur.sentence))
        S.words.push({ en: l.cur.sentence, ru: l.cur.ru || '' });
      save();
      paint();
      return;
    }
    if (d.sys) {
      dialog({
        title: 'система',
        icon: '<svg width="36" height="36" viewBox="0 0 17 17"><rect x="2" y="3" width="13" height="10" fill="#39479E" stroke="#16151A"/><path d="M4 5h9M4 7h6M4 9h7" stroke="#EDE7D8"/></svg>',
        text:
          'English ' +
          (APPVER || '—') +
          '\nслов в запасе: ' +
          myWords() +
          ' (' +
          cover(myWords()).toFixed(1) +
          '% текста)\nуровень: ' +
          cefr(S.level) +
          '\nв работе: ' +
          inProgress().length +
          ', выучено: ' +
          learnedWords().length +
          '\nзаписей в дневнике: ' +
          ((S.diary && S.diary.items) || []).length +
          '\nнайдено пасхалок: ' +
          Object.keys(S.egg || {}).length,
      });
      return;
    }
    if (d.dcheck) {
      diaryCheck();
      return;
    }
    if (d.dnew) {
      const w = winByApp('diary')!;
      w.data.res = null;
      paint();
      return;
    }
    if (d.dsave) {
      const w = winByApp('diary')!;
      (w.data.res.fixes || []).forEach((f: { wrong: string; right: string; why?: string }) => {
        if (!S.notes.find((x: { wrong: string }) => x.wrong.toLowerCase() === f.wrong.toLowerCase()))
          S.notes.push(f);
      });
      save();
      paint();
      return;
    }
    if (d.reset) {
      if (d.reset === 'term') delete S.term;
      if (d.reset === 'vocab') delete S.vocab;
      if (d.reset === 'five') delete S.five;
      if (d.reset === 'diary') delete S.diary;
      if (d.reset === 'read') S.read = {};
      save();
      paint();
      return;
    }
    if (d.tcmd) {
      termRun(d.tcmd);
      return;
    }
    if (d.tr) {
      termTranslate();
      return;
    }
    if (d.app) {
      if (isIconDragging()) return;
      open(d.app);
      return;
    }
    if (d.close) {
      close(d.close);
      return;
    }
    if (d.winmin) {
      const w = findWin((x) => x.key === d.winmin);
      if (w) {
        toggleMinimize(w);
        paint();
      }
      return;
    }
    if (d.winmax) {
      const w = findWin((x) => x.key === d.winmax);
      if (w) {
        toggleMaximize(w);
        paint();
      }
      return;
    }
    if (d.focus) {
      const w = findWin((x) => x.key === d.focus);
      if (w) {
        w.minimized = false;
        bringToFront(w);
        syncBackGate();
        paint();
      }
      return;
    }
    if (d.topic) {
      getText(d.topic);
      return;
    }
    if (d.owntopic) {
      dialog({
        kind: 'ask',
        title: 'своя тема',
        text: 'О чём написать текст?',
        placeholder: 'например, кофе и утро',
        onok: (v) => {
          if (v && v.trim()) getText(v.trim());
        },
      });
      return;
    }
    if (d.harvest) {
      const w = winByApp('read')!;
      w.data.harvest = textWords(w.data.text && w.data.text.body);
      // nothing is chosen until the reader taps a word
      w.data.hpick = {};
      paint();
      return;
    }
    if (d.hpick !== undefined) {
      const w = winByApp('read')!;
      w.data.hpick[+d.hpick] = !w.data.hpick[+d.hpick];
      paint();
      return;
    }
    if (d.hall) {
      const w = winByApp('read')!;
      const all = (w.data.harvest || []).every((_x: unknown, i: number) => w.data.hpick[i]);
      (w.data.harvest || []).forEach((_x: unknown, i: number) => (w.data.hpick[i] = !all));
      paint();
      return;
    }
    if (d.hclose) {
      const w = winByApp('read')!;
      w.data.harvest = null;
      paint();
      return;
    }
    if (d.hadd) {
      const w = winByApp('read')!;
      const v = vocabState();
      let n = 0;
      (w.data.harvest || []).forEach((x: { w: string }, i: number) => {
        if (!w.data.hpick[i]) return;
        if (!v.srs[x.w]) {
          v.srs[x.w] = { b: 0, due: DAY(), reps: 0, lapses: 0, first: DAY() };
          n++;
        }
      });
      w.data.harvest = null;
      save();
      recalcLevel();
      paint();
      dialog({
        title: 'курс',
        text: n ? 'Добавлено слов: ' + n + '. Они придут карточками в WORDS.' : 'Ты ничего не отметил.',
      });
      if (n) setTimeout(() => prefetch(true), 300);
      return;
    }
    if (d.newtext) {
      const w = winByApp('read')!;
      w.data.text = null;
      w.data.pop = null;
      paint();
      return;
    }
    if (d.again) {
      const w = winByApp('read')!;
      w.data.text = S.read.last;
      paint();
      return;
    }
    if (d.w !== undefined) {
      const w = winByApp('read');
      if (!w || !w.data.text) return;
      const words = w.data.text.body.split(/\s+/);
      const i = +d.w;
      lookup(words[i], words.slice(Math.max(0, i - 9), i + 10).join(' '));
      return;
    }
    if (d.saveword) {
      const w = winByApp('read')!;
      const p = w.data.pop;
      if (p && !S.words.find((x: { en: string }) => x.en.toLowerCase() === p.en.toLowerCase())) {
        S.words.push({ en: p.en, ru: p.ru });
        save();
      }
      w.data.pop = null;
      paint();
      return;
    }
    if (d.tab) {
      const w = winByApp('notes')!;
      w.data.tab = d.tab;
      paint();
      return;
    }
    if (d.del !== undefined) {
      S.words.splice(+d.del, 1);
      save();
      paint();
      return;
    }
  });

  syncBackGate();
}
