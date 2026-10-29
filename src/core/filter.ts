import type { DiffEntry, DiffKind, Path, PathSeg } from './model';

/** Ancestor changes that explain why an included subtree is missing or different. */
const STRUCTURAL = new Set<DiffKind>(['added', 'removed', 'type']);

/**
 * Keeps the entries inside the included subtrees, plus structural changes on their ancestors,
 * then drops those inside the excluded subtrees: an exclusion wins over an inclusion.
 */
export function filterEntries(entries: DiffEntry[], includes: Path[], excludes: Path[] = []): DiffEntry[] {
  if (includes.length === 0 && excludes.length === 0) return entries;
  return entries.filter(
    (e) =>
      (includes.length === 0 ||
        includes.some((inc) => startsWith(e.path, inc) || (STRUCTURAL.has(e.kind) && startsWith(inc, e.path)))) &&
      !excludes.some((exc) => startsWith(e.path, exc)),
  );
}

export function startsWith(path: Path, prefix: Path): boolean {
  return prefix.length <= path.length && prefix.every((seg, i) => sameSeg(seg, path[i]));
}

function sameSeg(a: PathSeg, b: PathSeg): boolean {
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  return a.field === b.field && a.value === b.value;
}
