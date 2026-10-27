import { describe, expect, it } from 'vitest';
import { diff } from '../src/core/diff';
import { DEFAULT_OPTIONS, formatPath, type DiffEntry, type DiffOptions, type Format } from '../src/core/model';
import { applyEntry, patchSupport, type Direction, type PatchDoc } from '../src/core/patch';
import { applyRoot } from '../src/core/select';
import { node } from './helpers';

function doc(text: string, format: Format = 'yaml'): PatchDoc {
  return { text, format, node: node(text, format), rootPath: [] };
}

function entry(a: PatchDoc, b: PatchDoc, label: string, opts: Partial<DiffOptions> = {}): DiffEntry {
  const all = diff(a.node, b.node, { ...DEFAULT_OPTIONS, ...opts }, { a: a.text, b: b.text });
  const found = all.find((e) => `${e.kind} ${formatPath(e.path)}` === label);
  if (!found) throw new Error(`no "${label}" in: ${all.map((e) => `${e.kind} ${formatPath(e.path)}`).join(', ')}`);
  return found;
}

function patched(a: PatchDoc, b: PatchDoc, label: string, dir: Direction, opts: Partial<DiffOptions> = {}): string {
  const r = applyEntry(entry(a, b, label, opts), dir, a, b);
  if (!r.ok) throw new Error(r.error);
  return r.text;
}

