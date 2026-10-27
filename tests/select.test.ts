import { describe, expect, it } from 'vitest';
import { formatPath, toPlain, type Path } from '../src/core/model';
import { parsePath, selectNode } from '../src/core/select';
import { node } from './helpers';

function path(text: string): Path {
  const r = parsePath(text);
  if (!r.ok) throw new Error(r.error);
  return r.path;
}

describe('parsePath', () => {
  it('treats empty input and "$" as the document root', () => {
    expect(path('')).toEqual([]);
    expect(path('  $ ')).toEqual([]);
  });

  it('accepts paths with or without the leading "$"', () => {
    expect(path('server.config')).toEqual(['server', 'config']);
    expect(path('$.server.config')).toEqual(['server', 'config']);
    expect(path('.server')).toEqual(['server']);
  });

  it('parses indexes, quoted keys and field selectors', () => {
    expect(path('$.a[0]["x.y"][name=alice]')).toEqual(['a', 0, 'x.y', { field: 'name', value: 'alice' }]);
  });

  it('accepts any character except dots and brackets after a dot', () => {
    expect(path('my key.1')).toEqual(['my key', '1']);
  });

  it('round-trips formatPath output', () => {
    const p: Path = ['a', 0, 'x.y', 'a b', { field: 'name', value: 'alice' }];
    expect(path(formatPath(p))).toEqual(p);
  });

  it('rejects malformed paths', () => {
    for (const bad of ['a[', 'a..b', 'a.', 'a[x', '["\\q"]']) {
      expect(parsePath(bad)).toEqual({ ok: false, error: `Root non valida: ${bad}` });
    }
  });
});

describe('selectNode', () => {
  const doc = node('server:\n  ports: [80, 443]\nusers: [{name: alice, role: admin}]\n');

  it('returns the whole document for an empty path', () => {
    expect(selectNode(doc, [])).toBe(doc);
  });

  it('follows keys, indexes and field selectors', () => {
    expect(toPlain(selectNode(doc, ['server', 'ports', 1])!)).toBe(443);
    expect(toPlain(selectNode(doc, ['users', { field: 'name', value: 'alice' }, 'role'])!)).toBe('admin');
  });

  it('returns undefined for missing or mismatched segments', () => {
    expect(selectNode(doc, ['missing'])).toBeUndefined();
    expect(selectNode(doc, ['server', 0])).toBeUndefined();
    expect(selectNode(doc, ['users', { field: 'name', value: 'bob' }])).toBeUndefined();
    expect(selectNode(doc, ['server', 'ports', 1, 'x'])).toBeUndefined();
  });
});
