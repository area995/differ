import { fieldValue } from './arrays';
import { formatPath, type Node, type Path, type PathSeg } from './model';

/** A path present in at least one of several documents. */
export type UnionNode = {
  path: Path;
  kind: Node['kind'];
  /** Indexes of the documents that contain this path. */
  present: number[];
  children: UnionNode[];
};

/**
 * Merges the structure of several documents: keys in first-seen order, array items by index or, when
 * `keyField` is given, by the value of that field. Missing documents are skipped.
 */
export function buildUnion(nodes: (Node | undefined)[], keyField = ''): UnionNode {
  const found = nodes.flatMap((node, index) => (node ? [{ node, index }] : []));
  return merge([], found, keyField.trim());
}

type Found = { node: Node; index: number };

function merge(path: Path, found: Found[], keyField: string): UnionNode {
  const groups = new Map<string, { seg: PathSeg; found: Found[] }>();
  const add = (seg: PathSeg, child: Found) => {
    const id = formatPath([seg]);
    const group = groups.get(id) ?? { seg, found: [] };
    group.found.push(child);
    groups.set(id, group);
  };
  for (const { node, index } of found) {
    if (node.kind === 'object') for (const e of node.entries) add(e.key, { node: e.value, index });
    if (node.kind === 'array') {
      node.items.forEach((item, i) => {
        const value = keyField ? fieldValue(item, keyField) : undefined;
        add(value === undefined ? i : { field: keyField, value }, { node: item, index });
      });
    }
  }
  return {
    path,
    kind: found[0]?.node.kind ?? 'object',
    present: found.map((f) => f.index),
    children: [...groups.values()].map((g) => merge([...path, g.seg], g.found, keyField)),
  };
}
