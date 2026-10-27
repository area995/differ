import { describe, expect, it } from 'vitest';
import { movedKeys } from '../src/core/order';

describe('movedKeys', () => {
  it('returns nothing for identical order', () => {
    expect(movedKeys(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([]);
  });

  it('detects a key moved to the end', () => {
    expect(movedKeys(['a', 'b', 'c'], ['b', 'c', 'a'])).toEqual(['a']);
  });

  it('reports a single key for an adjacent swap', () => {
    expect(movedKeys(['a', 'b', 'c', 'd'], ['a', 'c', 'b', 'd'])).toEqual(['b']);
  });

  it('handles empty input', () => {
    expect(movedKeys([], [])).toEqual([]);
  });
});
