/**
 * catalog/nap-types-parser.ts — Read a domain's operations from its packaged
 * `@napplet/nap/<domain>/types.d.ts`, and from a NAP document's wire table.
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
  const declared = [...resolve('Inbound'), ...resolve('Result'), ...[...literals].map((match) => match[1] as string)];
  const inbound = new Set(declared.filter((type) => !outbound.has(type)));
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