describe('applyEntry on YAML', () => {
  it('replaces a scalar value and reports the edit', () => {
    const a = doc('a: 1\nb: x\n');
    const b = doc('a: 2\nb: x\n');
    const r = applyEntry(entry(a, b, 'changed $.a'), 'aToB', a, b);
    expect(r).toEqual({ ok: true, text: 'a: 1\nb: x\n', edit: { start: 3, end: 4, text: '1' } });
    expect(patched(a, b, 'changed $.a', 'bToA')).toBe('a: 2\nb: x\n');
  });

  it('keeps source quoting and target comments', () => {
    const a = doc("name: 'svc'  # n\nport: 1\n");
    const b = doc('name: "old" # keep\nport: 1\n');
    expect(patched(a, b, 'changed $.name', 'aToB')).toBe("name: 'svc' # keep\nport: 1\n");
  });

  it('replaces a scalar with a block mapping', () => {
    const a = doc('a:\n  x: 1\n  y: 2\nb: 1\n');
    const b = doc('a: 5\nb: 1\n');
    expect(patched(a, b, 'type $.a', 'aToB')).toBe('a:\n  x: 1\n  y: 2\nb: 1\n');
  });

  it('replaces a block mapping with a scalar on the key line', () => {
    const a = doc('a:\n  x: 1\n  y: 2\nb: 1\n');
    const b = doc('a: 5\nb: 1\n');
    expect(patched(a, b, 'type $.a', 'bToA')).toBe('a: 5\nb: 1\n');
  });

  it('inserts a key after the previous one', () => {
    const a = doc('a: 1\nb: 2\nc: 3\n');
    const b = doc('a: 1 # first\nc: 3\n');
    expect(patched(a, b, 'removed $.b', 'aToB')).toBe('a: 1 # first\nb: 2\nc: 3\n');
  });

  it('inserts after a key whose value is a block', () => {
    const a = doc('a:\n  x: 1\nb: 2\n');
    const b = doc('a:\n  x: 1\n');
    expect(patched(a, b, 'removed $.b', 'aToB')).toBe('a:\n  x: 1\nb: 2\n');
  });

  it('inserts a key at the top when no previous key exists', () => {
    const a = doc('z: 0\na: 1\n');
    const b = doc('a: 1\n');
    expect(patched(a, b, 'removed $.z', 'aToB')).toBe('z: 0\na: 1\n');
  });

  it('inserts a key with a nested block value', () => {
    const a = doc('a: 1\nsrv:\n  port: 1\n  host: x\n');
    const b = doc('a: 1\n');
    expect(patched(a, b, 'removed $.srv', 'aToB')).toBe('a: 1\nsrv:\n  port: 1\n  host: x\n');
  });

  it('inserts into a nested mapping using its indentation', () => {
    const a = doc('srv:\n    port: 1\n    host: x\n');
    const b = doc('srv:\n  port: 1\n');
    expect(patched(a, b, 'removed $.srv.host', 'aToB')).toBe('srv:\n  port: 1\n  host: x\n');
  });

  it('deletes a key with its subtree', () => {
    const a = doc('a: 1\nc: 2\n');
    const b = doc('a: 1\nb:\n  x: 1\nc: 2\n');
    expect(patched(a, b, 'added $.b', 'aToB')).toBe('a: 1\nc: 2\n');
  });

  it('inserts and deletes sequence items', () => {
    const a = doc('l:\n  - a\n  - b\n');
    const b = doc('l:\n  - a\n');
    expect(patched(a, b, 'removed $.l[1]', 'aToB')).toBe('l:\n  - a\n  - b\n');
    expect(patched(a, b, 'removed $.l[1]', 'bToA')).toBe('l:\n  - a\n');
  });

  it('inserts a mapping item into a sequence', () => {
    const a = doc('l:\n  - name: a\n    v: 1\n  - name: b\n    v: 2\n');
    const b = doc('l:\n  - name: a\n    v: 1\n');
    expect(patched(a, b, 'removed $.l[1]', 'aToB')).toBe('l:\n  - name: a\n    v: 1\n  - name: b\n    v: 2\n');
  });

  it('inserts and deletes in flow mappings', () => {
    const a = doc('a: {x: 1, y: 2}\n');
    const b = doc('a: {x: 1}\n');
    expect(patched(a, b, 'removed $.a.y', 'aToB')).toBe('a: {x: 1, y: 2}\n');
    expect(patched(a, b, 'removed $.a.y', 'bToA')).toBe('a: {x: 1}\n');
  });

  it('copies a whole line for whitespace differences', () => {
    const a = doc('a:\n  b: 1\n');
    const b = doc('a:\n    b: 1\n');
    expect(patched(a, b, 'whitespace $.a.b', 'aToB', { whitespace: true })).toBe('a:\n  b: 1\n');
  });

  it('quotes values coming from JSON when needed', () => {
    const a = doc('{"a": "1"}', 'json');
    const b = doc('a: 2\n');
    expect(patched(a, b, 'type $.a', 'aToB')).toBe('a: "1"\n');
  });

  it('renders JSON objects as YAML blocks', () => {
    const a = doc('{"a": 1, "srv": {"port": 1, "tags": ["x"]}}', 'json');
    const b = doc('a: 1\n');
    expect(patched(a, b, 'removed $.srv', 'aToB')).toBe('a: 1\nsrv:\n  port: 1\n  tags:\n    - x\n');
  });
});

