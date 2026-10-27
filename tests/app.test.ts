// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';

const textareas = () => document.querySelectorAll<HTMLTextAreaElement>('textarea');
const items = () => [...document.querySelectorAll('.diff-list li')].map((li) => li.textContent);

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
});
