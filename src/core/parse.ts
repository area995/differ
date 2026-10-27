import {
  LineCounter,
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  parseAllDocuments,
  type Document,
} from 'yaml';
import type { Format, Node, ParseResult, Pos, Range, ScalarValue } from './model';

type Ctx = { doc: Document.Parsed; lc: LineCounter; text: string; stack: Set<unknown> };

const START: Pos = { line: 1, col: 1 };

export function parse(text: string, format: Format): ParseResult {
  if (format === 'json') {
    try {
      JSON.parse(text);
    } catch (e) {
      const message = (e as Error).message;
      return { ok: false, error: { message, pos: jsonErrorPos(message, text) } };
    }
  }
  const lc = new LineCounter();
  const docs = parseAllDocuments(text, { lineCounter: lc, uniqueKeys: true, prettyErrors: false });
  if (docs.length === 0) return { ok: true, node: { kind: 'scalar', value: null, range: point(START) } };
  if (docs.length > 1) {
    return {
      ok: false,
      error: { message: 'YAML multi-documento non supportato', pos: lc.linePos(docs[1].range[0]) },
    };
  }
  const doc = docs[0];
  const err = doc.errors[0];
  if (err) return { ok: false, error: { message: err.message, pos: lc.linePos(err.pos[0]) } };
  try {
    return { ok: true, node: convert(doc.contents, { doc, lc, text, stack: new Set() }) };
  } catch (e) {
    return { ok: false, error: { message: (e as Error).message, pos: START } };
  }
}

function convert(n: unknown, ctx: Ctx): Node {
  if (n == null) return { kind: 'scalar', value: null, range: point(START) };
  if (isAlias(n)) {
    const target = n.resolve(ctx.doc);
    if (!target) throw new Error(`Alias non risolto: *${n.source}`);
    if (ctx.stack.has(target)) throw new Error(`Alias ciclico: *${n.source}`);
    return { ...convert(target, ctx), range: toRange(n.range, ctx) };
  }
  if (isMap(n)) {
    ctx.stack.add(n);
    const entries = n.items.map((pair) => {
      const k = pair.key;
      const key = isScalar(k)
        ? String(k.value)
        : k == null
          ? ''
          : JSON.stringify((k as { toJSON(): unknown }).toJSON());
      const keyRange = toRange(isNode(k) ? k.range : undefined, ctx);
      const value: Node =
        pair.value == null
          ? { kind: 'scalar', value: null, range: point(keyRange.end) }
          : convert(pair.value, ctx);
      return { key, keyRange, value };
    });
    ctx.stack.delete(n);
    return { kind: 'object', range: toRange(n.range, ctx), entries };
  }
  if (isSeq(n)) {
    ctx.stack.add(n);
    const items = n.items.map((item) => convert(item, ctx));
    ctx.stack.delete(n);
    return { kind: 'array', range: toRange(n.range, ctx), items };
  }
  if (isScalar(n)) return { kind: 'scalar', value: toScalarValue(n.value), range: toRange(n.range, ctx) };
  return { kind: 'scalar', value: String(n), range: point(START) };
}

function toScalarValue(v: unknown): ScalarValue {
  if (v === undefined) return null;
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return Number(v);
  return String(v);
}

function toRange(r: readonly [number, number, number] | null | undefined, ctx: Ctx): Range {
  if (!r) return point(START);
  let end = r[1];
  while (end > r[0] && /\s/.test(ctx.text[end - 1])) end--;
  return { start: ctx.lc.linePos(r[0]), end: ctx.lc.linePos(end) };
}

function point(p: Pos): Range {
  return { start: p, end: p };
}

/** V8 messages look like "... in JSON at position 12 (line 3 column 1)". */
function jsonErrorPos(message: string, text: string): Pos {
  const m = /position (\d+)/.exec(message);
  if (!m) return START;
  const offset = Number(m[1]);
  const before = text.slice(0, offset);
  return { line: before.split('\n').length, col: offset - before.lastIndexOf('\n') };
}
