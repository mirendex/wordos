import { describe, expect, it } from 'vitest';
import { buildQuest, resolve, type QuestSource } from './termfs';

describe('resolve', () => {
  it('resolves relative paths against the current directory', () => {
    expect(resolve('~', 'docs')).toBe('~/docs');
    expect(resolve('~/docs', 'notes')).toBe('~/docs/notes');
  });
  it('resolves .. and absolute/home paths', () => {
    expect(resolve('~/docs/notes', '..')).toBe('~/docs');
    expect(resolve('~/docs', '~')).toBe('~');
    expect(resolve('~/docs', '/etc')).toBe('~/etc');
  });
  it('returns the current directory for an empty argument', () => {
    expect(resolve('~/docs', '')).toBe('~/docs');
  });
});

describe('buildQuest', () => {
  const base: QuestSource = {
    code: '1234',
    name: 'node1',
    title: 'Заголовок',
    intro: ['line1', 'line2'],
    files: [
      { path: '~/README.txt', text: 'readme' },
      { path: '~/mail/note.txt', text: 'note' },
      { path: '~/logs/run.log', text: 'log' },
    ],
    locked_file: { path: '~/vault/answer.txt', text: 'secret' },
    hint: 'ищи в письмах',
  };

  it('builds a filesystem tree with nested directories', () => {
    const q = buildQuest(base);
    expect(q.lock).toBe('1234');
    expect(q.fs['~'].d).toContain('mail');
    expect(q.fs['~'].d).toContain('logs');
    expect(q.fs['~/mail'].f['note.txt']).toBe('note');
  });
  it('marks the locked file directory', () => {
    const q = buildQuest(base);
    expect(q.fs['~/vault'].lock).toBe(1);
    expect(q.fs['~/vault'].f['answer.txt']).toBe('secret');
  });
  it('rejects a missing or malformed code', () => {
    expect(() => buildQuest({ ...base, code: '12' })).toThrow();
    expect(() => buildQuest({ ...base, code: undefined })).toThrow();
  });
  it('rejects too few files', () => {
    expect(() => buildQuest({ ...base, files: base.files!.slice(0, 1) })).toThrow();
  });
  it('rejects a missing locked file', () => {
    expect(() => buildQuest({ ...base, locked_file: undefined })).toThrow();
  });
});
