import '../styles.css';
import { detectFormat } from '../core/detect';
import { diff } from '../core/diff';
import { filterEntries } from '../core/filter';
import {
  DEFAULT_OPTIONS,
  formatPath,
  type DiffEntry,
  type DiffOptions,
  type Format,
  type ParseResult,
  type Path,
  type Range,
} from '../core/model';
import { buildMatrix, type MatrixRow } from '../core/multi';
import { parse } from '../core/parse';
import { PATCH_ERROR, applyEntry, locateEntry, patchSupport, type Direction, type PatchDoc } from '../core/patch';
import { parsePath, parsePathList, selectNode } from '../core/select';
import { buildUnion } from '../core/union';
import { el } from './dom';
import { createInputPanel, type InputPanel, type InputState } from './input';
import { renderMatrix } from './matrix';
import { createOptionsBar } from './options';
import { lineMarks, renderResult, renderWaiting } from './result';
import { createThemeSwitch } from './theme';
import { unionItems } from './tree-items';

const byId = (id: string) => document.getElementById(id)!;

const themeRoot = document.getElementById('theme');
if (themeRoot) createThemeSwitch(themeRoot);

const SAME_FORMAT_ONLY = 'Disponibile solo con file dello stesso formato';
const ROOT_ONE_SIDE = 'Non disponibile quando la root è applicata solo ad alcuni file';
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

/** One input panel. */
type Slot = { letter: string; root: HTMLElement; panel: InputPanel; input: InputState };
type Analysis = { format: Format; result: ParseResult };
/** A parsed, non-empty file with the root applied when present. */
type Loaded = { slot: Slot; doc: PatchDoc; applied: boolean };

const notice = el('div', 'notice');
// a refused change is announced: the user just pressed a button and expects an outcome
notice.setAttribute('role', 'alert');
notice.hidden = true;
byId('result').before(notice);

function showNotice(message: string | null): void {
  notice.hidden = !message;
  notice.textContent = message ?? '';
}

// outcome of the last change (applied, removed…), with a way back when there is one
const status = el('div', 'status');
status.setAttribute('role', 'status');
status.hidden = true;
notice.after(status);

/** Shows the outcome of a change; returns the button of its action, if any, so that it can take focus. */
function showStatus(message: string | null, action?: { label: string; run(): void }): HTMLButtonElement | null {
  status.hidden = !message;
  status.replaceChildren();
  if (!message) return null;
  const text = el('span');
  text.textContent = message;
  status.append(text);
  if (action) {
    const button = el('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      showStatus(null);
      action.run();
    });
    status.append(button);
    return button;
  }
  return null;
}

// the answer (counts, "equivalent" or what is missing) and the selected difference, kept in view while scrolling
const answer = el('div', 'answer');
answer.setAttribute('role', 'status');
byId('inputs').before(answer);

/** One line of a file, as evidence next to the answer; a range over several lines ends with an ellipsis. */
function lineAt(text: string, range: Range): string {
  const first = text.split(/\r?\n/)[range.start.line - 1] ?? '';
  return (range.end.line > range.start.line ? `${first} …` : first).trim();
}

/** Shows where the selected difference is in each file, with its first line, or that the file lacks it. */
function showEvidence(path: string, sides: { name: string; text: string; range: Range | null }[]): void {
  const box = el('div', 'evidence');
  const where = el('code', 'path');
  where.textContent = path;
  box.append(where);
  for (const side of sides) {
    const item = el('span', 'side');
    const who = el('span', 'who');
    who.textContent = side.name;
    const line = el('code', 'line');
    if (side.range) {
      const n = el('span', 'ln');
      n.textContent = `r. ${side.range.start.line}`;
      line.textContent = lineAt(side.text, side.range);
      item.append(who, n, line);
    } else {
      line.textContent = 'assente';
      line.classList.add('missing');
      item.append(who, line);
    }
    box.append(item);
  }
  answer.querySelector('.evidence')?.remove();
  answer.append(box);
}

let opts: DiffOptions = { ...DEFAULT_OPTIONS };
let timer: number | undefined;
const slots: Slot[] = [];
let baseLetter = 'A';
/** Where to put the selection back after the recomputation that follows an applied change. */
let pending: { row: number; column: number } | null = null;

