import { describe, expect, it } from 'vitest';
import { configFileName, formatConfig, parseConfig } from '../src/core/config';
import { DEFAULT_OPTIONS } from '../src/core/model';

describe('parseConfig', () => {
  it('reads every option, paths in the "$." form', () => {
    const text = JSON.stringify({
      root: 'config',
      include: ['server', 'users[name=bob]'],
      exclude: ['$.server.tls'],
      keys: false,
      values: true,
      whitespace: true,
      keyOrder: true,
      ignoreArrayOrder: true,
      arrayKeyField: 'name',
      looseTypes: true,
    });
    expect(parseConfig(text)).toEqual({
      ok: true,
      options: {
        root: '$.config',
        include: '$.server, $.users[name=bob]',
        exclude: '$.server.tls',
        keys: false,
        values: true,
        whitespace: true,
        keyOrder: true,
        ignoreArrayOrder: true,
        arrayKeyField: 'name',
        looseTypes: true,
      },
    });
  });

  it('leaves out the options the file does not set; a list may be a single string', () => {
    expect(parseConfig('{"exclude": "db.password, db.user"}')).toEqual({
      ok: true,
      options: { exclude: '$.db.password, $.db.user' },
    });
    expect(parseConfig('{"root": ""}')).toEqual({ ok: true, options: { root: '' } });
  });

  it('rejects what is not a configuration', () => {
    expect(parseConfig('nope')).toEqual({ ok: false, error: 'Configurazione non valida: il file non è JSON' });
    for (const text of ['[]', '{}', '{"other": 1}']) {
      expect(parseConfig(text)).toEqual({
        ok: false,
        error: 'Configurazione non valida: serve un oggetto con le opzioni del confronto (root, include, exclude, keys…)',
      });
    }
    const error = (text: string) => {
      const r = parseConfig(text);
      return r.ok ? null : r.error;
    };
    expect(error('{"include": [1]}')).toBe('Configurazione non valida: "include" deve essere una lista di path');
    expect(error('{"exclude": ["db["]}')).toBe('Configurazione non valida: Escludi non valido: db[');
    expect(error('{"root": "a["}')).toBe('Configurazione non valida: Root non valida: a[');
    expect(error('{"root": 1}')).toBe('Configurazione non valida: "root" deve essere un path');
    expect(error('{"keys": "yes"}')).toBe('Configurazione non valida: "keys" deve essere true o false');
    expect(error('{"arrayKeyField": 1}')).toBe('Configurazione non valida: "arrayKeyField" deve essere un testo');
  });
});

describe('formatConfig', () => {
  it('writes every option, which reads back the same', () => {
    const opts = { ...DEFAULT_OPTIONS, root: 'config', include: 'server, db', ignoreArrayOrder: true, arrayKeyField: 'id' };
    const r = formatConfig(opts);
    if (!r.ok) throw new Error(r.error);
    expect(JSON.parse(r.text)).toEqual({
      root: '$.config',
      include: ['$.server', '$.db'],
      exclude: [],
      keys: true,
      values: true,
      whitespace: false,
      keyOrder: false,
      ignoreArrayOrder: true,
      looseTypes: false,
      arrayKeyField: 'id',
    });
    expect(parseConfig(r.text)).toEqual({
      ok: true,
      options: { ...opts, root: '$.config', include: '$.server, $.db' },
    });
  });

  it('refuses an invalid path field', () => {
    expect(formatConfig({ ...DEFAULT_OPTIONS, exclude: 'a[' })).toEqual({ ok: false, error: 'Escludi non valido: a[' });
    expect(formatConfig({ ...DEFAULT_OPTIONS, root: 'a[' })).toEqual({ ok: false, error: 'Root non valida: a[' });
  });
});

describe('configFileName', () => {
  it('adds .json once and falls back to a default name', () => {
    expect(configFileName('prod')).toBe('prod.json');
    expect(configFileName(' prod.JSON ')).toBe('prod.json');
    expect(configFileName('')).toBe('ledger-config.json');
    expect(configFileName('  ')).toBe('ledger-config.json');
  });

  it('replaces characters a file name cannot have', () => {
    expect(configFileName('a/b:c*?')).toBe('a-b-c-.json');
  });
});
