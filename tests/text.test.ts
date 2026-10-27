import { describe, expect, it } from 'vitest';
import { indentAt, lineEnd, lineStart, toOffset } from '../src/core/text';

const text = 'a: 1\n  b: 2\n\nc: 3';

describe('toOffset', () => {
  it('converts 1-based positions to offsets', () => {
    expect(toOffset(text, { line: 1, col: 1 })).toBe(0);
    expect(toOffset(text, { line: 2, col: 3 })).toBe(7);
    expect(toOffset(text, { line: 4, col: 4 })).toBe(15);
  });

  it('clamps positions past the end', () => {
    expect(toOffset(text, { line: 9, col: 1 })).toBe(text.length);
    expect(toOffset(text, { line: 4, col: 99 })).toBe(text.length);
  });
});

describe('line helpers', () => {
  it('finds line boundaries', () => {
    expect(lineStart(text, 0)).toBe(0);
    expect(lineStart(text, 8)).toBe(5);
    expect(lineEnd(text, 8)).toBe(11);
    expect(lineEnd(text, 14)).toBe(text.length);
  });

  it('handles a leading newline', () => {
    expect(lineStart('\nx', 0)).toBe(0);
    expect(lineStart('\nx', 1)).toBe(1);
  });

  it('returns the indentation of the line containing an offset', () => {
    expect(indentAt(text, 9)).toBe('  ');
    expect(indentAt(text, 2)).toBe('');
  });
});
