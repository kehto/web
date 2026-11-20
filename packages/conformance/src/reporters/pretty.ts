import { authorityUrl } from '../authority.js';
import type { CheckResult, ConformanceRun } from '../model.js';

const MARK: Readonly<Record<CheckResult['status'], string>> = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP', 'spec-gap': 'GAP ' };

function line(check: CheckResult): string {
  const severity = check.status === 'fail' && check.severity === 'warning' ? ' (warning)' : '';
  return `  ${MARK[check.status]} ${check.id} [${check.scope}]${severity} ${check.detail}`;
}

/**
 * Render a run for a terminal: one block per variant, failures and gaps with
 * their authority, then the counts and the scope statement as the last line.
 *
 * @param run - A finished run.
 * @returns Plain text ending with a newline.
 * @example
 * ```ts
 * process.stdout.write(formatPretty(run));
 * ```
 */
export function formatPretty(run: ConformanceRun): string {
  const out: string[] = [
    `${run.engine.name}@${run.engine.version} against ${run.target.name} (profile ${run.profile}${run.domains.length ? `, domains ${run.domains.join(', ')}` : ''})`,
  ];
  for (const variant of run.variants) {
    out.push('', `${variant.id}: advertised ${variant.advertisedDomains.join(', ') || '(none)'}`);
    for (const check of run.checks.filter((item) => item.variant === variant.id)) out.push(line(check));
  }
  const cited = new Set(run.checks.filter((check) => check.status === 'fail' || check.status === 'spec-gap').flatMap((check) => check.authority));
  if (cited.size) {
    out.push('', 'Authority for failures and gaps:');
    for (const id of cited) {
      const ref = run.authority[id];
      if (ref) out.push(`  ${id}: ${ref.status} ${authorityUrl(ref)}`);
    }
  }
  const { summary } = run;
  out.push(
    '',
    `${summary.total} checks: ${summary.pass} pass, ${summary.fail} fail (${summary.errorFailures} error), ${summary.skip} skip, ${summary.specGap} spec-gap`,
    run.statement,
    '',
  );
  return out.join('\n');
}
