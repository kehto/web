import type { ConformanceRun } from '../model.js';

/**
 * Render a run as indented JSON: the complete result model, transcript included.
 *
 * @param run - A finished run.
 * @returns JSON text ending with a newline.
 * @example
 * ```ts
 * const run = JSON.parse(formatJson(result)) as ConformanceRun;
 * ```
 */
export function formatJson(run: ConformanceRun): string {
  return `${JSON.stringify(run, null, 2)}\n`;
}
