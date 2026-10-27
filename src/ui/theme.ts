import { el } from './dom';

export type ThemeChoice = 'auto' | 'light' | 'dark';

/** Storage key; index.html reads it too, before the styles load, so that the page does not flash. */
export const THEME_KEY = 'ledger-theme';

const CHOICES: [ThemeChoice, string][] = [
  ['auto', 'Auto'],
  ['light', 'Chiaro'],
  ['dark', 'Scuro'],
];

/** The saved choice, "auto" (follow the OS) when there is none or storage is unavailable. */
export function readTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

/** Pins the theme on <html>, or lets the stylesheet follow the OS for "auto". */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}

/** Auto / Chiaro / Scuro as native radios: arrow keys and screen readers work without extra code. */
export function createThemeSwitch(root: HTMLElement): void {
  const current = readTheme();
  applyTheme(current);
  const group = el('fieldset', 'theme-switch');
  const legend = el('legend', 'sr-only');
  legend.textContent = 'Tema';
  group.append(legend);
  for (const [value, text] of CHOICES) {
    const label = el('label');
    label.title = value === 'auto' ? 'Segue il tema del sistema' : `Tema ${text.toLowerCase()}`;
    const input = el('input');
    input.type = 'radio';
    input.name = 'theme';
    input.value = value;
    input.checked = value === current;
    input.addEventListener('change', () => {
      applyTheme(value);
      try {
        if (value === 'auto') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, value);
      } catch {
        // without storage the choice still holds for this visit
      }
    });
    label.append(input, text);
    group.append(label);
  }
  root.append(group);
}
