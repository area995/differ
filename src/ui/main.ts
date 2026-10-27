import '../styles.css';
import { detectFormat } from '../core/detect';
import { diff } from '../core/diff';
import { DEFAULT_OPTIONS, type DiffOptions, type Format, type ParseResult } from '../core/model';
import { parse } from '../core/parse';
import { createInputPanel, type InputState } from './input';
import { createOptionsBar } from './options';
import { renderResult } from './result';

const byId = (id: string) => document.getElementById(id)!;

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
  optionsBar.setWhitespaceEnabled(sameFormat, 'Disponibile solo con file dello stesso formato');

  if (!a || !b || !a.result.ok || !b.result.ok) {
    renderResult(byId('result'), null);
    return;
  }
  const raw = sameFormat ? { a: inputA.text, b: inputB.text } : undefined;
  const entries = diff(a.result.node, b.result.node, opts, raw);
  renderResult(byId('result'), { textA: inputA.text, textB: inputB.text, entries });
}
