export type FiveMark = 'y' | 'm' | 'n';

export function fiveMark(guess: string, word: string): FiveMark[] {
  const res: FiveMark[] = new Array(5).fill('n');
  const left: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === word[i]) res[i] = 'y';
    else left[word[i]] = (left[word[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'y') continue;
    if (left[guess[i]] > 0) {
      res[i] = 'm';
      left[guess[i]]--;
    }
  }
  return res;
}
