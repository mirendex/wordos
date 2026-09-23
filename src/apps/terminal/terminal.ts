import { esc, cefr } from '../../lib/scale';
import { buildQuest, resolve } from '../../lib/termfs';
import { paint } from '../../core/paint';
import { S, save } from '../../core/persist';
import { ask } from '../../services/llm';
import { node, quest, QUESTS, termInit } from './state';

export function tprint(x: string, t?: '' | 'cmd' | 'sys' | 'ok'): void {
  termInit().out.push({ t: t || '', x });
  if (S.term.out.length > 140) S.term.out = S.term.out.slice(-140);
}

export async function genQuest(): Promise<void> {
  const t = termInit();
  if (t.gen && t.gen.busy) return;
  t.gen = t.gen || {};
  t.gen.busy = true;
  t.gen.err = '';
  paint(true);
  try {
    const themes = [
      'ночная смена в порту',
      'маленькая студия звукозаписи',
      'сервер школьного сайта',
      'склад запчастей',
      'метеостанция',
      'служба доставки еды',
      'ферма серверов в подвале',
      'касса маленького кинотеатра',
      'приют для собак',
      'ремонт велосипедов',
    ];
    const theme = themes[Math.floor(Math.random() * themes.length)];
    const code = String(Math.floor(Math.random() * 8999) + 1000);
    const j = await ask(`Придумай маленький текстовый квест для тренировки чтения на английском.
Тема: ${theme}. Уровень английского: ${cefr(S.level)}.
Это чужой компьютер: несколько файлов на английском (письма, логи, заметки, README). Из них читатель должен вывести четырёхзначный код ${code} и открыть запертую папку.
Код ${code} НЕ пиши прямо. Спрячь его как дату (месяц и день), время (чч:мм) или номер: пусть в двух разных файлах будут подсказки, из которых он однозначно собирается.
В запертом файле должна быть человеческая мысль или наблюдение, а не техническая сводка.
Все тексты файлов на английском, кроме intro и hint.
Формат ответа:
{"name":"короткое имя машины латиницей","title":"по-русски, до 5 слов","intro":["строка на английском","строка по-русски про то, что это"],
"files":[{"path":"~/README.txt","text":"..."},{"path":"~/mail/note.txt","text":"..."},{"path":"~/logs/run.log","text":"..."}],
"locked_file":{"path":"~/vault/answer.txt","text":"..."},
"code":"${code}","hint":"подсказка по-русски, где искать цифры"}`);
    const q = buildQuest(j);
    QUESTS.push(q);
    t.saved.push(q);
    if (t.saved.length > 6) t.saved = t.saved.slice(-6);
    t.qi = QUESTS.length - 1;
    t.cwd = '~';
    t.out = q.intro.map((x) => ({ t: 'sys' as const, x }));
    t.gen.busy = false;
    save();
    paint(true);
  } catch (e) {
    t.gen.busy = false;
    t.gen.err = (e as Error).message || 'не вышло';
    tprint('машина не собралась: ' + t.gen.err, 'sys');
    paint(true);
  }
}

export function termView(): string {
  const t = termInit();
  const q = quest();
  return `<div class="sub">${esc(q.title)} · ${t.qi + 1} из ${QUESTS.length}</div>
    <div class="term" id="termout">${t.out
      .map((l) =>
        l.t === 'cmd'
          ? `<div class="cmd">$ ${esc(l.x)}</div>`
          : l.t === 'sys'
            ? `<div class="sys">${esc(l.x)}</div>`
            : l.t === 'ok'
              ? `<div class="ok">${esc(l.x)}</div>`
              : `<div>${esc(l.x)}</div>`,
      )
      .join('')}</div>
    <div class="termline"><span>${esc(t.cwd)} $</span><input id="tin" autocomplete="off" spellcheck="false" autocapitalize="off"></div>
    <div class="rowb"><button class="btn sm" data-tcmd="help">help</button><button class="btn sm" data-tcmd="ls">ls</button>
    <button class="btn sm" data-tcmd="hint">hint</button><button class="btn sm" data-tr="1">перевести файл</button>
    ${t.qi < QUESTS.length - 1 && t.solved.indexOf(quest().id) >= 0 ? '<button class="btn sm p" data-tcmd="next">next</button>' : ''}
    <button class="btn sm" data-tcmd="new">${t.gen && t.gen.busy ? 'собираю...' : 'новая машина'}</button></div>`;
}