// applied changes exist only in the page until saved
window.addEventListener('beforeunload', (event) => {
  if (slots.some((s) => s.panel.isModified())) event.preventDefault();
});

// files dropped outside a card would make the browser open them and leave the page: place them instead
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => {
  event.preventDefault();
  const files = [...(event.dataTransfer?.files ?? [])];
  if (files.length) distribute(files, null);
});

const optionsBar = createOptionsBar(byId('options'), opts, (o) => {
  opts = o;
  schedule();
});

const addButton = byId('add-file') as HTMLButtonElement;
addButton.textContent ||= '+ Aggiungi file';
addButton.addEventListener('click', () => {
  // the new card is where the user goes next
  addSlot()?.root.querySelector('textarea')?.focus();
  schedule();
});
addSlot();
addSlot();
run(); // shows what to do before anything is loaded

function addSlot(): Slot | null {
  const letter = LETTERS.find((l) => !slots.some((s) => s.letter === l));
  if (!letter) return null;
  const root = el('div', 'panel');
  root.id = `input-${letter.toLowerCase()}`;
  byId('inputs').append(root);
  // the callbacks run later, once `slot` exists
  const panel = createInputPanel(
    root,
    `File ${letter}`,
    (s) => {
      slot.input = s;
      schedule();
    },
    {
      onBase: () => {
        baseLetter = letter;
        refreshControls();
        schedule();
      },
      onRemove: () => removeSlot(slot),
      onMoreFiles: (files) => distribute(files, slot),
    },
  );
  const slot: Slot = { letter, root, panel, input: { text: '', choice: 'auto' } };
  slots.push(slot);
  refreshControls();
  return slot;
}

/** Removes a file at once, offering to put it back rather than asking first. */
function removeSlot(slot: Slot): void {
  if (slots.length <= 2) return;
  const index = slots.indexOf(slot);
  const wasBase = baseLetter === slot.letter;
  const input = { ...slot.input };
  const modified = slot.panel.isModified();
  const name = title(slot);
  slot.root.remove();
  slots.splice(index, 1);
  if (wasBase) baseLetter = slots[0].letter;
  refreshControls();
  schedule();
  const restore = showStatus(`${name} rimosso dal confronto.`, {
    label: 'Ripristina',
    run: () => {
      const back = addSlot();
      if (!back) return;
      // back to its old place, which sets the order of the matrix columns
      slots.splice(slots.indexOf(back), 1);
      slots.splice(index, 0, back);
      byId('inputs').insertBefore(back.root, byId('inputs').children[index] ?? null);
      if (wasBase) baseLetter = back.letter;
      back.panel.restore(input, modified);
      refreshControls();
      schedule();
      back.root.querySelector('textarea')?.focus();
    },
  });
  // the removed card took the focus with it: the way back is the useful next stop
  restore?.focus();
}

/**
 * Puts each file in the next empty card after `from` (from the first card when null), adding cards as needed.
 * Cards with content are never overwritten.
 */
function distribute(files: File[], from: Slot | null): void {
  let i = from ? slots.indexOf(from) + 1 : 0;
  const skipped: string[] = [];
  for (const file of files) {
    while (i < slots.length && slots[i].input.text.trim() !== '') i++;
    const slot = i < slots.length ? slots[i] : addSlot();
    if (!slot) {
      skipped.push(file.name);
      continue;
    }
    void slot.panel.load(file);
    i = slots.indexOf(slot) + 1;
  }
  if (skipped.length) showNotice(`Massimo ${LETTERS.length} file: non caricati ${skipped.join(', ')}`);
  schedule();
}

function refreshControls(): void {
  for (const s of slots) s.panel.setControls({ base: s.letter === baseLetter, removable: slots.length > 2 });
  addButton.disabled = slots.length >= LETTERS.length;
}

function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(run, 300);
}

function analyze(s: InputState): Analysis | null {
  if (s.text.trim() === '') return null;
  const format = s.choice === 'auto' ? detectFormat(s.text, s.fileName) : s.choice;
  return { format, result: parse(s.text, format) };
}

