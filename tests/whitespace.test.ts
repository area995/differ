import { describe, expect, it } from 'vitest';
import { compareLines } from '../src/core/whitespace';

describe('compareLines', () => {
  it('returns nothing for identical lines', () => {
    expect(compareLines('  a: 1', '  a: 1')).toEqual([]);
  });

  it('reports indentation width', () => {
    expect(compareLines('  a: 1', '    a: 1')).toEqual(['indentazione 2 → 4']);
  });

  it('reports tabs vs spaces', () => {
    expect(compareLines('\ta: 1', '  a: 1')).toEqual(["tab vs spazi nell'indentazione"]);
  });

  it('reports trailing whitespace', () => {
    expect(compareLines('a: 1  ', 'a: 1')).toEqual(['spazi finali']);
  });

  it('reports inner spacing', () => {
    expect(compareLines('"a":1,', '"a": 1,')).toEqual(['spaziatura interna']);
  });

  it('ignores non-whitespace differences', () => {
    expect(compareLines('a: 1', 'a: 2')).toEqual([]);
  });
});
