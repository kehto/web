/**
 * model.ts — The serializable result model shared by every conformance surface.
 *
 * Everything here is plain data: a run can be produced in a browser page,
 * returned across `page.evaluate`, written as JSON, and rendered by the CLI
 * reporters or the web UI without any of them re-deriving a verdict.
 */

/** Outcome of one check. `spec-gap` is a real missing or contradictory upstream decision. */
export type CheckStatus = 'pass' | 'fail' | 'skip' | 'spec-gap';

/** `error` failures fail the run and the CLI exit code; `warning` failures are reported only. */
export type CheckSeverity = 'error' | 'warning';

/**
 * What a check proves.
 *
 * - `nip5d-core`: a requirement of NIP-5D itself.
 * - `nap-spec`: semantics exercised against a named NAP revision.
 * - `wire-contract`: envelope shape and correlation proved against the packaged
 *   `@napplet/nap` types only.
 * - `kehto-policy`: a Kehto choice that is stricter than the protocol.
 */
export type CheckScope = 'nip5d-core' | 'nap-spec' | 'wire-contract' | 'kehto-policy';

/** The two profiles every target must support. */
export type ConformanceProfile = 'minimal' | 'full';

/** Whether the optional NAP-SHELL domain is exposed in a variant. */
export type ShellMode = 'shell-present' | 'shell-absent';

/**
 * A pinned upstream source a check is argued from.
 *
 * @example
 * ```ts
 * const ref: AuthorityRef = {
 *   id: 'nap-theme', title: 'NAP-THEME', repo: 'napplet/naps',
 *   ref: '377bf939c6c906817084b43dd21d424de646dbc2', path: 'naps/NAP-THEME.md', status: 'merged',
 * };
 * ```
 */
export interface AuthorityRef {
  /** Stable id used by checks, e.g. `nip5d` or `nap-theme`. */
  readonly id: string;
  /** Document title. */
  readonly title: string;
  /** `owner/name` of the repository that holds the document. */
  readonly repo: string;
  /** Exact commit the document was read at. */
  readonly ref: string;
  /** Path of the document inside the repository. */
  readonly path: string;
  /** `merged` on the default branch, `draft` at an open pull-request head. */
  readonly status: 'merged' | 'draft';
  /** Pull request number when `status` is `draft`. */
  readonly pr?: number;
}

/** Direction of one transcript entry. */
export type WireDirection = 'napplet->runtime' | 'runtime->napplet';

/**
 * One captured wire message.
 *
 * @example
 * ```ts
 * const entry: TranscriptEntry = {
 *   seq: 4, at: 12.5, variant: 'full/shell-present', endpoint: 'ep-2',
 *   direction: 'napplet->runtime', tap: 'frame', envelope: { type: 'theme.get', id: 'c1' },
 * };
 * ```
 */
export interface TranscriptEntry {
  /** Monotonic order across the whole run. */
  readonly seq: number;
  /** Milliseconds since the run started. */
  readonly at: number;
  /** Variant the message belongs to, e.g. `full/shell-absent`. */
  readonly variant: string;
  /** Target-assigned endpoint (window) id. */
  readonly endpoint: string;
  readonly direction: WireDirection;
  /** `frame`: seen inside the napplet document; `host`: seen at the runtime boundary. */
  readonly tap: 'frame' | 'host';
  /** The message as sent. Not always an object: malformed-wire cases send arrays and scalars. */
  readonly envelope: unknown;
  /** Frame tap only: the message was withheld from the bootstrap until the probe released it. */
  readonly withheld?: boolean;
  /** Frame tap only: port receivers the bootstrap had installed when this message left. */
  readonly receivers?: number;
}

/**
 * The static part of a check: what it is and what it is argued from.
 *
 * @example
 * ```ts
 * const definition: CheckDefinition = {
 *   id: 'nip5d/sandbox', title: 'Probe iframe is sandboxed without allow-same-origin',
 *   scope: 'nip5d-core', severity: 'error', authority: ['nip5d'],
 * };
 * ```
 */
export interface CheckDefinition {
  /** Stable id consumers filter on, e.g. `nip5d/sandbox` or `theme/correlation`. */
  readonly id: string;
  readonly title: string;
  readonly scope: CheckScope;
  readonly severity: CheckSeverity;
  /** Owning NAP domain, when the check belongs to one. */
  readonly domain?: string;
  /** Ids of the {@link AuthorityRef}s the check is argued from. */
  readonly authority: readonly string[];
}

/**
 * What a check evaluator returns.
 *
 * @example
 * ```ts
 * const outcome: CheckOutcome = { status: 'fail', detail: 'window.nostr is defined', diagnostics: { type: 'object' } };
 * ```
 */
export interface CheckOutcome {
  readonly status: CheckStatus;
  /** One-sentence explanation. A `spec-gap` detail names the missing decision and the bounded policy applied. */
  readonly detail: string;
  /** Structured evidence: offending envelopes, expected and observed values. */
  readonly diagnostics?: unknown;
}

/** One evaluated check in one variant. */
export interface CheckResult extends CheckDefinition, CheckOutcome {
  /** Variant the result belongs to, e.g. `minimal/shell-absent`. */
  readonly variant: string;
}

/** How one inventoried operation was covered. */
export type OperationCoverage = 'nap-spec' | 'wire-contract' | 'spec-gap' | 'uncovered';

