/**
 * engine.ts — Run scenarios against a target and assemble the result model.
 */
import { AUTHORITY } from './authority.js';
import type {
  CheckResult, ConformanceRun, DomainCoverage, RunOptions, RunSummary, ShellMode, TranscriptEntry, VariantResult,
} from './model.js';
import { fail, skip } from './model.js';
import { pickAnchor, type CollectContext, type Scenario } from './scenario.js';
import { SCENARIOS } from './scenarios/index.js';
import type { ConformanceTarget, TargetSession } from './target.js';
import { ENGINE_VERSION } from './version.js';

const SHELL_MODES: readonly ShellMode[] = ['shell-present', 'shell-absent'];

/** Thrown when a target cannot boot or the harness itself breaks. Maps to CLI exit code 2. */
export class ConformanceHarnessError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ConformanceHarnessError';
  }
}

async function runScenario(scenario: Scenario, context: CollectContext, onCheck: RunOptions['onCheck']): Promise<{ checks: CheckResult[]; coverage: readonly DomainCoverage[] }> {
  const applies = !scenario.shell || scenario.shell.includes(context.variant.shell);
  let facts: unknown;
  let collectionError: string | null = null;
  if (applies) {
    try { facts = await scenario.collect(context); }
    catch (error) { collectionError = error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
  }
  const checks = scenario.checks.map((check): CheckResult => {
    const { evaluate, ...definition } = check;
    let outcome;
    if (!applies) outcome = skip(`Applies to ${scenario.shell?.join(', ')} variants only`);
    else if (collectionError) outcome = fail(`Collecting evidence threw: ${collectionError}`);
    else {
      try { outcome = evaluate(facts); }
      catch (error) { outcome = fail(`Evaluating the check threw: ${error instanceof Error ? error.message : String(error)}`); }
    }
    const result: CheckResult = { ...definition, ...outcome, variant: context.variantId };
    onCheck?.(result);
    return result;
  });
  const coverage = applies && !collectionError && scenario.coverage ? scenario.coverage(facts, context) : [];
  return { checks, coverage };
}

function summarize(checks: readonly CheckResult[], variants: readonly VariantResult[]): RunSummary {
  const count = (status: CheckResult['status']): number => checks.filter((check) => check.status === status).length;
  // An operation is counted once per run, at its best coverage across variants.
  const best = new Map<string, string>();
  const rank = ['uncovered', 'spec-gap', 'wire-contract', 'nap-spec'];
  for (const variant of variants) {
    for (const domain of variant.coverage) {
      for (const operation of domain.operations) {
        const key = `${domain.domain}:${operation.type}`;
        const current = best.get(key);
        if (!current || rank.indexOf(operation.coverage) > rank.indexOf(current)) best.set(key, operation.coverage);
      }
    }
  }
  const operations = [...best.values()];
  return {
    total: checks.length,
    pass: count('pass'),
    fail: count('fail'),
    skip: count('skip'),
    specGap: count('spec-gap'),
    errorFailures: checks.filter((check) => check.status === 'fail' && check.severity === 'error').length,
    wireOnlyOperations: operations.filter((coverage) => coverage === 'wire-contract').length,
    specOperations: operations.filter((coverage) => coverage === 'nap-spec').length,
    gapOperations: operations.filter((coverage) => coverage === 'spec-gap').length,
  };
}

/**
 * The final sentence of every report. It states the tested scope and the
 * counts, and never claims more than the results show.
 *
 * @param summary - Counts derived from the results.
 * @returns One sentence.
 * @example
 * ```ts
 * conformanceStatement(run.summary);
 * ```
 */
export function conformanceStatement(summary: RunSummary): string {
  const scope = `${summary.specOperations} operations exercised against a pinned NAP revision; `
    + `${summary.wireOnlyOperations} operations have wire-contract coverage only; `
    + `${summary.gapOperations + summary.specGap > 0 ? `${summary.specGap} semantic spec-gap results (${summary.gapOperations} operations) remain` : 'no semantic spec gaps recorded'}`;
  if (summary.errorFailures > 0) {
    return `NOT conformant: ${summary.errorFailures} error-severity checks failed (${summary.fail} failed, ${summary.pass} passed, ${summary.skip} skipped). ${scope}.`;
  }
  return `NIP-5D core and selected NAP checks passed (${summary.pass} passed, ${summary.fail} warning-severity failures, ${summary.skip} skipped); ${scope}. This is not a claim of full NAP conformance.`;
}

async function runVariant(
  target: ConformanceTarget, session: TargetSession, options: RunOptions, scenarios: readonly Scenario[],
): Promise<{ variant: VariantResult; checks: CheckResult[]; transcript: readonly TranscriptEntry[] }> {
  const { variant } = session;
  const advertised = session.advertised();
  const context: CollectContext = {
    target, session, variant,
    variantId: `${variant.profile}/${variant.shell}`,
    advertised,
    anchor: pickAnchor(advertised.domains),
    domains: options.domains ?? [],
    timeoutMs: options.readyTimeoutMs ?? 2000,
    settleMs: options.settleMs ?? 120,
  };
  const checks: CheckResult[] = [];
  const coverage: DomainCoverage[] = [];
  for (const scenario of scenarios) {
    const result = await runScenario(scenario, context, options.onCheck);
    checks.push(...result.checks);
    coverage.push(...result.coverage);
  }
  return {
    variant: {
      id: context.variantId, profile: variant.profile, shell: variant.shell,
      advertisedDomains: [...advertised.domains], advertisedServices: [...advertised.services], coverage,
    },
    checks,
    transcript: session.transcript(),
  };
}

/**
 * Run the catalog against a target: both shell variants of one profile.
 *
 * @param target - The runtime under test.
 * @param options - Profile, domain filter and timeouts.
 * @param scenarios - The catalog to run. Default: every built-in scenario.
 * @returns A serializable run.
 * @throws {ConformanceHarnessError} When the target cannot boot.
 * @example
 * ```ts
 * const run = await runConformance(createKehtoTarget(), { profile: 'minimal' });
 * console.log(run.statement);
 * ```
 */
export async function runConformance(
  target: ConformanceTarget, options: RunOptions = {}, scenarios: readonly Scenario[] = SCENARIOS,
): Promise<ConformanceRun> {
  const profile = options.profile ?? 'full';
  const started = Date.now();
  const variants: VariantResult[] = [];
  const checks: CheckResult[] = [];
  const transcript: TranscriptEntry[] = [];
  for (const shell of SHELL_MODES) {
    let session: TargetSession;
    try { session = await target.boot({ profile, shell }); }
    catch (error) { throw new ConformanceHarnessError(`Target failed to boot ${profile}/${shell}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
    try {
      const result = await runVariant(target, session, options, scenarios);
      variants.push(result.variant);
      checks.push(...result.checks);
      const offset = transcript.length;
      transcript.push(...result.transcript.map((entry, index) => ({ ...entry, seq: offset + index + 1 })));
    } finally {
      await session.dispose();
    }
  }
  const summary = summarize(checks, variants);
  return {
    schema: 1,
    engine: { name: '@kehto/conformance', version: ENGINE_VERSION },
    target: { name: target.name, packages: target.packages },
    authority: AUTHORITY,
    profile,
    domains: [...(options.domains ?? [])],
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    variants,
    checks,
    transcript,
    summary,
    ok: summary.errorFailures === 0,
    statement: conformanceStatement(summary),
  };
}
