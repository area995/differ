// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';

const textareas = () => document.querySelectorAll<HTMLTextAreaElement>('textarea');
const items = () =>
  [...document.querySelectorAll('.diff-list li')].map((li) =>
    [...li.querySelectorAll('.kind, .path, .desc')].map((x) => x.textContent).join(''),
  );

function applyButton(index: number, label: 'A → B' | 'B → A'): HTMLButtonElement {
  const li = document.querySelectorAll('.diff-list li')[index];
  return [...li.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)!;
}

function apply(index: number, label: 'A → B' | 'B → A'): void {
  applyButton(index, label).click();
  vi.advanceTimersByTime(300);
}

const selected = (ta: HTMLTextAreaElement) => ta.value.slice(ta.selectionStart, ta.selectionEnd);

function type(index: number, text: string): void {
  const ta = textareas()[index];
  ta.value = text;
  ta.dispatchEvent(new Event('input'));
  vi.advanceTimersByTime(300);
}

function option(label: string): HTMLInputElement {
  const l = [...document.querySelectorAll('.opt')].find((x) => x.textContent === label);
  if (!l) throw new Error(`option not found: ${label}`);
  return l.querySelector('input')!;
}

function toggle(label: string): void {
  option(label).click();
  vi.advanceTimersByTime(300);
}

function setText(placeholderStart: string, text: string): void {
  const input = document.querySelector<HTMLInputElement>(`#options input[placeholder^="${placeholderStart}"]`)!;
  input.value = text;
  input.dispatchEvent(new Event('input'));
  vi.advanceTimersByTime(300);
}

const setRoot = (text: string) => setText('tutto il documento', text);
const setInclude = (text: string) => setText('tutti i sottoalberi', text);
const setExclude = (text: string) => setText('nessun sottoalbero', text);

/** Text of the answer bar (counts, "equivalent" or what is missing), without the selected difference. */
const answerText = () =>
  [...document.querySelector('.answer')!.children]
    .filter((c) => !c.classList.contains('evidence'))
    .map((c) => c.textContent)
    .join('');

/** Classes of the editor shade behind a line, without the passing wash (motion only). */
const lasting = (e: Element) => [...e.classList].filter((c) => !c.startsWith('wash')).join(' ');

/** Class of the editor shade behind a line of a file ('a', 'b'…). */
const shade = (file: string, line: number) => {
  const e = document.querySelectorAll(`#input-${file} .backdrop-lines > div`)[line - 1];
  return e && lasting(e);
};

/** Lines of a file under a wash of the given kind. */
const washed = (file: string, kind: 'land' | 'post') =>
  [...document.querySelectorAll(`#input-${file} .backdrop-lines > div`)].flatMap((d, i) =>
    d.classList.contains(`wash-${kind}`) ? [i + 1] : [],
  );

