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
import { el } from './dom';
import { createInputPanel, type InputPanel, type InputState } from './input';
import { renderMatrix } from './matrix';
import { createOptionsBar } from './options';
import { renderResult } from './result';

const byId = (id: string) => document.getElementById(id)!;

const SAME_FORMAT_ONLY = 'Disponibile solo con file dello stesso formato';
const ROOT_ONE_SIDE = 'Non disponibile quando la root è applicata solo ad alcuni file';
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

/** One input panel. */
type Slot = { letter: string; root: HTMLElement; panel: InputPanel; input: InputState };
type Analysis = { format: Format; result: ParseResult };
/** A parsed, non-empty file with the root applied when present. */
type Loaded = { slot: Slot; doc: PatchDoc; applied: boolean };

const notice = el('div', 'notice');
notice.hidden = true;
byId('result').before(notice);

function showNotice(message: string | null): void {
  notice.hidden = !message;
  notice.textContent = message ?? '';
}

let opts: DiffOptions = { ...DEFAULT_OPTIONS };
let timer: number | undefined;
const slots: Slot[] = [];
let baseLetter = 'A';

const optionsBar = createOptionsBar(byId('options'), opts, (o) => {
  opts = o;
  schedule();
});

const addButton = byId('add-file') as HTMLButtonElement;
addButton.textContent ||= '+ Aggiungi file';
addButton.addEventListener('click', () => {
  addSlot();
  schedule();
});
addSlot();
addSlot();

function addSlot(): void {
  const letter = LETTERS.find((l) => !slots.some((s) => s.letter === l));
  if (!letter) return;
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
    },
  );
  const slot: Slot = { letter, root, panel, input: { text: '', choice: 'auto' } };
  slots.push(slot);
  refreshControls();
}

function removeSlot(slot: Slot): void {
  if (slots.length <= 2) return;
  slot.root.remove();
  slots.splice(slots.indexOf(slot), 1);
  if (baseLetter === slot.letter) baseLetter = slots[0].letter;
  refreshControls();
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
    renderResult(byId('result'), null);
    return;
  }
  const loaded = filled.map((f) => load(f.slot, f.a, rootPath.path));
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
  if (others.length === 1) renderPair(base, others[0], entries[0]);
  else renderMatrixView(base, others, entries);
}

function load(slot: Slot, a: Analysis, root: Path): Loaded {
  if (!a.result.ok) throw new Error('only parsed files can be loaded');
  const scoped = root.length ? selectNode(a.result.node, root) : undefined;
  const doc: PatchDoc = { text: slot.input.text, format: a.format, node: scoped ?? a.result.node, rootPath: scoped ? root : [] };
  return { slot, doc, applied: scoped !== undefined };
}

function renderPair(base: Loaded, other: Loaded, entries: DiffEntry[]): void {
  renderResult(byId('result'), {
    textA: base.doc.text,
    textB: other.doc.text,
    entries,
    labels: { a: title(base.slot), b: title(other.slot) },
    actions: {
      support: (e) => patchSupport(e, base.doc, other.doc, opts.ignoreArrayOrder),
      apply: (e, direction) => applyChange(e, direction, base, other),
      select: (e) => {
        showNotice(null);
        const at = locateEntry(e, base.doc, other.doc);
        base.slot.panel.reveal(at.a);
        other.slot.panel.reveal(at.b);
        return at;
      },
    },
  });
}

function renderMatrixView(base: Loaded, others: Loaded[], entries: DiffEntry[][]): void {
  const support = (row: MatrixRow, i: number) => {
    const e = row.cells[i].entry;
    return e ? patchSupport(e, base.doc, others[i].doc, opts.ignoreArrayOrder) : 'Nessuna differenza diretta con la base';
  };
  renderMatrix(byId('result'), {
    rows: buildMatrix(base.doc, others.map((o) => o.doc), entries),
    names: [base, ...others].map((l) => `File ${l.slot.letter}`),
    titles: [base, ...others].map((l) => title(l.slot)),
    counts: entries.map((e) => e.length),
    actions: {
      select: (row) => {
        showNotice(null);
        let baseAt: Range | null = null;
        others.forEach((o, i) => {
          const e = row.cells[i].entry;
          const at = e ? locateEntry(e, base.doc, o.doc) : null;
          baseAt ??= at?.a ?? null;
          o.slot.panel.reveal(at?.b ?? selectNode(o.doc.node, row.path)?.range ?? null);
        });
        base.slot.panel.reveal(baseAt ?? selectNode(base.doc.node, row.path)?.range ?? null);
      },
      support,
      apply: (row, i, direction) => {
        const e = row.cells[i].entry;
        if (e) applyChange(e, direction === 'toFile' ? 'aToB' : 'bToA', base, others[i]);
      },
      applyAll: (row) => {
        const failed: string[] = [];
        row.cells.forEach((c, i) => {
          if (c.entry && support(row, i) === null && !applyChange(c.entry, 'aToB', base, others[i])) {
            failed.push(`File ${others[i].slot.letter}`);
          }
        });
        if (failed.length) showNotice(`${PATCH_ERROR}: ${failed.join(', ')}`);
      },
    },
  });
}

function title(slot: Slot): string {
  return slot.input.fileName ? `File ${slot.letter} · ${slot.input.fileName}` : `File ${slot.letter}`;
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
  (direction === 'aToB' ? b : a).slot.panel.replace(r.edit);
  return true;
}

function missingIncludes(paths: Path[], loaded: Loaded[]): string[] {
  const where = loaded.length === 2 ? `né in ${loaded[0].slot.letter} né in ${loaded[1].slot.letter}` : 'in nessun file';
  return paths
    .filter((p) => loaded.every((l) => !selectNode(l.doc.node, p)))
    .map((p) => `Includi: ${formatPath(p)} non trovato ${where}`);
}

function rootMessage(path: string, loaded: Loaded[]): string | null {
  if (path === '$') return null;
  const scoped = loaded.filter((l) => l.applied).map((l) => l.slot.letter);
  const whole = loaded.filter((l) => !l.applied).map((l) => l.slot.letter);
  if (scoped.length === 0) return `Root ${path} non trovata: confronto tra i file interi`;
  if (whole.length === 0) {
    return loaded.length === 2 ? `Root ${path} applicata a ${scoped.join(' e ')}` : `Root ${path} applicata a tutti i file`;
  }
  if (loaded.length === 2) return `Root ${path} applicata solo a ${scoped[0]}: confrontata con l'intero file ${whole[0]}`;
  return `Root ${path} applicata a ${scoped.join(', ')}; file interi: ${whole.join(', ')}`;
}
