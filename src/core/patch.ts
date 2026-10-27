import { stringify } from 'yaml';
import { toPlain, type DiffEntry, type Entry, type Format, type Node, type Path, type Range, type Side } from './model';
import { parse } from './parse';
import { selectNode } from './select';
import { indentAt, lineEnd, lineStart, toOffset } from './text';

export type Direction = 'aToB' | 'bToA';

/** A document as seen by the diff: `node` is the root actually compared, found at `rootPath` in the text. */
export type PatchDoc = { text: string; format: Format; node: Node; rootPath: Path };

/** Replacement of `text.slice(start, end)` in the target document. */
export type Edit = { start: number; end: number; text: string };

export type PatchResult = { ok: true; text: string; edit: Edit } | { ok: false; error: string };

export const PATCH_ERROR = 'Impossibile riportare automaticamente questa modifica';

/** Returns why an entry cannot be applied, or null when it can. */
export function patchSupport(entry: DiffEntry, a: PatchDoc, b: PatchDoc, ignoreArrayOrder: boolean): string | null {
  if (entry.kind === 'moved') return 'Le chiavi spostate non si possono riportare';
  if (entry.kind === 'whitespace' && a.format !== b.format) return 'Disponibile solo tra file dello stesso formato';
  if (ignoreArrayOrder && entry.path.some((s) => typeof s === 'number')) {
    return 'Non disponibile con "Ignora ordine array" su elementi per indice';
  }
  return null;
}

/** Copies the difference described by `entry` from one document to the other, touching only that node. */
export function applyEntry(entry: DiffEntry, direction: Direction, a: PatchDoc, b: PatchDoc): PatchResult {
  const [src, tgt] = direction === 'aToB' ? [a, b] : [b, a];
  const srcSide = direction === 'aToB' ? entry.a : entry.b;
  const tgtSide = direction === 'aToB' ? entry.b : entry.a;
  try {
    const plan = makePlan(entry, src, tgt, srcSide, tgtSide);
    const text = tgt.text.slice(0, plan.edit.start) + plan.edit.text + tgt.text.slice(plan.edit.end);
    if (plan.check(text)) return { ok: true, text, edit: plan.edit };
  } catch {
    // unsupported layout: fall through
  }
  return { ok: false, error: PATCH_ERROR };
}

type Plan = { edit: Edit; check: (text: string) => boolean };

class Unsupported extends Error {}

function makePlan(entry: DiffEntry, src: PatchDoc, tgt: PatchDoc, srcSide?: Side, tgtSide?: Side): Plan {
  switch (entry.kind) {
    case 'changed':
    case 'type':
      if (!srcSide || !tgtSide) throw new Unsupported();
      return replaceValue(entry.path, src, tgt, srcSide, tgtSide);
    case 'whitespace':
      if (!srcSide || !tgtSide || src.format !== tgt.format) throw new Unsupported();
      return replaceLine(src, tgt, srcSide.range.start.line, tgtSide.range.start.line);
    case 'added':
    case 'removed':
      if (srcSide) return insert(entry.path, src, tgt, srcSide);
      if (tgtSide) return remove(entry.path, tgt, tgtSide);
      throw new Unsupported();
    default:
      throw new Unsupported();
  }
}

// ---------- replace ----------

function replaceValue(path: Path, src: PatchDoc, tgt: PatchDoc, srcSide: Side, tgtSide: Side): Plan {
  let start = toOffset(tgt.text, tgtSide.range.start);
  const end = toOffset(tgt.text, tgtSide.range.end);
  const parent = selectNode(tgt.node, path.slice(0, -1));
  const flow = tgt.format === 'json' || (path.length > 0 && !!parent && isFlow(tgt.text, parent));
  const pretty = parent && path.length > 0 ? spansLines(parent.range) : tgt.text.trim().includes('\n');
  const ctx = contextAt(tgt.text, start, flow, pretty);
  let text = renderValue(srcSide.value, sliceOf(src, tgt, srcSide.range), tgt, ctx);

  if (text.startsWith('\n')) {
    // block value moved below its key: drop the spaces after the colon
    while (start > 0 && tgt.text[start - 1] === ' ') start--;
  } else if (tgt.format === 'yaml' && !text.includes('\n') && ctx.ownLine) {
    // single-line value replacing a block: put it back on the key line
    let q = lineStart(tgt.text, start) - 1;
    while (q > 0 && /\s/.test(tgt.text[q - 1])) q--;
    if (tgt.text[q - 1] === ':') {
      start = q;
      text = ` ${text}`;
    }
  }
  return { edit: { start, end, text }, check: expectValue(tgt, path, srcSide.value) };
}

