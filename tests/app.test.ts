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

function setRoot(text: string): void {
  const input = document.querySelector<HTMLInputElement>('#options input[placeholder^="tutto"]')!;
  input.value = text;
  input.dispatchEvent(new Event('input'));
  vi.advanceTimersByTime(300);
}

function rootError(): string {
  const e = document.querySelector<HTMLElement>('.opt-error')!;
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

  it('compares only the subtree selected as root', () => {
    type(0, 'server:\n  port: 1\nother: 1\n');
    type(1, 'server:\n  port: 2\nother: 2\n');
    expect(items()).toHaveLength(2);

    setRoot('server');
    expect(items()).toEqual(['modificata$.port1 → 2']);
    expect(document.querySelector('.pane[data-side="A"] [data-line="2"]')!.className).toContain('d-changed');

    setRoot('$.nope');
    expect(rootError()).toBe('Root $.nope non trovata in A e B');
    expect(document.getElementById('result')!.textContent).toBe('');

    setRoot('server[');
    expect(rootError()).toBe('Root non valida: server[');

    setRoot('');
    expect(rootError()).toBe('');
    expect(items()).toHaveLength(2);
  });
});
