import type { DiffKind } from '../core/model';
import type { MatrixRow } from '../core/multi';
import { el } from './dom';
import { formatValue } from './result';

export type MatrixActions = {
  /** Positions the editors on the row. */
  select(row: MatrixRow): void;
  /** Why file `i` cannot exchange this row with the base, or null. */
  support(row: MatrixRow, i: number): string | null;
  apply(row: MatrixRow, i: number, direction: 'toFile' | 'toBase'): void;
  /** Copies the base value into every file that differs on this row. */
  applyAll(row: MatrixRow): void;
};

export type MatrixInput = {
  rows: MatrixRow[];
  /** Short names, base first ("File A"). */
  names: string[];
  /** Column titles, base first (may include the file name). */
  titles: string[];
  /** Number of differences of each non-base file. */
  counts: number[];
  actions: MatrixActions;
};

const STATUS_LABELS: Record<DiffKind, string> = {
  added: 'aggiunta rispetto alla base',
  removed: 'assente rispetto alla base',
  changed: 'diversa dalla base',
  type: 'tipo diverso dalla base',
  moved: 'in posizione diversa',
  whitespace: 'formattazione diversa',
};

export function renderMatrix(root: HTMLElement, input: MatrixInput): void {
  root.replaceChildren();
  const { rows, names, titles, counts, actions } = input;
  if (rows.length === 0) {
    const p = el('p', 'equal');
    p.textContent = 'File equivalenti con le opzioni correnti.';
    root.append(p);
    return;
  }

  const summary = el('div', 'matrix-summary');
  counts.forEach((n, i) => {
    const chip = el('span', 'chip');
    chip.textContent = `${names[i + 1]}: ${n} differenze`;
    summary.append(chip);
  });

  const bar = el('div', 'matrix-actions');
  bar.hidden = true;

  const table = el('table', 'matrix');
  const headRow = el('tr');
  for (const text of ['Path', `${titles[0]} (base)`, ...titles.slice(1)]) {
    const th = el('th');
    th.textContent = text;
    headRow.append(th);
  }
  table.append(el('thead'));
  table.tHead!.append(headRow);

  const body = el('tbody');
  const select = (target: HTMLElement, row: MatrixRow, i: number | null) => {
    table.querySelectorAll('.selected').forEach((c) => c.classList.remove('selected'));
    target.classList.add('selected');
    actions.select(row);
    showActions(bar, row, i, input);
  };
  for (const row of rows) {
    const tr = el('tr');
    const path = el('td', 'path');
    const code = el('code');
    code.textContent = row.label;
    path.append(code);
    path.addEventListener('click', () => select(path, row, null));
    const base = el('td', 'base');
    base.textContent = row.base.present ? formatValue(row.base.value) : '—';
    base.addEventListener('click', () => select(base, row, null));
    tr.append(path, base);
    row.cells.forEach((c, i) => {
      const td = el('td', c.status === 'equal' ? 'cell' : `cell d-${c.status}`);
      td.classList.toggle('inherited', c.inherited);
      td.textContent = c.present ? formatValue(c.value) : '—';
      td.title = c.status === 'equal' ? 'uguale alla base' : STATUS_LABELS[c.status] + (c.inherited ? ' (su un livello superiore)' : '');
      td.addEventListener('click', () => select(td, row, i));
      tr.append(td);
    });
    body.append(tr);
  }
  table.append(body);
  root.append(summary, bar, table);
}

function showActions(bar: HTMLElement, row: MatrixRow, i: number | null, input: MatrixInput): void {
  const { names, actions } = input;
  const what = el('span', 'what');
  what.textContent = i === null ? row.label : `${row.label} · ${names[i + 1]}`;
  const buttons: HTMLButtonElement[] = [];
  if (i !== null) {
    const reason = actions.support(row, i);
    buttons.push(
      button(`Base → ${names[i + 1]}`, reason, () => actions.apply(row, i, 'toFile')),
      button(`${names[i + 1]} → Base`, reason, () => actions.apply(row, i, 'toBase')),
    );
  }
  const anyFile = row.cells.some((_, j) => row.cells[j].entry && actions.support(row, j) === null);
  buttons.push(
    button('Base → tutti', anyFile ? null : 'Nessun file con differenze riportabili su questo path', () =>
      actions.applyAll(row),
    ),
  );
  bar.replaceChildren(what, ...buttons);
  bar.hidden = false;
}

function button(text: string, disabledReason: string | null, onClick: () => void): HTMLButtonElement {
  const b = el('button');
  b.type = 'button';
  b.textContent = text;
  b.disabled = disabledReason !== null;
  if (disabledReason) b.title = disabledReason;
  b.addEventListener('click', onClick);
  return b;
}
