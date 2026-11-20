/**
 * catalog/field-drift.ts — Field-level drift between the installed
 * `@napplet/nap` message declarations and the pinned NAP wire tables.
 */
import { INVENTORY } from './inventory.generated.js';
import type { DomainInventory } from './inventory.js';
import type { FieldPresence } from './nap-types-parser.js';

/** One field whose presence differs between the pinned wire table and the packaged types. */
export interface FieldDrift {
  /** Message type, `domain.action`. */
  readonly type: string;
  readonly field: string;
  /** Presence in the pinned NAP wire table. */
  readonly spec: FieldPresence | 'absent';
  /** Presence in the installed `@napplet/nap` declaration. */
  readonly package: FieldPresence | 'absent';
}

/**
 * A difference the pinned NAP's own prose settles, cited by sentence.
 *
 * Classification rule: prose that adds to or conditions a table row (a
 * generic "any result MAY include `error`; when present, other fields are
 * undefined" clause) makes the packaged shape `prose`. Prose and table that
 * make incompatible unconditional claims about the same field are a
 * `contradiction`. A difference no sentence addresses is not an exception.
 */
export interface FieldDriftException extends FieldDrift {
  /**
   * `prose`: a sentence of the pinned NAP sanctions the packaged shape, so it is not drift.
   * `contradiction`: the pinned NAP's table and prose disagree, so neither side is authority (a spec gap).
   */
  readonly kind: 'prose' | 'contradiction';
  /** Id of the owning {@link AuthorityRef}. */
  readonly authority: string;
  /** The exact sentence(s) of the pinned document. */
  readonly quote: string;
}

/** A message the wire table names but the field comparison cannot read. */
export interface UncomparedMessage {
  readonly type: string;
  /** Why: the cell is prose (`unparsed`) or spreads named types (`open`, named fields still compared). */
  readonly reason: 'unparsed' | 'open';
  readonly cell?: string;
}

/**
 * Field differences of one domain, for every message both sources define.
 * Operations only one source defines are `catalog/package-drift`'s concern.
 *
 * @param domain - Bare domain name.
 * @param inventory - Inventory to read; defaults to the pinned one.
 * @returns One row per differing field, sorted by type then field.
 * @example
 * ```ts
 * fieldDrift('resource'); // [] when the package matches NAP-RESOURCE
 * ```
 */
export function fieldDrift(domain: string, inventory: Readonly<Record<string, DomainInventory>> = INVENTORY): FieldDrift[] {
  const entry = inventory[domain];
  if (!entry) return [];
  const rows: FieldDrift[] = [];
  for (const [type, spec] of Object.entries(entry.specFields)) {
    const pkg = entry.packageFields[type];
    if (!pkg || spec.unparsed !== undefined) continue;
    const names = [...new Set([...Object.keys(spec.fields), ...(spec.open ? [] : Object.keys(pkg.fields))])].sort();
    for (const field of names) {
      const specPresence = spec.fields[field] ?? 'absent';
      const packagePresence = pkg.fields[field] ?? 'absent';
      if (specPresence !== packagePresence) rows.push({ type, field, spec: specPresence, package: packagePresence });
    }
  }
  return rows.sort((a, b) => a.type.localeCompare(b.type) || a.field.localeCompare(b.field));
}

const RESULT_ERROR_CLAUSE = 'Any result message MAY include an `error` field (string). When `error` is present, other result fields are undefined.';

/**
 * Field differences the pinned NAP documents settle in prose, each matched
 * exactly (type, field and both presences): once either side changes, the
 * row stops applying and the difference is reported again.
 */
