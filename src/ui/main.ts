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
} from '../core/model';
import { parse } from '../core/parse';
import { applyEntry, patchSupport, type Direction, type PatchDoc } from '../core/patch';
import { applyRoot, parsePath, parsePathList, selectNode, type Scoped } from '../core/select';
import { el } from './dom';
import { createInputPanel, type InputState } from './input';
import { createOptionsBar } from './options';
import { renderResult } from './result';

const byId = (id: string) => document.getElementById(id)!;

const notice = el('div', 'notice');
notice.hidden = true;
byId('result').before(notice);

function showNotice(message: string | null): void {
  notice.hidden = !message;
  notice.textContent = message ?? '';
}

const SAME_FORMAT_ONLY = 'Disponibile solo con file dello stesso formato';
const ROOT_ONE_SIDE = 'Non disponibile quando la root è applicata a un solo file';

let opts: DiffOptions = { ...DEFAULT_OPTIONS };
let inputA: InputState = { text: '', choice: 'auto' };
let inputB: InputState = { text: '', choice: 'auto' };
let timer: number | undefined;

const optionsBar = createOptionsBar(byId('options'), opts, (o) => {
  opts = o;
  schedule();
});
const panelA = createInputPanel(byId('input-a'), 'File A', (s) => {
  inputA = s;
  schedule();
});
const panelB = createInputPanel(byId('input-b'), 'File B', (s) => {
  inputB = s;
  schedule();
});

function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(run, 300);
}

function analyze(s: InputState): { format: Format; result: ParseResult } | null {
  if (s.text.trim() === '') return null;
  const format = s.choice === 'auto' ? detectFormat(s.text, s.fileName) : s.choice;
  return { format, result: parse(s.text, format) };
}

function run(): void {
  const a = analyze(inputA);
  const b = analyze(inputB);
  panelA.setStatus(a?.format ?? null, a && !a.result.ok ? a.result.error : null);
  panelB.setStatus(b?.format ?? null, b && !b.result.ok ? b.result.error : null);

  const sameFormat = !a || !b || a.format === b.format;
  const rootPath = parsePath(opts.root);
  const includes = parsePathList(opts.include);

  if (!rootPath.ok || !includes.ok || !a || !b || !a.result.ok || !b.result.ok) {
    const syntaxError = !rootPath.ok ? rootPath.error : !includes.ok ? includes.error : null;
    optionsBar.setScopeMessage(syntaxError, 'error');
    optionsBar.setWhitespaceEnabled(sameFormat, SAME_FORMAT_ONLY);
    renderResult(byId('result'), null);
    return;
  }
  const scope = applyRoot(a.result.node, b.result.node, rootPath.path);
  const notes = [rootMessage(formatPath(rootPath.path), scope), ...missingIncludes(includes.paths, scope)];
  const info = notes.filter((n): n is string => n !== null);
  optionsBar.setScopeMessage(info.length ? info.join('\n') : null, 'info');

  // nesting changes the indentation of every line, so whitespace makes no sense on one side only
  const oneSided = scope.inA !== scope.inB;
  optionsBar.setWhitespaceEnabled(sameFormat && !oneSided, oneSided ? ROOT_ONE_SIDE : SAME_FORMAT_ONLY);

  const raw = sameFormat && !oneSided ? { a: inputA.text, b: inputB.text } : undefined;
  const entries = filterEntries(diff(scope.a, scope.b, opts, raw), includes.paths);
  const docA: PatchDoc = { text: inputA.text, format: a.format, node: scope.a, rootPath: scope.inA ? rootPath.path : [] };
  const docB: PatchDoc = { text: inputB.text, format: b.format, node: scope.b, rootPath: scope.inB ? rootPath.path : [] };
  renderResult(byId('result'), {
    textA: inputA.text,
    textB: inputB.text,
    entries,
    actions: {
      support: (e) => patchSupport(e, docA, docB, opts.ignoreArrayOrder),
      apply: (e, direction) => applyChange(e, direction, docA, docB),
      select: (e) => {
        showNotice(null);
        panelA.reveal(e.a?.range ?? null);
        panelB.reveal(e.b?.range ?? null);
      },
    },
  });
}

function applyChange(entry: DiffEntry, direction: Direction, docA: PatchDoc, docB: PatchDoc): void {
  if (docA.text !== inputA.text || docB.text !== inputB.text) {
    // the result is about to be recomputed: its positions no longer match the editors
    showNotice('Il contenuto è cambiato: riprova dopo l\'aggiornamento del confronto');
    run();
    return;
  }
  const r = applyEntry(entry, direction, docA, docB);
  if (!r.ok) {
    showNotice(r.error);
    return;
  }
  showNotice(null);
  (direction === 'aToB' ? panelB : panelA).replace(r.edit);
}

function missingIncludes(paths: Path[], scope: Scoped): string[] {
  return paths
    .filter((p) => !selectNode(scope.a, p) && !selectNode(scope.b, p))
    .map((p) => `Includi: ${formatPath(p)} non trovato né in A né in B`);
}

function rootMessage(path: string, scope: Scoped): string | null {
  if (path === '$') return null;
  if (scope.inA && scope.inB) return `Root ${path} applicata a A e B`;
  if (scope.inA) return `Root ${path} applicata solo a A: confrontata con l'intero file B`;
  if (scope.inB) return `Root ${path} applicata solo a B: confrontata con l'intero file A`;
  return `Root ${path} non trovata: confronto tra i file interi`;
}
