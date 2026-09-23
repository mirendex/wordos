import { S } from '../../core/persist';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function echoState(): any {
  if (!S.echo || typeof S.echo !== 'object')
    S.echo = { cur: null, pool: [], i: 0, tries: 0, last: null, acc: [], done: 0, err: '', heard: '' };
  if (!Array.isArray(S.echo.acc)) S.echo.acc = [];
  if (!Array.isArray(S.echo.pool)) S.echo.pool = [];
  return S.echo;
}

export function echoLen(): [number, number] {
  const v = S.level;
  return v < 42 ? [3, 6] : v < 60 ? [5, 8] : v < 75 ? [7, 11] : [9, 14];
}