const press = (target: HTMLElement, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

function scopeMessage(): string {
  const e = document.querySelector<HTMLElement>('.scope-msg')!;
  return e.hidden ? '' : (e.textContent ?? '');
}

beforeAll(async () => {
  vi.useFakeTimers();
  document.body.innerHTML = `
    <section id="options"></section>
    <section id="inputs"></section>
    <button id="add-file"></button>
    <section id="result"></section>`;
  await import('../src/ui/main');
});

describe('app', () => {
  it('says what to do before two files are loaded', () => {
    expect(answerText()).toBe('Incolla o apri almeno due file per confrontarli.');
  });

  it('compares JSON against YAML and reacts to options', () => {
    type(0, '{"server": {"port": 8080, "hosts": ["a", "b"]}}');
    type(1, 'server:\n  port: "8080"\n  hosts: [b, a]\n  debug: true\n');

    const detected = [...document.querySelectorAll('.detected')].map((d) => d.textContent);
    expect(detected).toEqual(['rilevato: JSON', 'rilevato: YAML']);
    expect(option('Spazi e tabulazioni').disabled).toBe(true);
    expect(items()).toEqual([
      'tipo$.server.port8080 → "8080" (number → string)',
      'modificata$.server.hosts[0]"a" → "b"',
      'modificata$.server.hosts[1]"b" → "a"',
      'aggiunta$.server.debugtrue',
    ]);

    const keyField = document.querySelector<HTMLElement>('.key-field')!;
    expect(keyField.hidden).toBe(true);
    toggle('Ignora ordine array');
    expect(keyField.hidden).toBe(false);
    expect(items()).toHaveLength(2);
    toggle('Tipi laschi');
    expect(items()).toEqual(['aggiunta$.server.debugtrue']);
    toggle('Differenze chiavi');
    expect(document.querySelector('.equal')?.textContent).toContain('equivalenti');
    expect(document.querySelector('.equal-scope')?.textContent).toBe('Confronto parziale: chiavi aggiunte o rimosse escluse.');

    toggle('Ignora ordine array');
    toggle('Tipi laschi');
    toggle('Differenze chiavi');
  });

  it('shows parse errors and clears the result', () => {
    // in 'auto' this would be read as valid flow YAML, so force JSON
    const select = document.querySelector<HTMLSelectElement>('#input-a select')!;
    select.value = 'json';
    select.dispatchEvent(new Event('change'));
    type(0, '{"a": 1,}');
    const error = document.querySelector<HTMLElement>('#input-a .error')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/^Riga 1, colonna \d+:/);
    expect(document.querySelector('#input-a .gutter .err')?.textContent).toBe('1');
    expect(answerText()).toBe(
      'Correggi gli errori di sintassi in File A per aggiornare il confronto.',
    );
    select.value = 'auto';
    select.dispatchEvent(new Event('change'));
  });

  it('reports indentation differences between YAML files', () => {
    type(0, 'a:\n  b: 1\n');
    type(1, 'a:\n    b: 1\n');
    expect(document.querySelector('.equal')).not.toBeNull();
    expect(option('Spazi e tabulazioni').disabled).toBe(false);
    toggle('Spazi e tabulazioni');
    expect(items()).toEqual(['formattazione$.a.bindentazione 2 → 4']);
    expect(shade('b', 2)).toBe('d-whitespace');
  });

  it('uses the root value in the files that have it', () => {
    type(0, 'config:\n  port: 1\n  host: a\n');
    type(1, 'port: 2\nhost: a\n');
    expect(items()).toHaveLength(3);

    setRoot('config');
    expect(items()).toEqual(['modificata$.port1 → 2']);
    expect(scopeMessage()).toBe("Root $.config applicata solo a A: confrontata con l'intero file B");
    expect(option('Spazi e tabulazioni').disabled).toBe(true);
    expect(shade('a', 2)).toBe('d-changed');

    type(1, 'config:\n  port: 2\n  host: a\n');
    expect(items()).toEqual(['modificata$.port1 → 2']);
    expect(scopeMessage()).toBe('Root $.config applicata a A e B');
    expect(option('Spazi e tabulazioni').disabled).toBe(false);

    setRoot('nope');
    expect(scopeMessage()).toBe('Root $.nope non trovata: confronto tra i file interi');
    expect(items()).toEqual(['modificata$.config.port1 → 2']);

    setRoot('server[');
    expect(scopeMessage()).toBe('Root non valida: server[');
    expect(document.querySelector('.scope-msg')!.classList.contains('error')).toBe(true);
    expect(answerText()).toBe('Correggi Root, Includi o Escludi per aggiornare il confronto.');

    setRoot('');
    expect(scopeMessage()).toBe('');
  });

  it('compares only the included subtrees of the root', () => {
    setRoot('config');
    type(0, 'config:\n  server:\n    port: 1\n  db:\n    pool: 5\n    user: a\n  logging: debug\n');
    type(1, 'server:\n  port: 2\ndb:\n  pool: 9\n  user: b\nlogging: info\n');
    expect(items()).toHaveLength(4);

    setInclude('server, db.pool');
    expect(items()).toEqual(['modificata$.server.port1 → 2', 'modificata$.db.pool5 → 9']);
    expect(shade('a', 6)).toBe('');

    setInclude('server, nope');
    expect(items()).toEqual(['modificata$.server.port1 → 2']);
    expect(scopeMessage()).toBe(
      "Root $.config applicata solo a A: confrontata con l'intero file B\nIncludi: $.nope non trovato né in A né in B",
    );

    setInclude('server, db[');
    expect(scopeMessage()).toBe('Includi non valido: db[');
    expect(document.querySelector('.scope-msg')!.classList.contains('error')).toBe(true);
    expect(answerText()).toBe('Correggi Root, Includi o Escludi per aggiornare il confronto.');

    setInclude('');
    setRoot('');
    expect(scopeMessage()).toBe('');
  });

  it('leaves the excluded subtrees out, even inside an included one', () => {
    type(0, 'server:\n  port: 1\n  tls: on\ndb:\n  pool: 5\n');
    type(1, 'server:\n  port: 2\n  tls: off\ndb:\n  pool: 9\n');
    expect(items()).toHaveLength(3);

    setExclude('server.tls, db');
    expect(items()).toEqual(['modificata$.server.port1 → 2']);
    expect(shade('a', 5)).toBe('');

    setInclude('server');
    setExclude('server.tls, nope');
    expect(items()).toEqual(['modificata$.server.port1 → 2']);
    expect(scopeMessage()).toBe('Escludi: $.nope non trovato né in A né in B');

    setExclude('server');
    expect(document.querySelector('.equal-scope')?.textContent).toBe(
      'Confronto parziale: solo i sottoalberi $.server; esclusi i sottoalberi $.server.',
    );

    setExclude('db[');
    expect(scopeMessage()).toBe('Escludi non valido: db[');
    expect(answerText()).toBe('Correggi Root, Includi o Escludi per aggiornare il confronto.');

    setExclude('');
    setInclude('');
  });

  it('saves all the options to a named JSON file and loads them back', async () => {
    const field = (start: string) => document.querySelector<HTMLInputElement>(`#options input[placeholder^="${start}"]`)!;
    const message = () => document.querySelector<HTMLElement>('.config-msg')!;
    const configName = document.querySelector<HTMLInputElement>('.config-name')!;
    type(0, 'server:\n  port: 1\n  tls: on\n');
    type(1, 'server:\n  port: 2\n  tls: off\n');

    setInclude('server');
    setExclude('server.tls');
    toggle('Ignora ordine array');
    setText('campo chiave', 'name');
    configName.value = 'prod';
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:config';
    });
    URL.revokeObjectURL = vi.fn();
    let downloaded = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    document.querySelector<HTMLButtonElement>('.config-save')!.click();
    click.mockRestore();
    expect(downloaded).toBe('prod.json');
    expect(message().textContent).toBe('Configurazione salvata come prod.json');
    const saved = await created[0].text();
    expect(JSON.parse(saved)).toEqual({
      root: '',
      include: ['$.server'],
      exclude: ['$.server.tls'],
      keys: true,
      values: true,
      // left on by an earlier test
      whitespace: option('Spazi e tabulazioni').checked,
      keyOrder: false,
      ignoreArrayOrder: true,
      looseTypes: false,
      arrayKeyField: 'name',
    });

    setInclude('');
    setExclude('');
    setText('campo chiave', '');
    toggle('Ignora ordine array');
    configName.value = '';
    expect(items()).toHaveLength(2);

    const input = document.querySelector<HTMLInputElement>('.config-actions input[type="file"]')!;
    expect(input.accept).toContain('.json');
    const load = (text: string, name = 'prod.json') => {
      Object.defineProperty(input, 'files', { value: [new File([text], name)], configurable: true });
      input.dispatchEvent(new Event('change'));
    };
    load(saved);
    await vi.waitFor(() => expect(field('tutti i sottoalberi').value).toBe('$.server'));
    expect(field('nessun sottoalbero').value).toBe('$.server.tls');
    expect(option('Ignora ordine array').checked).toBe(true);
    expect(document.querySelector<HTMLElement>('.key-field')!.hidden).toBe(false);
    expect(field('campo chiave').value).toBe('name');
    expect(configName.value).toBe('prod');
    expect(message().textContent).toBe('Configurazione caricata da prod.json');
    vi.advanceTimersByTime(300);
    expect(items()).toEqual(['modificata$.server.port1 → 2']);

    // an option the file leaves out keeps its value
    load('{"exclude": []}', 'partial.json');
    await vi.waitFor(() => expect(field('nessun sottoalbero').value).toBe(''));
    expect(field('tutti i sottoalberi').value).toBe('$.server');
    expect(option('Ignora ordine array').checked).toBe(true);

    load('{"exclude": 3}', 'bad.json');
    await vi.waitFor(() => expect(message().classList.contains('error')).toBe(true));
    expect(message().textContent).toBe('bad.json: Configurazione non valida: "exclude" deve essere una lista di path');
    expect(configName.value).toBe('partial');

    setExclude('a[');
    document.querySelector<HTMLButtonElement>('.config-save')!.click();
    expect(message().textContent).toBe('Impossibile salvare: Escludi non valido: a[');

    setExclude('');
    setInclude('');
    setText('campo chiave', '');
    toggle('Ignora ordine array');
  });

  it('selects the clicked difference in both editors', () => {
    type(0, 'a: 1\nb: 2\n');
    type(1, 'a: 1\nb: 3\n');
    document.querySelector<HTMLElement>('.diff-list li')!.click();
    const [ta, tb] = textareas();
    expect(selected(ta)).toBe('2');
    expect(selected(tb)).toBe('3');
    expect(document.querySelector('#input-a .gutter .cur')?.textContent).toBe('2');
    expect(document.querySelector('#input-b .gutter .cur')?.textContent).toBe('2');
    // visible without focusing the editors: framed in the backdrop, quoted in the answer bar
    expect(shade('a', 2)).toBe('d-changed cur cur-start cur-end');
    // the eye is led to where each editor landed
    expect(washed('a', 'land')).toEqual([2]);
    expect(washed('b', 'land')).toEqual([2]);
    expect(document.querySelector('.answer .evidence')!.textContent).toBe('$.bAr. 2b: 2Br. 2b: 3');
  });

  it('positions both files also for added and removed nodes', () => {
    type(0, 'a: 1\nb: 2\n');
    type(1, 'a: 1\nc: 3\n');
    expect(items()).toEqual(['rimossa$.b2', 'aggiunta$.c3']);
    const [ta, tb] = textareas();
    const list = () => document.querySelectorAll<HTMLElement>('.diff-list li');
    // each editor colors only the lines its file has
    expect([shade('a', 2), shade('b', 2)]).toEqual(['d-removed', 'd-added']);

    list()[0].click(); // b only in A: B goes where b would be
    expect(selected(ta)).toBe('b: 2');
    expect(tb.selectionStart).toBe(5);
    expect(document.querySelector('#input-b .gutter .cur')?.textContent).toBe('2');

    list()[1].click(); // c only in B, right after a: A goes where B → A would insert it
    expect(selected(tb)).toBe('c: 3');
    expect(ta.selectionStart).toBe(5);
    expect(document.querySelector('#input-a .gutter .cur')?.textContent).toBe('2');
  });

  it('moves through the differences with the keyboard', () => {
    type(0, 'a: 1\nb: 2\n');
    type(1, 'a: 2\nb: 3\n');
    const list = () => [...document.querySelectorAll<HTMLElement>('.diff-list li')];
    expect(list().map((li) => li.tabIndex)).toEqual([0, -1]);

    press(list()[0], 'ArrowDown');
    expect(document.activeElement).toBe(list()[1]);
    expect(list()[1].getAttribute('aria-current')).toBe('true');
    expect(list().map((li) => li.tabIndex)).toEqual([-1, 0]);
    expect(selected(textareas()[1])).toBe('3');

    press(list()[1], 'k');
    expect(document.activeElement).toBe(list()[0]);
    expect(selected(textareas()[0])).toBe('1');

    // only the current row's buttons are in the tab order; "a" presses its first one
    const tabbable = () => list().map((li) => [...li.querySelectorAll('button')].map((b) => b.tabIndex));
    expect(tabbable()).toEqual([
      [0, 0],
      [-1, -1],
    ]);
    press(list()[0], 'a');
    vi.advanceTimersByTime(300);
    expect(textareas()[1].value).toBe('a: 1\nb: 3\n');
  });

  it('opens the file picker from a button', () => {
    const input = document.querySelector<HTMLInputElement>('#input-a input[type="file"]')!;
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    document.querySelector<HTMLButtonElement>('#input-a .file-btn')!.click();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('applies a difference in either direction', () => {
    type(0, 'a: 1\nb: 2\n');
    type(1, 'a: 1\nb: 3\nc: 4\n');
    expect(items()).toEqual(['modificata$.b2 → 3', 'aggiunta$.c4']);

    apply(0, 'A → B');
    expect(textareas()[1].value).toBe('a: 1\nb: 2\nc: 4\n');
    expect(selected(textareas()[1])).toBe('2');
    expect(items()).toEqual(['aggiunta$.c4']);
    // the place in the list is kept: the next difference takes the resolved one's row
    expect(document.activeElement).toBe(document.querySelector('.diff-list li'));
    expect(document.querySelector('.status')!.textContent).toBe('Riportato in File B.Annulla');
    expect(document.querySelector<HTMLElement>('#input-b .modified')!.hidden).toBe(false);

    apply(0, 'B → A');
    expect(textareas()[0].value).toBe('a: 1\nb: 2\nc: 4\n');
    expect(document.querySelector('.equal')).not.toBeNull();
  });

  it('keeps applied changes highlighted in the editor until it is edited by hand', () => {
    const signs = () =>
      [...document.querySelectorAll('#input-b .gutter span')].map((s) => s.getAttribute('data-sign') ?? '');
    const shades = () => [...document.querySelectorAll('#input-b .backdrop-lines > div')].map(lasting);

    type(0, 'a: 1\nb: 2\n');
    type(1, 'a: 5\nc: 3\n');
    expect(items()).toEqual(['modificata$.a1 → 5', 'rimossa$.b2', 'aggiunta$.c3']);

    apply(0, 'A → B'); // a: 5 -> a: 1
    apply(0, 'A → B'); // insert b
    apply(0, 'A → B'); // delete c
    expect(textareas()[1].value).toBe('a: 1\nb: 2\n');
    expect(signs()).toEqual(['', '+', '−']);
    expect(shades()).toEqual(['applied', 'applied', 'removed-before']);
    // the last apply (deleting c) wrote at line 3
    expect(washed('b', 'post')).toContain(3);

    type(1, 'a: 1\nb: 3\n');
    expect(signs()).toEqual(['', '', '']);
    // the applied marks are gone; line 2 now shows the new difference instead
    expect(shades()).toEqual(['', 'd-changed', '']);
  });

  it('cannot be typed into; a paste replaces the whole content', () => {
    const ta = textareas()[0];
    expect(ta.readOnly).toBe(true);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'x: 1\n' } });
    ta.dispatchEvent(paste);
    vi.advanceTimersByTime(300);
    expect(paste.defaultPrevented).toBe(true);
    expect(ta.value).toBe('x: 1\n');
  });

  it('applies to files with Windows line endings without shifting the change', () => {
    const paste = (index: number, text: string) => {
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
      textareas()[index].dispatchEvent(event);
      vi.advanceTimersByTime(300);
    };
    const crlf = (lines: string[]) => lines.join('\r\n') + '\r\n';
    paste(0, crlf(['kafka:', '  storage: 50Gi', 'connect:', '  image: kc:1.1.7', '  replicas: 1']));
    paste(1, crlf(['kafka:', '  storage: 10Gi', 'connect:', '  image: kc:1.1.7', '  replicas: 1']));
    expect(items()).toEqual(['modificata$.kafka.storage"50Gi" → "10Gi"']);

    apply(0, 'A → B');
    expect(textareas()[1].value).toBe('kafka:\n  storage: 50Gi\nconnect:\n  image: kc:1.1.7\n  replicas: 1\n');
    expect(document.querySelector('.equal')).not.toBeNull();

    // back to LF files, as the next tests expect
    paste(0, 'x: 0\n');
    paste(1, 'x: 0\n');
  });

  it('applies at the node, wherever the cursor is', () => {
    // a browser's insertText writes at the current selection: if apply relied on it, a caret placed
    // elsewhere by the user would receive the value and corrupt the file
    const insertAtCaret = vi.fn((_cmd: string, _ui: boolean, text: string) => {
      const ta = document.activeElement as HTMLTextAreaElement;
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      return true;
    });
    const original = document.execCommand;
    document.execCommand = insertAtCaret as unknown as typeof document.execCommand;
    const caretAtStart = (ta: HTMLTextAreaElement) => {
      ta.focus();
      ta.setSelectionRange(0, 0); // far from line 2, where the change belongs
    };
    try {
      type(0, 'a: 1\nb: 2\nc: 3\n');
      type(1, 'a: 1\nb: 9\nc: 3\n');
      caretAtStart(textareas()[1]);
      apply(0, 'A → B');
      expect(textareas()[1].value).toBe('a: 1\nb: 2\nc: 3\n');

      type(1, 'a: 1\nb: 9\nc: 3\n');
      caretAtStart(textareas()[0]);
      apply(0, 'B → A');
      expect(textareas()[0].value).toBe('a: 1\nb: 9\nc: 3\n');
    } finally {
      document.execCommand = original;
    }
    expect(insertAtCaret).not.toHaveBeenCalled();
  });

  it('undoes a single apply from the status line', () => {
    type(0, 'a: 1\n');
    type(1, 'a: 2\n');
    apply(0, 'A → B');
    expect(textareas()[1].value).toBe('a: 1\n');
    const status = document.querySelector<HTMLElement>('.status')!;
    [...status.querySelectorAll('button')].find((b) => b.textContent === 'Annulla')!.click();
    vi.advanceTimersByTime(300);
    expect(textareas()[1].value).toBe('a: 2\n');
    expect(status.textContent).toBe('Riporto annullato.');
  });

  it('explains when a difference cannot be applied', () => {
    type(0, 'l:\n  - x: 1\n');
    type(1, 'l:\n  - name: a\n    x: 1\n');
    apply(0, 'A → B');
    expect(textareas()[1].value).toBe('l:\n  - name: a\n    x: 1\n');
    const notice = document.querySelector<HTMLElement>('.notice')!;
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe('Impossibile riportare automaticamente questa modifica');
  });

  it('disables apply for moved keys', () => {
    type(0, 'a: 1\nb: 2\n');
    type(1, 'b: 2\na: 1\n');
    toggle('Posizione chiavi');
    expect(applyButton(0, 'A → B').disabled).toBe(true);
    expect(applyButton(0, 'A → B').title).toMatch(/spostate/);
    expect(document.querySelector('.diff-list li .reason')!.textContent).toBe('Le chiavi spostate non si possono riportare');
    toggle('Posizione chiavi');
  });

  it('saves the current text of a panel', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('file-b.yaml');
    });

    type(1, 'x: 1\n');
    document.querySelector<HTMLButtonElement>('#input-b .save')!.click();
    expect(click).toHaveBeenCalledOnce();
    expect(await created[0].text()).toBe('x: 1\n');
    click.mockRestore();
  });

  it('saves a Windows file with its CRLF line endings, applied changes included', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const paste = (index: number, text: string) => {
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
      textareas()[index].dispatchEvent(event);
      vi.advanceTimersByTime(300);
    };
    paste(0, 'a: 1\nb: 2\n');
    paste(1, 'a: 1\r\nb: 3\r\n');
    apply(0, 'A → B');
    document.querySelector<HTMLButtonElement>('#input-b .save')!.click();
    expect(await created[0].text()).toBe('a: 1\r\nb: 2\r\n');
    click.mockRestore();
  });
});

