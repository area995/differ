export type LineMark = 'changed' | 'added';

/** Lines touched by applied edits (1-based); `removedBefore` holds lines right after a removal. */
export type LineMarks = { lines: Map<number, LineMark>; removedBefore: Set<number> };

export function noMarks(): LineMarks {
  return { lines: new Map(), removedBefore: new Set() };
}

/** Marks the lines touched when `before` became `after`, moving the existing marks along. */
export function markEdit(before: string, after: string, marks: LineMarks): LineMarks {
  const a = before.split('\n');
  const b = after.split('\n');
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++;
  }
  const removed = a.length - prefix - suffix;
  const inserted = b.length - prefix - suffix;

  // lines before the edit stay, lines after it shift, lines inside it get new marks
  const move = (line: number) => (line <= prefix ? line : line > prefix + removed ? line + inserted - removed : null);
  const next = noMarks();
  for (const [line, mark] of marks.lines) {
    const to = move(line);
    if (to !== null) next.lines.set(to, mark);
  }
  for (const line of marks.removedBefore) {
    const to = move(line);
    if (to !== null) next.removedBefore.add(to);
  }
  for (let i = 0; i < inserted; i++) next.lines.set(prefix + 1 + i, i < removed ? 'changed' : 'added');
  if (inserted < removed) next.removedBefore.add(prefix + inserted + 1);
  return next;
}