export function termRun(raw: string): void {
  const t = termInit();
  const q = quest();
  const line = raw.trim();
  if (!line) return;
  tprint(line, 'cmd');
  const [cmd, ...rest] = line.split(/\s+/);
  const arg = rest.join(' ');
  const cur = node(t.cwd) || node('~')!;
  if (cmd === 'help')
    tprint(
      'ls, cd <dir>, cat <file>, unlock <code>, hint, next, clear, whoami\ncd ~ домой, cd .. на уровень выше, работает и cd ~/logs',
    );
  else if (cmd === 'pwd') tprint(t.cwd);
  else if (cmd === 'whoami') tprint('guest on ' + q.name);
  else if (cmd === 'clear') S.term.out = [];
  else if (cmd === 'ls') {
    const dirs = (cur.d || []).map((d) => d + '/').join('  ');
    const files = Object.keys(cur.f || {}).join('  ');
    const extra = t.unlocked[q.id]
      ? Object.keys(q.fs)
          .filter((k) => q.fs[k].lock && k.split('/').length === 2 && t.cwd === '~')
          .map((k) => k.slice(2) + '/')
          .join('  ')
      : '';
    tprint([dirs, extra, files].filter(Boolean).join('  ') || '(empty)');
  } else if (cmd === 'cd') {
    const p = resolve(t.cwd, arg);
    const n = node(p);
    if (!n) tprint('no such directory: ' + arg, 'sys');
    else if (n.lock && !t.unlocked[q.id]) tprint('locked. try: unlock <four digits>', 'sys');
    else t.cwd = p;
  } else if (cmd === 'cat') {
    const name = arg.split('/').pop();
    const dir = arg.indexOf('/') >= 0 ? node(resolve(t.cwd, arg.replace(/\/[^/]+$/, ''))) : cur;
    const f = dir && !(dir.lock && !t.unlocked[q.id]) && (dir.f || {})[name!];
    if (!f) {
      const where = Object.keys(q.fs).find(
        (k) => (q.fs[k].f || {})[name!] && (!q.fs[k].lock || t.unlocked[q.id]),
      );
      tprint('no such file: ' + arg + (where ? '  (он в ' + where + ')' : ''), 'sys');
    } else {
      tprint(f);
      t.lastFile = f;
      if (dir.lock && t.solved.indexOf(q.id) < 0) {
        t.solved.push(q.id);
        tprint('', '');
        tprint(q.done, 'ok');
        if (q.id === 'atlas') S.egg = Object.assign({}, S.egg || {}, { atlas: 1 });
      }
    }
  } else if (cmd === 'unlock') {
    if (arg.trim() === q.lock) {
      t.unlocked[q.id] = 1;
      const lockedDir = Object.keys(q.fs).find((k) => q.fs[k].lock);
      tprint('unlocked. cd ' + lockedDir, 'ok');
    } else tprint('wrong code', 'sys');
  } else if (cmd === 'next' || cmd === 'new') {
    if (cmd === 'next' && t.solved.indexOf(q.id) < 0 && t.qi < QUESTS.length - 1) {
      tprint('эта машина ещё не разобрана', 'sys');
    } else if (cmd === 'next' && t.qi < QUESTS.length - 1) {
      t.qi++;
      t.cwd = '~';
      S.term.out = QUESTS[t.qi].intro.map((x) => ({ t: 'sys' as const, x }));
    } else {
      tprint('собираю новую машину, это занимает несколько секунд', 'sys');
      genQuest();
    }
  } else if (cmd === 'hint')
    tprint(
      t.unlocked[q.id] ? 'Всё открыто. Ты в ' + t.cwd + '. Загляни в запертую папку и печатай next.' : q.hint,
      'sys',
    );
  else if (cmd === 'sudo') tprint('вежливость важнее прав доступа', 'sys');
  else if (cmd === 'exit') tprint('окно закрывается крестиком, как в девяностые', 'sys');
  else tprint('unknown command: ' + cmd + '. try help', 'sys');
  save();
  paint(true);
  setTimeout(() => {
    const o = document.getElementById('termout');
    if (o) o.scrollTop = o.scrollHeight;
    const i = document.getElementById('tin');
    if (i) i.focus();
  }, 0);
}

export async function termTranslate(): Promise<void> {
  const t = termInit();
  if (!t.lastFile) {
    tprint('сначала открой файл через cat', 'sys');
    paint();
    return;
  }
  tprint('перевожу...', 'sys');
  paint(true);
  try {
    const r = await ask(`Переведи на русский этот текст. Сохрани переносы строк и имена.
Текст: """${t.lastFile}"""
Формат ответа:
{"ru":"перевод"}`);
    S.term.out.pop();
    tprint(r.ru || '', 'sys');
  } catch {
    S.term.out.pop();
    tprint('перевод не пришёл', 'sys');
  }
  save();
  paint(true);
}
