import { describe, expect, it } from 'vitest';
import { markEdit, noMarks, type LineMarks } from '../src/core/linemarks';

const marks = (lines: [number, 'changed' | 'added'][], removedBefore: number[] = []): LineMarks => ({
  lines: new Map(lines),
  removedBefore: new Set(removedBefore),
});

describe('markEdit', () => {
  it('marks a replaced line as changed', () => {
    expect(markEdit('a: 2\nb: x\n', 'a: 1\nb: x\n', noMarks())).toEqual(marks([[1, 'changed']]));
  });

  it('marks inserted lines as added', () => {
    expect(markEdit('a: 1\nc: 3\n', 'a: 1\nb: 2\nc: 3\n', noMarks())).toEqual(marks([[2, 'added']]));
  });

  it('marks where lines were removed', () => {
    expect(markEdit('a: 1\nb:\n  x: 1\nc: 2\n', 'a: 1\nc: 2\n', noMarks())).toEqual(marks([], [2]));
  });

  it('marks a line that grew into several', () => {
    expect(markEdit('a: 5\nb: 1\n', 'a:\n  x: 1\n  y: 2\nb: 1\n', noMarks())).toEqual(
      marks([
        [1, 'changed'],
        [2, 'added'],
        [3, 'added'],
      ]),
    );
  });

  it('shifts the marks after the edit', () => {
    const before = marks([[3, 'changed']], [4]);
    expect(markEdit('a\nb\nc\nd\n', 'a\nnew\nb\nc\nd\n', before)).toEqual(
      marks(
        [
          [2, 'added'],
          [4, 'changed'],
        ],
        [5],
      ),
    );
  });

  it('replaces the marks inside the edited lines', () => {
    expect(markEdit('a: 1\n', 'a: 2\n', marks([[1, 'added']]))).toEqual(marks([[1, 'changed']]));
  });
});
