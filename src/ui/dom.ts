export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

/** Index reached from `i` by a list navigation key (arrows, j/k, Home/End), or null for other keys. */
export function step(key: string, i: number, count: number, prev = ['ArrowUp', 'k'], next = ['ArrowDown', 'j']): number | null {
  if (prev.includes(key)) return Math.max(0, i - 1);
  if (next.includes(key)) return Math.min(count - 1, i + 1);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/** Makes `target` the only element of `items` reachable with Tab (roving tabindex). */
export function setTabStop(items: Iterable<HTMLElement>, target: HTMLElement): void {
  for (const item of items) item.tabIndex = item === target ? 0 : -1;
}
