/**
 * scenario.ts — The split between collecting facts and judging them.
 *
 * A scenario's `collect` is asynchronous and side-effectful: it loads probes
 * and drives the target. Its checks are synchronous and pure: each one reads
 * the captured facts and returns an outcome.
 */
import type { CheckDefinition, CheckOutcome, DomainCoverage, ShellMode } from './model.js';
import type { ProbePlan, ProbeReport, StepRecord } from './probe/plan.js';
import type { ConformanceTarget, ProbeEndpoint, ProbeSpec, TargetSession, TargetVariant } from './target.js';

/** A request every advertised anchor domain answers; used wherever "another granted domain works" must be proved. */
export interface AnchorDomain {
  readonly domain: string;
  /** Build a request envelope with the given correlation id. */
  request(id: string): Record<string, unknown>;
  readonly resultType: string;
}

/** What `collect` receives. */
export interface CollectContext {
  readonly target: ConformanceTarget;
  readonly session: TargetSession;
  readonly variant: TargetVariant;
  readonly variantId: string;
  readonly advertised: { readonly domains: readonly string[]; readonly services: readonly string[] };
  /** A working non-shell domain in this variant, or `null` when none is advertised. */
  readonly anchor: AnchorDomain | null;
  /** Domain filter; empty means every domain. */
  readonly domains: readonly string[];
  readonly timeoutMs: number;
  readonly settleMs: number;
}

/** One check over a scenario's facts. */
export interface Check<F> extends CheckDefinition {
  evaluate(facts: F): CheckOutcome;
}

/** A group of checks that share one collection pass. */
export interface Scenario<F = unknown> {
  readonly id: string;
  /** Shell modes the scenario applies to. Default: both. */
  readonly shell?: readonly ShellMode[];
  collect(context: CollectContext): Promise<F>;
  readonly checks: readonly Check<F>[];
  /** Per-domain coverage derived from the facts. */
  coverage?(facts: F, context: CollectContext): readonly DomainCoverage[];
}

/** Keep a scenario's fact type while storing it in a heterogeneous list. */
export function defineScenario<F>(scenario: Scenario<F>): Scenario {
  return scenario as unknown as Scenario;
}

const ANCHORS: readonly AnchorDomain[] = [
  { domain: 'storage', request: (id) => ({ type: 'storage.get', id, key: 'conformance-anchor' }), resultType: 'storage.get.result' },
  { domain: 'theme', request: (id) => ({ type: 'theme.get', id }), resultType: 'theme.get.result' },
  { domain: 'identity', request: (id) => ({ type: 'identity.getPublicKey', id }), resultType: 'identity.getPublicKey.result' },
];

/** Pick the anchor domain for a set of advertised domains. */
export function pickAnchor(domains: readonly string[]): AnchorDomain | null {
  return ANCHORS.find((anchor) => domains.includes(anchor.domain)) ?? null;
}

/** Steps that send the anchor request and wait for its correlated reply. */
export function anchorSteps(anchor: AnchorDomain, id: string, as: string): ProbePlan['steps'] {
  return [
    { op: 'send', envelope: anchor.request(id) },
    { op: 'expect', as, match: { type: anchor.resultType, id } },
  ];
}

/** A loaded probe together with its final report. */
export interface ProbeRun {
  readonly endpoint: ProbeEndpoint;
  readonly report: ProbeReport | null;
}

/** Load a probe and wait for its report. Optional domains default to the explicit grants. */
export async function runProbe(context: CollectContext, spec: ProbeSpec): Promise<ProbeRun> {
  const granted = spec.grants === 'all' ? context.advertised.domains : spec.grants;
  const declared = new Set(spec.requires ?? []);
  const plan = { timeoutMs: context.timeoutMs, settleMs: context.settleMs, ...spec.plan };
  const endpoint = await context.session.loadProbe({
    optional: granted.filter((domain) => !declared.has(domain)),
    ...spec,
    plan,
  });
  if (endpoint.rejection) return { endpoint, report: null };
  const budget = context.timeoutMs * (2 + plan.steps.length) + 2000;
  return { endpoint, report: await endpoint.report(budget) };
}

/** Find the record a step left under `as`. */
export function step(report: ProbeReport | null, as: string): StepRecord | undefined {
  return report?.steps.find((record) => record.as === as);
}

/** The value a step recorded, or `undefined`. */
export function value<T = unknown>(report: ProbeReport | null, as: string): T | undefined {
  return step(report, as)?.value as T | undefined;
}

/** Sorted copy, for order-insensitive comparison. */
export function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

/** Whether two string lists hold the same members. */
export function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(sorted([...new Set(left)])) === JSON.stringify(sorted([...new Set(right)]));
}
