import type { Pos } from './model';

/** Converts a 1-based line/column position to a string offset, clamped to the text. */
export function toOffset(text: string, pos: Pos): number {
  let offset = 0;
  for (let line = 1; line < pos.line; line++) {
    const nl = text.indexOf('\n', offset);
    if (nl === -1) return text.length;
    offset = nl + 1;
  }
  return Math.min(offset + pos.col - 1, text.length);
}

export function lineStart(text: string, offset: number): number {
  return offset <= 0 ? 0 : text.lastIndexOf('\n', offset - 1) + 1;
}

/** Offset of the newline ending the line that contains `offset`, or the text length. */
export function lineEnd(text: string, offset: number): number {
  const nl = text.indexOf('\n', offset);
  return nl === -1 ? text.length : nl;
}

export function indentAt(text: string, offset: number): string {
  return /^[ \t]*/.exec(text.slice(lineStart(text, offset)))![0];
}
