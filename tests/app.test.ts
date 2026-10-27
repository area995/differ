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

function scopeMessage(): string {
  const e = document.querySelector<HTMLElement>('.scope-msg')!;
  return e.hidden ? '' : (e.textContent ?? '');
}

beforeAll(async () => {
  vi.useFakeTimers();
  document.body.innerHTML = `
    <section id="options"></section>
    <div id="input-a"></div>
    <div id="input-b"></div>
    <section id="result"></section>`;
  await import('../src/ui/main');
});

describe('app', () => {
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

    toggle('Ignora ordine array');
    expect(items()).toHaveLength(2);
    toggle('Tipi laschi');
    expect(items()).toEqual(['aggiunta$.server.debugtrue']);
    toggle('Differenze chiavi');
    expect(document.querySelector('.equal')?.textContent).toContain('equivalenti');

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
    expect(document.getElementById('result')!.textContent).toBe('');
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
    expect(document.querySelector('.pane[data-side="B"] [data-line="2"] .code')?.textContent).toBe('····b:·1');
  });

  it('uses the root value in the files that have it', () => {
    type(0, 'config:\n  port: 1\n  host: a\n');
    type(1, 'port: 2\nhost: a\n');
    expect(items()).toHaveLength(3);

    setRoot('config');
    expect(items()).toEqual(['modificata$.port1 → 2']);
    expect(scopeMessage()).toBe("Root $.config applicata solo a A: confrontata con l'intero file B");
    expect(option('Spazi e tabulazioni').disabled).toBe(true);
    expect(document.querySelector('.pane[data-side="A"] [data-line="2"]')!.className).toContain('d-changed');

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
    expect(document.getElementById('result')!.textContent).toBe('');

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
    expect(document.querySelector('.pane[data-side="A"] [data-line="6"]')!.className).toBe('line');

    setInclude('server, nope');
    expect(items()).toEqual(['modificata$.server.port1 → 2']);
    expect(scopeMessage()).toBe(
      "Root $.config applicata solo a A: confrontata con l'intero file B\nIncludi: $.nope non trovato né in A né in B",
    );

    setInclude('server, db[');
    expect(scopeMessage()).toBe('Includi non valido: db[');
    expect(document.querySelector('.scope-msg')!.classList.contains('error')).toBe(true);
    expect(document.getElementById('result')!.textContent).toBe('');

    setInclude('');
    setRoot('');
    expect(scopeMessage()).toBe('');
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
  });

  it('positions both files also for added and removed nodes', () => {
    type(0, 'a: 1\nb: 2\n');
    type(1, 'a: 1\nc: 3\n');
    expect(items()).toEqual(['rimossa$.b2', 'aggiunta$.c3']);
    const [ta, tb] = textareas();
    const list = () => document.querySelectorAll<HTMLElement>('.diff-list li');
    const flashing = (side: string) =>
      document.querySelector(`.pane[data-side="${side}"] .flash`)?.getAttribute('data-line');

    list()[0].click(); // b only in A: B goes where b would be
    expect(selected(ta)).toBe('b: 2');
    expect(tb.selectionStart).toBe(5);
    expect(document.querySelector('#input-b .gutter .cur')?.textContent).toBe('2');
    expect([flashing('A'), flashing('B')]).toEqual(['2', '2']);

    list()[1].click(); // c only in B, right after a: A goes where B → A would insert it
    expect(selected(tb)).toBe('c: 3');
    expect(ta.selectionStart).toBe(5);
    expect(document.querySelector('#input-a .gutter .cur')?.textContent).toBe('2');
    expect([flashing('A'), flashing('B')]).toEqual(['2', '2']);
  });

  it('applies a difference in either direction', () => {
    type(0, 'a: 1\nb: 2\n');
    type(1, 'a: 1\nb: 3\nc: 4\n');
    expect(items()).toEqual(['modificata$.b2 → 3', 'aggiunta$.c4']);

    apply(0, 'A → B');
    expect(textareas()[1].value).toBe('a: 1\nb: 2\nc: 4\n');
    expect(selected(textareas()[1])).toBe('2');
    expect(items()).toEqual(['aggiunta$.c4']);

    apply(0, 'B → A');
    expect(textareas()[0].value).toBe('a: 1\nb: 2\nc: 4\n');
    expect(document.querySelector('.equal')).not.toBeNull();
  });

  it('keeps applied changes highlighted in the editor until it is edited by hand', () => {
    const signs = () =>
      [...document.querySelectorAll('#input-b .gutter span')].map((s) => s.getAttribute('data-sign') ?? '');
    const shades = () => [...document.querySelectorAll('#input-b .backdrop-lines > div')].map((d) => d.className);

    type(0, 'a: 1\nb: 2\n');
    type(1, 'a: 5\nc: 3\n');
    expect(items()).toEqual(['modificata$.a1 → 5', 'rimossa$.b2', 'aggiunta$.c3']);

    apply(0, 'A → B'); // a: 5 -> a: 1
    apply(0, 'A → B'); // insert b
    apply(0, 'A → B'); // delete c
    expect(textareas()[1].value).toBe('a: 1\nb: 2\n');
    expect(signs()).toEqual(['', '+', '−']);
    expect(shades()).toEqual(['applied', 'applied', 'removed-before']);

    type(1, 'a: 1\nb: 3\n');
    expect(signs()).toEqual(['', '', '']);
    expect(shades()).toEqual(['', '', '']);
  });

  it('labels the result panes with the file names', () => {
    type(0, 'a: 1\n');
    type(1, 'a: 2\n');
    const titles = [...document.querySelectorAll('.pane-title')].map((t) => t.textContent);
    expect(titles).toEqual(['File A', 'File B']);
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
});
