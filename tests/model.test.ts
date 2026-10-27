import { describe, expect, it } from 'vitest';
import { formatPath, toPlain, type Node } from '../src/core/model';

const r = { start: { line: 1, col: 1 }, end: { line: 1, col: 1 } };

describe('formatPath', () => {
  it('formats the root', () => {
    expect(formatPath([])).toBe('$');
  });

  it('formats keys, indexes, quoted keys and field selectors', () => {
    expect(formatPath(['server', 'ports', 0, 'a b', { field: 'name', value: 'alice' }])).toBe(
      '$.server.ports[0]["a b"][name=alice]',
    );
  });
});

describe('toPlain', () => {
  it('converts a node tree to plain JS values', () => {
    const n: Node = {
      kind: 'object',
      range: r,
      entries: [
        {
          key: 'a',
          keyRange: r,
          value: { kind: 'array', range: r, items: [{ kind: 'scalar', range: r, value: 1 }] },
        },
      ],
    };
    expect(toPlain(n)).toEqual({ a: [1] });
  });
});
