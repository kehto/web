/**
 * catalog/nap-type-fields.ts — Read each message's payload fields from a
 * packaged `@napplet/nap/<domain>/types.d.ts` with the TypeScript checker.
 *
 * Generator and test only: it imports `typescript`, so nothing on the
 * published or browser path may import it. Inheritance (including
 * `@napplet/core` bases), intersections and generic result aliases resolve
 * through the checker, which a text parser cannot do.
 */
import ts from 'typescript';
import type { FieldPresence, MessageFields } from './nap-types-parser.js';

type Constituent = { readonly type: string | null; readonly fields: Record<string, FieldPresence> };

function presenceOf(checker: ts.TypeChecker, prop: ts.Symbol): FieldPresence | null {
  const type = checker.getTypeOfSymbol(prop);
  const members = type.isUnion() ? type.types : [type];
  // `field?: never` / `field?: undefined` marks a field as forbidden in this branch.
  if (members.every((member) => (member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Never)) !== 0)) return null;
  return (prop.flags & ts.SymbolFlags.Optional) !== 0 ? 'optional' : 'required';
}

function constituent(checker: ts.TypeChecker, type: ts.Type): Constituent {
  const fields: Record<string, FieldPresence> = {};
  let literal: string | null = null;
  for (const prop of checker.getPropertiesOfType(type)) {
    if (prop.getName() === 'type') {
      const value = checker.getTypeOfSymbol(prop);
      literal = value.isStringLiteral() ? value.value : null;
      continue;
    }
    const presence = presenceOf(checker, prop);
    if (presence) fields[prop.getName()] = presence;
  }
  return { type: literal, fields };
}

/** A union of branches of one message: a field is required only when every branch requires it. */
function merge(branches: readonly Constituent[]): Record<string, FieldPresence> {
  const names = [...new Set(branches.flatMap((branch) => Object.keys(branch.fields)))].sort();
  return Object.fromEntries(names.map((name) => [name, branches.every((branch) => branch.fields[name] === 'required') ? 'required' : 'optional']));
}

/**
 * Payload fields of every message in a packaged domain's `<Domain>NapMessage` union.
 *
 * Union branches are grouped by their `type` literal. Several branches of one
 * literal (an "exactly one of result or error" reply) merge branch-wise. The
 * `type` discriminant itself is not a payload field.
 *
 * @param file - Absolute path of `@napplet/nap/dist/<domain>/types.d.ts`.
 * @param domain - Bare domain name.
 * @param source - Optional replacement text for `file`, resolved in place (mutation tests).
 * @returns Fields per message type, sorted by type.
 * @throws When the union is missing or a branch has no single `domain.*` literal.
 * @example
 * ```ts
 * readPackageFields(join(dist, 'theme/types.d.ts'), 'theme')['theme.get']; // { fields: { id: 'required' } }
 * ```
 */
export function readPackageFields(file: string, domain: string, source?: string): Record<string, MessageFields> {
  const options: ts.CompilerOptions = { strict: true, noEmit: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
  const host = ts.createCompilerHost(options);
  if (source !== undefined) {
    const read = host.getSourceFile.bind(host);
    host.getSourceFile = (name, version, ...rest) => (name === file ? ts.createSourceFile(name, source, version) : read(name, version, ...rest));
  }
  const program = ts.createProgram([file], options, host);
  const checker = program.getTypeChecker();
  const alias = `${domain.charAt(0).toUpperCase()}${domain.slice(1)}NapMessage`;
  const declaration = program.getSourceFile(file)?.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === alias);
  if (!declaration) throw new Error(`${file}: no ${alias} union`);
  const union = checker.getTypeAtLocation(declaration.name);
  const grouped = new Map<string, Constituent[]>();
  for (const branch of (union.isUnion() ? union.types : [union]).map((member) => constituent(checker, member))) {
    if (!branch.type?.startsWith(`${domain}.`)) throw new Error(`${file}: a ${alias} branch has no ${domain}.* type literal`);
    grouped.set(branch.type, [...(grouped.get(branch.type) ?? []), branch]);
  }
  return Object.fromEntries([...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([type, branches]) => [type, { fields: merge(branches) }]));
}
