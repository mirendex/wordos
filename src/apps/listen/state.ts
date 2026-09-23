import { S } from '../../core/persist';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listenState(): any {
  if (!S.listen || typeof S.listen !== 'object')
    S.listen = { done: 0, acc: [], cur: null, shown: false, text: '', err: '' };
  if (!Array.isArray(S.listen.acc)) S.listen.acc = [];
  return S.listen;
}
