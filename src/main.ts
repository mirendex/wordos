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
import { newDay } from './domain/today';

installGestures();
installKeyboard();
installActions();

function boot(): void {
  if (!S.cfg) S.cfg = { key: '', model: 'openai/gpt-4o-mini' };
  recalcLevel();
  const fresh = newDay() && !!S.seenIntro;
  // the windows come back as they were left; the very first time there are none to bring back
  if (restoreWins(WINS)) paint();
  else withoutHaptics(() => (S.seenIntro ? open('vocab') : open('about')));
  // the first time in a day the day's route opens on top of what was left open
  if (fresh) withoutHaptics(() => open('today'));
  playBoot(() => haptic('boot'));
  notifyPlan();
  loadAppVersion();
  installWarm();
  installUpdateCheck();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && newDay()) withoutHaptics(() => open('today'));
  });
}

setInterval(() => {
  const c = $('#clock');
  if (c) c.textContent = clockTxt();
}, 20000);

load().then(() => {
  if (window.speechSynthesis) speechSynthesis.getVoices();
  boot();
});