describe('applyEntry on JSON', () => {
  it('replaces a scalar value', () => {
    const a = doc('{\n  "a": 1,\n  "b": 2\n}', 'json');
    const b = doc('{\n  "a": 5,\n  "b": 2\n}', 'json');
    expect(patched(a, b, 'changed $.a', 'aToB')).toBe(a.text);
  });

  it('inserts after the previous key in a multi-line object', () => {
    const a = doc('{\n  "a": 1,\n  "b": 2\n}', 'json');
    const b = doc('{\n  "a": 1\n}', 'json');
    expect(patched(a, b, 'removed $.b', 'aToB')).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('inserts at the top of a single-line object', () => {
    const a = doc('{"z": 0, "a": 1}', 'json');
    const b = doc('{"a": 1}', 'json');
    expect(patched(a, b, 'removed $.z', 'aToB')).toBe('{"z": 0, "a": 1}');
  });

  it('inserts into an empty object', () => {
    const a = doc('{"a": 1}', 'json');
    const b = doc('{}', 'json');
    expect(patched(a, b, 'removed $.a', 'aToB')).toBe('{"a": 1}');
  });

  it('deletes keys in the middle, at the end and at the start', () => {
    const three = doc('{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}', 'json');
    expect(patched(doc('{\n  "a": 1,\n  "c": 3\n}', 'json'), three, 'added $.b', 'aToB')).toBe(
      '{\n  "a": 1,\n  "c": 3\n}',
    );
    expect(patched(doc('{\n  "a": 1,\n  "b": 2\n}', 'json'), three, 'added $.c', 'aToB')).toBe(
      '{\n  "a": 1,\n  "b": 2\n}',
    );
    expect(patched(doc('{"b": 2}', 'json'), doc('{"a": 1, "b": 2}', 'json'), 'added $.a', 'aToB')).toBe(
      '{"b": 2}',
    );
  });

  it('deletes the only key of a multi-line object', () => {
    expect(patched(doc('{}', 'json'), doc('{\n  "a": 1\n}', 'json'), 'added $.a', 'aToB')).toBe('{\n}');
  });

  it('inserts an object coming from YAML with indentation', () => {
    const a = doc('a: 1\nsrv:\n  port: 1\n');
    const b = doc('{\n  "a": 1\n}', 'json');
    expect(patched(a, b, 'removed $.srv', 'aToB')).toBe('{\n  "a": 1,\n  "srv": {\n    "port": 1\n  }\n}');
  });

  it('inserts array items', () => {
    const a = doc('{"l": [1, 2, 3]}', 'json');
    const b = doc('{"l": [1, 2]}', 'json');
    expect(patched(a, b, 'removed $.l[2]', 'aToB')).toBe('{"l": [1, 2, 3]}');
    expect(patched(a, b, 'removed $.l[2]', 'bToA')).toBe('{"l": [1, 2]}');
  });
});

describe('applyEntry limits', () => {
  it('rejects edits it cannot verify', () => {
    const a = doc('l:\n  - x: 1\n');
    const b = doc('l:\n  - name: a\n    x: 1\n');
    expect(applyEntry(entry(a, b, 'added $.l[0].name'), 'aToB', a, b)).toEqual({
      ok: false,
      error: 'Impossibile riportare automaticamente questa modifica',
    });
  });

  it('rejects whitespace copies that would change the structure', () => {
    const a = doc('l:\n  - x: 1\n');
    const b = doc('l:\n  - name: a\n    x: 1\n');
    const line = (n: number) => ({ range: { start: { line: n, col: 1 }, end: { line: n, col: 1 } } });
    const e: DiffEntry = { kind: 'whitespace', path: ['l', 0, 'x'], a: line(2), b: line(3) };
    expect(applyEntry(e, 'aToB', a, b).ok).toBe(false);
  });

  it('works on the real paths when the root is applied to one side only', () => {
    const fullA = node('config:\n  port: 1\n  host: a\n');
    const fullB = node('port: 2\nhost: a\n');
    const scope = applyRoot(fullA, fullB, ['config']);
    const a: PatchDoc = { text: 'config:\n  port: 1\n  host: a\n', format: 'yaml', node: scope.a, rootPath: ['config'] };
    const b: PatchDoc = { text: 'port: 2\nhost: a\n', format: 'yaml', node: scope.b, rootPath: [] };
    expect(patched(a, b, 'changed $.port', 'aToB')).toBe('port: 1\nhost: a\n');
    expect(patched(a, b, 'changed $.port', 'bToA')).toBe('config:\n  port: 2\n  host: a\n');
  });
});

describe('patchSupport', () => {
  const y = doc('a: 1\n');
  const j = doc('{"a": 1}', 'json');

  it('allows regular entries', () => {
    expect(patchSupport({ kind: 'changed', path: ['a'] }, y, y, false)).toBeNull();
  });

  it('explains why an entry cannot be applied', () => {
    expect(patchSupport({ kind: 'moved', path: ['a'] }, y, y, false)).toMatch(/spostate/);
    expect(patchSupport({ kind: 'whitespace', path: ['a'] }, y, j, false)).toMatch(/stesso formato/);
    expect(patchSupport({ kind: 'changed', path: ['l', 0] }, y, y, true)).toMatch(/Ignora ordine array/);
  });
});
