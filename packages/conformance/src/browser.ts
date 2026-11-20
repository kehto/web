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

export { runConformance, conformanceStatement, ConformanceHarnessError } from './engine.js';
export { createKehtoTarget } from './kehto-target.js';
export { AUTHORITY, authorityUrl } from './authority.js';

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
