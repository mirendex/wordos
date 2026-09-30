import { playBoot } from './ui/bootanim';
import './ui/render';
import { load, S } from './core/persist';
import { paint } from './core/paint';
import { recalcLevel } from './domain/progress';
import { open } from './ui/windows';
import { installGestures } from './ui/gestures';
import { installKeyboard } from './ui/keyboard';
import { installActions } from './ui/actions';
import { loadAppVersion } from './platform/appinfo';
import { notifyPlan } from './platform/notify';
import { $, clockTxt } from './core/util';
import { haptic, withoutHaptics } from './platform/haptics';
import { installWarm } from './services/warm';

installGestures();
installKeyboard();
installActions();

function boot(): void {
  if (!S.cfg) S.cfg = { key: '', model: 'openai/gpt-4o-mini' };
  recalcLevel();
  paint();
  withoutHaptics(() => (S.seenIntro ? open('vocab') : open('about')));
  playBoot(() => haptic('boot'));
  notifyPlan();
  loadAppVersion();
  installWarm();
}

setInterval(() => {
  const c = $('#clock');
  if (c) c.textContent = clockTxt();
}, 20000);

load().then(() => {
  if (window.speechSynthesis) speechSynthesis.getVoices();
  boot();
});