function replaceLine(src: PatchDoc, tgt: PatchDoc, srcLine: number, tgtLine: number): Plan {
  const line = lineText(src.text, srcLine);
  const start = toOffset(tgt.text, { line: tgtLine, col: 1 });
  const end = start + lineText(tgt.text, tgtLine).length;
  return { edit: { start, end, text: line }, check: (text) => lineText(text, tgtLine) === line };
}

function lineText(text: string, line: number): string {
  const start = toOffset(text, { line, col: 1 });
  return text.slice(start, lineEnd(text, start)).replace(/\r$/, '');
}

// ---------- insert ----------

function insert(path: Path, src: PatchDoc, tgt: PatchDoc, srcSide: Side): Plan {
  const key = path[path.length - 1];
  const parentPath = path.slice(0, -1);
  const parent = selectNode(tgt.node, parentPath);
  const srcParent = selectNode(src.node, parentPath);
  if (!parent || !srcParent || key === undefined) throw new Unsupported();
  const flow = tgt.format === 'json' || isFlow(tgt.text, parent);

  if (parent.kind === 'object' && srcParent.kind === 'object' && typeof key === 'string') {
    const index = srcParent.entries.findIndex((e) => e.key === key);
    if (index < 0) throw new Unsupported();
    const inTarget = new Map(parent.entries.map((e) => [e.key, e]));
    let anchor: Entry | undefined;
    for (let i = index - 1; i >= 0 && !anchor; i--) anchor = inTarget.get(srcParent.entries[i].key);
    const first = parent.entries[0];
    const edit = flow
      ? insertFlow(src, tgt, parent.range, anchor?.value.range.end, first?.keyRange, srcParent.entries[index], srcSide)
      : insertBlockEntry(src, tgt, anchor, first, srcParent.entries[index], srcSide);
    return { edit, check: expectValue(tgt, path, srcSide.value) };
  }

  if (parent.kind === 'array' && srcParent.kind === 'array') {
    const at = typeof key === 'number' ? Math.min(key, parent.items.length) : parent.items.length;
    const anchor = parent.items[at - 1];
    const first = parent.items[0];
    const edit = flow
      ? insertFlow(src, tgt, parent.range, anchor?.range.end, first?.range, undefined, srcSide)
      : insertBlockItem(src, tgt, anchor, first, srcSide);
    return { edit, check: expectValue(tgt, [...parentPath, at], srcSide.value) };
  }
  throw new Unsupported();
}

function insertBlockEntry(
  src: PatchDoc,
  tgt: PatchDoc,
  anchor: Entry | undefined,
  first: Entry | undefined,
  srcEntry: Entry,
  srcSide: Side,
): Edit {
  const ref = anchor ?? first;
  if (!ref) throw new Unsupported();
  const keyOffset = toOffset(tgt.text, ref.keyRange.start);
  const before = tgt.text.slice(lineStart(tgt.text, keyOffset), keyOffset);
  const indent = ' '.repeat(ref.keyRange.start.col - 1);
  const keyText = keyTextFor(src, tgt, srcEntry, false);
  const ctx: Ctx = { mode: 'afterKey', col: indent.length + keyText.length + 3, lineIndent: indent, flow: false, pretty: true, ownLine: false };
  const value = renderValue(srcSide.value, sliceOf(src, tgt, srcEntry.value.range), tgt, ctx);
  const entryText = `${keyText}:${value.startsWith('\n') ? '' : ' '}${value}`;
  if (anchor) {
    const at = lineEnd(tgt.text, toOffset(tgt.text, anchor.value.range.end));
    return { start: at, end: at, text: `\n${indent}${entryText}` };
  }
  if (!/^\s*$/.test(before)) throw new Unsupported(); // first key of a compact "- key:" item
  const at = lineStart(tgt.text, keyOffset);
  return { start: at, end: at, text: `${indent}${entryText}\n` };
}

function insertBlockItem(src: PatchDoc, tgt: PatchDoc, anchor: Node | undefined, first: Node | undefined, srcSide: Side): Edit {
  const ref = anchor ?? first;
  if (!ref) throw new Unsupported();
  const refOffset = toOffset(tgt.text, ref.range.start);
  const dash = /^(\s*)-\s+$/.exec(tgt.text.slice(lineStart(tgt.text, refOffset), refOffset));
  if (!dash) throw new Unsupported();
  const indent = dash[1];
  const ctx: Ctx = { mode: 'column', col: indent.length + 3, lineIndent: indent, flow: false, pretty: true, ownLine: false };
  const item = `- ${renderValue(srcSide.value, sliceOf(src, tgt, srcSide.range), tgt, ctx)}`;
  if (anchor) {
    const at = lineEnd(tgt.text, toOffset(tgt.text, anchor.range.end));
    return { start: at, end: at, text: `\n${indent}${item}` };
  }
  const at = lineStart(tgt.text, refOffset);
  return { start: at, end: at, text: `${indent}${item}\n` };
}

