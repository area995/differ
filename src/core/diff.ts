import { matchArrays } from './arrays';
import { scalarEqual, scalarType } from './equal';
import {
  toPlain,
  type ArrayNode,
  type DiffEntry,
  type DiffOptions,
  type Entry,
  type Node,
  type ObjectNode,
  type Path,
  type Range,
  type Side,
} from './model';
import { movedKeys } from './order';
import { compareLines } from './whitespace';

/** Original texts, needed only for whitespace comparison. */
export type RawTexts = { a: string; b: string };

type Ctx = {
  opts: DiffOptions;
  out: DiffEntry[];
  ws?: { linesA: string[]; linesB: string[]; seen: Set<string> };
};

export function diff(a: Node, b: Node, opts: DiffOptions, raw?: RawTexts): DiffEntry[] {
  const ctx: Ctx = { opts, out: [] };
  if (opts.whitespace && raw) {
    ctx.ws = { linesA: raw.a.split(/\r?\n/), linesB: raw.b.split(/\r?\n/), seen: new Set() };
  }
  walk(a, b, [], ctx);
  return ctx.out;
}

function walk(a: Node, b: Node, path: Path, ctx: Ctx): void {
  const { opts, out } = ctx;
  if (a.kind === 'scalar' && b.kind === 'scalar') {
    if (scalarEqual(a.value, b.value, opts.looseTypes)) {
      checkWhitespace(a.range.start.line, b.range.start.line, path, ctx);
      return;
    }
    if (!opts.values) return;
    const ta = scalarType(a.value);
    const tb = scalarType(b.value);
    const sameType = ta === tb || opts.looseTypes;
    out.push({
      kind: sameType ? 'changed' : 'type',
      path,
      a: side(a),
      b: side(b),
      detail: sameType ? undefined : `${ta} → ${tb}`,
    });
    return;
  }
  if (a.kind === 'object' && b.kind === 'object') return walkObject(a, b, path, ctx);
  if (a.kind === 'array' && b.kind === 'array') return walkArray(a, b, path, ctx);
  if (opts.values) {
    out.push({ kind: 'type', path, a: side(a), b: side(b), detail: `${kindLabel(a)} → ${kindLabel(b)}` });
  }
}

function walkObject(a: ObjectNode, b: ObjectNode, path: Path, ctx: Ctx): void {
  const { opts, out } = ctx;
  const indexB = new Map(b.entries.map((e, i) => [e.key, i]));
  const keysA = new Set(a.entries.map((e) => e.key));

  for (const ea of a.entries) {
    const p = [...path, ea.key];
    const ib = indexB.get(ea.key);
    if (ib === undefined) {
      if (opts.keys) out.push({ kind: 'removed', path: p, a: entrySide(ea) });
      continue;
    }
    const eb = b.entries[ib];
    if (ea.value.kind !== 'scalar' && eb.value.kind !== 'scalar') {
      checkWhitespace(ea.keyRange.start.line, eb.keyRange.start.line, p, ctx);
    }
    walk(ea.value, eb.value, p, ctx);
  }

  if (opts.keys) {
    for (const eb of b.entries) {
      if (!keysA.has(eb.key)) out.push({ kind: 'added', path: [...path, eb.key], b: entrySide(eb) });
    }
  }

  if (opts.keyOrder) {
    const indexA = new Map(a.entries.map((e, i) => [e.key, i]));
    const commonA = a.entries.filter((e) => indexB.has(e.key)).map((e) => e.key);
    const commonB = b.entries.filter((e) => keysA.has(e.key)).map((e) => e.key);
    for (const key of movedKeys(commonA, commonB)) {
      const ia = indexA.get(key)!;
      const ib = indexB.get(key)!;
      out.push({
        kind: 'moved',
        path: [...path, key],
        a: { range: entryRange(a.entries[ia]) },
        b: { range: entryRange(b.entries[ib]) },
        detail: `posizione ${ia + 1} → ${ib + 1}`,
      });
    }
  }
}

function walkArray(a: ArrayNode, b: ArrayNode, path: Path, ctx: Ctx): void {
  const m = matchArrays(a.items, b.items, ctx.opts);
  for (const p of m.pairs) walk(a.items[p.a], b.items[p.b], [...path, p.seg], ctx);
  if (!ctx.opts.keys) return;
  for (const r of m.onlyA) ctx.out.push({ kind: 'removed', path: [...path, r.seg], a: side(a.items[r.index]) });
  for (const r of m.onlyB) ctx.out.push({ kind: 'added', path: [...path, r.seg], b: side(b.items[r.index]) });
}

function checkWhitespace(lineA: number, lineB: number, path: Path, ctx: Ctx): void {
  const ws = ctx.ws;
  if (!ws) return;
  const id = `${lineA}:${lineB}`;
  if (ws.seen.has(id)) return;
  ws.seen.add(id);
  const details = compareLines(ws.linesA[lineA - 1] ?? '', ws.linesB[lineB - 1] ?? '');
  if (details.length === 0) return;
  ctx.out.push({
    kind: 'whitespace',
    path,
    a: { range: lineRange(lineA) },
    b: { range: lineRange(lineB) },
    detail: details.join(', '),
  });
}

function side(n: Node): Side {
  return { value: toPlain(n), range: n.range };
}

function entrySide(e: Entry): Side {
  return { value: toPlain(e.value), range: entryRange(e) };
}

function entryRange(e: Entry): Range {
  return { start: e.keyRange.start, end: e.value.range.end };
}

function lineRange(line: number): Range {
  return { start: { line, col: 1 }, end: { line, col: 1 } };
}

function kindLabel(n: Node): string {
  return n.kind === 'scalar' ? scalarType(n.value) : n.kind;
}
