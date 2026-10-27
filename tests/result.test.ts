// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { diff } from '../src/core/diff';
import { DEFAULT_OPTIONS } from '../src/core/model';
import { describeEntry, lineMarks, renderResult } from '../src/ui/result';
import { node } from './helpers';

describe('renderResult', () => {
  it('renders the summary and the list', () => {
    const entries = diff(node('a: 1\nb: 2\n'), node('a: 1\nb: 3\nc: 4\n'), DEFAULT_OPTIONS);
    const root = document.createElement('div');
    renderResult(root, { entries });

    expect(root.querySelectorAll('.diff-list li')).toHaveLength(2);
    expect(root.querySelector('.summary')!.textContent).toContain('1 modificata');
  });

  it('marks the lines of each side by kind', () => {
    const entries = diff(node('a: 1\nb: 2\n'), node('a: 1\nb: 3\nc: 4\n'), DEFAULT_OPTIONS);
    expect([...lineMarks(entries, 'a')]).toEqual([[2, 'changed']]);
    expect([...lineMarks(entries, 'b')]).toEqual([
      [2, 'changed'],
      [3, 'added'],
    ]);
  });

  it('shows a message when files are equivalent', () => {
    const root = document.createElement('div');
    renderResult(root, { entries: [] });
    expect(root.querySelector('.equal')!.textContent).toContain('equivalenti');
  });

  it('clears the view when there is nothing to compare', () => {
    const root = document.createElement('div');
    root.textContent = 'old';
    renderResult(root, null);
    expect(root.textContent).toBe('');
  });
});

describe('describeEntry', () => {
  it('describes changes with values', () => {
    const [e] = diff(node('a: 1\n'), node('a: "x"\n'), DEFAULT_OPTIONS);
    expect(describeEntry(e)).toBe('1 → "x" (number → string)');
  });
});
