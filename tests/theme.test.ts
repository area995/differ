// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_KEY, createThemeSwitch, readTheme } from '../src/ui/theme';

const radio = (root: HTMLElement, value: string) => root.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;

describe('theme switch', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('follows the OS until a theme is chosen, then pins and remembers it', () => {
    const root = document.body.appendChild(document.createElement('div'));
    createThemeSwitch(root);
    expect(radio(root, 'auto').checked).toBe(true);
    expect(document.documentElement.dataset.theme).toBeUndefined();

    radio(root, 'dark').click();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(readTheme()).toBe('dark');

    radio(root, 'auto').click();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('starts from the saved choice', () => {
    localStorage.setItem(THEME_KEY, 'light');
    const root = document.body.appendChild(document.createElement('div'));
    createThemeSwitch(root);
    expect(radio(root, 'light').checked).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(root.querySelector('legend')!.textContent).toBe('Tema');
  });
});
