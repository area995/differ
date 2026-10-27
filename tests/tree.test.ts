// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderTree, setAllExpanded, type TreeItem } from '../src/ui/tree';

const items: TreeItem[] = [
  {
    id: '$.a',
    label: 'a',
    badge: '{1}',
    children: [{ id: '$.a.b', label: 'b', badge: '{1}', children: [{ id: '$.a.b.c', label: 'c', value: '1' }] }],
  },
  { id: '$.x', label: 'x', value: '"y"', note: 'solo in B' },
];

const row = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`.tree-row[data-id="${id}"]`)!;

/** A row is visible when none of the lists containing it is hidden. */
function visible(root: HTMLElement, id: string): boolean {
  for (let n: HTMLElement | null = row(root, id); n && n !== root; n = n.parentElement) if (n.hidden) return false;
  return true;
}

describe('renderTree', () => {
  it('opens the first levels and shows labels, values, badges and notes', () => {
    const root = document.createElement('div');
    renderTree(root, items, { expanded: new Map(), defaultDepth: 1 });
    expect(visible(root, '$.a.b')).toBe(true);
    expect(visible(root, '$.a.b.c')).toBe(false);
    expect(row(root, '$.x').textContent).toBe('x"y"solo in B');
    expect(row(root, '$.a').textContent).toContain('{1}');
  });

  it('toggles a node and remembers it across renders', () => {
    const root = document.createElement('div');
    const expanded = new Map<string, boolean>();
    renderTree(root, items, { expanded, defaultDepth: 1 });
    row(root, '$.a.b').querySelector<HTMLButtonElement>('.toggle')!.click();
    expect(visible(root, '$.a.b.c')).toBe(true);
    expect(expanded.get('$.a.b')).toBe(true);

    renderTree(root, items, { expanded, defaultDepth: 1 });
    expect(visible(root, '$.a.b.c')).toBe(true);
  });

  it('expands or collapses everything', () => {
    const root = document.createElement('div');
    const expanded = new Map<string, boolean>();
    setAllExpanded(items, expanded, true);
    renderTree(root, items, { expanded, defaultDepth: 0 });
    expect(visible(root, '$.a.b.c')).toBe(true);
    setAllExpanded(items, expanded, false);
    renderTree(root, items, { expanded, defaultDepth: 9 });
    expect(visible(root, '$.a.b')).toBe(false);
  });

  it('renders checkboxes with on, implied and off states', () => {
    const root = document.body.appendChild(document.createElement('div'));
    const onChange = vi.fn();
    const state = (id: string) => (id === '$.a' ? 'on' : id.startsWith('$.a.') ? 'implied' : 'off');
    renderTree(root, items, { expanded: new Map(), defaultDepth: 9, checks: { state, onChange } });
    const box = (id: string) => row(root, id).querySelector<HTMLInputElement>('input[type=checkbox]')!;
    expect([box('$.a').checked, box('$.a').disabled]).toEqual([true, false]);
    expect([box('$.a.b').checked, box('$.a.b').disabled]).toEqual([true, true]);
    expect(box('$.x').checked).toBe(false);
    box('$.x').click();
    expect(onChange).toHaveBeenCalledWith('$.x', true);
  });

  it('reports clicks on a label', () => {
    const root = document.createElement('div');
    const onSelect = vi.fn();
    renderTree(root, items, { expanded: new Map(), defaultDepth: 9, onSelect });
    row(root, '$.x').querySelector<HTMLElement>('.key')!.click();
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it('is one tab stop moved with the arrow keys', () => {
    const root = document.body.appendChild(document.createElement('div'));
    const onSelect = vi.fn();
    renderTree(root, items, { expanded: new Map(), defaultDepth: 1, onSelect });
    const node = (id: string) => root.querySelector<HTMLElement>(`[role="treeitem"][data-id="${id}"]`)!;
    const press = (key: string) =>
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

    expect(root.querySelector('[role="tree"]')).not.toBeNull();
    expect([...root.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter((n) => n.tabIndex === 0)).toEqual([node('$.a')]);
    expect(row(root, '$.a').querySelector<HTMLElement>('.toggle')!.tabIndex).toBe(-1);

    node('$.a').focus();
    press('ArrowDown');
    expect(document.activeElement).toBe(node('$.a.b'));
    expect(node('$.a.b').getAttribute('aria-expanded')).toBe('false');
    press('ArrowRight'); // opens
    expect(visible(root, '$.a.b.c')).toBe(true);
    press('ArrowRight'); // goes to the first child
    expect(document.activeElement).toBe(node('$.a.b.c'));
    press('ArrowLeft'); // a leaf goes to its parent
    expect(document.activeElement).toBe(node('$.a.b'));
    press('End');
    expect(document.activeElement).toBe(node('$.x'));
    press('Enter');
    expect(onSelect).toHaveBeenCalledWith(items[1]);
    root.remove();
  });

  it('names its checkboxes and keeps focus on the node across re-renders', () => {
    const root = document.body.appendChild(document.createElement('div'));
    const options = {
      expanded: new Map<string, boolean>(),
      defaultDepth: 9,
      checks: {
        state: (id: string) => (id === '$.a' ? ('on' as const) : id.startsWith('$.a.') ? ('implied' as const) : ('off' as const)),
        onChange: () => renderTree(root, items, options),
      },
    };
    renderTree(root, items, options);
    const box = (id: string) => row(root, id).querySelector<HTMLInputElement>('input[type=checkbox]')!;
    expect(box('$.x').getAttribute('aria-label')).toBe('Includi $.x');
    expect(box('$.a.b').getAttribute('aria-label')).toBe('Includi $.a.b: incluso tramite un nodo superiore');

    const x = root.querySelector<HTMLElement>('[role="treeitem"][data-id="$.x"]')!;
    x.focus();
    x.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(document.activeElement?.getAttribute('data-id')).toBe('$.x');
    root.remove();
  });
});
