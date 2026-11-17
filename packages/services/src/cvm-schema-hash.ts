/** CEP-15 annotation fields excluded from compatibility hashes. */
const ANNOTATIONS = new Set(['title', 'description', 'default', 'examples', 'deprecated', 'readOnly', 'writeOnly']);

function normalized(value: unknown, depth = 0): unknown {
  if (depth > 64) throw new Error('schema mismatch');
  if (Array.isArray(value)) return value.map(item => normalized(item, depth + 1));
  if (value === null || typeof value !== 'object') return value;
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, item] of Object.entries(value)) {
    if (ANNOTATIONS.has(key) || key.startsWith('x-')) continue;
    if (key === '$ref' && typeof item === 'string' && !item.startsWith('#')) throw new Error('schema mismatch');
    result[key] = normalized(item, depth + 1);
  }
  return result;
}

// RFC 8785: ECMAScript primitive serialization, UTF-16 property ordering, no whitespace.
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value !== 'object' || value === null) throw new Error('schema mismatch');
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

/**
 * Compute a tool's CEP-15 compatibility hash without resolving remote references.
 * @param tool - Tool name and self-contained JSON schemas from tools/list.
 * @returns Lowercase SHA-256 digest of the normalized JCS payload.
 * @example
 * ```ts
 * await computeCvmToolSchemaHash({ name: 'echo', inputSchema: { type: 'object' } });
 * ```
 */
export async function computeCvmToolSchemaHash(tool: {
  name: string; inputSchema: Record<string, unknown>; outputSchema?: Record<string, unknown>;
}): Promise<string> {
  const payload = {
    name: tool.name, inputSchema: normalized(tool.inputSchema),
    ...(tool.outputSchema == null ? {} : { outputSchema: normalized(tool.outputSchema) }),
  };
  const bytes = new TextEncoder().encode(canonical(payload));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
