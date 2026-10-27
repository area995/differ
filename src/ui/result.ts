import { formatPath, type DiffEntry, type DiffKind, type Range } from '../core/model';
import type { Direction } from '../core/patch';
import { el } from './dom';

const COUNT_LABELS: Record<DiffKind, string> = {
  added: 'aggiunte',
  removed: 'rimosse',
  changed: 'modificate',
  type: 'tipo cambiato',
  moved: 'spostate',
  whitespace: 'formattazione',
};

const ITEM_LABELS: Record<DiffKind, string> = {
  added: 'aggiunta',
  removed: 'rimossa',
  changed: 'modificata',
  type: 'tipo',
  moved: 'spostata',
  whitespace: 'formattazione',
};

/** When several differences touch the same line, the later kind wins. */
const PRIORITY: DiffKind[] = ['whitespace', 'moved', 'added', 'removed', 'changed', 'type'];

export type ResultActions = {
  /** Why the entry cannot be applied, or null. */
  support(e: DiffEntry): string | null;
  apply(e: DiffEntry, direction: Direction): void;
  /** Called when an entry is clicked; returns where it is (or would be) in each file. */
  select(e: DiffEntry): { a: Range; b: Range };
};

export type ResultInput = {
  textA: string;
  textB: string;
  entries: DiffEntry[];
  actions?: ResultActions;
  /** Pane titles, "File A" / "File B" by default. */
  labels?: { a: string; b: string };
};

const APPLY_BUTTONS: [Direction, string, string][] = [
  ['aToB', 'A → B', 'Riporta in B il contenuto di A'],
  ['bToA', 'B → A', 'Riporta in A il contenuto di B'],
];

export function renderResult(root: HTMLElement, input: ResultInput | null): void {
  root.replaceChildren();
  if (!input) return;
  if (input.entries.length === 0) {
    const p = el('p', 'equal');
    p.textContent = 'File equivalenti con le opzioni correnti.';
    root.append(p);
    return;
  }
  const paneA = pane(input.textA, lineMarks(input.entries, 'a'), 'A');
  const paneB = pane(input.textB, lineMarks(input.entries, 'b'), 'B');
  const panes = el('div', 'panes');
  const labels = input.labels ?? { a: 'File A', b: 'File B' };
  panes.append(titled(paneA, labels.a), titled(paneB, labels.b));
  root.append(summary(input.entries), panes, list(input.entries, paneA, paneB, input.actions));
}

export function describeEntry(e: DiffEntry): string {
  const va = show(e.a?.value);
  const vb = show(e.b?.value);
  switch (e.kind) {
    case 'added':
      return vb;
    case 'removed':
      return va;
    case 'changed':
      return `${va} → ${vb}`;
    case 'type':
      return `${va} → ${vb} (${e.detail})`;
    default:
      return e.detail ?? '';
  }
}

function summary(entries: DiffEntry[]): HTMLElement {
  const counts = new Map<DiffKind, number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const div = el('div', 'summary');
  for (const kind of Object.keys(COUNT_LABELS) as DiffKind[]) {
    const n = counts.get(kind);
    if (!n) continue;
    const chip = el('span', `chip d-${kind}`);
    chip.textContent = `${n} ${COUNT_LABELS[kind]}`;
    div.append(chip);
  }
  return div;
}

function lineMarks(entries: DiffEntry[], side: 'a' | 'b'): Map<number, DiffKind> {
  const marks = new Map<number, DiffKind>();
  for (const e of entries) {
    const s = e[side];
    if (!s) continue;
    for (let line = s.range.start.line; line <= s.range.end.line; line++) {
      const current = marks.get(line);
      if (!current || PRIORITY.indexOf(e.kind) > PRIORITY.indexOf(current)) marks.set(line, e.kind);
    }
  }
  return marks;
}

function titled(pane: HTMLElement, label: string): HTMLElement {
  const box = el('div', 'pane-box');
  const title = el('h3', 'pane-title');
  title.textContent = label;
  box.append(title, pane);
  return box;
}

function pane(text: string, marks: Map<number, DiffKind>, side: string): HTMLElement {
  const div = el('div', 'pane');
  div.dataset.side = side;
  text.split(/\r?\n/).forEach((line, i) => {
    const n = i + 1;
    const kind = marks.get(n);
    const row = el('div', kind ? `line d-${kind}` : 'line');
    row.dataset.line = String(n);
    const num = el('span', 'num');
    num.textContent = String(n);
    const code = el('span', 'code');
    code.textContent = kind === 'whitespace' ? line.replace(/\t/g, '→').replace(/ /g, '·') : line;
    row.append(num, code);
    div.append(row);
  });
  return div;
}

function list(entries: DiffEntry[], paneA: HTMLElement, paneB: HTMLElement, actions?: ResultActions): HTMLElement {
  const ul = el('ul', 'diff-list');
  for (const e of entries) {
    const li = el('li', `d-${e.kind}`);
    const kind = el('span', 'kind');
    kind.textContent = ITEM_LABELS[e.kind];
    const path = el('code', 'path');
    path.textContent = formatPath(e.path);
    const desc = el('span', 'desc');
    desc.textContent = describeEntry(e);
    li.append(kind, path, desc);
    if (actions) li.append(applyButtons(e, actions));
    li.addEventListener('click', () => {
      const at = actions?.select(e) ?? { a: e.a?.range, b: e.b?.range };
      if (at.a) reveal(paneA, at.a.start.line);
      if (at.b) reveal(paneB, at.b.start.line);
    });
    ul.append(li);
  }
  return ul;
}

function applyButtons(e: DiffEntry, actions: ResultActions): HTMLElement {
  const box = el('span', 'apply');
  const reason = actions.support(e);
  for (const [direction, label, title] of APPLY_BUTTONS) {
    const button = el('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = reason !== null;
    button.title = reason ?? title;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      actions.apply(e, direction);
    });
    box.append(button);
  }
  return box;
}

function reveal(pane: HTMLElement, line: number): void {
  // an insertion point can be one line past the end of the text
  const row =
    pane.querySelector<HTMLElement>(`[data-line="${line}"]`) ?? pane.querySelector<HTMLElement>('.line:last-child');
  if (!row) return;
  pane.scrollTop = row.offsetTop - pane.clientHeight / 2;
  pane.querySelectorAll('.flash').forEach((r) => r.classList.remove('flash'));
  void row.offsetWidth; // restart the animation
  row.classList.add('flash');
}

function show(v: unknown): string {
  if (v === undefined) return '';
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}
