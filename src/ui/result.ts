import { formatPath, type DiffEntry, type DiffKind } from '../core/model';
import type { Direction } from '../core/patch';
import { el, setTabStop, step } from './dom';

/** Summary labels, singular and plural. */
const COUNT_LABELS: Record<DiffKind, [string, string]> = {
  added: ['aggiunta', 'aggiunte'],
  removed: ['rimossa', 'rimosse'],
  changed: ['modificata', 'modificate'],
  type: ['tipo cambiato', 'tipo cambiato'],
  moved: ['spostata', 'spostate'],
  whitespace: ['formattazione', 'formattazione'],
};

export const EQUAL_MESSAGE = 'File equivalenti con le opzioni correnti.';

/** The "files are equivalent" banner, with what the comparison was limited to when it was. */
export function equalBanner(scope: string | null | undefined): HTMLElement {
  const p = el('p', 'equal');
  p.textContent = EQUAL_MESSAGE;
  if (scope) {
    const note = el('span', 'equal-scope');
    note.textContent = scope;
    p.append(note);
  }
  return p;
}

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
  /** Called when an entry is selected: positions the editors on it. */
  select(e: DiffEntry): void;
};

export type ResultInput = {
  entries: DiffEntry[];
  actions?: ResultActions;
  /** Short names of the two files for the apply buttons, "A" / "B" by default. */
  names?: { a: string; b: string };
  /** What the comparison is limited to, shown with the "equivalent" message; null when nothing is. */
  scope?: string | null;
  /** Row to select and focus once rendered (clamped to the last one), to keep the user's place. */
  initial?: number | null;
};

/** Apply buttons: direction, label and tooltip, from the files' short names. */
function applyLabels({ a, b }: { a: string; b: string }): [Direction, string, string][] {
  return [
    ['aToB', `${a} → ${b}`, `Riporta in ${b} il contenuto di ${a}`],
    ['bToA', `${b} → ${a}`, `Riporta in ${a} il contenuto di ${b}`],
  ];
}

/** Renders the list in `root` and the answer (summary or "equivalent") in `answer`, `root` by default. */
export function renderResult(root: HTMLElement, input: ResultInput | null, answer?: HTMLElement): void {
  // the answer (counts or "equivalent") can live apart from the list, in a bar that stays in view
  const top = answer ?? root;
  top.replaceChildren();
  root.replaceChildren();
  if (!input) return;
  if (input.entries.length === 0) {
    top.append(equalBanner(input.scope));
    return;
  }
  // the editors show the differences in place (lineMarks), so the result is the summary and the list
  const labels = applyLabels(input.names ?? { a: 'A', b: 'B' });
  top.append(summary(input.entries));
  root.append(list(input.entries, labels, input.actions, input.initial));
  // focus only works once the list is in the document
  if (input.initial != null) root.querySelector<HTMLElement>('.diff-list li.selected')?.focus();
}

export function describeEntry(e: DiffEntry): string {
  const va = formatValue(e.a?.value);
  const vb = formatValue(e.b?.value);
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

/** One chip per difference kind with its count, in the kind's ledger colors. */
export function summary(entries: DiffEntry[]): HTMLElement {
  const counts = new Map<DiffKind, number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const div = el('div', 'summary');
  for (const kind of Object.keys(COUNT_LABELS) as DiffKind[]) {
    const n = counts.get(kind);
    if (!n) continue;
    const chip = el('span', `chip d-${kind}`);
    chip.textContent = `${n} ${COUNT_LABELS[kind][n === 1 ? 0 : 1]}`;
    div.append(chip);
  }
  return div;
}

/** The kind of difference on each line of one side, for coloring that file's editor. */
export function lineMarks(entries: DiffEntry[], side: 'a' | 'b'): Map<number, DiffKind> {
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

function list(
  entries: DiffEntry[],
  labels: [Direction, string, string][],
  actions?: ResultActions,
  initial?: number | null,
): HTMLElement {
  const ul = el('ul', 'diff-list');
  ul.setAttribute('aria-label', 'Differenze');
  const rows: HTMLLIElement[] = [];
  /** One row in the tab order, with its buttons: crossing the list is one Tab, not two per row. */
  const stop = (li: HTMLLIElement) => {
    setTabStop(rows, li);
    for (const r of rows) for (const b of r.querySelectorAll('button')) b.tabIndex = r === li ? 0 : -1;
  };
  const mark = (li: HTMLLIElement) => {
    for (const r of rows) {
      r.classList.toggle('selected', r === li);
      if (r === li) r.setAttribute('aria-current', 'true');
      else r.removeAttribute('aria-current');
    }
    stop(li);
  };
  const choose = (li: HTMLLIElement, e: DiffEntry) => {
    mark(li);
    actions?.select(e);
  };
  for (const e of entries) {
    const li = el('li', `d-${e.kind}`);
    li.tabIndex = rows.length === 0 ? 0 : -1;
    rows.push(li);
    const kind = el('span', 'kind');
    kind.textContent = ITEM_LABELS[e.kind];
    const path = el('code', 'path');
    path.textContent = formatPath(e.path);
    const desc = el('span', 'desc');
    desc.textContent = describeEntry(e);
    li.append(kind, path, desc);
    if (actions) {
      const reason = actions.support(e);
      li.append(applyButtons(e, reason, labels, actions));
      // a disabled button cannot take focus, so its tooltip alone would reach mouse users only
      if (reason) li.append(reasonText(reason));
    }
    li.addEventListener('click', () => choose(li, e));
    li.addEventListener('keydown', (event) => {
      // keys pressed on the apply buttons inside the row keep their own meaning
      if (event.target !== li) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        li.click();
        return;
      }
      // a / b: the row's first and second apply buttons, as their aria-keyshortcuts announce
      const shortcut = ['a', 'b'].indexOf(event.key);
      if (shortcut >= 0) {
        const button = li.querySelectorAll<HTMLButtonElement>('.apply button')[shortcut];
        if (button && !button.disabled) {
          event.preventDefault();
          button.click();
        }
        return;
      }
      const next = step(event.key, rows.indexOf(li), rows.length);
      if (next === null) return;
      event.preventDefault();
      rows[next].focus();
      rows[next].click();
    });
    ul.append(li);
  }
  if (initial != null && rows.length) {
    // keeps the user's place without moving the editors, which still show the applied change
    mark(rows[Math.min(initial, rows.length - 1)]);
  } else if (rows.length) {
    stop(rows[0]);
  }
  return ul;
}

/** Replaces the result with why there is nothing to compare yet. */
export function renderWaiting(root: HTMLElement, message: string, answer?: HTMLElement): void {
  const p = el('p', 'waiting');
  p.textContent = message;
  root.replaceChildren();
  (answer ?? root).replaceChildren(p);
}

/** Visible explanation of why an action is unavailable. */
export function reasonText(reason: string): HTMLElement {
  const span = el('span', 'reason');
  span.textContent = reason;
  return span;
}

function applyButtons(
  e: DiffEntry,
  reason: string | null,
  labels: [Direction, string, string][],
  actions: ResultActions,
): HTMLElement {
  const box = el('span', 'apply');
  labels.forEach(([direction, label, title], i) => {
    const key = i === 0 ? 'a' : 'b';
    const button = el('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = reason !== null;
    button.title = reason ?? `${title} (tasto ${key} sulla riga)`;
    button.setAttribute('aria-keyshortcuts', key);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      actions.apply(e, direction);
    });
    box.append(button);
  });
  return box;
}

/** Short JSON rendering of a value for lists and tables. */
export function formatValue(v: unknown): string {
  if (v === undefined) return '';
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}
