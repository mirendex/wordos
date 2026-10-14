// "v1.5.0", "1.5" or "1.5.0-beta" as [1, 5, 0]; missing or non-numeric parts count as 0
export function parseVersion(v: string): number[] {
  const core = String(v || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[-+]/)[0];
  const parts = core.split('.').map((p) => parseInt(p, 10));
  return [0, 1, 2].map((i) => (Number.isFinite(parts[i]) ? parts[i] : 0));
}

// true when `a` is a later version than `b`
export function isNewer(a: string, b: string): boolean {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