/** Inserts into a `{...}` or `[...]` container; `srcEntry` is set for objects. */
function insertFlow(
  src: PatchDoc,
  tgt: PatchDoc,
  container: Range,
  anchorEnd: Range['end'] | undefined,
  first: Range | undefined,
  srcEntry: Entry | undefined,
  srcSide: Side,
): Edit {
  const multiline = spansLines(container);
  const containerOffset = toOffset(tgt.text, container.start);
  const ref = anchorEnd ? toOffset(tgt.text, anchorEnd) : first ? toOffset(tgt.text, first.start) : undefined;
  const itemIndent =
    ref !== undefined ? indentAt(tgt.text, ref) : indentAt(tgt.text, containerOffset) + ' '.repeat(indentUnit(tgt.text));
  const keyText = srcEntry ? `${keyTextFor(src, tgt, srcEntry, true)}: ` : '';
  const ctx: Ctx = { mode: 'column', col: itemIndent.length + keyText.length + 1, lineIndent: itemIndent, flow: true, pretty: multiline, ownLine: false };
  const valueRange = srcEntry ? srcEntry.value.range : srcSide.range;
  const item = keyText + renderValue(srcSide.value, sliceOf(src, tgt, valueRange), tgt, ctx);
  const sep = multiline ? `\n${itemIndent}` : ' ';
  if (anchorEnd) {
    const at = toOffset(tgt.text, anchorEnd);
    return { start: at, end: at, text: `,${sep}${item}` };
  }
  if (first) {
    const at = toOffset(tgt.text, first.start);
    return { start: at, end: at, text: `${item},${sep}` };
  }
  const at = containerOffset + 1;
  return { start: at, end: at, text: multiline ? `\n${itemIndent}${item}` : item };
}

