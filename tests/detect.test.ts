import { describe, expect, it } from 'vitest';
import { detectFormat } from '../src/core/detect';

describe('detectFormat', () => {
  it('uses the file extension first', () => {
    expect(detectFormat('a: 1', 'config.json')).toBe('json');
    expect(detectFormat('{"a": 1}', 'config.YAML')).toBe('yaml');
    expect(detectFormat('{"a": 1}', 'config.yml')).toBe('yaml');
  });

  it('falls back to content when the extension is unknown or missing', () => {
    expect(detectFormat('  {"a": 1}', 'notes.txt')).toBe('json');
    expect(detectFormat('[1, 2]')).toBe('json');
    expect(detectFormat('{a: 1}')).toBe('yaml');
    expect(detectFormat('a: 1')).toBe('yaml');
  });
});
