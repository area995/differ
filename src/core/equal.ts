import type { Node, ScalarValue } from './model';

export type ScalarType = 'string' | 'number' | 'boolean' | 'null';

export function scalarType(v: ScalarValue): ScalarType {
  return v === null ? 'null' : (typeof v as Exclude<ScalarType, 'null'>);
}

export function scalarEqual(x: ScalarValue, y: ScalarValue, loose: boolean): boolean {
  if (x === y) return true;
  return loose && normalize(x) === normalize(y);
}

function normalize(v: ScalarValue): string {
  if (typeof v !== 'string') return String(v);
  const t = v.trim();
  if (t === '') return '';
  const lower = t.toLowerCase();
  if (lower === 'true' || lower === 'false' || lower === 'null') return lower;
  const n = Number(t);
  return Number.isNaN(n) ? v : String(n);
}

export function nodeEqual(a: Node, b: Node, loose: boolean): boolean {
  if (a.kind === 'scalar' && b.kind === 'scalar') return scalarEqual(a.value, b.value, loose);
  if (a.kind === 'array' && b.kind === 'array') {
    return a.items.length === b.items.length && a.items.every((x, i) => nodeEqual(x, b.items[i], loose));
  }
  if (a.kind === 'object' && b.kind === 'object') {
    if (a.entries.length !== b.entries.length) return false;
    const valuesB = new Map(b.entries.map((e) => [e.key, e.value]));
    return a.entries.every((e) => {
      const v = valuesB.get(e.key);
      return v !== undefined && nodeEqual(e.value, v, loose);
    });
  }
  return false;
}
