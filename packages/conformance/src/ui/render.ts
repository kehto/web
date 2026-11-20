/**
 * ui/render.ts — Pure HTML rendering of a run for the conformance web UI.
 *
 * Every function returns a string built from plain run data, so the UI and
 * its unit tests share one renderer and nothing here touches the DOM.
 */
import { authorityUrl } from '../authority.js';
import { SUPPORTED_DOMAINS } from '../catalog/domains.js';
import type { CheckResult, CheckScope, ConformanceRun, DomainCoverage, TranscriptEntry } from '../model.js';

/** Escape text for HTML content and attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Human labels for every scope, in display order. */
export const SCOPE_LABELS: Readonly<Record<CheckScope, string>> = {
  'nip5d-core': 'NIP-5D core',
  'nap-spec': 'NAP semantics',
  'wire-contract': 'Wire contract',
  'kehto-policy': 'Kehto policy',
  catalog: 'Catalog',
};

const STATUS_LABELS: Readonly<Record<CheckResult['status'], string>> = { pass: 'pass', fail: 'fail', skip: 'skip', 'spec-gap': 'spec gap' };

function badge(kind: string, text: string): string {
  return `<span class="badge badge-${escapeHtml(kind)}">${escapeHtml(text)}</span>`;
}

/**
 * The verdict banner: overall state, counts and the scope statement.
 *
 * @param run - A finished run.
 * @returns HTML.
 */
export function renderVerdict(run: ConformanceRun): string {
  const { summary } = run;
  const state = run.ok ? 'ok' : 'fail';
  const counts = [
    ['pass', summary.pass], ['fail', summary.fail], ['skip', summary.skip], ['spec-gap', summary.specGap],
  ].map(([kind, count]) => `<li class="count count-${kind}"><strong>${count}</strong> ${STATUS_LABELS[kind as CheckResult['status']]}</li>`).join('');
  return `<section class="verdict verdict-${state}" aria-live="polite">
<h2>${run.ok ? 'Applicable checks passed' : `${summary.errorFailures} error-severity checks failed`}</h2>
<ul class="counts">${counts}</ul>
<p class="statement">${escapeHtml(run.statement)}</p>
<p class="meta">${escapeHtml(`${run.engine.name}@${run.engine.version} · target ${run.target.name} · profile ${run.profile}${run.domains.length ? ` · domains ${run.domains.join(', ')}` : ''} · ${run.durationMs} ms`)}</p>
</section>`;
}

function coverageCell(coverage: DomainCoverage | undefined, advertised: boolean): string {
  if (!advertised) return '<td class="cell-off">not advertised</td>';
  if (!coverage) return '<td class="cell-untested">advertised, not tested</td>';
  const tally = (kind: string) => coverage.operations.filter((row) => row.coverage === kind).length;
  const parts = [['nap-spec', tally('nap-spec')], ['wire-contract', tally('wire-contract')], ['spec-gap', tally('spec-gap')], ['uncovered', tally('uncovered')]]
    .filter(([, count]) => Number(count) > 0)
    .map(([kind, count]) => badge(String(kind), `${count} ${kind}`));
  const failing = coverage.operations.filter((row) => row.status === 'fail').length;
  const drift = coverage.drift.length ? `<details><summary>${coverage.drift.length} drift</summary><ul>${coverage.drift.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul></details>` : '';
  return `<td class="${failing ? 'cell-fail' : 'cell-ok'}">${parts.join(' ')}${failing ? ` ${badge('fail', `${failing} failing`)}` : ''}${drift}</td>`;
}

/**
 * The advertised-versus-tested matrix: one row per supported (or advertised) domain, one column per variant.
 *
 * @param run - A finished run.
 * @returns HTML.
 */
