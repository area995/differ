import { describe, expect, it } from 'vitest';
import { diff } from '../src/core/diff';
import { DEFAULT_OPTIONS as O, formatPath, type DiffEntry } from '../src/core/model';
import { node } from './helpers';

const summary = (es: DiffEntry[]) => es.map((e) => `${e.kind} ${formatPath(e.path)}`);

describe('diff', () => {
  it('finds no differences between equivalent JSON and YAML', () => {
    expect(diff(node('a: 1\nb: [1, 2]\n'), node('{"b": [1, 2], "a": 1}', 'json'), O)).toEqual([]);
  });

  const A = 'a: 1\nb: 2\nc: {x: 1}\n';
  const B = 'a: 1\nb: 3\nd: 4\n';

  it('reports added, removed and changed keys', () => {
    expect(summary(diff(node(A), node(B), O))).toEqual(['changed $.b', 'removed $.c', 'added $.d']);
  });

  it('reports keys only', () => {
    expect(summary(diff(node(A), node(B), { ...O, values: false }))).toEqual(['removed $.c', 'added $.d']);
  });

  it('reports values only', () => {
    expect(summary(diff(node(A), node(B), { ...O, keys: false }))).toEqual(['changed $.b']);
  });

  it('carries values and ranges', () => {
    const [changed, removed] = diff(node('a: 1\nb:\n  x: 1\n'), node('a: 2\n'), O);
    expect(changed.a?.value).toBe(1);
    expect(changed.b?.value).toBe(2);
    expect(removed.a?.value).toEqual({ x: 1 });
    expect(removed.a?.range.start.line).toBe(2);
    expect(removed.a?.range.end.line).toBe(3);
  });

  it('reports scalar type changes unless loose', () => {
    const es = diff(node('port: 8080\n'), node('port: "8080"\n'), O);
    expect(summary(es)).toEqual(['type $.port']);
    expect(es[0].detail).toBe('number → string');
    expect(diff(node('port: 8080\n'), node('port: "8080"\n'), { ...O, looseTypes: true })).toEqual([]);
  });

  it('reports collection vs scalar as a type change', () => {
    const es = diff(node('a: [1]\n'), node('a: 1\n'), O);
    expect(summary(es)).toEqual(['type $.a']);
    expect(es[0].detail).toBe('array → number');
  });

  it('reports moved keys only when asked', () => {
    const a = node('a: 1\nb: 2\nc: 3\n');
    const b = node('b: 2\nc: 3\na: 1\n');
    expect(diff(a, b, O)).toEqual([]);
    const es = diff(a, b, { ...O, keyOrder: true });
    expect(summary(es)).toEqual(['moved $.a']);
    expect(es[0].detail).toBe('posizione 1 → 3');
  });

  it('compares arrays by index or ignoring order', () => {
    const a = node('l: [1, 2, 3]\n');
    const b = node('l: [0, 1, 2, 3]\n');
    expect(summary(diff(a, b, O))).toEqual(['changed $.l[0]', 'changed $.l[1]', 'changed $.l[2]', 'added $.l[3]']);
    expect(summary(diff(a, b, { ...O, ignoreArrayOrder: true }))).toEqual(['added $.l[0]']);
  });

  it('compares array objects by key field', () => {
    const a = node('users: [{name: alice, role: admin}, {name: bob, role: dev}]\n');
    const b = node('users: [{name: bob, role: ops}, {name: alice, role: admin}]\n');
    const opts = { ...O, ignoreArrayOrder: true, arrayKeyField: 'name' };
    expect(summary(diff(a, b, opts))).toEqual(['changed $.users[name=bob].role']);
  });

  it('reports whitespace differences only with raw texts', () => {
    const ta = 'a:\n  b: 1\n  c: 2\n';
    const tb = 'a:\n    b: 1\n    c: 2\n';
    const opts = { ...O, whitespace: true };
    expect(diff(node(ta), node(tb), opts)).toEqual([]);
    const es = diff(node(ta), node(tb), opts, { a: ta, b: tb });
    expect(summary(es)).toEqual(['whitespace $.a.b', 'whitespace $.a.c']);
    expect(es[0].detail).toBe('indentazione 2 → 4');
    expect(es[0].a?.range.start.line).toBe(2);
  });

  it('does not report whitespace on changed values', () => {
    const ta = 'a:  1\n';
    const tb = 'a: 2\n';
    expect(summary(diff(node(ta), node(tb), { ...O, whitespace: true }, { a: ta, b: tb }))).toEqual(['changed $.a']);
  });
});
