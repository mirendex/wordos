export interface FsNode {
  d: string[];
  f: Record<string, string>;
  lock?: 1;
}

export interface QuestFile {
  path: string;
  text: string;
}

export interface QuestSource {
  code?: string | number;
  files?: QuestFile[];
  locked_file?: QuestFile;
  name?: string;
  title?: string;
  intro?: string[];
  hint?: string;
}

export interface Quest {
  id: string;
  name: string;
  lock: string;
  title: string;
  intro: string[];
  fs: Record<string, FsNode>;
  hint: string;
  done: string;
}

export function resolve(cwd: string, arg: string): string {
  let a = (arg || '').trim().replace(/\/$/, '');
  if (!a) return cwd;
  if (a === '~' || a === '/') return '~';
  if (a[0] === '~') a = a.slice(1).replace(/^\//, '');
  else if (a[0] === '/') a = a.slice(1);
  else a = (cwd === '~' ? '' : cwd.slice(2) + '/') + a;
  const out: string[] = [];
  a.split('/').forEach((p) => {
    if (!p || p === '.') return;
    if (p === '..') out.pop();
    else out.push(p);
  });
  return out.length ? '~/' + out.join('/') : '~';
}

export function buildQuest(j: QuestSource): Quest {
  if (!j || !j.code || !/^\d{4}$/.test(String(j.code))) throw new Error('в ответе нет четырёхзначного кода');
  const files = (Array.isArray(j.files) ? j.files : []).filter((f) => f && f.path && f.text);
  if (files.length < 3) throw new Error('слишком мало файлов');
  const lf = j.locked_file;
  if (!lf || !lf.path || !lf.text) throw new Error('нет запертого файла');
  const fs: Record<string, FsNode> = { '~': { d: [], f: {} } };
  function add(path: string, text: string, locked: boolean) {
    const parts = String(path).replace(/^~\/?/, '').split('/').filter(Boolean);
    const file = parts.pop()!;
    let cur = '~';
    parts.forEach((seg) => {
      const next = cur === '~' ? '~/' + seg : cur + '/' + seg;
      if (!fs[cur]) fs[cur] = { d: [], f: {} };
      if (fs[cur].d.indexOf(seg) < 0) fs[cur].d.push(seg);
      if (!fs[next]) fs[next] = { d: [], f: {} };
      cur = next;
    });
    if (!fs[cur]) fs[cur] = { d: [], f: {} };
    if (locked) fs[cur].lock = 1;
    fs[cur].f[file] = text;
  }
  files.forEach((f) => add(f.path, f.text, false));
  add(lf.path, lf.text, true);
  return {
    id: 'gen' + Date.now(),
    name: (j.name || 'node').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'node',
    lock: String(j.code),
    title: j.title || 'чужая машина',
    intro: (Array.isArray(j.intro) && j.intro.length
      ? j.intro
      : [(j.name || 'node') + ' shell', 'Печатай help.']
    ).slice(0, 3),
    fs,
    hint: j.hint || 'Код это четыре цифры, они выводятся из текстов в файлах.',
    done: 'Разобрано. Печатай next, чтобы взять следующую машину.',
  };
}
