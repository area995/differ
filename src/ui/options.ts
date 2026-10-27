import type { DiffOptions } from '../core/model';
import { el } from './dom';

type BoolKey = Exclude<keyof DiffOptions, 'arrayKeyField' | 'root'>;

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
  setRootMessage(message: string | null, kind: 'info' | 'error'): void;
};

export function createOptionsBar(
  root: HTMLElement,
  initial: DiffOptions,
  onChange: (opts: DiffOptions) => void,
): OptionsBar {
  const opts = { ...initial };
  const labels = new Map<BoolKey, HTMLLabelElement>();
  const inputs = new Map<BoolKey, HTMLInputElement>();

  const rootInput = el('input');
  rootInput.type = 'text';
  rootInput.placeholder = 'tutto il documento (es. $.server)';
  rootInput.value = opts.root;
  rootInput.addEventListener('input', () => {
    opts.root = rootInput.value;
    onChange({ ...opts });
  });
  const rootLabel = el('label', 'opt');
  rootLabel.title = 'Path del nodo da confrontare in entrambi i file. Si può copiare dalla lista differenze.';
  rootLabel.append('Root', rootInput);
  root.append(rootLabel);

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

  const rootMessage = el('div', 'root-msg');
  rootMessage.hidden = true;
  root.append(rootMessage);

  return {
    setWhitespaceEnabled(enabled, reason) {
      const label = labels.get('whitespace')!;
      inputs.get('whitespace')!.disabled = !enabled;
      label.classList.toggle('disabled', !enabled);
      label.title = enabled ? CHECKS[2].title : reason;
    },
    setRootMessage(message, kind) {
      rootMessage.hidden = !message;
      rootMessage.textContent = message ?? '';
      rootMessage.classList.toggle('error', kind === 'error');
    },
  };
}
