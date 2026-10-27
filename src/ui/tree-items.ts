import { scalarType } from '../core/equal';
import { formatPath, type Node, type Path, type PathSeg, type Range } from '../core/model';
import type { UnionNode } from '../core/union';
import { formatValue } from './result';
import type { TreeItem } from './tree';

/** Tree items for the children of a document node. */
export function documentItems(node: Node, path: Path = []): TreeItem[] {
  if (node.kind === 'object') {
    return node.entries.map((e) =>
      documentItem([...path, e.key], e.key, e.value, { start: e.keyRange.start, end: e.value.range.end }),
    );
  }
  if (node.kind === 'array') return node.items.map((item, i) => documentItem([...path, i], `[${i}]`, item, item.range));
  return [{ id: '$', label: '$', value: formatValue(node.value), tone: scalarType(node.value), range: node.range }];
}

function documentItem(path: Path, label: string, value: Node, range: Range): TreeItem {
  const id = formatPath(path);
  if (value.kind === 'scalar') return { id, label, value: formatValue(value.value), tone: scalarType(value.value), range };
  const children = documentItems(value, path);
  return { id, label, badge: badge(value.kind, children.length), range, children };
}

/** Tree items for the children of a union node; `names` are the documents' short names. */
export function unionItems(node: UnionNode, names: string[]): TreeItem[] {
  return node.children.map((child) => {
    const children = unionItems(child, names);
    const partial = child.present.length < names.length;
    return {
      id: formatPath(child.path),
      label: segLabel(child.path[child.path.length - 1]),
      ...(child.kind !== 'scalar' && { badge: badge(child.kind, children.length) }),
      ...(partial && { note: `solo in ${child.present.map((i) => names[i]).join(', ')}` }),
      ...(children.length && { children }),
    };
  });
}

function badge(kind: Node['kind'], size: number): string {
  return kind === 'object' ? `{${size}}` : `[${size}]`;
}

function segLabel(seg: PathSeg): string {
  return typeof seg === 'string' ? seg : formatPath([seg]).slice(1);
}
