import { formatPath, type DiffOptions } from '../core/model';
import { parsePathList } from '../core/select';
import { el } from './dom';
import { renderTree, type TreeItem } from './tree';

type BoolKey = Exclude<keyof DiffOptions, 'arrayKeyField' | 'root' | 'include'>;

const CHECKS: { key: BoolKey; label: string; title: string }[] = [
  { key: 'keys', label: 'Differenze chiavi', title: 'Chiavi aggiunte o rimosse' },
  { key: 'values', label: 'Differenze valori', title: 'Valori o tipi diversi sulle stesse chiavi' },
  { key: 'whitespace', label: 'Spazi e tabulazioni', title: 'Differenze di formattazione su contenuti uguali' },
  { key: 'keyOrder', label: 'Posizione chiavi', title: 'Chiavi comuni in ordine diverso' },
  { key: 'ignoreArrayOrder', label: 'Ignora ordine array', title: "Abbina gli elementi degli array senza considerare l'indice" },
  { key: 'looseTypes', label: 'Tipi laschi', title: '8080 uguale a "8080", true uguale a "true"' },
];

export type OptionsBar = {
  setWhitespaceEnabled(enabled: boolean, reason: string): void;
  setScopeMessage(message: string | null, kind: 'info' | 'error'): void;
  /** Subtrees offered by the include picker, or null when the files cannot be read. */
  setIncludeTree(items: TreeItem[] | null): void;
};

export function createOptionsBar(
  root: HTMLElement,
  initial: DiffOptions,
  onChange: (opts: DiffOptions) => void,
): OptionsBar {
  const opts = { ...initial };
  const labels = new Map<BoolKey, HTMLLabelElement>();
  const inputs = new Map<BoolKey, HTMLInputElement>();

  const pathField = (key: 'root' | 'include', label: string, placeholder: string, title: string) => {
    const input = el('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = opts[key];
    input.addEventListener('input', () => {
      opts[key] = input.value;
      onChange({ ...opts });
    });
    const wrapper = el('label', 'opt');
    wrapper.title = title;
    wrapper.append(label, input);
    root.append(wrapper);
    return input;
  };
  pathField(
    'root',
    'Root',
    'tutto il documento (es. $.server)',
    'Path il cui valore sostituisce il documento nei file che lo contengono. Si può copiare dalla lista differenze.',
  );
  const includeInput = pathField(
    'include',
    'Includi',
    'tutti i sottoalberi (es. server, db.pool)',
    'Path relativi alla root, separati da virgola: confronta solo questi sottoalberi.',
  );

  // tree of the subtrees found in the files, to pick the included ones
  let includeItems: TreeItem[] | null = null;
  const pickerExpanded = new Map<string, boolean>();
  const pick = el('button', 'include-pick');
  pick.type = 'button';
  pick.textContent = 'Scegli';
  pick.title = 'Scegli i sottoalberi da includere';
  pick.setAttribute('aria-expanded', 'false');
  root.append(pick);
  const picker = el('div', 'include-picker');
  picker.hidden = true;

  const selectedIds = (): string[] => {
    const parsed = parsePathList(opts.include);
    return parsed.ok ? parsed.paths.map(formatPath) : [];
  };
  const isUnder = (id: string, ancestor: string) => id.startsWith(`${ancestor}.`) || id.startsWith(`${ancestor}[`);
  const renderPicker = () => {
    if (picker.hidden) return;
    if (!includeItems) {
      picker.textContent = 'Carica almeno due file validi per scegliere i sottoalberi';
      return;
    }
    const selected = selectedIds();
    renderTree(picker, includeItems, {
      expanded: pickerExpanded,
      defaultDepth: 1,
      checks: {
        state: (id) => (selected.includes(id) ? 'on' : selected.some((s) => isUnder(id, s)) ? 'implied' : 'off'),
        onChange: (id, checked) => {
          const kept = selected.filter((s) => s !== id && !(checked && isUnder(s, id)));
          opts.include = (checked ? [...kept, id] : kept).join(', ');
          includeInput.value = opts.include;
          onChange({ ...opts });
          renderPicker();
        },
      },
    });
  };
  pick.addEventListener('click', () => {
    picker.hidden = !picker.hidden;
    pick.setAttribute('aria-expanded', String(!picker.hidden));
    renderPicker();
  });

  const fieldInput = el('input');
  fieldInput.type = 'text';
  fieldInput.placeholder = 'campo chiave (es. name)';
  fieldInput.value = opts.arrayKeyField;
  fieldInput.disabled = !opts.ignoreArrayOrder;
  fieldInput.addEventListener('input', () => {
    opts.arrayKeyField = fieldInput.value;
    onChange({ ...opts });
  });

  for (const c of CHECKS) {
    const label = el('label', 'opt');
    label.title = c.title;
    const input = el('input');
    input.type = 'checkbox';
    input.checked = opts[c.key];
    input.addEventListener('change', () => {
      opts[c.key] = input.checked;
      fieldInput.disabled = !opts.ignoreArrayOrder;
      onChange({ ...opts });
    });
    label.append(input, c.label);
    root.append(label);
    labels.set(c.key, label);
    inputs.set(c.key, input);
  }

  const field = el('label', 'opt');
  field.title = 'Con "Ignora ordine array": abbina gli oggetti per questo campo (es. name, id)';
  field.append(fieldInput);
  root.append(field);

  const scopeMessage = el('div', 'scope-msg');
  scopeMessage.hidden = true;
  root.append(scopeMessage, picker);

  return {
    setWhitespaceEnabled(enabled, reason) {
      const label = labels.get('whitespace')!;
      inputs.get('whitespace')!.disabled = !enabled;
      label.classList.toggle('disabled', !enabled);
      label.title = enabled ? CHECKS[2].title : reason;
    },
    setScopeMessage(message, kind) {
      scopeMessage.hidden = !message;
      scopeMessage.textContent = message ?? '';
      scopeMessage.classList.toggle('error', kind === 'error');
    },
    setIncludeTree(items) {
      includeItems = items;
      renderPicker();
    },
  };
}
