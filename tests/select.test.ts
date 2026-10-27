import { describe, expect, it } from 'vitest';
import { formatPath, toPlain, type Path } from '../src/core/model';
import { applyRoot, parsePath, parsePathList, selectNode } from '../src/core/select';
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

describe('applyRoot', () => {
  const wrapped = node('config:\n  a: 1\n');
  const bare = node('a: 2\n');

  it('uses the root value only in the file that has it', () => {
    const s = applyRoot(wrapped, bare, ['config']);
    expect(toPlain(s.a)).toEqual({ a: 1 });
    expect(s.b).toBe(bare);
    expect([s.inA, s.inB]).toEqual([true, false]);
    expect(applyRoot(bare, wrapped, ['config'])).toMatchObject({ a: bare, inA: false, inB: true });
  });

  it('uses the root value in both files when both have it', () => {
    const s = applyRoot(wrapped, node('config:\n  a: 3\n'), ['config']);
    expect([toPlain(s.a), toPlain(s.b)]).toEqual([{ a: 1 }, { a: 3 }]);
    expect([s.inA, s.inB]).toEqual([true, true]);
  });

  it('falls back to the whole documents when the root is missing or empty', () => {
    expect(applyRoot(wrapped, bare, ['nope'])).toEqual({ a: wrapped, b: bare, inA: false, inB: false });
    expect(applyRoot(wrapped, bare, [])).toEqual({ a: wrapped, b: bare, inA: false, inB: false });
  });
});

describe('parsePathList', () => {
  const paths = (text: string) => {
    const r = parsePathList(text);
    if (!r.ok) throw new Error(r.error);
    return r.paths;
  };

  it('returns no paths for empty input', () => {
    expect(paths('  ')).toEqual([]);
  });

  it('splits on commas and newlines, dropping empty parts', () => {
    expect(paths('server, db.pool\r\n\nlogging,,')).toEqual([['server'], ['db', 'pool'], ['logging']]);
  });

  it('does not split inside brackets or quotes', () => {
    expect(paths('["a,b"], users[name=x,y]')).toEqual([['a,b'], ['users', { field: 'name', value: 'x,y' }]]);
  });

  it('reports the first invalid part', () => {
    expect(parsePathList('a, b[')).toEqual({ ok: false, error: 'Includi non valido: b[' });
  });
});
