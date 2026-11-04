// a damped spring from 0 to 1 as a CSS easing: `zeta` is the damping (less is springier), `swings`
// how many times it goes back and forth. A browser without linear() gets an overshooting curve.
export function spring(zeta: number, swings: number, n = 48): string {
  if (!CSS.supports('animation-timing-function', 'linear(0, 1)')) return 'cubic-bezier(0.34, 1.5, 0.64, 1)';
  const w = 2 * Math.PI * swings;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const v = 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
    pts.push((i === n ? 1 : v).toFixed(4));
  }
  return `linear(${pts.join(',')})`;
}
