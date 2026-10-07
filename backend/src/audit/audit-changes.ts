export type AuditChanges = Record<string, { before: unknown; after: unknown }>;

export function diffFields(before: object, after: object, fields: readonly string[]): AuditChanges {
  const previous = before as Record<string, unknown>;
  const next = after as Record<string, unknown>;
  const changes: AuditChanges = {};
  for (const field of fields) {
    if (next[field] === undefined) continue;
    const beforeValue = normalize(previous[field]);
    const afterValue = normalize(next[field]);
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) changes[field] = { before: beforeValue, after: afterValue };
  }
  return changes;
}

export function pickFields(record: object, fields: readonly string[]): Record<string, unknown> {
  const source = record as Record<string, unknown>;
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, normalize(source[field])]));
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, normalize(nested)]));
  }
  return value;
}
