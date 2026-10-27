import type { Format, Node } from '../src/core/model';
import { parse } from '../src/core/parse';

export function node(text: string, format: Format = 'yaml'): Node {
  const r = parse(text, format);
  if (!r.ok) throw new Error(`${r.error.pos.line}:${r.error.pos.col} ${r.error.message}`);
  return r.node;
}

export function items(text: string): Node[] {
  const n = node(text);
  if (n.kind !== 'array') throw new Error('expected an array');
  return n.items;
}
