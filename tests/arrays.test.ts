import { describe, expect, it } from 'vitest';
import { matchArrays } from '../src/core/arrays';
import { items } from './helpers';

const base = { ignoreArrayOrder: false, arrayKeyField: '', looseTypes: false };

describe('matchArrays', () => {
  it('matches by index by default', () => {
    const m = matchArrays(items('[1, 2, 3]'), items('[1, 5]'), base);
    expect(m.pairs).toEqual([
      { a: 0, b: 0, seg: 0 },
      { a: 1, b: 1, seg: 1 },
    ]);
    expect(m.onlyA).toEqual([{ index: 2, seg: 2 }]);
    expect(m.onlyB).toEqual([]);
  });

  it('matches equal elements regardless of order', () => {
    const m = matchArrays(items('[1, 2, 3]'), items('[3, 1, 2]'), { ...base, ignoreArrayOrder: true });
    expect(m.pairs).toEqual([
      { a: 0, b: 1, seg: 0 },
      { a: 1, b: 2, seg: 1 },
      { a: 2, b: 0, seg: 2 },
    ]);
    expect(m.onlyA).toEqual([]);
    expect(m.onlyB).toEqual([]);
  });

  it('pairs leftovers so they show up as changes', () => {
    const m = matchArrays(items('[1, 2]'), items('[2, 9]'), { ...base, ignoreArrayOrder: true });
    expect(m.pairs).toEqual([
      { a: 0, b: 1, seg: 0 },
      { a: 1, b: 0, seg: 1 },
    ]);
  });

  it('matches objects by key field', () => {
    const m = matchArrays(
      items('[{name: a, v: 1}, {name: b, v: 2}]'),
      items('[{name: b, v: 2}, {name: c, v: 3}, {name: a, v: 9}]'),
      { ...base, ignoreArrayOrder: true, arrayKeyField: 'name' },
    );
    expect(m.pairs).toEqual([
      { a: 0, b: 2, seg: { field: 'name', value: 'a' } },
      { a: 1, b: 0, seg: { field: 'name', value: 'b' } },
    ]);
    expect(m.onlyA).toEqual([]);
    expect(m.onlyB).toEqual([{ index: 1, seg: { field: 'name', value: 'c' } }]);
  });
});