/**
 * Coverage of one message type in one domain.
 *
 * @example
 * ```ts
 * const row: OperationResult = {
 *   type: 'theme.get', direction: 'napplet->runtime', sources: ['spec', 'package'],
 *   coverage: 'nap-spec', status: 'pass', cases: ['theme/get'],
 * };
 * ```
 */
export interface OperationResult {
  /** Message type, e.g. `theme.get`. */
  readonly type: string;
  readonly direction: WireDirection;
  /** Where the operation is declared: the selected NAP revision, the installed package, or both. */
  readonly sources: readonly ('spec' | 'package')[];
  readonly coverage: OperationCoverage;
  /** Worst status of the cases that exercised it; `skip` when none ran in this variant. */
  readonly status: CheckStatus;
  /** Ids of the cases that exercised it. */
  readonly cases: readonly string[];
  /** For `spec-gap` rows: the missing decision and where it is tracked. */
  readonly note?: string;
}

/** Per-domain summary for one variant. */
export interface DomainCoverage {
  readonly domain: string;
  /** The runtime advertised the domain in this variant. */
  readonly advertised: boolean;
  /** At least one runnable case executed against it. */
  readonly tested: boolean;
  /** `nap-spec` when a pinned NAP revision supplied semantics; otherwise `wire-contract`. */
  readonly authorityClass: 'nap-spec' | 'wire-contract';
  /** Id of the owning {@link AuthorityRef}, when one is selected. */
  readonly authority?: string;
  readonly operations: readonly OperationResult[];
  /** Package-versus-spec and catalog-versus-package differences. Never empty silently. */
  readonly drift: readonly string[];
}

/** Counts derived from results, never asserted separately. */
export interface RunSummary {
  readonly total: number;
  readonly pass: number;
  readonly fail: number;
  readonly skip: number;
  readonly specGap: number;
  /** Failures at `error` severity. `ok` is exactly `errorFailures === 0`. */
  readonly errorFailures: number;
  /** Operations whose only proof is the packaged wire contract. */
  readonly wireOnlyOperations: number;
  /** Operations exercised against a named NAP revision. */
  readonly specOperations: number;
  /** Operations recorded as a semantic spec gap. */
  readonly gapOperations: number;
}

/** Everything observed and evaluated for one profile variant. */
export interface VariantResult {
  /** `<profile>/<shell-mode>`. */
  readonly id: string;
  readonly profile: ConformanceProfile;
  readonly shell: ShellMode;
  /** Domains the runtime says it can expose in this variant. */
  readonly advertisedDomains: readonly string[];
  /** Named services reported by the runtime's environment. */
  readonly advertisedServices: readonly string[];
  readonly coverage: readonly DomainCoverage[];
}

/**
 * A complete, serializable conformance run.
 *
 * @example
 * ```ts
 * const run: ConformanceRun = await runConformance(target, { profile: 'full' });
 * if (!run.ok) process.exitCode = 1;
 * ```
 */
export interface ConformanceRun {
  /** Result schema version. */
  readonly schema: 1;
  readonly engine: { readonly name: string; readonly version: string };
  readonly target: { readonly name: string; readonly packages: Readonly<Record<string, string>> };
  /** Every pinned source the catalog used, keyed by id. */
  readonly authority: Readonly<Record<string, AuthorityRef>>;
  readonly profile: ConformanceProfile;
  /** Domain filter that was applied; empty means every domain. */
  readonly domains: readonly string[];
  readonly startedAt: string;
  readonly durationMs: number;
  readonly variants: readonly VariantResult[];
  readonly checks: readonly CheckResult[];
  readonly transcript: readonly TranscriptEntry[];
  readonly summary: RunSummary;
  /** `true` exactly when no `error`-severity check failed. */
  readonly ok: boolean;
  /** Final human sentence stating the tested scope and counts. */
  readonly statement: string;
}

/**
 * Options for one run.
 *
 * @example
 * ```ts
 * const options: RunOptions = { profile: 'minimal', domains: ['theme'], settleMs: 50 };
 * ```
 */
export interface RunOptions {
  /** Profile to run. Default `full`. */
  readonly profile?: ConformanceProfile;
  /** Restrict domain cases to these domains. NIP-5D core and NAP-SHELL checks always run. */
  readonly domains?: readonly string[];
  /** Longest a probe step waits for a reply. Default 2000. */
  readonly readyTimeoutMs?: number;
  /** Quiet period used to prove that nothing was sent. Default 120. */
  readonly settleMs?: number;
  /** Called after every evaluated check, for live progress. */
  readonly onCheck?: (result: CheckResult) => void;
}

/** Build a passing outcome. */
export function pass(detail: string, diagnostics?: unknown): CheckOutcome {
  return diagnostics === undefined ? { status: 'pass', detail } : { status: 'pass', detail, diagnostics };
}

/** Build a failing outcome. */
export function fail(detail: string, diagnostics?: unknown): CheckOutcome {
  return diagnostics === undefined ? { status: 'fail', detail } : { status: 'fail', detail, diagnostics };
}

/** Build a skipped outcome. A skip means the check does not apply here, never that it failed quietly. */
export function skip(detail: string): CheckOutcome {
  return { status: 'skip', detail };
}

/** Build a spec-gap outcome. `detail` names the missing decision and the bounded policy applied. */
export function specGap(detail: string, diagnostics?: unknown): CheckOutcome {
  return diagnostics === undefined ? { status: 'spec-gap', detail } : { status: 'spec-gap', detail, diagnostics };
}
