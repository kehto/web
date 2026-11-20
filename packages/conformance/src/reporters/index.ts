/**
 * reporters/index.ts — Render a finished run. Every reporter reads the same
 * counts from `run.summary`; none re-derives a verdict.
 */
import type { ConformanceRun } from '../model.js';
import { formatJson } from './json.js';
import { formatJunit } from './junit.js';
import { formatPretty } from './pretty.js';

export { formatJson } from './json.js';
export { formatJunit } from './junit.js';
export { formatPretty } from './pretty.js';

/** Names accepted by `--reporter`. */
export type ReporterName = 'pretty' | 'json' | 'junit';

/** Every reporter, keyed by name. */
export const REPORTERS: Readonly<Record<ReporterName, (run: ConformanceRun) => string>> = Object.freeze({
  pretty: formatPretty,
  json: formatJson,
  junit: formatJunit,
});

/**
 * Render a run with a named reporter.
 *
 * @param run - A finished run.
 * @param reporter - `pretty`, `json` or `junit`.
 * @returns The rendered report, ending with a newline.
 * @example
 * ```ts
 * process.stdout.write(formatReport(run, 'junit'));
 * ```
 */
export function formatReport(run: ConformanceRun, reporter: ReporterName = 'pretty'): string {
  return REPORTERS[reporter](run);
}
