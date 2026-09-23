import { S } from '../../core/persist';

export interface DiaryEntry {
  date: string;
  text: string;
  n: number;
  level: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function diaryState(): any {
  if (!S.diary || typeof S.diary !== 'object') S.diary = { items: [], draft: '', err: '' };
  if (!Array.isArray(S.diary.items)) S.diary.items = [];
  return S.diary;
}
