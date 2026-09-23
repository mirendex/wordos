type Painter = (force?: boolean) => void;

let painter: Painter | null = null;

export function setPainter(fn: Painter): void {
  painter = fn;
}

export function paint(force?: boolean): void {
  painter?.(force);
}
