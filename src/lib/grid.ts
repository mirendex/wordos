const FWN: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// lay the word as a chain of adjacent cells; the path can bend.
// leave cells claimed by another word's path alone — otherwise a found word
// would block the only remaining path for one not yet found
export function fwPlace(
  grid: (string | undefined)[][],
  size: number,
  claimed: number[][],
  word: string,
): [number, number][] | null {
  const starts: [number, number][] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) starts.push([r, c]);
  starts.sort(() => Math.random() - 0.5);
  for (const [r0, c0] of starts) {
    if (claimed[r0][c0]) continue;
    const path: [number, number][] = [[r0, c0]];
    const used: Record<string, 1> = {};
    used[r0 + ':' + c0] = 1;
    const walk = (i: number): boolean => {
      if (i >= word.length) return true;
      const [pr, pc] = path[path.length - 1];
      const dirs = FWN.slice().sort(() => Math.random() - 0.5);
      for (const [dr, dc] of dirs) {
        const r = pr + dr;
        const c = pc + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        if (used[r + ':' + c]) continue;
        if (claimed[r][c]) continue;
        path.push([r, c]);
        used[r + ':' + c] = 1;
        if (walk(i + 1)) return true;
        path.pop();
        delete used[r + ':' + c];
      }
      return false;
    };
    if (walk(1)) {
      path.forEach(([r, c], i) => {
        grid[r][c] = word[i];
        claimed[r][c] = 1;
      });
      return path;
    }
  }
  return null;
}
