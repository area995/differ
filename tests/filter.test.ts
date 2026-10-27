import { describe, expect, it } from 'vitest';
import { diff } from '../src/core/diff';
import { filterEntries } from '../src/core/filter';
import { DEFAULT_OPTIONS, formatPath, type DiffEntry } from '../src/core/model';
import { node } from './helpers';

const summary = (es: DiffEntry[]) => es.map((e) => `${e.kind} ${formatPath(e.path)}`);

const entries = diff(
  node('server: {port: 1, tls: true}\ndb: {pool: 5}\nname: a\n'),
  node('server: {port: 2, tls: false}\nname: b\n'),
  DEFAULT_OPTIONS,
);

describe('filterEntries', () => {
  it('keeps everything without includes', () => {
    expect(filterEntries(entries, [])).toBe(entries);
  });

  it('keeps entries inside the included subtrees', () => {
    expect(summary(filterEntries(entries, [['server', 'port'], ['name']]))).toEqual([
      'changed $.server.port',
      'changed $.name',
    ]);
    expect(summary(filterEntries(entries, [['server']]))).toEqual(['changed $.server.port', 'changed $.server.tls']);
  });

  it('keeps structural changes on ancestors of an include', () => {
    expect(summary(filterEntries(entries, [['db', 'pool']]))).toEqual(['removed $.db']);
    const rootType: DiffEntry = { kind: 'type', path: [] };
    expect(filterEntries([rootType], [['x']])).toEqual([rootType]);
  });

  it('drops whitespace and moved entries on ancestors', () => {
    const es: DiffEntry[] = [
      { kind: 'moved', path: ['db'] },
      { kind: 'whitespace', path: ['db'] },
      { kind: 'changed', path: ['db', 'pool', 'x'] },
    ];
    expect(summary(filterEntries(es, [['db', 'pool']]))).toEqual(['changed $.db.pool.x']);
  });

  it('matches field selectors by field and value', () => {
    const e: DiffEntry = { kind: 'changed', path: ['users', { field: 'name', value: 'bob' }, 'role'] };
    expect(filterEntries([e], [['users', { field: 'name', value: 'bob' }]])).toEqual([e]);
    expect(filterEntries([e], [['users', { field: 'name', value: 'alice' }]])).toEqual([]);
  });
});