export const FIELD_DRIFT_EXCEPTIONS: readonly FieldDriftException[] = Object.freeze([
  { type: 'relay.query.result', field: 'error', spec: 'absent', package: 'optional', kind: 'prose', authority: 'nap-relay', quote: '`relay.query.result` MAY include an `error` field instead of `events` if the query fails.' },
  ...['storage.get.result', 'storage.keys.result', 'storage.remove.result', 'storage.set.result'].map((type) => ({ type, field: 'error', spec: 'absent' as const, package: 'optional' as const, kind: 'prose' as const, authority: 'nap-storage', quote: RESULT_ERROR_CLAUSE })),
  { type: 'inc.subscribe.result', field: 'error', spec: 'absent', package: 'optional', kind: 'prose', authority: 'nap-inc', quote: '`inc.subscribe.result` MAY include an `error` field (string) if the shell rejects the subscription.' },
  { type: 'theme.get.result', field: 'error', spec: 'absent', package: 'optional', kind: 'prose', authority: 'nap-theme', quote: RESULT_ERROR_CLAUSE },
  { type: 'theme.get.result', field: 'theme', spec: 'required', package: 'optional', kind: 'prose', authority: 'nap-theme', quote: RESULT_ERROR_CLAUSE },
  { type: 'keys.registerAction.result', field: 'error', spec: 'absent', package: 'optional', kind: 'prose', authority: 'nap-keys', quote: '`keys.registerAction.result` includes an `error` field (string) on failure.' },
  {
    type: 'identity.getProfile.result', field: 'profile', spec: 'optional', package: 'required', kind: 'contradiction', authority: 'nap-identity',
    quote: 'Wire table: `id`, `profile?`, `error?`. Prose: "`getProfile` returns `profile: null` if no kind 0 is found -- this is not an error." and "When `error` is present, the primary result field contains a sensible default (empty array, null, etc.)."',
  },
  // Open on napplet/naps#33 (kehto/web#518). `upload.info.result` and
  // `upload.status.result` are not listed: the NAP pairs `error?` with the
  // required field and no sentence omits it, so their drift still fails.
  // Kehto's failed info replies carry `info: { rails: [] }`; its failed status
  // replies omit `status`, a bounded spec gap in docs/policies/NIP-5D-CONFORMANCE.md.
  {
    type: 'upload.upload.result', field: 'result', spec: 'required', package: 'optional', kind: 'contradiction', authority: 'nap-upload',
    quote: 'Wire table: `id`, `result`, `error?`. `UploadResult.uploadId` is required: "Shell-generated upload identifier." Error Handling: "The shell SHOULD return a structured `result` with `ok: false` when an upload was created and then failed or was cancelled. The shell SHOULD return a top-level `error` when no upload was created."',
  },
]);

/** Field drift of a set of domains, split by how the pinned NAPs settle each row. */
export interface FieldDriftReport {
  /** Differences no pinned sentence settles: package drift (or a table the NAP must fix). */
  readonly findings: readonly FieldDrift[];
  /** Differences a pinned NAP sentence sanctions. */
  readonly sanctioned: readonly FieldDriftException[];
  /** Differences where the pinned NAP's table and prose disagree. */
  readonly contradictions: readonly FieldDriftException[];
  /** Wire-table rows whose payload cell the comparison cannot fully read. */
  readonly uncompared: readonly UncomparedMessage[];
  /** Messages whose fields were compared. */
  readonly compared: number;
}

const sameRow = (a: FieldDrift, b: FieldDrift): boolean => a.type === b.type && a.field === b.field && a.spec === b.spec && a.package === b.package;

/**
 * Field drift of several domains, classified against {@link FIELD_DRIFT_EXCEPTIONS}.
 *
 * @param domains - Bare domain names.
 * @param inventory - Inventory to read; defaults to the pinned one.
 * @param exceptions - Exceptions to apply; defaults to {@link FIELD_DRIFT_EXCEPTIONS}.
 * @returns Findings, sanctioned and contradictory rows, and the rows not compared.
 * @example
 * ```ts
 * fieldDriftReport(['theme']).findings; // []
 * ```
 */
export function fieldDriftReport(
  domains: readonly string[],
  inventory: Readonly<Record<string, DomainInventory>> = INVENTORY,
  exceptions: readonly FieldDriftException[] = FIELD_DRIFT_EXCEPTIONS,
): FieldDriftReport {
  const findings: FieldDrift[] = [];
  const sanctioned: FieldDriftException[] = [];
  const contradictions: FieldDriftException[] = [];
  for (const row of domains.flatMap((domain) => fieldDrift(domain, inventory))) {
    const exception = exceptions.find((candidate) => sameRow(candidate, row));
    if (!exception) findings.push(row);
    else (exception.kind === 'prose' ? sanctioned : contradictions).push(exception);
  }
  const compared = domains.flatMap((domain) => Object.entries(inventory[domain]?.specFields ?? {})
    .filter(([type, spec]) => spec.unparsed === undefined && inventory[domain]?.packageFields[type] !== undefined));
  const uncompared = domains.flatMap((domain) => Object.entries(inventory[domain]?.specFields ?? {}).flatMap(([type, spec]): UncomparedMessage[] => {
    if (spec.unparsed !== undefined) return [{ type, reason: 'unparsed', cell: spec.unparsed }];
    return spec.open ? [{ type, reason: 'open' }] : [];
  }));
  return { findings, sanctioned, contradictions, uncompared, compared: compared.length };
}
