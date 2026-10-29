import { configFileName, formatConfig, parseConfig } from '../core/config';
import { formatPath, type DiffOptions } from '../core/model';
import { parsePathList } from '../core/select';
import { arrive, el } from './dom';
import { renderTree, type TreeItem } from './tree';

type ListKey = 'include' | 'exclude';
type PathKey = 'root' | ListKey;
type BoolKey = Exclude<keyof DiffOptions, 'arrayKeyField' | PathKey>;

/** "show" = which kinds of difference are reported; "match" = how the documents are matched. */
const CHECKS: { key: BoolKey; label: string; title: string; group: 'show' | 'match' }[] = [
  { key: 'keys', label: 'Differenze chiavi', title: 'Chiavi aggiunte o rimosse', group: 'show' },
  { key: 'values', label: 'Differenze valori', title: 'Valori o tipi diversi sulle stesse chiavi', group: 'show' },
  { key: 'whitespace', label: 'Spazi e tabulazioni', title: 'Differenze di formattazione su contenuti uguali', group: 'show' },
  { key: 'keyOrder', label: 'Posizione chiavi', title: 'Chiavi comuni in ordine diverso', group: 'show' },
  {
    key: 'ignoreArrayOrder',
    label: 'Ignora ordine array',
    title: "Abbina gli elementi degli array senza considerare l'indice",
    group: 'match',
  },
  { key: 'looseTypes', label: 'Tipi laschi', title: '8080 uguale a "8080", true uguale a "true"', group: 'match' },
];

function fieldset(legend: string, className: string): HTMLFieldSetElement {
  const set = el('fieldset', `opt-group ${className}`);
  const title = el('legend');
  title.textContent = legend;
  set.append(title);
  return set;
}

export type OptionsBar = {
  setWhitespaceEnabled(enabled: boolean, reason: string): void;
  setScopeMessage(message: string | null, kind: 'info' | 'error'): void;
  /** Subtrees offered by the Includi and Escludi pickers, or null with the reason shown instead. */
  setSubtrees(items: TreeItem[] | null, reason?: string): void;
};

