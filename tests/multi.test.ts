import { describe, expect, it } from 'vitest';
import { diff } from '../src/core/diff';
import { DEFAULT_OPTIONS, type Format } from '../src/core/model';
import { buildMatrix, type MatrixRow } from '../src/core/multi';
import type { PatchDoc } from '../src/core/patch';
import { node } from './helpers';

function doc(text: string, format: Format = 'yaml'): PatchDoc {
  return { text, format, node: node(text, format), rootPath: [] };
}

function matrix(base: PatchDoc, files: PatchDoc[]): MatrixRow[] {
  return buildMatrix(
    base,
    files,
    files.map((f) => diff(base.node, f.node, DEFAULT_OPTIONS)),
  );
}

const show = (rows: MatrixRow[]) =>
  rows.map((r) => [
    r.label,
    r.base.present ? JSON.stringify(r.base.value) : '—',
    ...r.cells.map((c) => `${c.status}${c.inherited ? '*' : ''}:${c.present ? JSON.stringify(c.value) : '—'}`),
  ]);

describe('buildMatrix', () => {
  it('groups the differences of every file by path, in base order', () => {
    const base = doc('a: 1\nb: 2\nc: 3\n');
    const rows = matrix(base, [doc('a: 1\nb: 5\nc: 3\n'), doc('a: 9\nc: 3\nd: 4\n')]);
    expect(show(rows)).toEqual([
      ['$.a', '1', 'equal:1', 'changed:9'],
      ['$.b', '2', 'changed:5', 'removed:—'],
      ['$.d', '—', 'equal:—', 'added:4'],
    ]);
  });

  it('keeps the entry behind each differing cell', () => {
    const base = doc('a: 1\n');
    const b = doc('a: 2\n');
    const [row] = matrix(base, [b]);
    expect(row.cells[0].entry).toEqual(diff(base.node, b.node, DEFAULT_OPTIONS)[0]);
  });

  it('marks cells whose difference is on an ancestor', () => {
    const base = doc('db:\n  pool: 5\n  user: a\n');
    const rows = matrix(base, [doc('other: 1\n'), doc('db:\n  pool: 9\n  user: a\n')]);
    expect(show(rows)).toEqual([
      ['$.db', '{"pool":5,"user":"a"}', 'removed:—', 'equal:{"pool":9,"user":"a"}'],
      ['$.other', '—', 'added:1', 'equal:—'],
      ['$.db.pool', '5', 'removed*:—', 'changed:9'],
    ]);
  });

  it('returns no rows when every file matches the base', () => {
    const base = doc('a: 1\n');
    expect(matrix(base, [doc('a: 1\n'), doc('{"a": 1}', 'json')])).toEqual([]);
  });
});
