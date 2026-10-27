export type Format = 'json' | 'yaml';

/** 1-based line and column. */
export type Pos = { line: number; col: number };
export type Range = { start: Pos; end: Pos };

export type ScalarValue = string | number | boolean | null;

export type Entry = { key: string; keyRange: Range; value: Node };

export type Node =
  | { kind: 'object'; range: Range; entries: Entry[] }
  | { kind: 'array'; range: Range; items: Node[] }
  | { kind: 'scalar'; range: Range; value: ScalarValue };

export type ObjectNode = Extract<Node, { kind: 'object' }>;
export type ArrayNode = Extract<Node, { kind: 'array' }>;

export type PathSeg = string | number | { field: string; value: string };
export type Path = PathSeg[];

export type DiffKind = 'added' | 'removed' | 'changed' | 'type' | 'moved' | 'whitespace';

export type Side = { value?: unknown; range: Range };

export type DiffEntry = {
  kind: DiffKind;
  path: Path;
  /** Missing for 'added'. */
  a?: Side;
  /** Missing for 'removed'. */
  b?: Side;
  detail?: string;
};

export type DiffOptions = {
  keys: boolean;
  values: boolean;
  whitespace: boolean;
  keyOrder: boolean;
  ignoreArrayOrder: boolean;
  arrayKeyField: string;
  looseTypes: boolean;
};

export const DEFAULT_OPTIONS: DiffOptions = {
  keys: true,
  values: true,
  whitespace: false,
  keyOrder: false,
  ignoreArrayOrder: false,
  arrayKeyField: '',
  looseTypes: false,
};

export type ParseError = { message: string; pos: Pos };
export type ParseResult = { ok: true; node: Node } | { ok: false; error: ParseError };

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$-]*$/;

export function formatPath(path: Path): string {
  let out = '$';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else if (typeof seg === 'string') out += IDENT.test(seg) ? `.${seg}` : `[${JSON.stringify(seg)}]`;
    else out += `[${seg.field}=${seg.value}]`;
  }
  return out;
}

export function toPlain(node: Node): unknown {
  switch (node.kind) {
    case 'scalar':
      return node.value;
    case 'array':
      return node.items.map(toPlain);
    case 'object':
      return Object.fromEntries(node.entries.map((e) => [e.key, toPlain(e.value)]));
  }
}