export function createOptionsBar(
  root: HTMLElement,
  initial: DiffOptions,
  onChange: (opts: DiffOptions) => void,
): OptionsBar {
  const opts = { ...initial };
  const labels = new Map<BoolKey, HTMLLabelElement>();
  const inputs = new Map<BoolKey, HTMLInputElement>();
  // what is compared, which differences are shown, how documents are matched
  const scope = fieldset('Ambito', 'scope');
  const show = fieldset('Mostra', 'show');
  const match = fieldset('Confronto', 'match');
  root.append(scope, show, match);

  const pathField = (key: PathKey, label: string, placeholder: string, title: string) => {
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
    scope.append(wrapper);
    return input;
  };
  const rootInput = pathField(
    'root',
    'Root',
    'tutto il documento (es. $.server)',
    'Path il cui valore sostituisce il documento nei file che lo contengono. Si può copiare dalla lista differenze.',
  );

  // subtrees found in the files, offered by the Includi and Escludi pickers
  let subtrees: TreeItem[] | null = null;
  let noSubtrees = '';
  const isUnder = (id: string, ancestor: string) => id.startsWith(`${ancestor}.`) || id.startsWith(`${ancestor}[`);

  /** A path list field with a "Scegli" button that opens a checkbox tree of the subtrees right below it. */
  const subtreeField = (
    key: ListKey,
    label: string,
    placeholder: string,
    title: string,
    verb: string,
    implied: string,
  ) => {
    const input = pathField(key, label, placeholder, title);
    const expanded = new Map<string, boolean>();
    const pick = el('button', `subtree-pick ${key}-pick`);
    pick.type = 'button';
    pick.textContent = 'Scegli';
    pick.title = `Scegli i sottoalberi da ${verb}`;
    pick.setAttribute('aria-expanded', 'false');
    const picker = el('div', `subtree-picker ${key}-picker`);
    picker.hidden = true;
    scope.append(pick, picker);

    const selectedIds = (): string[] => {
      const parsed = parsePathList(opts[key]);
      return parsed.ok ? parsed.paths.map(formatPath) : [];
    };
    const render = () => {
      if (picker.hidden) return;
      if (!subtrees) {
        picker.textContent = noSubtrees;
        return;
      }
      const selected = selectedIds();
      renderTree(picker, subtrees, {
        expanded,
        defaultDepth: 1,
        checks: {
          label,
          implied,
          state: (id) => (selected.includes(id) ? 'on' : selected.some((s) => isUnder(id, s)) ? 'implied' : 'off'),
          onChange: (id, checked) => {
            const kept = selected.filter((s) => s !== id && !(checked && isUnder(s, id)));
            opts[key] = (checked ? [...kept, id] : kept).join(', ');
            input.value = opts[key];
            onChange({ ...opts });
            render();
          },
        },
      });
    };
    pick.addEventListener('click', () => {
      picker.hidden = !picker.hidden;
      pick.setAttribute('aria-expanded', String(!picker.hidden));
      render();
    });
    return {
      render,
      /** Shows `opts[key]` after it was changed from outside the field. */
      set(value: string) {
        input.value = value;
        render();
      },
    };
  };
  const lists = {
    include: subtreeField(
      'include',
      'Includi',
      'tutti i sottoalberi (es. server, db.pool)',
      'Path relativi alla root, separati da virgola: confronta solo questi sottoalberi.',
      'includere',
      'Incluso tramite un nodo superiore',
    ),
    exclude: subtreeField(
      'exclude',
      'Escludi',
      'nessun sottoalbero (es. server.tls, db.password)',
      'Path relativi alla root, separati da virgola: questi sottoalberi restano fuori dal confronto, anche se inclusi.',
      'escludere',
      'Escluso tramite un nodo superiore',
    ),
  };

  const fieldInput = el('input');
  fieldInput.type = 'text';
  fieldInput.placeholder = 'campo chiave (es. name)';
  fieldInput.setAttribute('aria-label', 'Campo chiave per abbinare gli elementi degli array');
  fieldInput.value = opts.arrayKeyField;
  // only offered when it applies: an always-visible disabled field is one more control to read past
  const field = el('label', 'opt key-field');
  field.title = 'Abbina gli oggetti degli array per questo campo (es. name, id); vuoto = per uguaglianza';
  field.append(fieldInput);
  field.hidden = !opts.ignoreArrayOrder;
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
      field.hidden = !opts.ignoreArrayOrder;
      onChange({ ...opts });
    });
    label.append(input, c.label);
    (c.group === 'show' ? show : match).append(label);
    labels.set(c.key, label);
    inputs.set(c.key, input);
    // the key field only means something with this option, so it sits right after it
    if (c.key === 'ignoreArrayOrder') match.append(field);
  }

  // all the options saved to a named JSON file and loaded back, to reuse a setup across sessions
  const configName = el('input', 'config-name');
  configName.type = 'text';
  configName.placeholder = 'ledger-config';
  configName.setAttribute('aria-label', 'Nome del file di configurazione');
  configName.title = 'Nome del file salvato (.json viene aggiunto)';
  const configInput = el('input');
  configInput.type = 'file';
  configInput.accept = '.json,application/json';
  configInput.hidden = true;
  const loadConfig = el('button', 'config-load');
  loadConfig.type = 'button';
  loadConfig.textContent = 'Carica configurazione…';
  loadConfig.title = 'Imposta le opzioni da un file JSON salvato in precedenza';
  loadConfig.addEventListener('click', () => configInput.click());
  const saveConfig = el('button', 'config-save');
  saveConfig.type = 'button';
  saveConfig.textContent = 'Salva configurazione';
  saveConfig.title = 'Scarica tutte le opzioni in un file JSON con questo nome, da ricaricare in seguito';
  const configMessage = el('span', 'config-msg');
  // the outcome of a button just pressed
  configMessage.setAttribute('role', 'status');
  configMessage.hidden = true;
  const showConfigMessage = (message: string | null, error = false) => {
    configMessage.hidden = !message;
    configMessage.textContent = message ?? '';
    configMessage.classList.toggle('error', error);
    if (message) arrive(configMessage);
  };
  const config = el('div', 'config-actions');
  config.append(loadConfig, configInput, configName, saveConfig, configMessage);
  root.append(config);

  configInput.addEventListener('change', async () => {
    const file = configInput.files?.[0];
    configInput.value = '';
    if (!file) return;
    const r = parseConfig(await file.text());
    if (!r.ok) {
      showConfigMessage(`${file.name}: ${r.error}`, true);
      return;
    }
    Object.assign(opts, r.options);
    rootInput.value = opts.root;
    lists.include.set(opts.include);
    lists.exclude.set(opts.exclude);
    fieldInput.value = opts.arrayKeyField;
    for (const [key, input] of inputs) input.checked = opts[key];
    field.hidden = !opts.ignoreArrayOrder;
    // saved again under the same name unless the user changes it
    configName.value = file.name.replace(/\.json$/i, '');
    onChange({ ...opts });
    showConfigMessage(`Configurazione caricata da ${file.name}`);
  });
  saveConfig.addEventListener('click', () => {
    const r = formatConfig(opts);
    if (!r.ok) {
      showConfigMessage(`Impossibile salvare: ${r.error}`, true);
      return;
    }
    const name = configFileName(configName.value);
    const url = URL.createObjectURL(new Blob([r.text], { type: 'application/json' }));
    const link = el('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showConfigMessage(`Configurazione salvata come ${name}`);
  });

  const scopeMessage = el('div', 'scope-msg');
  // announced politely: it changes while the user types in Root, Includi or Escludi
  scopeMessage.setAttribute('role', 'status');
  scopeMessage.hidden = true;
  scope.append(scopeMessage);

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
    setSubtrees(items, reason = 'Carica almeno due file validi per scegliere i sottoalberi') {
      subtrees = items;
      noSubtrees = reason;
      lists.include.render();
      lists.exclude.render();
    },
  };
}
