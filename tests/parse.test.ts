import { describe, expect, it } from 'vitest';
import { toPlain } from '../src/core/model';
import { parse } from '../src/core/parse';
import { node } from './helpers';

function error(text: string, format: 'json' | 'yaml') {
  const r = parse(text, format);
  if (r.ok) throw new Error('expected a parse error');
  return r.error;
}

describe('parse JSON', () => {
  it('builds a tree with 1-based positions', () => {
    const n = node('{\n  "a": 1,\n  "b": [true, null]\n}', 'json');
    expect(toPlain(n)).toEqual({ a: 1, b: [true, null] });
    if (n.kind !== 'object') throw new Error('expected object');
    expect(n.entries.map((e) => e.key)).toEqual(['a', 'b']);
    expect(n.entries[0].keyRange.start).toEqual({ line: 2, col: 3 });
    expect(n.entries[1].value.range.start).toEqual({ line: 3, col: 8 });
  });

  it('rejects trailing commas with a position', () => {
    const e = error('{\n  "a": 1,\n}', 'json');
    expect(e.pos.line).toBe(3);
  });

  it('rejects duplicate keys', () => {
    expect(error('{"a": 1, "a": 2}', 'json').message).toMatch(/unique/i);
  });
});

describe('parse YAML', () => {
  it('builds a tree with positions', () => {
    const n = node('server:\n  port: 8080\n  hosts:\n    - a\n    - b\n');
    expect(toPlain(n)).toEqual({ server: { port: 8080, hosts: ['a', 'b'] } });
    if (n.kind !== 'object' || n.entries[0].value.kind !== 'object') throw new Error('expected objects');
    expect(n.entries[0].value.entries[0].value.range.start).toEqual({ line: 2, col: 9 });
  });

  it('trims trailing whitespace from range ends', () => {
    const n = node('a:\n  b: 1\nc: 2\n');
    if (n.kind !== 'object') throw new Error('expected object');
    expect(n.entries[0].value.range.end.line).toBe(2);
  });

  it('rejects duplicate keys', () => {
    expect(error('a: 1\na: 2\n', 'yaml').message).toMatch(/unique/i);
  });

  it('rejects multi-document streams', () => {
    const e = error('a: 1\n---\nb: 2\n', 'yaml');
    expect(e.message).toContain('multi-documento');
    expect(e.pos.line).toBe(2);
  });

  it('rejects syntax errors', () => {
    expect(parse('a: [1, 2\n', 'yaml').ok).toBe(false);
  });

  it('expands aliases using the alias position', () => {
    const n = node('base: &b\n  x: 1\nother: *b\n');
    expect(toPlain(n)).toEqual({ base: { x: 1 }, other: { x: 1 } });
    if (n.kind !== 'object') throw new Error('expected object');
    expect(n.entries[1].value.range.start.line).toBe(3);
  });

  it('stringifies non-string keys', () => {
    const n = node('1: a\ntrue: b\n');
    if (n.kind !== 'object') throw new Error('expected object');
    expect(n.entries.map((e) => e.key)).toEqual(['1', 'true']);
  });

  it('treats empty or comment-only documents as null', () => {
    expect(toPlain(node('# only a comment\n'))).toBeNull();
    expect(toPlain(node(''))).toBeNull();
  });

  it('treats a missing value as null', () => {
    expect(toPlain(node('a:\nb: 1\n'))).toEqual({ a: null, b: 1 });
  });
});
