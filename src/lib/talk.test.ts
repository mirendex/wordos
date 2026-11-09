import { describe, expect, it } from 'vitest';
import { fixGap, pickFormat, Played, titleRepeats, usedWord, wordForms } from './talk';
import { addDays } from './today';

const T = '2026-11-09';
const run = (fs: string[]): Played[] =>
  fs.map((f, i) => ({ day: addDays(T, i - fs.length), format: f as Played['format'] }));

describe('pickFormat', () => {
  it('never repeats yesterday', () => {
    for (let i = 0; i < 20; i++) {
      const r = (i + 0.5) / 20;
      expect(pickFormat(T, run(['detective']), () => r)).not.toBe('detective');
    }
  });

  it('prefers the formats not seen for longest', () => {
    expect(pickFormat(T, run(['scene', 'detective', 'persuade', 'twenty']), () => 0)).toBe('tourist');
  });

  it('brings no guest on the first days', () => {
    expect(pickFormat(T, [], () => 0)).not.toBe('guest');
    expect(pickFormat(T, run(['scene', 'twenty']), () => 0)).not.toBe('guest');
  });

  it('brings a guest by RARE_SURE days and not before RARE_MIN', () => {
    const ten = run([
      'scene',
      'twenty',
      'persuade',
      'tourist',
      'scene',
      'detective',
      'twenty',
      'scene',
      'tourist',
      'persuade',
    ]);
    expect(pickFormat(T, ten, () => 0.99)).toBe('guest');
    const withGuest = run(['scene', 'twenty', 'guest', 'tourist', 'scene', 'detective']);
    expect(pickFormat(T, withGuest, () => 0)).not.toBe('guest');
  });

  it('counts only the days before today', () => {
    const p: Played[] = [{ day: T, format: 'scene' }];
    expect(pickFormat(T, p, () => 0)).toBe('scene');
  });
});

describe('usedWord', () => {
  it('finds the word and its usual forms', () => {
    expect(usedWord('book', 'I booked a table')).toBe(true);
    expect(usedWord('make', "We're making progress")).toBe(true);
    expect(usedWord('try', 'She tried twice')).toBe(true);
    expect(usedWord('stop', 'The bus stopped')).toBe(true);
    expect(usedWord('city', 'Two big cities')).toBe(true);
  });

  it('does not take a part of another word', () => {
    expect(usedWord('cat', 'a catalogue')).toBe(false);
    expect(wordForms('run')).toContain('running');
  });
});

describe('fixGap', () => {
  const known = (w: string) => ['gone', 'went', 'the', 'to', 'shop', 'on', 'at'].indexOf(w) >= 0;

  it('gaps the one word the fix brings', () => {
    expect(fixGap('I have went to the shop', 'I have gone to the shop', known)).toEqual({
      word: 'gone',
      sentence: 'I have ___ to the shop',
    });
  });

  it('skips fixes that are not a single known word', () => {
    expect(fixGap('I go shop', 'I go to the shop', known)).toBeNull();
    expect(fixGap('see you in Monday', 'see you on Monday', () => false)).toBeNull();
    expect(fixGap('went', 'gone', known)).toBeNull();
  });
});

describe('titleRepeats', () => {
  it('spots a title that only names the kind again', () => {
    expect(titleRepeats('Двадцать вопросов с Эллой', '20 вопросов')).toBe(true);
    expect(titleRepeats('Пропавший торт', 'Детектив')).toBe(false);
    expect(titleRepeats('Детективная история', 'Детектив')).toBe(true);
    expect(titleRepeats('', 'Сцена')).toBe(true);
  });
});
