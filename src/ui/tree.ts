import type { Range } from '../core/model';
import { el } from './dom';

export type TreeItem = {
  /** Stable id (the formatted path), used to remember which nodes are open. */
  id: string;
  label: string;
  /** Scalar preview. */
  value?: string;
  /** Extra class for the value, e.g. its type. */
  tone?: string;
  /** Size hint for containers, e.g. "{3}". */
  badge?: string;
  note?: string;
  range?: Range;
  children?: TreeItem[];
};

export type CheckState = 'on' | 'implied' | 'off';

export type TreeOptions = {
  /** Open/closed overrides by id; updated when the user toggles a node. */
  expanded: Map<string, boolean>;
  /** Nodes shallower than this are open unless overridden. */
  defaultDepth: number;
  checks?: { state(id: string): CheckState; onChange(id: string, checked: boolean): void };
  onSelect?(item: TreeItem): void;
};

export function renderTree(container: HTMLElement, items: TreeItem[], options: TreeOptions): void {
  container.replaceChildren(list(items, 0, options));
}

/** Opens or closes every container node. */
export function setAllExpanded(items: TreeItem[], expanded: Map<string, boolean>, open: boolean): void {
  for (const item of items) {
    if (!item.children?.length) continue;
    expanded.set(item.id, open);
    setAllExpanded(item.children, expanded, open);
  }
}

function list(items: TreeItem[], depth: number, options: TreeOptions): HTMLElement {
  const ul = el('ul', 'tree');
  for (const item of items) ul.append(entry(item, depth, options));
  return ul;
}

function entry(item: TreeItem, depth: number, options: TreeOptions): HTMLElement {
  const li = el('li');
  const row = el('div', 'tree-row');
  row.dataset.id = item.id;
  const hasChildren = !!item.children?.length;
  let open = options.expanded.get(item.id) ?? depth < options.defaultDepth;

  const toggle = el(hasChildren ? 'button' : 'span', 'toggle');
  row.append(toggle);

  if (options.checks) {
    const state = options.checks.state(item.id);
    const box = el('input');
    box.type = 'checkbox';
    box.checked = state !== 'off';
    box.disabled = state === 'implied';
    if (state === 'implied') box.title = 'Incluso tramite un nodo superiore';
    box.addEventListener('change', () => options.checks!.onChange(item.id, box.checked));
    row.append(box);
  }

  const key = el('span', 'key');
  key.textContent = item.label;
  if (options.onSelect) {
    key.classList.add('selectable');
    key.addEventListener('click', () => options.onSelect!(item));
  }
  row.append(key);
  for (const [cls, text] of [
    [`val ${item.tone ?? ''}`.trim(), item.value],
    ['badge', item.badge],
    ['note', item.note],
  ] as const) {
    if (text === undefined) continue;
    const span = el('span', cls);
    span.textContent = text;
    row.append(span);
  }
  li.append(row);

  if (hasChildren) {
    const children = list(item.children!, depth + 1, options);
    const button = toggle as HTMLButtonElement;
    button.type = 'button';
    const update = () => {
      children.hidden = !open;
      button.textContent = open ? '▾' : '▸';
      button.setAttribute('aria-expanded', String(open));
      button.title = open ? 'Comprimi' : 'Espandi';
    };
    button.addEventListener('click', () => {
      open = !open;
      options.expanded.set(item.id, open);
      update();
    });
    update();
    li.append(children);
  }
  return li;
}