function run(): void {
  const filled: { slot: Slot; a: Analysis }[] = [];
  for (const slot of slots) {
    const a = analyze(slot.input);
    slot.panel.setStatus(a?.format ?? null, a && !a.result.ok ? a.result.error : null);
    slot.panel.setTree(
      a?.result.ok ? a.result.node : null,
      a ? "Correggi gli errori di sintassi per vedere l'albero" : 'Nessun contenuto',
    );
    if (a) filled.push({ slot, a });
  }
  const sameFormat = new Set(filled.map((f) => f.a.format)).size <= 1;
  const rootPath = parsePath(opts.root);
  const includes = parsePathList(opts.include);
  const hasBase = filled.some((f) => f.slot.letter === baseLetter);

  if (!rootPath.ok || !includes.ok || !hasBase || filled.length < 2 || filled.some((f) => !f.a.result.ok)) {
    const syntaxError = !rootPath.ok ? rootPath.error : !includes.ok ? includes.error : null;
    optionsBar.setScopeMessage(syntaxError, 'error');
    optionsBar.setWhitespaceEnabled(sameFormat, SAME_FORMAT_ONLY);
    optionsBar.setIncludeTree(null);
    renderWaiting(byId('result'), waitingMessage(syntaxError !== null, filled, hasBase), answer);
    for (const s of slots) s.panel.setDiffMarks(new Map());
    pending = null;
    return;
  }
  const loaded = filled.map((f) => load(f.slot, f.a, rootPath.path));
  const keyField = opts.ignoreArrayOrder ? opts.arrayKeyField : '';
  const union = buildUnion(loaded.map((l) => l.doc.node), keyField);
  optionsBar.setIncludeTree(unionItems(union, loaded.map((l) => short(l.slot))));
  const notes = [rootMessage(formatPath(rootPath.path), loaded), ...missingIncludes(includes.paths, loaded)];
  const info = notes.filter((n): n is string => n !== null);
  optionsBar.setScopeMessage(info.length ? info.join('\n') : null, 'info');

  // nesting changes the indentation of every line, so whitespace needs the root applied everywhere or nowhere
  const oneSided = new Set(loaded.map((l) => l.applied)).size > 1;
  optionsBar.setWhitespaceEnabled(sameFormat && !oneSided, oneSided ? ROOT_ONE_SIDE : SAME_FORMAT_ONLY);

  const base = loaded.find((l) => l.slot.letter === baseLetter)!;
  const others = loaded.filter((l) => l !== base);
  const entries = others.map((o) => {
    const raw = sameFormat && !oneSided ? { a: base.doc.text, b: o.doc.text } : undefined;
    return filterEntries(diff(base.doc.node, o.doc.node, opts, raw), includes.paths);
  });
  // each editor shows its own differences: the base all of them, every other file those against the base
  for (const s of slots) if (!loaded.some((l) => l.slot === s)) s.panel.setDiffMarks(new Map());
  base.slot.panel.setDiffMarks(lineMarks(entries.flat(), 'a'));
  others.forEach((o, i) => o.slot.panel.setDiffMarks(lineMarks(entries[i], 'b')));

  const scope = scopeNote(loaded, rootPath.path, includes.paths);
  const place = pending;
  pending = null;
  if (others.length === 1) renderPair(base, others[0], entries[0], scope, place?.row ?? null);
  else renderMatrixView(base, others, entries, scope, place);
}

/**
 * What the comparison leaves out, so that "equivalent" is never read as "identical files":
 * the root, the included subtrees and the main difference kinds turned off.
 */
function scopeNote(loaded: Loaded[], root: Path, includes: Path[]): string | null {
  const limits: string[] = [];
  if (loaded.some((l) => l.applied)) limits.push(`solo la root ${formatPath(root)}`);
  if (includes.length) limits.push(`solo i sottoalberi ${includes.map(formatPath).join(', ')}`);
  if (!opts.keys) limits.push('chiavi aggiunte o rimosse escluse');
  if (!opts.values) limits.push('valori diversi esclusi');
  return limits.length ? `Confronto parziale: ${limits.join('; ')}.` : null;
}

