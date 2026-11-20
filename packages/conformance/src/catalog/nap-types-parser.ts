/**
 * catalog/nap-types-parser.ts — Read a domain's operations from its packaged
 * `@napplet/nap/<domain>/types.d.ts`, and operations plus payload fields from
 * a NAP document's wire table.
 *
 * Self-contained (no imports) so the inventory generator can load it with
 * Node's type stripping as well as through the normal build.
 */

/** Operations of one domain, split by direction. */
export interface ParsedOperations {
  /** Napplet -> runtime message types. */
  readonly outbound: readonly string[];
  /** Runtime -> napplet message types. */
  readonly inbound: readonly string[];
}

function unionMembers(source: string, alias: RegExp): string[] {
  const match = alias.exec(source);
  if (!match?.[1]) return [];
  return match[1].split('|').map((member) => member.trim()).filter((member) => /^[A-Z]\w*$/.test(member));
}

function literalType(source: string, interfaceName: string, domain: string): string | null {
  const start = source.search(new RegExp(`interface ${interfaceName}\\b[^{]*\\{`));
  if (start < 0) return null;
  const body = source.slice(start, start + 4000);
  const literal = new RegExp(`\\btype\\??: '(${domain}\\.[A-Za-z0-9_.-]+)'`).exec(body);
  return literal?.[1] ?? null;
}

/**
 * Parse the operations of a packaged types declaration.
 *
 * Outbound members of `<Domain>OutboundMessage` / `<Domain>RequestMessage`
 * are resolved to their `type` literals; every other declared literal of the
 * domain is inbound. Members with only a template-literal type are skipped.
 *
 * @param source - Text of `@napplet/nap/<domain>/types.d.ts`.
 * @param domain - Bare domain name.
 * @returns Sorted message types per direction.
 * @example
 * ```ts
 * parseNapTypes(readFileSync(path, 'utf8'), 'theme'); // { outbound: ['theme.get'], inbound: [...] }
 * ```
 */
export function parseNapTypes(source: string, domain: string): ParsedOperations {
  const prefix = domain.charAt(0).toUpperCase() + domain.slice(1);
  const resolve = (direction: 'Outbound' | 'Inbound' | 'Request' | 'Result'): string[] => {
    const members = unionMembers(source, new RegExp(`type ${prefix}${direction}Message\\s*=\\s*([^;]+);`));
    return members.map((member) => literalType(source, member, domain)).filter((type): type is string => type !== null);
  };
  const outbound = new Set([...resolve('Outbound'), ...resolve('Request')]);
  // Inbound unions are often built from generic aliases, so take every
  // declared literal that is not outbound. Doc comments are stripped first.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const literals = code.matchAll(new RegExp(`\\btype\\??: '(${domain}\\.[A-Za-z0-9_.-]+)'`, 'g'));
  // Union members are taken as declared (a type may travel both ways); bare literals only when not outbound.
  const loose = [...literals].map((match) => match[1] as string).filter((type) => !outbound.has(type));
  const inbound = new Set([...resolve('Inbound'), ...resolve('Result'), ...loose]);
  return { outbound: [...outbound].sort(), inbound: [...inbound].sort() };
}

/**
 * Parse a NAP document's wire-protocol table rows of the form
 * `` | `domain.action` | napplet -> runtime | ... | ``. A row between two
 * napplet roles (`owner -> peer`) counts in both directions.
 *
 * @param markdown - The NAP document.
 * @param domain - Bare domain name.
 * @returns Sorted message types per direction.
 * @example
 * ```ts
 * parseNapWireTable(text, 'theme'); // { outbound: ['theme.get'], inbound: ['theme.changed', 'theme.get.result'] }
 * ```
 */
export function parseNapWireTable(markdown: string, domain: string): ParsedOperations {
  const outbound = new Set<string>();
  const inbound = new Set<string>();
  const row = new RegExp(`^\\|\\s*\`(${domain}\\.[A-Za-z0-9_.-]+)\`\\s*\\|\\s*([^|]+?)\\s*\\|`, 'gm');
  for (let match = row.exec(markdown); match; match = row.exec(markdown)) {
    const [from, to] = (match[2] ?? '').toLowerCase().split(/->|→/).map((side) => side.trim());
    if (to === undefined) continue;
    const runtime = /^(shell|runtime|host)$/;
    // `shell -> target napplet` is still runtime -> napplet.
    if (from === 'napplet' && runtime.test(to)) outbound.add(match[1] as string);
    else if (runtime.test(from ?? '') && /\bnapplet$/.test(to)) inbound.add(match[1] as string);
    else {
      // Role-to-role rows (`owner -> peer`) can travel either way over the port.
      outbound.add(match[1] as string);
      inbound.add(match[1] as string);
    }
  }
  return { outbound: [...outbound].sort(), inbound: [...inbound].sort() };
}

