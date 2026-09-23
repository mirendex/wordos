import { describe, expect, it } from 'vitest';
import { fwPlace } from './grid';

function makeGrid(size: number) {
  return Array.from({ length: size }, () => Array.from<undefined>({ length: size }));
}
function makeClaimed(size: number) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

describe('fwPlace', () => {
  it('lays the word along a path of adjacent cells', () => {
    const size = 6;
    const grid = makeGrid(size);
    const claimed = makeClaimed(size);
    const path = fwPlace(grid, size, claimed, 'cat');
    expect(path).not.toBeNull();
    expect(path).toHaveLength(3);
    for (let i = 1; i < path!.length; i++) {
      const [pr, pc] = path![i - 1];
      const [r, c] = path![i];
      const dist = Math.abs(pr - r) + Math.abs(pc - c);
      expect(dist).toBe(1);
    }
    path!.forEach(([r, c], i) => {
      expect(grid[r][c]).toBe('cat'[i]);
      expect(claimed[r][c]).toBe(1);
    });
  });

  it('never reuses a cell claimed by an earlier word', () => {
    const size = 6;
    const grid = makeGrid(size);
    const claimed = makeClaimed(size);
    const path1 = fwPlace(grid, size, claimed, 'cat')!;
    const path2 = fwPlace(grid, size, claimed, 'dog')!;
    const key1 = new Set(path1.map(([r, c]) => r + ':' + c));
    for (const [r, c] of path2) {
      expect(key1.has(r + ':' + c)).toBe(false);
    }
  });

  it('returns null when the word cannot fit', () => {
    const size = 2;
    const grid = makeGrid(size);
    const claimed = makeClaimed(size);
    expect(fwPlace(grid, size, claimed, 'toolongforthisgrid')).toBeNull();
  });
});
