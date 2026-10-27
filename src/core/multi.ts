import { startsWith } from './filter';
import { formatPath, toPlain, type DiffEntry, type DiffKind, type Node, type Path } from './model';
import { locateEntry, type PatchDoc } from './patch';
import { selectNode } from './select';

export type CellStatus = 'equal' | DiffKind;

export type MatrixCell = {
  status: CellStatus;
  /** The status comes from a difference on an ancestor path. */
  inherited: boolean;
  present: boolean;
  value?: unknown;
  /** The difference at exactly this path, when there is one. */
  entry?: DiffEntry;
};

export type MatrixRow = {
  path: Path;
  label: string;
  base: { present: boolean; value?: unknown };
  /** One cell per compared file, in the order of `files`. */
  cells: MatrixCell[];
};

const STRUCTURAL = new Set<DiffKind>(['added', 'removed', 'type']);

/**
 * Groups the differences between the base and each file by path: one row per path that differs in at
 * least one file, ordered by position in the base. `entries[i]` is `diff(base, files[i])`.
 */
export function buildMatrix(base: PatchDoc, files: PatchDoc[], entries: DiffEntry[][]): MatrixRow[] {
  const found = new Map<string, { path: Path; line: number; seq: number }>();
  entries.forEach((list, i) => {
    for (const e of list) {
      const label = formatPath(e.path);
      if (!found.has(label)) {
        found.set(label, { path: e.path, line: locateEntry(e, base, files[i]).a.start.line, seq: found.size });
      }
    }
  });
  const ordered = [...found.entries()].sort(([, x], [, y]) => x.line - y.line || x.seq - y.seq);

  return ordered.map(([label, { path }]) => {
    const exact = entries.map((list) => list.find((e) => formatPath(e.path) === label));
    const withBase = exact.find((e) => e && e.kind !== 'added');
    const baseValue = withBase?.a?.value ?? plain(selectNode(base.node, path));
    return {
      path,
      label,
      base: withBase ? { present: true, value: baseValue } : { present: false },
      cells: files.map((file, i) => cell(file.node, path, exact[i], entries[i])),
    };
  });
}

function cell(node: Node, path: Path, entry: DiffEntry | undefined, all: DiffEntry[]): MatrixCell {
  if (entry) {
    if (entry.kind === 'removed') return { status: 'removed', inherited: false, present: false, entry };
    const value = entry.b?.value ?? plain(selectNode(node, path));
    return { status: entry.kind, inherited: false, present: true, value, entry };
  }
  const ancestor = all.find((e) => STRUCTURAL.has(e.kind) && e.path.length < path.length && startsWith(path, e.path));
  const here = ancestor?.kind === 'removed' ? undefined : selectNode(node, path);
  return {
    status: ancestor?.kind ?? 'equal',
    inherited: !!ancestor,
    present: here !== undefined,
    ...(here !== undefined && { value: toPlain(here) }),
  };
}

function plain(node: Node | undefined): unknown {
  return node === undefined ? undefined : toPlain(node);
}
