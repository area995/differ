import { fieldValue } from './arrays';
import type { Node, Path, PathSeg } from './model';

export type PathResult = { ok: true; path: Path } | { ok: false; error: string };

const DOT = /^\.([^.[\]]+)/;
const INDEX = /^\[(\d+)\]/;
const QUOTED = /^\["((?:[^"\\]|\\.)*)"\]/;
const FIELD = /^\[([^\]=]+)=([^\]]*)\]/;

/** Parses the syntax produced by formatPath; the leading "$" is optional. */
export function parsePath(text: string): PathResult {
  const source = text.trim();
  const invalid: PathResult = { ok: false, error: `Root non valida: ${source}` };
  let rest = source.startsWith('$') ? source.slice(1) : source;
  if (rest && !rest.startsWith('.') && !rest.startsWith('[')) rest = `.${rest}`;
  const path: Path = [];
  try {
    while (rest) {
      let m: RegExpExecArray | null;
      if ((m = DOT.exec(rest))) path.push(m[1]);
      else if ((m = INDEX.exec(rest))) path.push(Number(m[1]));
      else if ((m = QUOTED.exec(rest))) path.push(JSON.parse(`"${m[1]}"`) as string);
      else if ((m = FIELD.exec(rest))) path.push({ field: m[1], value: m[2] });
      else return invalid;
      rest = rest.slice(m[0].length);
    }
  } catch {
    return invalid; // bad escape inside a quoted key
  }
  return { ok: true, path };
}

export type PathListResult = { ok: true; paths: Path[] } | { ok: false; error: string };

/** Parses comma- or newline-separated paths; empty parts are ignored. */
export function parsePathList(text: string): PathListResult {
  const paths: Path[] = [];
  for (const part of splitList(text)) {
    const r = parsePath(part);
    if (!r.ok) return { ok: false, error: `Includi non valido: ${part}` };
    paths.push(r.path);
  }
  return { ok: true, paths };
}

/** Splits on commas and newlines outside brackets and quotes. */
function splitList(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '\\') {
        current += c + (text[i + 1] ?? '');
        i++;
        continue;
      }
      if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if ((c === ',' || c === '\n') && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export type Scoped = { a: Node; b: Node; inA: boolean; inB: boolean };

/** Uses the node at `path` in each document that has it, the whole document otherwise. */
export function applyRoot(a: Node, b: Node, path: Path): Scoped {
  const rootA = path.length ? selectNode(a, path) : undefined;
  const rootB = path.length ? selectNode(b, path) : undefined;
  return { a: rootA ?? a, b: rootB ?? b, inA: !!rootA, inB: !!rootB };
}

export function selectNode(node: Node, path: Path): Node | undefined {
  let current: Node | undefined = node;
  for (const seg of path) {
    if (!current) return undefined;
    current = step(current, seg);
  }
  return current;
}

function step(node: Node, seg: PathSeg): Node | undefined {
  if (typeof seg === 'string') {
    return node.kind === 'object' ? node.entries.find((e) => e.key === seg)?.value : undefined;
  }
  if (node.kind !== 'array') return undefined;
  if (typeof seg === 'number') return node.items[seg];
  return node.items.find((item) => fieldValue(item, seg.field) === seg.value);
}
