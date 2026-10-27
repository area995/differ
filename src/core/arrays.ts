import { nodeEqual } from './equal';
import type { DiffOptions, Node, PathSeg } from './model';

export type ItemRef = { index: number; seg: PathSeg };
export type ItemPair = { a: number; b: number; seg: PathSeg };
export type ArrayMatch = { pairs: ItemPair[]; onlyA: ItemRef[]; onlyB: ItemRef[] };

type MatchOptions = Pick<DiffOptions, 'ignoreArrayOrder' | 'arrayKeyField' | 'looseTypes'>;

export function matchArrays(a: Node[], b: Node[], opts: MatchOptions): ArrayMatch {
  const res: ArrayMatch = { pairs: [], onlyA: [], onlyB: [] };
  if (!opts.ignoreArrayOrder) {
    zip(indexes(a.length), indexes(b.length), res);
    return res;
  }

  let restA = indexes(a.length);
  let restB = indexes(b.length);

  const field = opts.arrayKeyField.trim();
  if (field) {
    const byField = new Map<string, number>();
    for (const j of restB) {
      const v = fieldValue(b[j], field);
      if (v !== undefined && !byField.has(v)) byField.set(v, j);
    }
    const usedByField = new Set<number>();
    const leftA: number[] = [];
    for (const i of restA) {
      const v = fieldValue(a[i], field);
      if (v === undefined) {
        leftA.push(i);
        continue;
      }
      const seg = { field, value: v };
      const j = byField.get(v);
      if (j !== undefined && !usedByField.has(j)) {
        usedByField.add(j);
        res.pairs.push({ a: i, b: j, seg });
      } else res.onlyA.push({ index: i, seg });
    }
    const leftB: number[] = [];
    for (const j of restB) {
      if (usedByField.has(j)) continue;
      const v = fieldValue(b[j], field);
      if (v === undefined) leftB.push(j);
      else res.onlyB.push({ index: j, seg: { field, value: v } });
    }
    restA = leftA;
    restB = leftB;
  }

  const usedByEquality = new Set<number>();
  const leftA: number[] = [];
  for (const i of restA) {
    const j = restB.find((k) => !usedByEquality.has(k) && nodeEqual(a[i], b[k], opts.looseTypes));
    if (j === undefined) leftA.push(i);
    else {
      usedByEquality.add(j);
      res.pairs.push({ a: i, b: j, seg: i });
    }
  }
  zip(
    leftA,
    restB.filter((k) => !usedByEquality.has(k)),
    res,
  );
  res.pairs.sort((x, y) => x.a - y.a);
  return res;
}

export function fieldValue(node: Node, field: string): string | undefined {
  if (node.kind !== 'object') return undefined;
  const entry = node.entries.find((e) => e.key === field);
  return entry && entry.value.kind === 'scalar' ? String(entry.value.value) : undefined;
}

function indexes(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function zip(as: number[], bs: number[], res: ArrayMatch): void {
  const n = Math.min(as.length, bs.length);
  for (let k = 0; k < n; k++) res.pairs.push({ a: as[k], b: bs[k], seg: as[k] });
  for (const i of as.slice(n)) res.onlyA.push({ index: i, seg: i });
  for (const j of bs.slice(n)) res.onlyB.push({ index: j, seg: j });
}
