import { playBoot } from './ui/bootanim';
import './ui/render';
import { load, S, WINS } from './core/persist';
import { paint } from './core/paint';
import { recalcLevel } from './domain/progress';
import { open, restoreWins } from './ui/windows';
import { installGestures } from './ui/gestures';
import { installKeyboard } from './ui/keyboard';
import { installActions } from './ui/actions';
import { loadAppVersion } from './platform/appinfo';
import { notifyPlan } from './platform/notify';
import { $, clockTxt } from './core/util';
import { haptic, withoutHaptics } from './platform/haptics';
import { installWarm } from './services/warm';
import { installUpdateCheck } from './services/update';

installGestures();
installKeyboard();
installActions();

function boot(): void {
  if (!S.cfg) S.cfg = { key: '', model: 'openai/gpt-4o-mini' };
  recalcLevel();
  // the windows come back as they were left; the very first time there are none to bring back
  if (restoreWins(WINS)) paint();
  else withoutHaptics(() => (S.seenIntro ? open('vocab') : open('about')));
  playBoot(() => haptic('boot'));
  notifyPlan();
  loadAppVersion();
  installWarm();
  installUpdateCheck();
}

setInterval(() => {
  const c = $('#clock');
  if (c) c.textContent = clockTxt();
}, 20000);

load().then(() => {
  if (window.speechSynthesis) speechSynthesis.getVoices();
  boot();
});
