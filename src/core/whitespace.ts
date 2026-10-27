/** Describes the whitespace-only differences between two lines (empty if none). */
export function compareLines(a: string, b: string): string[] {
  if (a === b || a.replace(/\s+/g, '') !== b.replace(/\s+/g, '')) return [];
  const details: string[] = [];

  const indentA = leading(a);
  const indentB = leading(b);
  if (indentA.includes('\t') !== indentB.includes('\t')) details.push("tab vs spazi nell'indentazione");
  else if (indentA !== indentB) details.push(`indentazione ${indentA.length} → ${indentB.length}`);

  const trailA = trailing(a, indentA.length);
  const trailB = trailing(b, indentB.length);
  if (trailA !== trailB) details.push('spazi finali');

  const coreA = a.slice(indentA.length, a.length - trailA.length);
  const coreB = b.slice(indentB.length, b.length - trailB.length);
  if (coreA !== coreB) details.push('spaziatura interna');
  return details;
}

function leading(s: string): string {
  return /^[ \t]*/.exec(s)![0];
}

function trailing(s: string, from: number): string {
  return /[ \t]*$/.exec(s.slice(from))![0];
}
