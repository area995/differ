import { markEdit, noMarks } from '../core/linemarks';
import type { DiffKind, Format, Node, ParseError, Range } from '../core/model';
import type { Edit } from '../core/patch';
import { eolOf, toLf, toOffset } from '../core/text';
import { el, setTabStop, step } from './dom';
import { iconButton } from './icons';
import { renderTree, setAllExpanded } from './tree';
import { documentItems } from './tree-items';

export type FormatChoice = 'auto' | Format;
/**
 * `label` is the user's name for the file ("prod"), empty for none. `text` always has LF line endings;
 * `eol` is the line ending of the file it came from, restored when saving (none = LF).
 */
export type InputState = { text: string; fileName?: string; choice: FormatChoice; label?: string; eol?: '\r\n' };
export type InputPanel = {
  setStatus(format: Format | null, error: ParseError | null): void;
  /** Selects `range` in the editor, scrolls to it and marks its lines in the gutter. */
  reveal(range: Range | null): void;
  /** Loads a file into this card, replacing its content. */
  load(file: File): Promise<void>;
  /**
   * Applies an edit and selects the new text, only if the result is exactly `expected` (the text that was
   * checked); otherwise leaves the editor untouched and returns false.
   */
  replace(edit: Edit, expected: string): boolean;
  setControls(state: { base: boolean; removable: boolean }): void;
  /** The parsed document for the tree tab, or null with the reason shown instead. */
  setTree(node: Node | null, message: string): void;
  /** Colors the lines of this file that differ, by kind of difference. */
  setDiffMarks(marks: Map<number, DiffKind>): void;
  /** Puts back a previous state, e.g. of a removed file. */
  restore(state: InputState, modified: boolean): void;
  /** Whether applied changes have not been saved since. */
  isModified(): boolean;
};

/** `onMoreFiles`: the files after the first of a multiple selection or drop, for the other cards. */
export type PanelControls = { onBase(): void; onRemove(): void; onMoreFiles(files: File[]): void };

const MAX_SIZE = 5 * 1024 * 1024;

/**
 * A Signal Blue wash that fades from lines the eye has to find after a jump: those of a selected node (land),
 * longer on those just changed by an apply (post), which settle into Applied Gray.
 */
type Wash = { from: number; to: number; start: number; kind: 'land' | 'post' };
/** Durations of the two washes, matching the CSS animations. */
const WASH_MS = { land: 600, post: 1200 };