function keyTextFor(src: PatchDoc, tgt: PatchDoc, srcEntry: Entry, flow: boolean): string {
  if (tgt.format === 'json') return JSON.stringify(srcEntry.key);
  if (src.format === 'yaml') {
    const s = toOffset(src.text, srcEntry.keyRange.start);
    const raw = src.text.slice(s, toOffset(src.text, srcEntry.keyRange.end));
    if (!flow || /^["']/.test(raw) || !/[,[\]{}]/.test(raw)) return raw;
  }
  if (flow && /[,[\]{}:#]/.test(srcEntry.key)) return JSON.stringify(srcEntry.key);
  return stringify(srcEntry.key).trimEnd();
}

// ---------- remove ----------

function remove(path: Path, tgt: PatchDoc, tgtSide: Side): Plan {
  const parentPath = path.slice(0, -1);
  const parent = selectNode(tgt.node, parentPath);
  if (!parent) throw new Unsupported();
  const start = toOffset(tgt.text, tgtSide.range.start);
  const end = toOffset(tgt.text, tgtSide.range.end);
  const flow = tgt.format === 'json' || isFlow(tgt.text, parent);
  const edit = flow ? removeFlow(tgt.text, start, end) : removeBlock(tgt.text, start, end, parent.kind === 'array');

  const last = path[path.length - 1];
  const check =
    typeof last === 'string'
      ? (text: string) => locate(text, tgt, parentPath) !== undefined && locate(text, tgt, path) === undefined
      : (text: string) => {
          const after = locate(text, tgt, parentPath);
          return after?.kind === 'array' && parent.kind === 'array' && after.items.length === parent.items.length - 1;
        };
  return { edit, check };
}

function removeBlock(text: string, start: number, end: number, item: boolean): Edit {
  const before = text.slice(lineStart(text, start), start);
  if (!(item ? /^\s*-\s+$/ : /^\s*$/).test(before)) throw new Unsupported();
  return { start: lineStart(text, start), end: Math.min(lineEnd(text, end) + 1, text.length), text: '' };
}

function removeFlow(text: string, start: number, end: number): Edit {
  const ownLine = /^\s*$/.test(text.slice(lineStart(text, start), start));
  let next = end;
  while (next < text.length && /\s/.test(text[next])) next++;
  if (text[next] === ',') {
    const afterComma = next + 1;
    if (ownLine && /^[ \t\r]*$/.test(text.slice(afterComma, lineEnd(text, afterComma)))) {
      return { start: lineStart(text, start), end: lineEnd(text, afterComma) + 1, text: '' };
    }
    let k = afterComma;
    while (text[k] === ' ' || text[k] === '\t') k++;
    return { start, end: k, text: '' };
  }
  let prev = start;
  while (prev > 0 && /\s/.test(text[prev - 1])) prev--;
  if (text[prev - 1] === ',') return { start: prev - 1, end, text: '' };
  if (ownLine && /^[ \t\r]*$/.test(text.slice(end, lineEnd(text, end)))) {
    return { start: lineStart(text, start), end: lineEnd(text, end) + 1, text: '' };
  }
  return { start, end, text: '' };
}

// ---------- rendering ----------

type Ctx = {
  /** 'afterKey': value follows "key:" on the same line (YAML block); 'column': value starts at `col`. */
  mode: 'afterKey' | 'column';
  col: number;
  lineIndent: string;
  flow: boolean;
  pretty: boolean;
  ownLine: boolean;
};

type Slice = { text: string; col: number; lineIndent: string };

function contextAt(text: string, offset: number, flow: boolean, pretty: boolean): Ctx {
  const before = text.slice(lineStart(text, offset), offset);
  return {
    mode: !flow && /:\s*$/.test(before) ? 'afterKey' : 'column',
    col: before.length + 1,
    lineIndent: indentAt(text, offset),
    flow,
    pretty,
    ownLine: /^\s*$/.test(before),
  };
}

/** Source text of a node, reusable only when both documents share the format. */
function sliceOf(src: PatchDoc, tgt: PatchDoc, range: Range): Slice | undefined {
  if (src.format !== tgt.format) return undefined;
  const start = toOffset(src.text, range.start);
  return { text: src.text.slice(start, toOffset(src.text, range.end)), col: range.start.col, lineIndent: indentAt(src.text, start) };
}

function renderValue(value: unknown, slice: Slice | undefined, tgt: PatchDoc, ctx: Ctx): string {
  const unit = indentUnit(tgt.text);
  const collection = value !== null && typeof value === 'object';

  if (tgt.format === 'json') {
    const raw = slice ? slice.text : JSON.stringify(value, null, ctx.pretty ? unit : undefined);
    return reindent(raw, slice ? slice.lineIndent.length : 0, ctx.lineIndent);
  }

  if (slice) {
    const block = collection && isBlock(slice.text);
    const unsafeInFlow = ctx.flow && (block || (typeof value === 'string' && !/^["']/.test(slice.text) && /[,[\]{}#]|: /.test(value)));
    if (!unsafeInFlow) {
      if (block) return placeBlock(reindent(slice.text, slice.col - 1, ''), ctx, unit);
      return reindent(slice.text, slice.lineIndent.length, ctx.lineIndent);
    }
  }

  if (!collection) {
    if (ctx.flow) return JSON.stringify(value);
    return reindent(stringify(value, { lineWidth: 0 }).trimEnd(), 0, ctx.lineIndent);
  }
  if (ctx.flow) return stringify(value, { collectionStyle: 'flow', flowCollectionPadding: false, lineWidth: 0 }).trimEnd();
  const block = stringify(value, { indent: unit, lineWidth: 0 }).trimEnd();
  return isBlock(block) ? placeBlock(block, ctx, unit) : block;
}

/** `text` has its continuation lines relative to column 1. */
function placeBlock(text: string, ctx: Ctx, unit: number): string {
  const lines = text.split('\n');
  if (ctx.mode === 'afterKey') {
    const child = ctx.lineIndent + ' '.repeat(unit);
    return '\n' + lines.map((l) => (l ? child + l : l)).join('\n');
  }
  const pad = ' '.repeat(ctx.col - 1);
  return lines.map((l, i) => (i === 0 || !l ? l : pad + l)).join('\n');
}

/** Moves continuation lines from an indentation of `fromWidth` to `toIndent`. */
function reindent(text: string, fromWidth: number, toIndent: string): string {
  return text
    .split('\n')
    .map((line, i) => {
      if (i === 0) return line;
      if (line.trim() === '') return '';
      const head = line.slice(0, fromWidth);
      return head.trim() === '' ? toIndent + line.slice(fromWidth) : line;
    })
    .join('\n');
}

function isBlock(text: string): boolean {
  return !/^[[{]/.test(text);
}

function isFlow(text: string, node: Node): boolean {
  return node.kind !== 'scalar' && /[[{]/.test(text[toOffset(text, node.range.start)] ?? '');
}

function spansLines(range: Range): boolean {
  return range.start.line !== range.end.line;
}

function indentUnit(text: string): number {
  let unit = 0;
  for (const line of text.split('\n')) {
    const n = /^ */.exec(line)![0].length;
    if (n > 0 && line.trim() && (unit === 0 || n < unit)) unit = n;
  }
  return unit || 2;
}

// ---------- verification ----------

function locate(text: string, doc: PatchDoc, path: Path): Node | undefined {
  const r = parse(text, doc.format);
  if (!r.ok) return undefined;
  const root = selectNode(r.node, doc.rootPath);
  return root && selectNode(root, path);
}

function expectValue(doc: PatchDoc, path: Path, value: unknown): (text: string) => boolean {
  const expected = JSON.stringify(value);
  return (text) => {
    const n = locate(text, doc, path);
    return n !== undefined && JSON.stringify(toPlain(n)) === expected;
  };
}