/** Whether a payload field must be present. */
export type FieldPresence = 'required' | 'optional';

/** Payload fields of one message. */
export interface MessageFields {
  /** Every named field and whether it is required. `type` is never listed. */
  readonly fields: Readonly<Record<string, FieldPresence>>;
  /** The wire-table cell also spreads whole named types (`DmStatus` or `DmError`), so unnamed fields are allowed. */
  readonly open?: true;
  /** The wire-table cell is prose the parser cannot read, quoted; its fields are not compared. */
  readonly unparsed?: string;
}

const FIELD = '[a-z][A-Za-z0-9_]*';

/** Read one comma-separated segment of a payload cell into `fields`; false when it is not a field list. */
function readSegment(segment: string, fields: Record<string, FieldPresence>): 'field' | 'spread' | null {
  const single = new RegExp(`^\`(${FIELD})(\\?)?\`(\\?)?$`).exec(segment);
  if (single) {
    fields[single[1] as string] = single[2] || single[3] ? 'optional' : 'required';
    return 'field';
  }
  const optional = new RegExp(`^optional \`(${FIELD})\`$`).exec(segment);
  if (optional) {
    fields[optional[1] as string] = 'optional';
    return 'field';
  }
  // `a` or `b`: exactly one is present, so neither is required on its own.
  const either = new RegExp(`^\`(${FIELD})\` or \`(${FIELD})\`$`).exec(segment);
  if (either) {
    fields[either[1] as string] = 'optional';
    fields[either[2] as string] = 'optional';
    return 'field';
  }
  return /^`[A-Z]\w*`( or `[A-Z]\w*`)*$/.test(segment) ? 'spread' : null;
}

/**
 * Parse one wire-table payload cell, such as `` `id`, `servers?`, `error?` ``.
 * Field optionality is `name?` or `` `name`? `` or `optional `name``;
 * parenthesised notes are type hints and are dropped; `none` is no fields.
 *
 * @param cell - The cell text.
 * @returns The named fields, whether the cell spreads named types, or the unparsed text.
 * @example
 * ```ts
 * parseWireFieldCell('`id`, `servers?`, `error?`'); // { fields: { id: 'required', servers: 'optional', error: 'optional' } }
 * ```
 */
export function parseWireFieldCell(cell: string): MessageFields {
  const text = cell.trim();
  if (/^\(?none\)?$/i.test(text)) return { fields: {} };
  const fields: Record<string, FieldPresence> = {};
  let open = false;
  for (const segment of text.replace(/\s*\([^)]*\)/g, '').split(',').map((part) => part.trim()).filter(Boolean)) {
    const kind = readSegment(segment, fields);
    if (kind === null) return { fields: {}, unparsed: text };
    if (kind === 'spread') open = true;
  }
  return open ? { fields, open: true } : { fields };
}

/**
 * Parse the payload column of a NAP document's wire table: rows of the form
 * `` | `domain.action` | direction | payload fields | ``.
 *
 * @param markdown - The NAP document.
 * @param domain - Bare domain name.
 * @returns Fields per message type, sorted by type.
 * @throws When one type has two rows with different payload cells.
 * @example
 * ```ts
 * parseNapWireFields(text, 'theme')['theme.get.result']; // { fields: { id: 'required', theme: 'required' } }
 * ```
 */
export function parseNapWireFields(markdown: string, domain: string): Record<string, MessageFields> {
  const found = new Map<string, { cell: string; fields: MessageFields }>();
  const row = new RegExp(`^\\|\\s*\`(${domain}\\.[A-Za-z0-9_.-]+)\`\\s*\\|[^|]+\\|([^|]*)\\|`, 'gm');
  for (let match = row.exec(markdown); match; match = row.exec(markdown)) {
    const type = match[1] as string;
    const cell = (match[2] ?? '').trim();
    const seen = found.get(type);
    if (seen && seen.cell !== cell) throw new Error(`${type} has two wire-table rows with different payloads`);
    found.set(type, { cell, fields: parseWireFieldCell(cell) });
  }
  return Object.fromEntries([...found].sort(([a], [b]) => a.localeCompare(b)).map(([type, entry]) => [type, entry.fields]));
}
