import { authorityUrl } from '../authority.js';
import type { CheckResult, ConformanceRun } from '../model.js';

function xml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function testcase(check: CheckResult): string {
  const open = `    <testcase classname="${xml(`${check.variant}.${check.scope}`)}" name="${xml(check.id)}">`;
  const refs = check.authority.join(' ');
  if (check.status === 'pass') return `${open}</testcase>`;
  if (check.status === 'fail') {
    const tag = check.severity === 'error' ? 'failure' : 'system-err';
    const body = xml(JSON.stringify(check.diagnostics ?? null, null, 2));
    return tag === 'failure'
      ? `${open}\n      <failure message="${xml(check.detail)}" type="${xml(check.scope)}">${body}</failure>\n    </testcase>`
      : `${open}\n      <system-err>warning: ${xml(check.detail)}\n${body}</system-err>\n    </testcase>`;
  }
  const label = check.status === 'spec-gap' ? `spec-gap (${refs}): ` : '';
  return `${open}\n      <skipped message="${xml(label + check.detail)}"/>\n    </testcase>`;
}

/**
 * Render a run as JUnit XML. Each variant is one `<testsuite>`; `spec-gap`
 * results are `<skipped>` with a `spec-gap` message prefix and are counted
 * separately in the `spec-gap` property, so a gap never reads as a pass.
 * Warning-severity failures are reported as `<system-err>`, matching `ok`.
 *
 * @param run - A finished run.
 * @returns JUnit XML ending with a newline.
 * @example
 * ```ts
 * writeFileSync('conformance.xml', formatJunit(run));
 * ```
 */
export function formatJunit(run: ConformanceRun): string {
  const { summary } = run;
  const suites = run.variants.map((variant) => {
    const checks = run.checks.filter((check) => check.variant === variant.id);
    const failures = checks.filter((check) => check.status === 'fail' && check.severity === 'error').length;
    const skipped = checks.filter((check) => check.status === 'skip' || check.status === 'spec-gap').length;
    return [
      `  <testsuite name="${xml(`kehto-conformance.${variant.id}`)}" tests="${checks.length}" failures="${failures}" errors="0" skipped="${skipped}">`,
      '    <properties>',
      `      <property name="advertised-domains" value="${xml(variant.advertisedDomains.join(' '))}"/>`,
      `      <property name="spec-gap" value="${checks.filter((check) => check.status === 'spec-gap').length}"/>`,
      '    </properties>',
      ...checks.map(testcase),
      '  </testsuite>',
    ].join('\n');
  });
  const authority = Object.values(run.authority)
    .map((ref) => `    <property name="authority.${xml(ref.id)}" value="${xml(`${ref.status} ${authorityUrl(ref)}`)}"/>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="kehto-conformance" tests="${summary.total}" failures="${summary.errorFailures}" errors="0" skipped="${summary.skip + summary.specGap}">`,
    '  <properties>',
    `    <property name="engine" value="${xml(`${run.engine.name}@${run.engine.version}`)}"/>`,
    `    <property name="profile" value="${run.profile}"/>`,
    `    <property name="spec-gap" value="${summary.specGap}"/>`,
    `    <property name="statement" value="${xml(run.statement)}"/>`,
    ...authority,
    '  </properties>',
    ...suites,
    '</testsuites>',
    '',
  ].join('\n');
}
