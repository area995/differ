import '../styles.css';
import { detectFormat } from '../core/detect';
import { diff } from '../core/diff';
import { DEFAULT_OPTIONS, formatPath, type DiffOptions, type Format, type ParseResult } from '../core/model';
import { parse } from '../core/parse';
import { applyRoot, parsePath, type Scoped } from '../core/select';
import { createInputPanel, type InputState } from './input';
import { createOptionsBar } from './options';
import { renderResult } from './result';

const byId = (id: string) => document.getElementById(id)!;

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

  if (!rootPath.ok || !a || !b || !a.result.ok || !b.result.ok) {
    optionsBar.setRootMessage(rootPath.ok ? null : rootPath.error, 'error');
    optionsBar.setWhitespaceEnabled(sameFormat, SAME_FORMAT_ONLY);
    renderResult(byId('result'), null);
    return;
  }
  const scope = applyRoot(a.result.node, b.result.node, rootPath.path);
  optionsBar.setRootMessage(rootMessage(formatPath(rootPath.path), scope), 'info');

  // nesting changes the indentation of every line, so whitespace makes no sense on one side only
  const oneSided = scope.inA !== scope.inB;
  optionsBar.setWhitespaceEnabled(sameFormat && !oneSided, oneSided ? ROOT_ONE_SIDE : SAME_FORMAT_ONLY);

  const raw = sameFormat && !oneSided ? { a: inputA.text, b: inputB.text } : undefined;
  const entries = diff(scope.a, scope.b, opts, raw);
  renderResult(byId('result'), { textA: inputA.text, textB: inputB.text, entries });
}

function rootMessage(path: string, scope: Scoped): string | null {
  if (path === '$') return null;
  if (scope.inA && scope.inB) return `Root ${path} applicata a A e B`;
  if (scope.inA) return `Root ${path} applicata solo a A: confrontata con l'intero file B`;
  if (scope.inB) return `Root ${path} applicata solo a B: confrontata con l'intero file A`;
  return `Root ${path} non trovata: confronto tra i file interi`;
}
