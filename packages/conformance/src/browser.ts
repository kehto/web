/**
 * browser.ts — Self-contained browser entry.
 *
 * Bundled with every dependency inlined into `dist/browser/conformance.js`, so
 * a plain HTML page (the CLI harness, the web UI) can import it directly.
 *
 * @module
 */
import { runConformance } from './engine.js';
import { createKehtoTarget, type KehtoTargetOptions } from './kehto-target.js';
import type { ConformanceRun, RunOptions } from './model.js';
import { createMutation } from './mutations.js';

export { runConformance, conformanceStatement, ConformanceHarnessError } from './engine.js';
export { createKehtoTarget } from './kehto-target.js';
export { AUTHORITY, authorityUrl } from './authority.js';
export { MUTATIONS } from './mutations.js';

/**
 * Run the catalog against the first-party target in this page.
 *
 * @param options - Profile, domain filter and timeouts.
 * @param target - First-party target options.
 * @returns The serializable run.
 * @example
 * ```ts
 * const run = await runKehtoConformance({ profile: 'minimal' });
 * ```
 */
export function runKehtoConformance(options: RunOptions = {}, target: KehtoTargetOptions = {}): Promise<ConformanceRun> {
  return runConformance(createKehtoTarget(target), options);
}

/** A mutated run and the evidence that the mutation took effect. */
export interface MutationRun {
  readonly run: ConformanceRun;
  /** Checks the mutation must fail. */
  readonly expect: readonly string[];
  /** Places the mutation changed something; `0` means it never applied. */
  readonly applied: number;
}

/**
 * Run the catalog against the first-party target with one named mutation.
 *
 * @param name - Mutation name from `MUTATIONS`.
 * @param options - Profile, domain filter and timeouts.
 * @returns The run, the checks it must fail and how often the mutation applied.
 * @example
 * ```ts
 * const { run, expect } = await runKehtoMutation('inject-window-nostr', { profile: 'minimal' });
 * ```
 */
export async function runKehtoMutation(name: string, options: RunOptions = {}): Promise<MutationRun> {
  const { spec, tamper, applied } = createMutation(name);
  const run = await runConformance(createKehtoTarget({ tamper }), options);
  return { run, expect: spec.expect, applied: applied.count };
}
