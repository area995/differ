import type { DiffKind } from '../core/model';
import type { MatrixRow } from '../core/multi';
import { el, setTabStop, step } from './dom';
import { equalBanner, formatValue, reasonText } from './result';

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
  /** What the comparison is limited to, shown with the "equivalent" message. */
  scope?: string | null;
  /** Cell to select and focus once rendered (grid coordinates, clamped), to keep the user's place. */
  initial?: { row: number; column: number } | null;
};

const STATUS_LABELS: Record<DiffKind, string> = {
  added: 'aggiunta rispetto alla base',
  removed: 'assente rispetto alla base',
  changed: 'diversa dalla base',
  type: 'tipo diverso dalla base',
  moved: 'in posizione diversa',
  whitespace: 'formattazione diversa',
};

/** Renders the table in `root` and the answer (per-file counts or "equivalent") in `answer`, `root` by default. */
export function renderMatrix(root: HTMLElement, input: MatrixInput, answer?: HTMLElement): void {
  const top = answer ?? root;
  top.replaceChildren();
  root.replaceChildren();
  const { rows, names, titles, counts, actions } = input;
  if (rows.length === 0) {
    top.append(equalBanner(input.scope));
    return;
  }

  const summary = el('div', 'matrix-summary');
  counts.forEach((n, i) => {
    const chip = el('span', 'chip');
    chip.textContent = `${names[i + 1]}: ${n} ${n === 1 ? 'differenza' : 'differenze'}`;
    summary.append(chip);
  });

  const bar = el('div', 'matrix-actions');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Azioni sulla cella selezionata');
  bar.hidden = true;
  // kept across selections so that screen readers announce the new path
  const what = el('span', 'what');
  what.setAttribute('aria-live', 'polite');
  const barButtons = el('span', 'buttons');
  bar.append(what, barButtons);

  const table = el('table', 'matrix');
  table.setAttribute('role', 'grid');
  table.setAttribute('aria-label', 'Differenze rispetto alla base');
  const headRow = el('tr');
  for (const text of ['Path', `${titles[0]} (base)`, ...titles.slice(1)]) {
    const th = el('th');
    th.textContent = text;
    headRow.append(th);
  }
  table.append(el('thead'));
  table.tHead!.append(headRow);

  const body = el('tbody');
  // cells by row and column, for arrow-key navigation (one tab stop for the whole grid)
  const grid: HTMLTableCellElement[][] = [];
  const all = () => grid.flat();
  const select = (target: HTMLTableCellElement, row: MatrixRow, i: number | null, reveal = true) => {
    for (const c of all()) {
      c.classList.toggle('selected', c === target);
      c.setAttribute('aria-selected', String(c === target));
    }
    setTabStop(all(), target);
    if (reveal) actions.select(row);
    what.textContent = i === null ? row.label : `${row.label} · ${names[i + 1]}`;
    barButtons.replaceChildren(...actionButtons(row, i, input));
    bar.hidden = false;
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
    const line = [path, base];
    row.cells.forEach((c, i) => {
      const td = el('td', c.status === 'equal' ? 'cell' : `cell d-${c.status}`);
      td.classList.toggle('inherited', c.inherited);
      td.textContent = c.present ? formatValue(c.value) : '—';
      td.title = c.status === 'equal' ? 'uguale alla base' : STATUS_LABELS[c.status] + (c.inherited ? ' (su un livello superiore)' : '');
      // the status is otherwise only a color and a tooltip
      td.setAttribute('aria-label', `${td.textContent}, ${td.title}`);
      td.addEventListener('click', () => select(td, row, i));
      tr.append(td);
      line.push(td);
    });
    for (const cell of line) {
      cell.tabIndex = -1;
      cell.setAttribute('aria-selected', 'false');
    }
    grid.push(line);
    body.append(tr);
  }
  grid[0][0].tabIndex = 0;
  table.addEventListener('keydown', (event) => {
    const target = event.target as HTMLTableCellElement;
    const r = grid.findIndex((line) => line.includes(target));
    if (r < 0) return;
    const c = grid[r].indexOf(target);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      target.click();
      return;
    }
    const nr = step(event.key, r, grid.length, ['ArrowUp'], ['ArrowDown']);
    const nc = step(event.key, c, grid[r].length, ['ArrowLeft'], ['ArrowRight']);
    let next: HTMLTableCellElement | undefined;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') next = grid[nr!][c];
    else if (nc !== null) next = grid[r][nc];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  });
  table.append(body);
  const scroll = el('div', 'matrix-scroll');
  scroll.append(table);
  top.append(summary);
  root.append(bar, scroll);
  if (input.initial) {
    // keeps the user's place without moving the editors, which still show the applied change
    const r = Math.min(input.initial.row, grid.length - 1);
    const c = Math.min(input.initial.column, grid[r].length - 1);
    select(grid[r][c], rows[r], c >= 2 ? c - 2 : null, false);
    grid[r][c].focus();
  }
}

/** The buttons for the selected cell, followed by why the disabled ones are unavailable. */
function actionButtons(row: MatrixRow, i: number | null, input: MatrixInput): HTMLElement[] {
  const { names, actions } = input;
  const buttons: HTMLButtonElement[] = [];
  const reasons: string[] = [];
  if (i !== null) {
    const reason = actions.support(row, i);
    if (reason) reasons.push(reason);
    buttons.push(
      button(`Base → ${names[i + 1]}`, reason, () => actions.apply(row, i, 'toFile')),
      button(`${names[i + 1]} → Base`, reason, () => actions.apply(row, i, 'toBase')),
    );
  }
  const targets = row.cells.flatMap((c, j) => (c.entry && actions.support(row, j) === null ? [j] : []));
  const allReason = targets.length ? null : 'Nessun file con differenze riportabili su questo path';
  // the cell's own reason usually explains this one too
  if (allReason && reasons.length === 0) reasons.push(allReason);
  const all = button('Base → tutti…', allReason, () => {
    // several files change at once: say which and how before doing it
    const bar = all.parentElement!;
    const preview = el('span', 'preview');
    const files = targets
      .map((j) => `${names[j + 1]} (ora ${row.cells[j].present ? formatValue(row.cells[j].value) : 'assente'})`)
      .join(', ');
    preview.textContent = row.base.present
      ? `Riportare ${formatValue(row.base.value)} in ${files}?`
      : `Rimuovere ${row.label} da ${files}, come nella base?`;
    const confirm = button('Conferma', null, () => actions.applyAll(row));
    const cancel = button('Annulla', null, () => bar.replaceChildren(...actionButtons(row, i, input)));
    bar.replaceChildren(preview, confirm, cancel);
    confirm.focus();
  });
  buttons.push(all);
  return [...buttons, ...reasons.map(reasonText)];
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