/** Why there is no comparison, and what to do about it. */
function waitingMessage(badScope: boolean, filled: { slot: Slot; a: Analysis }[], hasBase: boolean): string {
  if (badScope) return 'Correggi Root o Includi per aggiornare il confronto.';
  const broken = filled.filter((f) => !f.a.result.ok).map((f) => name(f.slot));
  if (broken.length) return `Correggi gli errori di sintassi in ${broken.join(', ')} per aggiornare il confronto.`;
  if (filled.length < 2) return 'Incolla o apri almeno due file per confrontarli.';
  const base = slots.find((s) => s.letter === baseLetter)!;
  if (!hasBase) return `Il file base (${name(base)}) è vuoto: incolla o apri un contenuto, oppure scegli un'altra base.`;
  return '';
}

function load(slot: Slot, a: Analysis, root: Path): Loaded {
  if (!a.result.ok) throw new Error('only parsed files can be loaded');
  const scoped = root.length ? selectNode(a.result.node, root) : undefined;
  const doc: PatchDoc = { text: slot.input.text, format: a.format, node: scoped ?? a.result.node, rootPath: scoped ? root : [] };
  return { slot, doc, applied: scoped !== undefined };
}

function renderPair(base: Loaded, other: Loaded, entries: DiffEntry[], scope: string | null, initial: number | null): void {
  renderResult(byId('result'), {
    entries,
    names: { a: short(base.slot), b: short(other.slot) },
    scope,
    initial,
    actions: {
      support: (e) => patchSupport(e, base.doc, other.doc, opts.ignoreArrayOrder),
      apply: (e, direction) => {
        // the resolved row goes away: the one after it takes its place
        if (applyChange(e, direction, base, other)) pending = { row: entries.indexOf(e), column: 0 };
      },
      select: (e) => {
        showNotice(null);
        const at = locateEntry(e, base.doc, other.doc);
        base.slot.panel.reveal(at.a);
        other.slot.panel.reveal(at.b);
        showEvidence(formatPath(e.path), [
          { name: short(base.slot), text: base.doc.text, range: e.a ? at.a : null },
          { name: short(other.slot), text: other.doc.text, range: e.b ? at.b : null },
        ]);
      },
    },
  }, answer);
}

function renderMatrixView(
  base: Loaded,
  others: Loaded[],
  entries: DiffEntry[][],
  scope: string | null,
  initial: { row: number; column: number } | null,
): void {
  const support = (row: MatrixRow, i: number) => {
    const e = row.cells[i].entry;
    return e ? patchSupport(e, base.doc, others[i].doc, opts.ignoreArrayOrder) : 'Nessuna differenza diretta con la base';
  };
  const rows = buildMatrix(base.doc, others.map((o) => o.doc), entries);
  renderMatrix(byId('result'), {
    rows,
    names: [base, ...others].map((l) => name(l.slot)),
    titles: [base, ...others].map((l) => title(l.slot)),
    counts: entries.map((e) => e.length),
    scope,
    initial,
    actions: {
      select: (row) => {
        showNotice(null);
        let baseAt: Range | null = null;
        const sides = others.map((o, i) => {
          const e = row.cells[i].entry;
          const at = e ? locateEntry(e, base.doc, o.doc) : null;
          baseAt ??= at?.a ?? null;
          const range = at?.b ?? selectNode(o.doc.node, row.path)?.range ?? null;
          o.slot.panel.reveal(range);
          return { name: short(o.slot), text: o.doc.text, range: row.cells[i].present ? range : null };
        });
        const baseRange = baseAt ?? selectNode(base.doc.node, row.path)?.range ?? null;
        base.slot.panel.reveal(baseRange);
        showEvidence(row.label, [
          { name: short(base.slot), text: base.doc.text, range: row.base.present ? baseRange : null },
          ...sides,
        ]);
      },
      support,
      apply: (row, i, direction) => {
        const e = row.cells[i].entry;
        if (e && applyChange(e, direction === 'toFile' ? 'aToB' : 'bToA', base, others[i])) {
          pending = { row: rows.indexOf(row), column: i + 2 };
        }
      },
      applyAll: (row) => {
        const failed: string[] = [];
        // texts before the change, to undo all files in one step
        const before = new Map<Slot, string>();
        row.cells.forEach((c, i) => {
          if (!c.entry || support(row, i) !== null) return;
          const text = others[i].slot.input.text;
          if (applyChange(c.entry, 'aToB', base, others[i])) before.set(others[i].slot, text);
          else failed.push(name(others[i].slot));
        });
        if (failed.length) showNotice(`${PATCH_ERROR}: ${failed.join(', ')}`);
        if (before.size === 0) return;
        pending = { row: rows.indexOf(row), column: 0 };
        const after = new Map([...before.keys()].map((s) => [s, s.input.text]));
        showStatus(`Riportato in ${[...before.keys()].map(title).join(', ')}.`, {
          label: 'Annulla tutto',
          run: () => undoAll(before, after, 'Riporto annullato in tutti i file.'),
        });
      },
    },
  }, answer);
}

