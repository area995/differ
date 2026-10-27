import { formatPath, type DiffEntry, type DiffKind } from '../core/model';
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

export type ResultInput = { textA: string; textB: string; entries: DiffEntry[] };

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
  panes.append(paneA, paneB);
  root.append(summary(input.entries), panes, list(input.entries, paneA, paneB));
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

function list(entries: DiffEntry[], paneA: HTMLElement, paneB: HTMLElement): HTMLElement {
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
    li.addEventListener('click', () => {
      if (e.a) reveal(paneA, e.a.range.start.line);
      if (e.b) reveal(paneB, e.b.range.start.line);
    });
    ul.append(li);
  }
  return ul;
}

function reveal(pane: HTMLElement, line: number): void {
  const row = pane.querySelector<HTMLElement>(`[data-line="${line}"]`);
  if (!row) return;
  pane.scrollTop = row.offsetTop - pane.clientHeight / 2;
  row.classList.remove('flash');
  void row.offsetWidth; // restart the animation
  row.classList.add('flash');
}

function show(v: unknown): string {
  if (v === undefined) return '';
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}
