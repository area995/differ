import { markEdit, noMarks } from '../core/linemarks';
import type { Format, ParseError, Range } from '../core/model';
import type { Edit } from '../core/patch';
import { toOffset } from '../core/text';
import { el } from './dom';

export type FormatChoice = 'auto' | Format;
export type InputState = { text: string; fileName?: string; choice: FormatChoice };
export type InputPanel = {
  setStatus(format: Format | null, error: ParseError | null): void;
  /** Selects `range` in the editor, scrolls to it and marks its lines in the gutter. */
  reveal(range: Range | null): void;
  /** Applies an edit through the editor, so that the browser can undo it, and selects the new text. */
  replace(edit: Edit): void;
  setControls(state: { base: boolean; removable: boolean }): void;
};

export type PanelControls = { onBase(): void; onRemove(): void };

const MAX_SIZE = 5 * 1024 * 1024;

export function createInputPanel(
  root: HTMLElement,
  title: string,
  onChange: (state: InputState) => void,
  controls?: PanelControls,
): InputPanel {
  const state: InputState = { text: '', choice: 'auto' };
  let format: Format | null = null;

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
  const save = el('button', 'save');
  save.type = 'button';
  save.textContent = 'Salva';
  save.title = 'Scarica il contenuto attuale';
  const head = el('div', 'panel-head');
  head.append(heading, select, detected, fileButton, save);

  const baseInput = el('input');
  baseInput.type = 'radio';
  baseInput.name = 'base';
  const baseLabel = el('label', 'base-pick');
  baseLabel.title = 'Confronta gli altri file con questo';
  baseLabel.append(baseInput, 'Base');
  const remove = el('button', 'remove');
  remove.type = 'button';
  remove.textContent = '×';
  remove.title = 'Rimuovi questo file dal confronto';
  remove.hidden = true;
  if (controls) {
    baseInput.addEventListener('change', () => controls.onBase());
    remove.addEventListener('click', () => controls.onRemove());
    heading.after(baseLabel);
    head.append(remove);
  }

  const gutter = el('pre', 'gutter');
  const textarea = el('textarea');
  textarea.spellcheck = false;
  textarea.wrap = 'off';
  textarea.placeholder = 'Incolla qui il contenuto o trascina un file';
  // shades applied lines behind the (transparent) textarea, which cannot color its own lines
  const backdrop = el('div', 'backdrop');
  const backdropLines = el('div', 'backdrop-lines');
  backdrop.append(backdropLines);
  const field = el('div', 'field');
  field.append(backdrop, textarea);
  const editor = el('div', 'editor');
  editor.append(gutter, field);

  const error = el('div', 'error');
  error.hidden = true;
  root.append(head, editor, error);

  let lineCount = -1;
  let errorLine = 0;
  let current: [number, number] | null = null;
  let marks = noMarks();
  let applying = false;
  const syncScroll = () => {
    gutter.scrollTop = textarea.scrollTop;
    backdropLines.style.transform = `translateY(${-textarea.scrollTop}px)`;
  };
  const renderGutter = (force = false) => {
    const n = textarea.value.split('\n').length;
    if (n !== lineCount || force) {
      lineCount = n;
      const lines = Array.from({ length: n }, (_, i) => i + 1);
      gutter.replaceChildren(
        ...lines.map((line) => {
          const span = el('span');
          span.classList.toggle('err', line === errorLine);
          span.classList.toggle('cur', !!current && line >= current[0] && line <= current[1]);
          const sign = marks.lines.get(line) === 'added' ? '+' : marks.removedBefore.has(line) ? '−' : '';
          if (sign) span.dataset.sign = sign;
          span.textContent = String(line);
          return span;
        }),
      );
      backdropLines.replaceChildren(
        ...lines.map((line) => {
          const shade = el('div');
          if (marks.lines.has(line)) shade.className = 'applied';
          else if (marks.removedBefore.has(line)) shade.className = 'removed-before';
          return shade;
        }),
      );
    }
    syncScroll();
  };

  const emit = () => onChange({ ...state });

  const load = async (file: File) => {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    if (file.size > MAX_SIZE && !confirm(`${file.name} pesa ${mb} MB. Caricarlo comunque?`)) return;
    state.text = await file.text();
    state.fileName = file.name;
    textarea.value = state.text;
    marks = noMarks();
    renderGutter(true);
    emit();
  };

  textarea.addEventListener('input', () => {
    state.text = textarea.value;
    current = null;
    // a manual edit (or undo) makes the applied-line marks unreliable
    if (!applying) marks = noMarks();
    renderGutter(true);
    emit();
  });
  textarea.addEventListener('scroll', syncScroll);
  select.addEventListener('change', () => {
    state.choice = select.value as FormatChoice;
    emit();
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void load(file);
    fileInput.value = '';
  });
  save.addEventListener('click', () => {
    const name = state.fileName ?? `${title.toLowerCase().replace(/\s+/g, '-')}.${format ?? 'txt'}`;
    const url = URL.createObjectURL(new Blob([textarea.value], { type: 'text/plain' }));
    const link = el('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
    setStatus(nextFormat, err) {
      format = nextFormat;
      detected.textContent = nextFormat && state.choice === 'auto' ? `rilevato: ${nextFormat.toUpperCase()}` : '';
      error.hidden = !err;
      error.textContent = err ? `Riga ${err.pos.line}, colonna ${err.pos.col}: ${err.message}` : '';
      const nextErrorLine = err?.pos.line ?? 0;
      if (nextErrorLine !== errorLine) {
        errorLine = nextErrorLine;
        renderGutter(true);
      }
    },

    reveal(range) {
      current = range ? [range.start.line, range.end.line] : null;
      renderGutter(true);
      if (!range) return;
      const text = textarea.value;
      textarea.setSelectionRange(toOffset(text, range.start), toOffset(text, range.end));
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 19.5;
      textarea.scrollTop = Math.max(0, (range.start.line - 1) * lineHeight - textarea.clientHeight / 2);
      syncScroll();
    },

    setControls({ base, removable }) {
      baseInput.checked = base;
      root.classList.toggle('is-base', base);
      remove.hidden = !removable;
    },

    replace(edit) {
      const before = textarea.value;
      const expected = before.slice(0, edit.start) + edit.text + before.slice(edit.end);
      textarea.focus();
      textarea.setSelectionRange(edit.start, edit.end);
      applying = true;
      let undoable = false;
      try {
        // execCommand keeps the change in the browser undo stack (Ctrl+Z)
        undoable = typeof document.execCommand === 'function' && document.execCommand('insertText', false, edit.text);
      } catch {
        undoable = false;
      }
      if (textarea.value !== expected) {
        textarea.value = expected;
        textarea.dispatchEvent(new Event('input'));
      } else if (!undoable) {
        textarea.dispatchEvent(new Event('input'));
      }
      applying = false;
      marks = markEdit(before, textarea.value, marks);
      renderGutter(true);
      textarea.setSelectionRange(edit.start, edit.start + edit.text.length);
    },
  };
}
