import { paint } from '../core/paint';
import { save } from '../core/persist';
import { setModelQuery } from '../services/models';
import { vocabState } from '../domain/vocab';
import { diaryState } from '../apps/diary/state';
import { goalState } from '../apps/goal/state';
import { termRun } from '../apps/terminal/terminal';

export function installKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.id === 'vans' && e.key === 'Enter') {
      e.preventDefault();
      const b = document.querySelector<HTMLElement>('[data-vcheck]');
      if (b) b.click();
      return;
    }
    if (target.id === 'tin' && e.key === 'Enter') {
      const v = target.value;
      target.value = '';
      termRun(v);
    }
  });

  document.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (target.matches('textarea.ta')) target.dataset.val = target.value;
    if (target.matches('[data-msearch]')) {
      setModelQuery(target.value);
      clearTimeout(window.__mt);
      window.__mt = setTimeout(() => {
        paint(true);
        const i = document.getElementById('mq') as HTMLInputElement | null;
        if (i) {
          i.focus();
          i.selectionStart = i.value.length;
        }
      }, 280);
    }
    if (target.matches('[data-vsearch]')) {
      const v = vocabState();
      v.q = target.value;
      clearTimeout(window.__qt);
      window.__qt = setTimeout(() => {
        paint(true);
        const i = document.getElementById('vq') as HTMLInputElement | null;
        if (i) {
          i.focus();
          i.selectionStart = i.value.length;
        }
      }, 280);
    }
    if (target.matches('[data-diary]')) {
      diaryState().draft = target.value;
      save();
    }
    if (target.matches('[data-gdesc]')) {
      goalState().draft = target.value;
      save();
    }
    if (target.matches('[data-guntil]')) {
      goalState().draftUntil = target.value;
      save();
    }
  });
}
