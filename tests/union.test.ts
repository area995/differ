import { describe, expect, it } from 'vitest';
import { formatPath } from '../src/core/model';
import { buildUnion, type UnionNode } from '../src/core/union';
import { node } from './helpers';

/** "path [present files] kind" for every node, depth-first. */
function flat(n: UnionNode): string[] {
  const here = n.path.length ? [`${formatPath(n.path)} [${n.present.join(',')}] ${n.kind}`] : [];
  return [...here, ...n.children.flatMap(flat)];
}

describe('buildUnion', () => {
  it('merges the keys of every file, first file order first', () => {
    const u = buildUnion([node('server: {port: 1}\ndb: {pool: 5}\n'), node('server: {port: 2, tls: true}\nlog: x\n')]);
    expect(flat(u)).toEqual([
      '$.server [0,1] object',
      '$.server.port [0,1] scalar',
      '$.server.tls [1] scalar',
      '$.db [0] object',
      '$.db.pool [0] scalar',
      '$.log [1] scalar',
    ]);
  });

  it('lists array items by index', () => {
    const u = buildUnion([node('l: [a, b]\n'), node('l: [a]\n')]);
    expect(flat(u)).toEqual(['$.l [0,1] array', '$.l[0] [0,1] scalar', '$.l[1] [0] scalar']);
  });

  it('lists array items by key field when given', () => {
    const u = buildUnion([node('users: [{name: a}, {name: b}]\n'), node('users: [{name: b}, {name: c}, x]\n')], 'name');
    expect(flat(u).filter((l) => !l.includes('.name '))).toEqual([
      '$.users [0,1] array',
      '$.users[name=a] [0] object',
      '$.users[name=b] [0,1] object',
      '$.users[name=c] [1] object',
      '$.users[2] [1] scalar',
    ]);
  });

  it('skips files that are missing', () => {
    expect(flat(buildUnion([undefined, node('a: 1\n')]))).toEqual(['$.a [1] scalar']);
  });
});
