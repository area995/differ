import type { Range } from '../core/model';
import { el, setTabStop, step } from './dom';
import { icon } from './icons';

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
  /** `label` names each box with its path ("Includi $.db"); `implied` explains a box checked through an ancestor. */
  checks?: {
    state(id: string): CheckState;
    onChange(id: string, checked: boolean): void;
    label?: string;
    implied?: string;
  };
  onSelect?(item: TreeItem): void;
};

/**
 * Renders an ARIA tree: one tab stop, ↑/↓ move between visible nodes, → opens or goes to the first child,
 * ← closes or goes to the parent, Enter selects (or toggles), Space checks the node in a picker.
 * The focused node survives re-renders, e.g. after checking a box.
 */
export function renderTree(container: HTMLElement, items: TreeItem[], options: TreeOptions): void {
  const focused = container.querySelector<HTMLElement>('[role="treeitem"]:focus')?.dataset.id;
  const root = list(items, 0, options);
  root.setAttribute('role', 'tree');
  root.addEventListener('keydown', (event) => onKey(root, event));
  root.addEventListener('focusin', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    if (item) setTabStop(treeItems(root), item);
  });
  container.replaceChildren(root);
  const all = treeItems(root);
  const again = focused ? all.find((li) => li.dataset.id === focused) : undefined;
  if (all.length) setTabStop(all, again ?? all[0]);
  again?.focus();
}

/** Opens or closes every container node. */
export function setAllExpanded(items: TreeItem[], expanded: Map<string, boolean>, open: boolean): void {
  for (const item of items) {
    if (!item.children?.length) continue;
    expanded.set(item.id, open);
    setAllExpanded(item.children, expanded, open);
  }
}

const treeItems = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[role="treeitem"]')];

/** Nodes the user can see, in reading order. */
const visible = (root: HTMLElement) => treeItems(root).filter((li) => !li.parentElement!.closest('[hidden]'));

function onKey(root: HTMLElement, event: KeyboardEvent): void {
  const li = event.target as HTMLElement;
  if (li.getAttribute('role') !== 'treeitem') return;
  const shown = visible(root);
  const toggle = li.querySelector<HTMLButtonElement>(':scope > .tree-row > button.toggle');
  const open = li.getAttribute('aria-expanded') === 'true';
  let next: HTMLElement | undefined;
  switch (event.key) {
    case 'ArrowRight':
      if (toggle && !open) toggle.click();
      else if (open) next = li.querySelector<HTMLElement>(':scope > ul > [role="treeitem"]') ?? undefined;
      break;
    case 'ArrowLeft':
      if (toggle && open) toggle.click();
      else next = li.parentElement!.closest<HTMLElement>('[role="treeitem"]') ?? undefined;
      break;
    case 'Enter':
      (li.querySelector<HTMLElement>(':scope > .tree-row > .key.selectable') ?? toggle)?.click();
      break;
    case ' ': {
      const box = li.querySelector<HTMLInputElement>(':scope > .tree-row > input[type="checkbox"]');
      if (box && !box.disabled) box.click();
      else (li.querySelector<HTMLElement>(':scope > .tree-row > .key.selectable') ?? toggle)?.click();
      break;
    }
    default: {
      const i = step(event.key, shown.indexOf(li), shown.length, ['ArrowUp'], ['ArrowDown']);
      if (i === null) return;
      next = shown[i];
    }
  }
  event.preventDefault();
  next?.focus();
}

function list(items: TreeItem[], depth: number, options: TreeOptions): HTMLElement {
  const ul = el('ul', 'tree');
  for (const item of items) ul.append(entry(item, depth, options));
  return ul;
}

function entry(item: TreeItem, depth: number, options: TreeOptions): HTMLElement {
  const li = el('li');
  // the node itself takes focus; its buttons stay clickable but out of the tab order
  li.setAttribute('role', 'treeitem');
  li.setAttribute('aria-level', String(depth + 1));
  li.dataset.id = item.id;
  li.tabIndex = -1;
  const row = el('div', 'tree-row');
  row.dataset.id = item.id;
  const hasChildren = !!item.children?.length;
  let open = options.expanded.get(item.id) ?? depth < options.defaultDepth;

  const toggle = el(hasChildren ? 'button' : 'span', 'toggle');
  toggle.setAttribute('aria-hidden', 'true');
  row.append(toggle);

  if (options.checks) {
    const state = options.checks.state(item.id);
    const box = el('input');
    box.type = 'checkbox';
    box.tabIndex = -1;
    box.checked = state !== 'off';
    box.disabled = state === 'implied';
    const { label = 'Includi', implied = 'Incluso tramite un nodo superiore' } = options.checks;
    if (state === 'implied') box.title = implied;
    box.setAttribute('aria-label', state === 'implied' ? `${label} ${item.id}: ${implied.toLowerCase()}` : `${label} ${item.id}`);
    li.setAttribute('aria-checked', String(state !== 'off'));
    box.addEventListener('change', () => options.checks!.onChange(item.id, box.checked));
    row.append(box);
  }

  const key = el(options.onSelect ? 'button' : 'span', 'key');
  key.textContent = item.label;
  if (options.onSelect) {
    (key as HTMLButtonElement).type = 'button';
    key.tabIndex = -1;
    key.classList.add('selectable');
    key.title = 'Mostra nel testo';
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
    children.setAttribute('role', 'group');
    const button = toggle as HTMLButtonElement;
    button.type = 'button';
    button.tabIndex = -1;
    button.append(icon('chevron'));
    const update = () => {
      children.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      li.setAttribute('aria-expanded', String(open));
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
