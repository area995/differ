import type { Format, ParseError } from '../core/model';
import { el } from './dom';

export type FormatChoice = 'auto' | Format;
export type InputState = { text: string; fileName?: string; choice: FormatChoice };
export type InputPanel = { setStatus(format: Format | null, error: ParseError | null): void };

const MAX_SIZE = 5 * 1024 * 1024;

export function createInputPanel(
  root: HTMLElement,
  title: string,
  onChange: (state: InputState) => void,
): InputPanel {
  const state: InputState = { text: '', choice: 'auto' };

  const heading = el('h2');
  heading.textContent = title;
  const select = el('select');
  for (const [value, label] of [
    ['auto', 'Auto'],
    ['json', 'JSON'],
    ['yaml', 'YAML'],
  ]) {
    const option = el('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  const detected = el('span', 'detected');
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,.yaml,.yml';
  fileInput.hidden = true;
  const fileButton = el('label', 'file-btn');
  fileButton.append('Apri file…', fileInput);
  const head = el('div', 'panel-head');
  head.append(heading, select, detected, fileButton);

  const gutter = el('pre', 'gutter');
  const textarea = el('textarea');
  textarea.spellcheck = false;
  textarea.wrap = 'off';
  textarea.placeholder = 'Incolla qui il contenuto o trascina un file';
  const editor = el('div', 'editor');
  editor.append(gutter, textarea);

  const error = el('div', 'error');
  error.hidden = true;
  root.append(head, editor, error);

  let lineCount = -1;
  let errorLine = 0;
  const renderGutter = (force = false) => {
    const n = textarea.value.split('\n').length;
    if (n !== lineCount || force) {
      lineCount = n;
      gutter.replaceChildren(
        ...Array.from({ length: n }, (_, i) => {
          const span = el('span', i + 1 === errorLine ? 'err' : undefined);
          span.textContent = String(i + 1);
          return span;
        }),
      );
    }
    gutter.scrollTop = textarea.scrollTop;
  };

  const emit = () => onChange({ ...state });

  const load = async (file: File) => {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    if (file.size > MAX_SIZE && !confirm(`${file.name} pesa ${mb} MB. Caricarlo comunque?`)) return;
    state.text = await file.text();
    state.fileName = file.name;
    textarea.value = state.text;
    renderGutter();
    emit();
  };

  textarea.addEventListener('input', () => {
    state.text = textarea.value;
    renderGutter();
    emit();
  });
  textarea.addEventListener('scroll', () => {
    gutter.scrollTop = textarea.scrollTop;
  });
  select.addEventListener('change', () => {
    state.choice = select.value as FormatChoice;
    emit();
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void load(file);
    fileInput.value = '';
  });
  root.addEventListener('dragover', (e) => {
    e.preventDefault();
    root.classList.add('drop');
  });
  root.addEventListener('dragleave', () => root.classList.remove('drop'));
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    root.classList.remove('drop');
    const file = e.dataTransfer?.files[0];
    if (file) void load(file);
  });

  renderGutter();

  return {
    setStatus(format, err) {
      detected.textContent = format && state.choice === 'auto' ? `rilevato: ${format.toUpperCase()}` : '';
      error.hidden = !err;
      error.textContent = err ? `Riga ${err.pos.line}, colonna ${err.pos.col}: ${err.message}` : '';
      const nextErrorLine = err?.pos.line ?? 0;
      if (nextErrorLine !== errorLine) {
        errorLine = nextErrorLine;
        renderGutter(true);
      }
    },
  };
}
