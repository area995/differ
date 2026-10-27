// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { diff } from '../src/core/diff';
import { DEFAULT_OPTIONS } from '../src/core/model';
import { describeEntry, renderResult } from '../src/ui/result';
import { node } from './helpers';

describe('renderResult', () => {
  it('renders summary, highlighted panes and the list', () => {
    const textA = 'a: 1\nb: 2\n';
    const textB = 'a: 1\nb: 3\nc: 4\n';
    const entries = diff(node(textA), node(textB), DEFAULT_OPTIONS);
    const root = document.createElement('div');
    renderResult(root, { textA, textB, entries });

    expect(root.querySelectorAll('.diff-list li')).toHaveLength(2);
    expect(root.querySelector('.pane[data-side="A"] [data-line="2"]')!.className).toContain('d-changed');
    expect(root.querySelector('.pane[data-side="B"] [data-line="3"]')!.className).toContain('d-added');
    expect(root.querySelector('.summary')!.textContent).toContain('1 modificate');
  });

  it('shows a message when files are equivalent', () => {
    const root = document.createElement('div');
    renderResult(root, { textA: 'a: 1', textB: '{"a": 1}', entries: [] });
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