export function renderDomainMatrix(run: ConformanceRun): string {
  const domains = [...new Set([...SUPPORTED_DOMAINS, ...run.variants.flatMap((variant) => variant.advertisedDomains)])];
  const head = run.variants.map((variant) => `<th scope="col">${escapeHtml(variant.id)}</th>`).join('');
  const rows = domains.map((domain) => {
    const cells = run.variants.map((variant) => coverageCell(variant.coverage.find((row) => row.domain === domain), variant.advertisedDomains.includes(domain))).join('');
    const authority = run.authority[`nap-${domain}`];
    const ref = authority ? `<a href="${escapeHtml(authorityUrl(authority))}" target="_blank" rel="noreferrer">${escapeHtml(authority.status)}</a>` : '';
    return `<tr><th scope="row"><code>${escapeHtml(domain)}</code> ${ref}</th>${cells}</tr>`;
  }).join('');
  return `<section class="matrix"><h2>Domains: advertised vs tested</h2><div class="scroll"><table><thead><tr><th scope="col">Domain</th>${head}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function checkRow(check: CheckResult, run: ConformanceRun): string {
  const authority = check.authority.map((id) => {
    const ref = run.authority[id];
    return ref ? `<a href="${escapeHtml(authorityUrl(ref))}" target="_blank" rel="noreferrer">${escapeHtml(id)}</a>` : escapeHtml(id);
  }).join(', ');
  const diagnostics = check.diagnostics === undefined ? '' : `<pre>${escapeHtml(JSON.stringify(check.diagnostics, null, 2))}</pre>`;
  const severity = check.status === 'fail' && check.severity === 'warning' ? ` ${badge('warning', 'warning')}` : '';
  return `<details class="check check-${check.status}" data-check="${escapeHtml(check.id)}" data-variant="${escapeHtml(check.variant)}"${check.status === 'fail' ? ' open' : ''}>
<summary>${badge(check.status, STATUS_LABELS[check.status])} ${badge(check.scope, SCOPE_LABELS[check.scope])}${severity} <code>${escapeHtml(check.id)}</code> <span class="variant">${escapeHtml(check.variant)}</span> <span class="detail">${escapeHtml(check.detail)}</span></summary>
<p class="authority">Authority: ${authority || 'none'} · ${escapeHtml(check.title)}</p>${diagnostics}
</details>`;
}

/**
 * Checks grouped by scope, failures first within each group.
 *
 * @param run - A finished run.
 * @returns HTML.
 */
export function renderChecks(run: ConformanceRun): string {
  const order: Readonly<Record<CheckResult['status'], number>> = { fail: 0, 'spec-gap': 1, pass: 2, skip: 3 };
  const groups = (Object.keys(SCOPE_LABELS) as CheckScope[]).map((scope) => {
    const checks = run.checks.filter((check) => check.scope === scope).sort((left, right) => order[left.status] - order[right.status]);
    if (!checks.length) return '';
    const failing = checks.filter((check) => check.status === 'fail').length;
    return `<section class="group group-${scope}"><h3>${badge(scope, SCOPE_LABELS[scope])} ${checks.length} results${failing ? ` · ${failing} failing` : ''}</h3>${checks.map((check) => checkRow(check, run)).join('')}</section>`;
  }).join('');
  return `<section class="checks"><h2>Checks</h2>${groups}</section>`;
}

function transcriptRow(entry: TranscriptEntry): string {
  const arrow = entry.direction === 'napplet->runtime' ? '→' : '←';
  return `<tr class="tap-${entry.tap}"><td>${entry.seq}</td><td>${entry.at}</td><td>${escapeHtml(entry.variant)}</td><td>${escapeHtml(entry.endpoint)}</td><td>${escapeHtml(entry.tap)} ${arrow}</td><td><code>${escapeHtml(JSON.stringify(entry.envelope))}</code></td></tr>`;
}

/**
 * The captured wire transcript, newest last, capped for the page.
 *
 * @param run - A finished run.
 * @param limit - Most entries to render. Default 2000.
 * @returns HTML.
 */
export function renderTranscript(run: ConformanceRun, limit = 2000): string {
  const entries = run.transcript.slice(0, limit);
  const more = run.transcript.length > limit ? `<p>${run.transcript.length - limit} more entries are in the JSON report.</p>` : '';
  return `<section class="transcript"><details><summary><h2>Wire transcript (${run.transcript.length})</h2></summary><div class="scroll"><table><thead><tr><th>#</th><th>ms</th><th>variant</th><th>endpoint</th><th>tap</th><th>envelope</th></tr></thead><tbody>${entries.map(transcriptRow).join('')}</tbody></table></div>${more}</details></section>`;
}

/**
 * Every pinned source the catalog used.
 *
 * @param run - A finished run.
 * @returns HTML.
 */
export function renderAuthority(run: ConformanceRun): string {
  const rows = Object.values(run.authority).map((ref) => `<li><a href="${escapeHtml(authorityUrl(ref))}" target="_blank" rel="noreferrer">${escapeHtml(ref.title)}</a> ${badge(ref.status, ref.status)} <code>${escapeHtml(ref.ref.slice(0, 12))}</code>${ref.pr ? ` · PR #${ref.pr}` : ''}</li>`).join('');
  return `<section class="authority-list"><details><summary><h2>Authority</h2></summary><ul>${rows}</ul></details></section>`;
}

/**
 * The full report body.
 *
 * @param run - A finished run.
 * @returns HTML.
 * @example
 * ```ts
 * element.innerHTML = renderRun(run);
 * ```
 */
export function renderRun(run: ConformanceRun): string {
  return [renderVerdict(run), renderDomainMatrix(run), renderChecks(run), renderAuthority(run), renderTranscript(run)].join('\n');
}
