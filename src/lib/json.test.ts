import { describe, expect, it } from 'vitest';
import { cutJson, errHint, objects, partialField } from './json';

describe('objects', () => {
  it('finds top-level and nested balanced objects', () => {
    const found = objects('{"a":1,"b":{"c":2}} garbage {"d":3}');
    expect(found).toContain('{"a":1,"b":{"c":2}}');
    expect(found).toContain('{"c":2}');
    expect(found).toContain('{"d":3}');
  });
  it('drops an object whose closing brace never arrives', () => {
    expect(objects('{"a":1} {"b":2')).toEqual(['{"a":1}']);
  });
  it('ignores braces inside strings', () => {
    expect(objects('{"a":"{not an object}"}')).toEqual(['{"a":"{not an object}"}']);
  });
});

describe('errHint', () => {
  it('recognises batch-api-only errors', () => {
    expect(errHint('only available through the batch API')).toMatch(/Batch API/);
  });
  it('falls back to a generic hint', () => {
    expect(errHint('boom')).toMatch(/другую модель/);
  });
  it('blames the network, not the model, on a fetch failure', () => {
    expect(errHint('Failed to fetch')).toMatch(/интернет/);
    expect(errHint('Failed to fetch')).not.toMatch(/другую модель/);
  });
  it('gives no hint for a plain form-validation message', () => {
    expect(errHint('Опиши, к чему готовишься.')).toBe('');
    expect(errHint('Выбери дату.')).toBe('');
  });
});

describe('cutJson', () => {
  it('parses a clean JSON object', () => {
    expect(cutJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips markdown code fences', () => {
    expect(cutJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('salvages cards from a truncated array response', () => {
    const truncated = '{"cards":[{"w":"cat","sentence":"a cat"},{"w":"dog","sentence":"a d';
    const res = cutJson(truncated) as { cards: { w: string }[]; _partial: true };
    expect(res._partial).toBe(true);
    expect(res.cards.map((c) => c.w)).toEqual(['cat']);
  });
  it('salvages goal items from a truncated response', () => {
    const truncated =
      '{"items":[{"kind":"word","en":"bill","sentence":"The ___ please."},{"kind":"word","en":"tip","sentence":"Leave a ___ here."},{"kind":"word","en":"ta';
    const res = cutJson(truncated) as { items: { en: string }[]; _partial: true };
    expect(res._partial).toBe(true);
    expect(res.items.map((i) => i.en)).toEqual(['bill', 'tip']);
  });
  it('salvages key/value pairs as a last resort', () => {
    const res = cutJson('{"ru":"перевод"') as Record<string, unknown>;
    expect(res.ru).toBe('перевод');
  });
  it('throws when nothing can be salvaged', () => {
    expect(() => cutJson('not json at all')).toThrow();
  });
});

describe('partialField', () => {
  it('reads a field that is still being written', () => {
    expect(partialField('{"title":"Sea","body":"The ocean is', 'body')).toBe('The ocean is');
  });
  it('stops at the closing quote and unescapes', () => {
    expect(partialField('{"body":"say \\"hi\\"\\nnow","x":1}', 'body')).toBe('say "hi"\nnow');
  });
  it('drops an escape cut in half', () => {
    expect(partialField('{"body":"a\\', 'body')).toBe('a');
    expect(partialField('{"body":"a\\u00', 'body')).toBe('a');
  });
  it('is null before the field starts', () => {
    expect(partialField('{"title":"x",', 'body')).toBeNull();
  });
});
