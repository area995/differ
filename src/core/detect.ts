import type { Format } from './model';

export function detectFormat(text: string, fileName?: string): Format {
  const ext = fileName?.toLowerCase().split('.').pop();
  if (ext === 'json') return 'json';
  if (ext === 'yaml' || ext === 'yml') return 'yaml';
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // not JSON: flow-style YAML
    }
  }
  return 'yaml';
}
