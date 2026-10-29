// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createInputPanel } from '../src/ui/input';

describe('input panel', () => {
  it('writes an edit only when the result is the text that was checked', () => {
    const root = document.createElement('div');
    const onChange = vi.fn();
    const panel = createInputPanel(root, 'File B', onChange);
    const ta = root.querySelector('textarea')!;
    panel.restore({ text: 'a: 1\r\nb: 2\r\n', choice: 'auto' }, false);
    expect(ta.value).toBe('a: 1\nb: 2\n');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'a: 1\nb: 2\n' }));

    // offsets of "2" in the CRLF text: one character too far in the editor
    expect(panel.replace({ start: 10, end: 11, text: '5' }, 'a: 1\r\nb: 5\r\n')).toBe(false);
    expect(ta.value).toBe('a: 1\nb: 2\n');
    expect(panel.isModified()).toBe(false);

    expect(panel.replace({ start: 8, end: 9, text: '5' }, 'a: 1\nb: 5\n')).toBe(true);
    expect(ta.value).toBe('a: 1\nb: 5\n');
    expect(panel.isModified()).toBe(true);
  });
});
