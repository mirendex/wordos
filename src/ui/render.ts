import { esc } from '../lib/scale';
import { $, clockTxt } from '../core/util';
import { setPainter } from '../core/paint';
import { title, windows, visibleWindows, topZ, saveWins, Win } from './windows';
import { modalHtml } from './modal';
import { renderIcons } from './icons';
import { aboutView } from '../apps/about';
import { readView } from '../apps/reader';
import { notesView } from '../apps/notes';
import { diaryView } from '../apps/diary/diary';
import { listenView } from '../apps/listen/listen';
import { echoView } from '../apps/echo/echo';
import { setupView } from '../apps/setup';
import { termView } from '../apps/terminal/terminal';
import { vocabView } from '../apps/vocab/vocab';
import { goalView } from '../apps/goal/goal';
import { gamesView } from '../apps/games/games';
import { MLOAD, MODELS, loadModels } from '../services/models';

function content(w: Win): string {
  if (w.app === 'games') return gamesView(w);
  if (w.app === 'vocab') return vocabView(w);
  if (w.app === 'goal') return goalView(w);
  if (w.app === 'diary') return diaryView(w);
  if (w.app === 'listen') return listenView(w);
  if (w.app === 'echo') return echoView(w);
  if (w.app === 'setup') {
    if (!MODELS.length && !MLOAD) setTimeout(() => loadModels(false), 10);
    return setupView(w);
  }
  if (w.app === 'term') return termView();
  if (w.app === 'about') return aboutView();
  if (w.app === 'read') return readView(w);
  if (w.app === 'notes') return notesView(w);
  return '';
}

function safeContent(w: Win): string {
  try {
    return content(w);
  } catch (e) {
    console.error('окно ' + w.app, e);
    return `<h3 class="h">Окно не открылось</h3>
      <p class="sub">${esc(String((e && (e as Error).message) || e))}</p>
      <p class="sub" style="margin-top:8px">Похоже, тут застряли старые данные от прошлой версии.</p>
      <div class="rowb"><button class="btn" data-reset="${esc(w.app)}">Сбросить это окно</button></div>`;
  }
}

const SCROLL: Record<string, number> = {};
let autoFocusFlag = false;

export function requestAutoFocus(): void {
  autoFocusFlag = true;
}

function typing(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
}

function paintImpl(force?: boolean): void {
  saveWins();
  if (typing() && !force) return; // не перерисовываем под открытой клавиатурой
  document.querySelectorAll<HTMLElement>('.win').forEach((el) => {
    const b = el.querySelector('.body');
    if (b) SCROLL[el.dataset.k!] = b.scrollTop;
  });
  renderIcons();
  const W = windows();
  const deskRect = document.getElementById('desk')?.getBoundingClientRect();
  $('#wins')!.innerHTML = visibleWindows()
    .map((w) => {
      const x = w.maximized ? 0 : w.x;
      const y = w.maximized ? 0 : w.y;
      const ww = w.maximized ? (deskRect?.width ?? w.w) : w.w;
      const hh = w.maximized ? (deskRect?.height ?? w.h) : w.h;
      return `<div class="win ${w.maximized ? 'max' : ''}" data-k="${esc(w.key)}" style="left:${x}px;top:${y}px;width:${ww}px;height:${hh}px;z-index:${w.z}">
    <div class="bar" data-dragk="${esc(w.key)}"><div class="lines"><span>${esc(title(w))}</span></div>
      <button class="min" data-winmin="${esc(w.key)}">_</button>
      <button class="max" data-winmax="${esc(w.key)}">${w.maximized ? '❐' : '□'}</button>
      <button class="x" data-close="${esc(w.key)}">x</button></div>
    <div class="body">${safeContent(w)}</div>
    ${w.maximized ? '' : `<i class="resize" data-resizek="${esc(w.key)}"></i>`}</div>`;
    })
    .join('');
  $('#modal')!.innerHTML = modalHtml();
  $('#taskbar')!.innerHTML =
    W.map(
      (w) =>
        `<button class="t ${w.z === topZ() && !w.minimized ? 'on' : ''} ${w.minimized ? 'min' : ''}" data-focus="${esc(w.key)}">${esc(title(w))}</button>`,
    ).join('') + `<span class="clock" id="clock" data-sys="1">${clockTxt()}</span>`;
  document.querySelectorAll<HTMLElement>('.win').forEach((el) => {
    const b = el.querySelector('.body') as HTMLElement | null;
    const s = SCROLL[el.dataset.k!];
    if (b && s) b.scrollTop = s;
  });
  const inl = document.querySelector<HTMLInputElement>('input.inline');
  if (inl && autoFocusFlag) {
    autoFocusFlag = false;
    setTimeout(() => inl.focus(), 30);
  }
  const ta = document.querySelector<HTMLTextAreaElement>('textarea.ta');
  if (ta && ta.dataset.val !== undefined) ta.value = ta.dataset.val;
}

setPainter(paintImpl);