describe('app with more than two files', () => {
  const headers = () => [...document.querySelectorAll('.matrix th')].map((th) => th.textContent);
  const rows = () =>
    [...document.querySelectorAll('.matrix tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent),
    );
  const cell = (row: number, column: number) =>
    document.querySelectorAll('.matrix tbody tr')[row].querySelectorAll<HTMLElement>('td')[column];
  const action = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('.matrix-actions button')].find((b) => b.textContent === label)!;
  const run = (button: HTMLButtonElement) => {
    button.click();
    vi.advanceTimersByTime(300);
  };

  it('shows a matrix against the base when a third file is added', () => {
    type(0, 'a: 1\nb: 2\n');
    type(1, 'a: 1\nb: 3\n');
    document.getElementById('add-file')!.click();
    expect(textareas()).toHaveLength(3);
    expect(document.activeElement).toBe(textareas()[2]);
    type(2, 'a: 9\nb: 2\n');

    expect(document.querySelector('.pane')).toBeNull();
    expect(headers()).toEqual(['Path', 'File A (base)', 'File B', 'File C']);
    expect(rows()).toEqual([
      ['$.a', '1', '1', '9'],
      ['$.b', '2', '3', '2'],
    ]);
    expect(cell(0, 3).className).toContain('d-changed');
    expect(document.querySelector('.matrix-summary')!.textContent).toBe('File B: 1 differenzaFile C: 1 differenza');
  });

  it('moves through the matrix with the keyboard', () => {
    expect(document.querySelector('.matrix')!.getAttribute('role')).toBe('grid');
    expect(cell(0, 0).tabIndex).toBe(0);

    press(cell(0, 0), 'ArrowRight');
    press(cell(0, 1), 'ArrowRight');
    press(cell(0, 2), 'ArrowDown');
    expect(document.activeElement).toBe(cell(1, 2));
    expect(cell(1, 2).getAttribute('aria-selected')).toBe('true');
    expect(cell(0, 0).tabIndex).toBe(-1);
    expect(cell(1, 2).getAttribute('aria-label')).toBe('3, diversa dalla base');
    expect(document.querySelector('.matrix-actions .what')!.textContent).toBe('$.b · File B');
    expect(action('Base → File B')).toBeDefined();
  });

  it('positions the editors and applies changes from a cell', () => {
    cell(0, 3).click();
    expect(selected(textareas()[0])).toBe('1');
    expect(selected(textareas()[2])).toBe('9');

    run(action('Base → File C'));
    expect(textareas()[2].value).toBe('a: 1\nb: 2\n');
    expect(rows()).toEqual([['$.b', '2', '3', '2']]);

    cell(0, 2).click();
    expect(action('Base → File B').disabled).toBe(false);
    run(action('File B → Base'));
    expect(textareas()[0].value).toBe('a: 1\nb: 3\n');
    expect(rows()).toEqual([['$.b', '3', '3', '2']]);

    cell(0, 2).click();
    expect(action('Base → File B').disabled).toBe(true);
    expect(document.querySelector('.matrix-actions .reason')!.textContent).toBe('Nessuna differenza diretta con la base');
    action('Base → tutti…').click();
    expect(document.querySelector('.matrix-actions .preview')!.textContent).toBe('Riportare 3 in File C (ora 2)?');
    expect(textareas()[2].value).toBe('a: 1\nb: 2\n');
    run(action('Conferma'));
    expect(textareas()[2].value).toBe('a: 1\nb: 3\n');
    expect(document.querySelector('.equal')).not.toBeNull();
  });

  it('undoes "Base → tutti" in every file at once', () => {
    type(2, 'a: 1\nb: 2\n');
    cell(0, 3).click();
    action('Base → tutti…').click();
    run(action('Conferma'));
    expect(textareas()[2].value).toBe('a: 1\nb: 3\n');
    const status = document.querySelector<HTMLElement>('.status')!;
    expect(status.textContent).toBe('Riportato in File C.Annulla tutto');

    [...status.querySelectorAll('button')].find((b) => b.textContent === 'Annulla tutto')!.click();
    vi.advanceTimersByTime(300);
    expect(textareas()[2].value).toBe('a: 1\nb: 2\n');
    expect(status.textContent).toBe('Riporto annullato in tutti i file.');
    type(2, 'a: 1\nb: 3\n');
  });

  it('lets any file be the base', () => {
    type(1, 'a: 2\nb: 3\n');
    document.querySelector<HTMLInputElement>('#input-b .base-pick input')!.click();
    vi.advanceTimersByTime(300);
    expect(headers()).toEqual(['Path', 'File B (base)', 'File A', 'File C']);
    expect(rows()).toEqual([['$.a', '2', '1', '1']]);
    document.querySelector<HTMLInputElement>('#input-a .base-pick input')!.click();
    vi.advanceTimersByTime(300);
  });

  it('names files after their labels', () => {
    const label = (file: string, text: string) => {
      const input = document.querySelector<HTMLInputElement>(`#input-${file} .slot-name`)!;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(300);
    };
    label('b', 'staging');
    label('c', ' prod ');
    expect(headers()).toEqual(['Path', 'File A (base)', 'staging', 'prod']);
    cell(0, 3).click();
    expect(action('Base → prod')).toBeDefined();
    label('b', '');
    label('c', '');
    expect(headers()).toEqual(['Path', 'File A (base)', 'File B', 'File C']);
  });

  it('goes back to the pair view when a file is removed', () => {
    expect(document.querySelector('#input-a .remove')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('#input-c .remove')!.click();
    vi.advanceTimersByTime(300);
    expect(textareas()).toHaveLength(2);
    expect(document.querySelector('.matrix')).toBeNull();
    expect(items()).toEqual(['modificata$.a1 → 2']);
    expect(document.querySelector<HTMLElement>('#input-a .remove')!.hidden).toBe(true);

    // removing is immediate, with a way back instead of a confirmation
    const status = document.querySelector<HTMLElement>('.status')!;
    expect(status.textContent).toBe('File C rimosso dal confronto.Ripristina');
    expect(document.activeElement).toBe(status.querySelector('button'));
    status.querySelector('button')!.click();
    vi.advanceTimersByTime(300);
    expect(textareas()).toHaveLength(3);
    expect(textareas()[2].value).toBe('a: 1\nb: 3\n');
    expect(document.querySelector('.matrix')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('#input-c .remove')!.click();
    vi.advanceTimersByTime(300);
  });

  it('uses icons for save and remove', () => {
    for (const [selector, label] of [
      ['#input-a .save', 'Salva'],
      ['#input-a .remove', 'Rimuovi file'],
    ]) {
      const button = document.querySelector(selector)!;
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button.getAttribute('aria-label')).toBe(label);
    }
  });

  it('shows each document as a collapsible tree', () => {
    const card = '#input-b';
    const q = <T extends Element>(s: string) => document.querySelector<T>(`${card} ${s}`)!;
    const tab = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>(`${card} .tabs button`)].find((b) => b.textContent === label)!;
    const shown = (id: string) => {
      for (let n: HTMLElement | null = q<HTMLElement>(`.tree-row[data-id="${id}"]`); n; n = n.parentElement) {
        if (n.hidden) return false;
      }
      return true;
    };

    type(1, 'server:\n  tls:\n    cert:\n      path: x\nname: x\n');
    tab('Albero').click();
    expect(q<HTMLElement>('.editor').hidden).toBe(true);
    expect(shown('$.server.tls.cert')).toBe(true);
    expect(shown('$.server.tls.cert.path')).toBe(false);
    expect(q('.tree-row[data-id="$.server"]').textContent).toContain('{1}');

    [...document.querySelectorAll<HTMLButtonElement>(`${card} .tree-tools button`)].find((b) => b.textContent === 'Espandi tutto')!.click();
    expect(shown('$.server.tls.cert.path')).toBe(true);
    [...document.querySelectorAll<HTMLButtonElement>(`${card} .tree-tools button`)].find((b) => b.textContent === 'Comprimi tutto')!.click();
    expect(shown('$.server.tls')).toBe(false);

    q<HTMLElement>('.tree-row[data-id="$.name"] .key').click();
    expect(q<HTMLElement>('.editor').hidden).toBe(false);
    expect(selected(textareas()[1])).toBe('name: x');
  });

  it('explains why the tree is empty', () => {
    type(1, 'a: [1\n');
    [...document.querySelectorAll<HTMLButtonElement>('#input-b .tabs button')].find((b) => b.textContent === 'Albero')!.click();
    expect(document.querySelector('#input-b .tree-view')!.textContent).toContain('Correggi');
    [...document.querySelectorAll<HTMLButtonElement>('#input-b .tabs button')].find((b) => b.textContent === 'Testo')!.click();
    type(1, 'a: 2\n');
  });

  it('picks included subtrees from the union of the files', () => {
    const picker = () => document.querySelector<HTMLElement>('.include-picker')!;
    const box = (id: string) =>
      picker().querySelector<HTMLInputElement>(`.tree-row[data-id="${id}"] input[type=checkbox]`)!;
    const check = (id: string) => {
      box(id).click();
      vi.advanceTimersByTime(300);
    };
    const field = () => document.querySelector<HTMLInputElement>('#options input[placeholder^="tutti i"]')!;

    type(0, 'server:\n  port: 1\ndb:\n  pool: 5\n');
    type(1, 'server:\n  port: 2\nlog: x\n');
    expect(picker().hidden).toBe(true);
    document.querySelector<HTMLButtonElement>('.include-pick')!.click();
    expect(picker().hidden).toBe(false);
    expect([...picker().querySelectorAll('.tree-row')].map((r) => r.getAttribute('data-id'))).toEqual([
      '$.server',
      '$.server.port',
      '$.db',
      '$.db.pool',
      '$.log',
    ]);
    expect(picker().querySelector('.tree-row[data-id="$.db"] .note')!.textContent).toBe('solo in A');
    expect(picker().querySelector('.tree-row[data-id="$.log"] .note')!.textContent).toBe('solo in B');

    check('$.server.port');
    expect(field().value).toBe('$.server.port');
    expect(items()).toEqual(['modificata$.server.port1 → 2']);

    check('$.server');
    expect(field().value).toBe('$.server');
    expect([box('$.server.port').checked, box('$.server.port').disabled]).toEqual([true, true]);

    check('$.server');
    expect(field().value).toBe('');
    expect(items()).toHaveLength(3);

    setInclude('db');
    expect(box('$.db').checked).toBe(true);
    setInclude('');
    document.querySelector<HTMLButtonElement>('.include-pick')!.click();
    expect(picker().hidden).toBe(true);
  });

  it('picks excluded subtrees from their own tree', () => {
    const picker = () => document.querySelector<HTMLElement>('.exclude-picker')!;
    const box = (id: string) =>
      picker().querySelector<HTMLInputElement>(`.tree-row[data-id="${id}"] input[type=checkbox]`)!;
    const field = () => document.querySelector<HTMLInputElement>('#options input[placeholder^="nessun"]')!;

    type(0, 'server:\n  port: 1\ndb:\n  pool: 5\n');
    type(1, 'server:\n  port: 2\ndb:\n  pool: 6\n');
    document.querySelector<HTMLButtonElement>('.exclude-pick')!.click();
    expect(picker().hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.include-picker')!.hidden).toBe(true);

    expect(box('$.db').getAttribute('aria-label')).toBe('Escludi $.db');
    box('$.db').click();
    vi.advanceTimersByTime(300);
    expect(field().value).toBe('$.db');
    expect([box('$.db.pool').checked, box('$.db.pool').disabled]).toEqual([true, true]);
    expect(box('$.db.pool').title).toBe('Escluso tramite un nodo superiore');

    // with an invalid path the picker says what to fix, not that files are missing
    setInclude('db[');
    expect(picker().textContent).toBe('Correggi Root, Includi o Escludi per scegliere i sottoalberi');
    setInclude('');
    expect(items()).toEqual(['modificata$.server.port1 → 2']);

    box('$.db').click();
    vi.advanceTimersByTime(300);
    expect(field().value).toBe('');
    document.querySelector<HTMLButtonElement>('.exclude-pick')!.click();
    expect(picker().hidden).toBe(true);
  });

  it('shows the name of a loaded file on its card', async () => {
    const name = document.querySelector<HTMLElement>('#input-a .file-name')!;
    expect(name.hidden).toBe(true);

    const drop = new Event('drop');
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File(['a: 5\n'], 'config.prod.yaml')] } });
    document.getElementById('input-a')!.dispatchEvent(drop);

    await vi.waitFor(() => expect(textareas()[0].value).toBe('a: 5\n'));
    expect(name.hidden).toBe(false);
    expect(name.textContent).toBe('config.prod.yaml');
    expect(name.title).toBe('config.prod.yaml');
    vi.advanceTimersByTime(300);
  });

  it('places several files at once: first in the card, the rest in empty or new cards', async () => {
    const values = () => [...textareas()].map((t) => t.value);
    const files = (...names: string[]) => names.map((n) => new File([`${n}: 1\n`], `${n}.yaml`));
    // every card has content, so extra files need new cards
    textareas().forEach((t, i) => {
      if (!t.value) type(i, 'z: 0\n');
    });
    const start = textareas().length;

    // the picker of card A takes several files
    const input = document.querySelector<HTMLInputElement>('#input-a input[type="file"]')!;
    expect(input.multiple).toBe(true);
    Object.defineProperty(input, 'files', { value: files('p', 'q'), configurable: true });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(values()[0]).toBe('p: 1\n'));
    await vi.waitFor(() => expect(values().slice(start)).toEqual(['q: 1\n']));

    // a drop outside the cards does not leave the page: the files go to new cards, nothing is overwritten
    const before = values();
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: files('r', 's') } });
    document.body.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(values()).toEqual([...before, 'r: 1\n', 's: 1\n']));
    vi.advanceTimersByTime(300);
  });
});
