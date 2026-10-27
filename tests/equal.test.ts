import { describe, expect, it } from 'vitest';
import { nodeEqual, scalarEqual, scalarType } from '../src/core/equal';
import { node } from './helpers';

describe('scalarEqual', () => {
  it('is strict by default', () => {
    expect(scalarEqual(8080, 8080, false)).toBe(true);
    expect(scalarEqual(8080, '8080', false)).toBe(false);
    expect(scalarEqual(null, 'null', false)).toBe(false);
  });

  it('normalizes numbers, booleans and null when loose', () => {
    expect(scalarEqual(8080, '8080', true)).toBe(true);
    expect(scalarEqual(1, '1.0', true)).toBe(true);
    expect(scalarEqual(true, 'TRUE', true)).toBe(true);
    expect(scalarEqual(null, 'null', true)).toBe(true);
    expect(scalarEqual(null, '', true)).toBe(false);
    expect(scalarEqual('abc', 'abd', true)).toBe(false);
  });
});

describe('scalarType', () => {
  it('names scalar types', () => {
    expect([scalarType(1), scalarType('a'), scalarType(true), scalarType(null)]).toEqual([
      'number',
      'string',
      'boolean',
      'null',
    ]);
  });
});

describe('nodeEqual', () => {
  it('ignores object key order', () => {
    expect(nodeEqual(node('{a: 1, b: [1, 2]}'), node('{b: [1, 2], a: 1}'), false)).toBe(true);
  });

  it('respects array order and length', () => {
    expect(nodeEqual(node('[1, 2]'), node('[2, 1]'), false)).toBe(false);
    expect(nodeEqual(node('[1]'), node('[1, 1]'), false)).toBe(false);
  });

  it('applies loose comparison to nested scalars', () => {
    expect(nodeEqual(node('{a: 1}'), node('{a: "1"}'), false)).toBe(false);
    expect(nodeEqual(node('{a: 1}'), node('{a: "1"}'), true)).toBe(true);
  });
});