/** 1-based line of a text offset. */
const lineOf = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

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
  // what the file is for the user (prod, staging…): names it everywhere instead of the letter
  const labelInput = el('input', 'slot-name');
  labelInput.type = 'text';
  labelInput.placeholder = 'nome (es. prod)';
  labelInput.maxLength = 24;
  labelInput.setAttribute('aria-label', `Nome di ${title}`);
  const select = el('select');
  select.setAttribute('aria-label', `Formato di ${title}`);
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
  fileInput.multiple = true;
  fileInput.hidden = true;
  // a real button, so that the picker can be opened from the keyboard
  const fileButton = el('button', 'file-btn');
  fileButton.type = 'button';
  fileButton.textContent = 'Apri file…';
  fileButton.title = 'Apri uno o più file: i successivi vanno nelle card vuote, aggiungendone se servono';
  fileButton.addEventListener('click', () => fileInput.click());
  const save = iconButton('download', 'save', 'Salva', 'Scarica il contenuto attuale');
  const fileName = el('span', 'file-name');
  fileName.hidden = true;
  // applied changes live only in the page until saved
  const modifiedTag = el('span', 'modified');
  modifiedTag.textContent = 'modificato, non salvato';
  modifiedTag.hidden = true;
  let modified = false;
  const setModified = (value: boolean) => {
    modified = value;
    modifiedTag.hidden = !value;
  };
  // the actions stay together at the end of the header, whatever wraps before them
  const actions = el('div', 'panel-actions');
  actions.append(fileButton, fileInput, save);
  const head = el('div', 'panel-head');
  head.append(heading, labelInput, fileName, select, detected, modifiedTag, actions);

  const baseInput = el('input');
  baseInput.type = 'radio';
  baseInput.name = 'base';
  const baseLabel = el('label', 'base-pick');
  baseLabel.title = 'Confronta gli altri file con questo';
  baseLabel.append(baseInput, 'Base');
  const remove = iconButton('trash', 'remove', 'Rimuovi file', 'Rimuovi questo file dal confronto');
  remove.hidden = true;
  if (controls) {
    baseInput.addEventListener('change', () => controls.onBase());
    remove.addEventListener('click', () => controls.onRemove());
    fileName.after(baseLabel);
    actions.append(remove);
  }

  const gutter = el('pre', 'gutter');
  const textarea = el('textarea');
  textarea.spellcheck = false;
  textarea.wrap = 'off';
  // content comes only from a file, a drop or a paste: the text can be scrolled and selected, not typed
  textarea.readOnly = true;
  textarea.placeholder = 'Apri un file, trascinalo qui o incollalo (Ctrl+V)';
  textarea.setAttribute('aria-label', `Contenuto di ${title}`);
  // shades applied lines behind the (transparent) textarea, which cannot color its own lines
  const backdrop = el('div', 'backdrop');
  const backdropLines = el('div', 'backdrop-lines');
  backdrop.append(backdropLines);
  const field = el('div', 'field');
  field.append(backdrop, textarea);
  const editor = el('div', 'editor');
  editor.append(gutter, field);

  const error = el('div', 'error');
  error.setAttribute('role', 'status');
  error.hidden = true;

  // read-only tree of the document, as an alternative to the text
  let tree: Node | null = null;
  let treeMessage = 'Nessun contenuto';
  const expanded = new Map<string, boolean>();
  const treeView = el('div', 'tree-view');
  treeView.hidden = true;
  const treeTools = el('div', 'tree-tools');
  const treeBody = el('div', 'tree-body');
  treeView.append(treeTools, treeBody);
  const renderTreeView = () => {
    if (treeView.hidden) return;
    const items = tree ? documentItems(tree) : [];
    treeTools.hidden = !tree;
    if (!tree) {
      treeBody.textContent = treeMessage;
      return;
    }
    renderTree(treeBody, items, {
      expanded,
      defaultDepth: 2,
      onSelect: (item) => {
        showTab('text');
        if (item.range) panel.reveal(item.range);
      },
    });
  };
  for (const [label, open] of [
    ['Espandi tutto', true],
    ['Comprimi tutto', false],
  ] as const) {
    const b = el('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => {
      if (tree) setAllExpanded(documentItems(tree), expanded, open);
      renderTreeView();
    });
    treeTools.append(b);
  }

  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', `Vista di ${title}`);
  const views = { text: editor, tree: treeView };
  const tabButtons = (['text', 'tree'] as const).map((name, i) => {
    const b = el('button');
    b.type = 'button';
    b.textContent = name === 'text' ? 'Testo' : 'Albero';
    b.setAttribute('role', 'tab');
    views[name].setAttribute('role', 'tabpanel');
    if (root.id) {
      b.id = `${root.id}-tab-${name}`;
      views[name].id = `${root.id}-${name}`;
      b.setAttribute('aria-controls', views[name].id);
      views[name].setAttribute('aria-labelledby', b.id);
    }
    b.addEventListener('click', () => showTab(name));
    b.addEventListener('keydown', (event) => {
      const next = step(event.key, i, 2, ['ArrowLeft'], ['ArrowRight']);
      if (next === null) return;
      event.preventDefault();
      tabButtons[next].focus();
      tabButtons[next].click();
    });
    tabs.append(b);
    return b;
  });
  const showTab = (name: 'text' | 'tree') => {
    editor.hidden = name !== 'text';
    treeView.hidden = name !== 'tree';
    const active = tabButtons[name === 'text' ? 0 : 1];
    tabButtons.forEach((b) => b.setAttribute('aria-selected', String(b === active)));
    setTabStop(tabButtons, active);
    renderTreeView();
  };
  showTab('text');

  root.append(head, tabs, editor, treeView, error);

  let lineCount = -1;
  let errorLine = 0;
  let current: [number, number] | null = null;
  let marks = noMarks();
  let diffMarks = new Map<number, DiffKind>();
  let applying = false;
  let washes: Wash[] = [];
  const wash = (from: number, to: number, kind: Wash['kind']) =>
    washes.push({ from, to, kind, start: performance.now() });
  const syncScroll = () => {
    gutter.scrollTop = textarea.scrollTop;
    backdropLines.style.transform = `translateY(${-textarea.scrollTop}px)`;
  };
  const renderGutter = (force = false) => {
    const n = textarea.value.split('\n').length;
    if (n !== lineCount || force) {
      lineCount = n;
      const lines = Array.from({ length: n }, (_, i) => i + 1);
      const now = performance.now();
      washes = washes.filter((w) => now - w.start < WASH_MS[w.kind]);
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
          // a current difference says more than "changed by an apply"
          const kind = diffMarks.get(line);
          if (kind) shade.className = `d-${kind}`;
          else if (marks.lines.has(line)) shade.className = 'applied';
          if (marks.removedBefore.has(line)) shade.classList.add('removed-before');
          // the selected node, visible even when the textarea is not focused and paints no selection
          if (current && line >= current[0] && line <= current[1]) {
            shade.classList.add('cur');
            if (line === current[0]) shade.classList.add('cur-start');
            if (line === current[1]) shade.classList.add('cur-end');
          }
          // the lines are rebuilt on every recomputation: a negative delay resumes a wash where it was
          const w = washes.filter((x) => line >= x.from && line <= x.to).at(-1);
          if (w) {
            shade.classList.add('wash', `wash-${w.kind}`);
            shade.style.animationDelay = `${w.start - now}ms`;
          }
          return shade;
        }),
      );
    }
    syncScroll();
  };

  const emit = () => onChange({ ...state });

  /** Shows new content; its line endings become LF, as the editor would report them anyway. */
  const show = (next: InputState) => {
    Object.assign(state, next, { text: toLf(next.text) });
    fileName.textContent = next.fileName ?? '';
    fileName.title = next.fileName ?? '';
    fileName.hidden = !next.fileName;
    select.value = next.choice;
    labelInput.value = next.label ?? '';
    textarea.value = state.text;
    marks = noMarks();
    renderGutter(true);
    emit();
  };

  const load = async (file: File) => {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    if (file.size > MAX_SIZE && !confirm(`${file.name} pesa ${mb} MB. Caricarlo comunque?`)) return;
    setModified(false);
    const text = await file.text();
    show({ ...state, text, fileName: file.name, eol: eolOf(text) });
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
  labelInput.addEventListener('input', () => {
    state.label = labelInput.value.trim();
    emit();
  });
  /** The first file goes in this card, the others to the caller (the next empty cards). */
  const loadAll = (files: File[]) => {
    const [first, ...rest] = files;
    if (first) void load(first);
    if (rest.length) controls?.onMoreFiles(rest);
  };
  fileInput.addEventListener('change', () => {
    loadAll([...(fileInput.files ?? [])]);
    fileInput.value = '';
  });
  save.addEventListener('click', () => {
    const name = state.fileName ?? `${(state.label || title).toLowerCase().replace(/\s+/g, '-')}.${format ?? 'txt'}`;
    const content = state.eol ? textarea.value.replace(/\n/g, state.eol) : textarea.value;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const link = el('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setModified(false);
  });
  root.addEventListener('dragover', (e) => {
    e.preventDefault();
    root.classList.add('drop');
  });
  root.addEventListener('dragleave', () => root.classList.remove('drop'));
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    // handled here: the page-level drop would place the files again
    e.stopPropagation();
    root.classList.remove('drop');
    loadAll([...(e.dataTransfer?.files ?? [])]);
  });
  // a paste anywhere on the card (except its own fields) replaces the whole content, like opening a file
  root.addEventListener('paste', (e) => {
    const target = e.target as HTMLElement;
    if (target !== textarea && target.closest('input, select')) return;
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    e.preventDefault();
    setModified(false);
    show({ ...state, text, fileName: undefined, eol: eolOf(text) });
  });

  renderGutter();

  const panel: InputPanel = {
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

    load,

    reveal(range) {
      current = range ? [range.start.line, range.end.line] : null;
      if (range) wash(range.start.line, range.end.line, 'land');
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

    replace(edit, expected) {
      // the textarea is read-only, so changes are set directly; undo is offered by the caller (Annulla)
      const before = textarea.value;
      const next = before.slice(0, edit.start) + edit.text + before.slice(edit.end);
      // the edit was computed and checked on another text: applied here it would land elsewhere
      if (next !== expected) return false;
      textarea.value = next;
      applying = true;
      textarea.dispatchEvent(new Event('input'));
      applying = false;
      setModified(true);
      marks = markEdit(before, textarea.value, marks);
      const after = textarea.value;
      const [from, to] = [lineOf(after, edit.start), lineOf(after, edit.start + edit.text.length)];
      // the difference written here is resolved: its mark would only tint the wash until the recomputation
      diffMarks = new Map(diffMarks);
      for (let line = from; line <= to; line++) diffMarks.delete(line);
      wash(from, to, 'post');
      renderGutter(true);
      textarea.setSelectionRange(edit.start, edit.start + edit.text.length);
      return true;
    },

    setTree(node, message) {
      tree = node;
      treeMessage = message;
      renderTreeView();
    },

    setDiffMarks(next) {
      diffMarks = next;
      renderGutter(true);
    },

    restore(next, wasModified) {
      setModified(wasModified);
      show(next);
    },

    isModified: () => modified,
  };
  return panel;
}
