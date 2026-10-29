import { formatPath, type DiffOptions } from './model';
import { parsePath, parsePathList } from './select';

/** Options a configuration file sets; those it leaves out keep their current value. */
export type ConfigResult = { ok: true; options: Partial<DiffOptions> } | { ok: false; error: string };

const LISTS = [
  ['include', 'Includi'],
  ['exclude', 'Escludi'],
] as const;
const FLAGS = ['keys', 'values', 'whitespace', 'keyOrder', 'ignoreArrayOrder', 'looseTypes'] as const;

const SHAPE = 'serve un oggetto con le opzioni del confronto (root, include, exclude, keys…)';

/**
 * Reads a saved configuration: root and arrayKeyField as strings, include and exclude as lists of paths
 * (or a single string), the other options as booleans. Paths come back in the "$." form.
 */
export function parseConfig(text: string): ConfigResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Configurazione non valida: il file non è JSON' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: `Configurazione non valida: ${SHAPE}` };
  }
  const record = data as Record<string, unknown>;
  const invalid = (message: string): ConfigResult => ({ ok: false, error: `Configurazione non valida: ${message}` });
  const options: Partial<DiffOptions> = {};

  if (record.root !== undefined) {
    if (typeof record.root !== 'string') return invalid('"root" deve essere un path');
    const parsed = parsePath(record.root);
    if (!parsed.ok) return invalid(parsed.error);
    options.root = parsed.path.length ? formatPath(parsed.path) : '';
  }
  for (const [key, field] of LISTS) {
    const value = record[key];
    if (value === undefined) continue;
    const list = typeof value === 'string' ? [value] : value;
    if (!Array.isArray(list) || list.some((p) => typeof p !== 'string')) {
      return invalid(`"${key}" deve essere una lista di path`);
    }
    const paths = [];
    for (const item of list as string[]) {
      const parsed = parsePathList(item, field);
      if (!parsed.ok) return invalid(parsed.error);
      paths.push(...parsed.paths);
    }
    options[key] = paths.map(formatPath).join(', ');
  }
  for (const key of FLAGS) {
    if (record[key] === undefined) continue;
    if (typeof record[key] !== 'boolean') return invalid(`"${key}" deve essere true o false`);
    options[key] = record[key];
  }
  if (record.arrayKeyField !== undefined) {
    if (typeof record.arrayKeyField !== 'string') return invalid('"arrayKeyField" deve essere un testo');
    options.arrayKeyField = record.arrayKeyField;
  }
  if (Object.keys(options).length === 0) return invalid(SHAPE);
  return { ok: true, options };
}

/** The JSON to save for all the options, or the error of the first invalid path field. */
export function formatConfig(opts: DiffOptions): { ok: true; text: string } | { ok: false; error: string } {
  const root = parsePath(opts.root);
  if (!root.ok) return root;
  const out: Record<string, unknown> = { root: root.path.length ? formatPath(root.path) : '' };
  for (const [key, field] of LISTS) {
    const parsed = parsePathList(opts[key], field);
    if (!parsed.ok) return parsed;
    out[key] = parsed.paths.map(formatPath);
  }
  for (const key of FLAGS) out[key] = opts[key];
  out.arrayKeyField = opts.arrayKeyField;
  return { ok: true, text: `${JSON.stringify(out, null, 2)}\n` };
}

/** A safe file name for a saved configuration: the given name, without characters files cannot have, plus ".json". */
export function configFileName(name: string): string {
  const base = name
    .trim()
    .replace(/\.json$/i, '')
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-')
    .trim();
  return `${base || 'ledger-config'}.json`;
}