/** Name of a file in messages and headers: the user's label, or "File A". */
function name(slot: Slot): string {
  return slot.input.label || `File ${slot.letter}`;
}

/** Shortest name, for buttons and lists of files: the label, or "A". */
function short(slot: Slot): string {
  return slot.input.label || slot.letter;
}

/** Name with the loaded file name, for column headers and confirmations. */
function title(slot: Slot): string {
  return slot.input.fileName ? `${name(slot)} · ${slot.input.fileName}` : name(slot);
}

/** Applies `entry` between two loaded files; returns whether the target editor was changed. */
function applyChange(entry: DiffEntry, direction: Direction, a: Loaded, b: Loaded): boolean {
  if (a.doc.text !== a.slot.input.text || b.doc.text !== b.slot.input.text) {
    // the result is about to be recomputed: its positions no longer match the editors
    showNotice("Il contenuto è cambiato: riprova dopo l'aggiornamento del confronto");
    run();
    return false;
  }
  const r = applyEntry(entry, direction, a.doc, b.doc);
  if (!r.ok) {
    showNotice(r.error);
    return false;
  }
  showNotice(null);
  const target = direction === 'aToB' ? b : a;
  const before = new Map([[target.slot, target.slot.input.text]]);
  target.slot.panel.replace(r.edit);
  // the editors are read-only, so the way back is offered here rather than through Ctrl+Z
  const after = new Map([[target.slot, target.slot.input.text]]);
  showStatus(`Riportato in ${title(target.slot)}.`, { label: 'Annulla', run: () => undoAll(before, after) });
  return true;
}

/** Puts back the texts an apply changed, unless they were changed again since (another apply, a paste…). */
function undoAll(before: Map<Slot, string>, after: Map<Slot, string>, done = 'Riporto annullato.'): void {
  const changed = [...before.keys()].some((s) => !slots.includes(s) || s.input.text !== after.get(s));
  if (changed) {
    showNotice('Il file è cambiato dopo il riporto: non si può più annullare.');
    return;
  }
  for (const [slot, text] of before) slot.panel.replace({ start: 0, end: slot.input.text.length, text });
  showStatus(done);
}

function missingIncludes(paths: Path[], loaded: Loaded[]): string[] {
  const where = loaded.length === 2 ? `né in ${short(loaded[0].slot)} né in ${short(loaded[1].slot)}` : 'in nessun file';
  return paths
    .filter((p) => loaded.every((l) => !selectNode(l.doc.node, p)))
    .map((p) => `Includi: ${formatPath(p)} non trovato ${where}`);
}

function rootMessage(path: string, loaded: Loaded[]): string | null {
  if (path === '$') return null;
  const scoped = loaded.filter((l) => l.applied).map((l) => short(l.slot));
  const whole = loaded.filter((l) => !l.applied).map((l) => short(l.slot));
  if (scoped.length === 0) return `Root ${path} non trovata: confronto tra i file interi`;
  if (whole.length === 0) {
    return loaded.length === 2 ? `Root ${path} applicata a ${scoped.join(' e ')}` : `Root ${path} applicata a tutti i file`;
  }
  if (loaded.length === 2) return `Root ${path} applicata solo a ${scoped[0]}: confrontata con l'intero file ${whole[0]}`;
  return `Root ${path} applicata a ${scoped.join(', ')}; file interi: ${whole.join(', ')}`;
}
