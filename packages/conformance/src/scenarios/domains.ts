/**
 * scenarios/domains.ts — The generic per-domain scenario.
 *
 * For every advertised domain with a fixture, one probe is granted that domain
 * and runs every request case and push case over the raw port. Checks judge
 * correlation, semantics and push delivery per domain, and two catalog checks
 * judge whether the advertised catalog is truthful and fully covered against
 * the pinned operation inventory.
 */
import { inventoryDrift, missingPackageOperations, outboundOperations } from '../catalog/inventory.js';
import { SUPPORTED_DOMAINS } from '../catalog/domains.js';
import { fieldDriftReport } from '../catalog/field-drift.js';
import { FIXTURES } from '../fixtures/index.js';
import type { DomainFixture, OperationCase, PushCase } from '../fixtures/types.js';
import { fail, pass, skip, specGap, type CheckOutcome, type DomainCoverage, type OperationResult } from '../model.js';
import type { ProbeReport, ProbeStep } from '../probe/plan.js';
import { defineScenario, step, type Check, type CollectContext } from '../scenario.js';

type Envelope = Readonly<Record<string, unknown>>;

/** What one domain's probe produced. */
interface DomainRun {
  readonly domain: string;
  readonly fixture: DomainFixture;
  readonly report: ProbeReport | null;
  readonly rejected: string | null;
  /** Push cases whose host control the target does not implement. */
  readonly missingControls: readonly string[];
}

interface DomainFacts {
  /** Missing host controls fail the full profile; the minimal profile has no backends to trigger. */
  readonly profile: 'minimal' | 'full';
  readonly advertised: readonly string[];
  readonly selected: readonly string[];
  readonly runs: Readonly<Record<string, DomainRun>>;
}

const replyType = (item: OperationCase): string | null => (item.reply === undefined ? `${item.type}.result` : item.reply);

function envelopeOf(item: OperationCase): Envelope {
  return { type: item.type, ...(item.noId ? {} : { id: item.id }), ...item.payload };
}

function requestSteps(item: OperationCase, settleMs: number): ProbeStep[] {
  const fill = item.fill ? Object.fromEntries(Object.entries(item.fill).map(([field, source]) => [field, { as: `c:${source.case}`, path: source.path }])) : undefined;
  const send: ProbeStep = { op: 'send', envelope: envelopeOf(item), ...(fill ? { fill } : {}) };
  if (replyType(item) === null || item.noId) return [send, { op: 'quiet', as: `q:${item.id}`, ms: settleMs }];
  return [send, { op: 'expect', as: `c:${item.id}`, match: { id: item.id } }];
}

function pushSteps(push: PushCase, settleMs: number): ProbeStep[] {
  const gate = (name: string): ProbeStep[] => (push.trigger ? [{ op: 'mark', name }, { op: 'waitSignal', name }] : []);
  return [
    ...(push.subscribe ? requestSteps(push.subscribe, settleMs) : []),
    ...gate(`push:${push.id}`),
    // Match the push's fields while waiting, so an earlier push of the same type cannot stand in for it.
    { op: 'expect', as: `p:${push.id}`, match: { ...push.match, type: push.type }, ...(push.trigger ? { since: `push:${push.id}` } : {}) },
    ...(push.then ?? []).flatMap((item) => requestSteps(item, settleMs)),
    ...(push.unsubscribe ? [
      ...requestSteps(push.unsubscribe, settleMs),
      ...gate(`off:${push.id}`),
      { op: 'quiet', as: `poff:${push.id}`, ms: settleMs * 2, ...(push.trigger ? { since: `off:${push.id}` } : {}) } as ProbeStep,
    ] : []),
  ];
}

async function drivePushes(context: CollectContext, endpoint: Awaited<ReturnType<CollectContext['session']['loadProbe']>>, pushes: readonly PushCase[]): Promise<void> {
  for (const push of pushes) {
    if (!push.trigger) continue;
    if (!await endpoint.waitMark(`push:${push.id}`, context.timeoutMs * 4)) return;
    await context.session.control(push.trigger.control, push.trigger.payload);
    endpoint.signal(`push:${push.id}`);
    if (!push.unsubscribe) continue;
    if (!await endpoint.waitMark(`off:${push.id}`, context.timeoutMs * 4)) return;
    await context.session.control(push.trigger.control, push.trigger.payload);
    endpoint.signal(`off:${push.id}`);
  }
}

async function runDomain(context: CollectContext, fixture: DomainFixture): Promise<DomainRun> {
  const pushes = fixture.pushes ?? [];
  const controlled = (push: PushCase): boolean => !push.trigger || context.session.controls.includes(push.trigger.control);
  const missingControls = pushes.filter((push) => !controlled(push)).map((push) => push.trigger?.control as string);
  const runnable = pushes.filter(controlled);
  const steps = [
    ...fixture.cases.flatMap((item) => requestSteps(item, context.settleMs)),
    ...runnable.flatMap((push) => pushSteps(push, context.settleMs)),
  ];
  const grants = [fixture.domain, ...(fixture.alsoGrant ?? [])].filter((domain) => context.advertised.domains.includes(domain));
  const endpoint = await context.session.loadProbe({
    plan: { label: `domain-${fixture.domain}`, steps, timeoutMs: context.timeoutMs, settleMs: context.settleMs },
    dTag: `probe-domain-${fixture.domain}`, grants, optional: grants, rawWire: true,
  });
  if (endpoint.rejection) return { domain: fixture.domain, fixture, report: null, rejected: endpoint.rejection.reason, missingControls };
  const [report] = await Promise.all([
    endpoint.report(context.timeoutMs * (steps.length + 4) + 4000),
    drivePushes(context, endpoint, runnable),
  ]);
  await context.session.destroyEndpoint(endpoint.id);
  return { domain: fixture.domain, fixture, report, rejected: null, missingControls };
}

async function collect(context: CollectContext): Promise<DomainFacts> {
  const advertised = context.advertised.domains.filter((domain) => domain !== 'shell');
  const selected = context.domains.length ? advertised.filter((domain) => context.domains.includes(domain)) : advertised;
  const runs: Record<string, DomainRun> = {};
  for (const domain of selected) {
    const fixture = FIXTURES[domain];
    if (fixture) runs[domain] = await runDomain(context, fixture);
  }
  return { profile: context.variant.profile, advertised, selected, runs };
}

/** Judge one request case. `null` means it passed. */
function judgeCase(run: DomainRun, item: OperationCase): string | null {
  const expected = replyType(item);
  if (expected === null || item.noId) {
    const quiet = (step(run.report, `q:${item.id}`)?.value as Envelope[] | undefined) ?? [];
    const correlated = quiet.filter((message) => message && typeof message === 'object' && String(message.type ?? '').startsWith(`${item.type}.`));
    return correlated.length ? `${item.type} is fire-and-forget but got ${String(correlated[0]?.type)}` : null;
  }
  const record = step(run.report, `c:${item.id}`);
  const reply = (record?.state === 'value' ? record.value : null) as Envelope | null;
  if (!reply) return `${item.type} got no reply with id ${item.id}`;
  if (reply.type !== expected) return `${item.type} was answered with ${String(reply.type)}, expected ${expected}`;
  if (reply.error !== undefined && !item.allowError) return `${item.type} was answered with error ${JSON.stringify(reply.error)}`;
  return null;
}

function replyOf(run: DomainRun, item: OperationCase): Envelope | null {
  const record = step(run.report, `c:${item.id}`);
  return (record?.state === 'value' ? record.value : null) as Envelope | null;
}

function judgePush(run: DomainRun, push: PushCase): string | null {
  if (push.trigger && run.missingControls.includes(push.trigger.control)) return `the target has no host control ${push.trigger.control}`;
  for (const item of [push.subscribe, push.unsubscribe, ...(push.then ?? [])]) {
    const problem = item ? judgeCase(run, item) : null;
    if (problem) return problem;
  }
  const record = step(run.report, `p:${push.id}`);
  const delivered = (record?.state === 'value' ? record.value : null) as Envelope | null;
  if (!delivered) return `${push.type} was not delivered${push.trigger ? ` after ${push.trigger.control}` : ''}`;
  for (const [key, expected] of Object.entries(push.match ?? {})) {
    if (JSON.stringify(delivered[key]) !== JSON.stringify(expected)) return `${push.type}.${key} was ${JSON.stringify(delivered[key])}, expected ${JSON.stringify(expected)}`;
  }
  if (push.unsubscribe) {
    const after = (step(run.report, `poff:${push.id}`)?.value as Envelope[] | undefined) ?? [];
    if (after.some((message) => message?.type === push.type)) return `${push.type} was still delivered after ${push.unsubscribe.type}`;
  }
  return null;
}

function judgePushSemantics(run: DomainRun, push: PushCase): string | null {
  const record = step(run.report, `p:${push.id}`);
  const delivered = (record?.state === 'value' ? record.value : null) as Envelope | null;
  if (!delivered) return judgePush(run, push) ?? `${push.type} was not delivered`;
  const replies = Object.fromEntries((push.then ?? []).map((item) => [item.id, replyOf(run, item)]));
  return push.semantics!.verify(delivered, replies);
}

/** Push cases to judge: all of them in the full profile, only those with a host control in minimal. */
function runnablePushes(facts: DomainFacts, run: DomainRun): readonly PushCase[] {
  const pushes = run.fixture.pushes ?? [];
  return facts.profile === 'full' ? pushes : pushes.filter((push) => !push.trigger || !run.missingControls.includes(push.trigger.control));
}

function domainRun(facts: DomainFacts, domain: string): DomainRun | CheckOutcome {
  if (!facts.advertised.includes(domain)) return skip(`${domain} is not advertised in this variant`);
  if (!facts.selected.includes(domain)) return skip(`${domain} is outside the --domain filter`);
  const run = facts.runs[domain];
  if (!run) return skip(`${domain} has no fixture; catalog/advertised-domain-covered reports it`);
  if (run.rejected) return fail(`The ${domain} probe was refused: ${run.rejected}`);
  if (!run.report) return fail(`The ${domain} probe did not finish`);
  return run;
}

const isOutcome = (value: DomainRun | CheckOutcome): value is CheckOutcome => 'status' in value;

function correlation(domain: string) {
  return (facts: DomainFacts): CheckOutcome => {
    const run = domainRun(facts, domain);
    if (isOutcome(run)) return run;
    const problems = run.fixture.cases.map((item) => ({ case: item.id, problem: judgeCase(run, item) })).filter((row) => row.problem);
    if (problems.length) return fail(`${problems.length} of ${run.fixture.cases.length} ${domain} requests were not answered canonically`, problems);
    return pass(`${run.fixture.cases.length} ${domain} requests got their canonical reply type with the same id`);
  };
}

function semantics(domain: string) {
  return (facts: DomainFacts): CheckOutcome => {
    const run = domainRun(facts, domain);
    if (isOutcome(run)) return run;
    const pushRequests = runnablePushes(facts, run).flatMap((push) => [push.subscribe, push.unsubscribe, ...(push.then ?? [])]);
    const cases = [...run.fixture.cases, ...pushRequests].filter((item): item is OperationCase => Boolean(item?.semantics));
    const pushCases = runnablePushes(facts, run).filter((push) => push.semantics);
    if (!cases.length && !pushCases.length) return skip(`No ${domain} case asserts NAP semantics beyond the wire contract`);
    const problems = [
      ...cases.map((item) => ({ case: item.id, rule: item.semantics!.rule, problem: judgeCase(run, item) ?? item.semantics!.verify(replyOf(run, item)) })),
      ...pushCases.map((push) => ({ case: push.id, rule: push.semantics!.rule, problem: judgePushSemantics(run, push) })),
    ].filter((row) => row.problem);
    const rules = [...cases.map((item) => item.semantics!.rule), ...pushCases.map((push) => push.semantics!.rule)];
    if (problems.length) return fail(`${problems.length} ${domain} semantic assertions failed`, problems);
    return pass(`${rules.length} ${domain} semantic assertions held`, rules);
  };
}

function pushes(domain: string) {
  return (facts: DomainFacts): CheckOutcome => {
    const run = domainRun(facts, domain);
    if (isOutcome(run)) return run;
    const list = runnablePushes(facts, run);
    if (!list.length) return skip(`${domain} has no host-triggered push runnable in this profile`);
    const problems = list.map((push) => ({ push: push.id, problem: judgePush(run, push) })).filter((row) => row.problem);
    if (problems.length) return fail(`${problems.length} ${domain} pushes misbehaved`, problems);
    return pass(`${list.length} ${domain} pushes were delivered and stopped as specified`);
  };
}

function operationRows(run: DomainRun | undefined, domain: string): OperationResult[] {
  return outboundOperations(domain).map((operation): OperationResult => {
    const cases = run ? [...run.fixture.cases, ...(run.fixture.pushes ?? []).flatMap((push) => [push.subscribe, push.unsubscribe])]
      .filter((item): item is OperationCase => item?.type === operation.type) : [];
    const gap = run?.fixture.gaps?.find((item) => item.type === operation.type);
    const base = { type: operation.type, direction: 'napplet->runtime' as const, sources: operation.sources, cases: cases.map((item) => item.id) };
    if (cases.length && run?.report) {
      const failed = cases.some((item) => judgeCase(run, item) !== null || (item.semantics && item.semantics.verify(replyOf(run, item)) !== null));
      const coverage = cases.some((item) => item.semantics) ? 'nap-spec' : 'wire-contract';
      return { ...base, coverage, status: failed ? 'fail' : 'pass' };
    }
    if (gap?.kind === 'spec-gap') return { ...base, coverage: 'spec-gap', status: 'spec-gap', note: `${gap.decision} Policy: ${gap.policy ?? 'none'}` };
    return { ...base, coverage: 'uncovered', status: 'skip', ...(gap ? { note: gap.decision } : {}) };
  });
}

function coverage(facts: DomainFacts): readonly DomainCoverage[] {
  return facts.selected.map((domain) => {
    const run = facts.runs[domain];
    const operations = operationRows(run, domain);
    const uncovered = operations.filter((row) => row.coverage === 'uncovered').map((row) => `${row.type} has no runnable case`);
    return {
      domain, advertised: true, tested: operations.some((row) => row.status === 'pass'),
      authorityClass: operations.some((row) => row.coverage === 'nap-spec') ? 'nap-spec' : 'wire-contract',
      authority: `nap-${domain}`, operations, drift: [...inventoryDrift(domain), ...uncovered],
    };
  });
}

function advertisedCovered(facts: DomainFacts): CheckOutcome {
  const problems: { domain: string; problem: string }[] = [];
  for (const domain of facts.selected) {
    const run = facts.runs[domain];
    if (!SUPPORTED_DOMAINS.includes(domain)) problems.push({ domain, problem: 'advertised but not a supported catalog domain' });
    if (!run) { problems.push({ domain, problem: 'advertised without a fixture' }); continue; }
    const rows = operationRows(run, domain);
    for (const row of rows.filter((item) => item.coverage === 'uncovered')) {
      problems.push({ domain, problem: `${row.type} (${row.sources.join('+')}) has no runnable case${row.note ? `: ${row.note}` : ''}` });
    }
    if (!rows.some((row) => row.status === 'pass')) problems.push({ domain, problem: 'no runnable case passed' });
  }
  if (problems.length) return fail(`${problems.length} coverage gaps in the advertised catalog`, problems);
  return pass(`Every advertised domain has a fixture and every inventoried operation a passing case or a semantic gap row (${facts.selected.length} domains)`);
}

function capabilityTruthfulness(facts: DomainFacts): CheckOutcome {
  // NIP-5D: "Presence of a domain object means that domain is available."
  // An advertised domain is truthful only if every request it was sent was serviced.
  const broken = facts.selected.flatMap((domain) => {
    const run = facts.runs[domain];
    if (!run?.report) return [];
    const failed = run.fixture.cases.filter((item) => replyType(item) !== null && !item.noId && judgeCase(run, item) !== null).map((item) => item.id);
    return failed.length ? [{ domain, failed }] : [];
  });
  if (broken.length) return fail(`Advertised and injected, but not serviced: ${broken.map((row) => row.domain).join(', ')}`, broken);
  return pass('Every advertised domain with a fixture serviced every request it was sent');
}

function packageDrift(facts: DomainFacts): CheckOutcome {
  const rows = facts.selected.map((domain) => ({ domain, missing: missingPackageOperations(domain) })).filter((row) => row.missing.length);
  if (rows.length) return fail(`The installed @napplet/nap types lack operations their pinned NAP specifies in ${rows.map((row) => row.domain).join(', ')}`, rows);
  return pass(`The installed @napplet/nap types cover every operation the pinned NAPs specify for ${facts.selected.length} advertised domains`);
}

/**
 * Field-level twin of {@link packageDrift}: every payload field the pinned
 * wire table names, with its optionality, against the installed declaration.
 * Rows a pinned sentence sanctions pass; table-versus-prose contradictions
 * are spec gaps; anything else fails. Cells the parser cannot read are listed.
 */
export function packageFieldDrift(facts: { readonly selected: readonly string[] }, report = fieldDriftReport(facts.selected)): CheckOutcome {
  const evidence = { findings: report.findings, sanctioned: report.sanctioned, contradictions: report.contradictions, uncompared: report.uncompared };
  if (report.findings.length) {
    const types = [...new Set(report.findings.map((row) => row.type))];
    return fail(`The installed @napplet/nap fields differ from the pinned NAP wire tables in ${types.join(', ')}`, evidence);
  }
  if (report.contradictions.length) {
    return specGap(`The pinned NAP table and prose disagree on ${report.contradictions.map((row) => `${row.type} ${row.field}`).join(', ')}; the packaged shape is accepted until the NAP settles it`, evidence);
  }
  return pass(`The installed @napplet/nap fields match the pinned NAP wire tables for ${report.compared} messages (${report.sanctioned.length} differences settled in NAP prose, ${report.uncompared.length} rows not fully comparable)`, evidence);
}

function domainChecks(domain: string): Check<DomainFacts>[] {
  const authority = [`nap-${domain}`, 'nap-package'];
  return [
    { id: `${domain}/correlation`, title: `${domain} requests get canonical, correlated replies`, scope: 'wire-contract', severity: 'error', domain, authority, evaluate: correlation(domain) },
    { id: `${domain}/semantics`, title: `${domain} replies follow the pinned NAP semantics`, scope: 'nap-spec', severity: 'error', domain, authority: [`nap-${domain}`], evaluate: semantics(domain) },
    { id: `${domain}/push`, title: `${domain} pushes are delivered and stop when unsubscribed`, scope: 'wire-contract', severity: 'error', domain, authority, evaluate: pushes(domain) },
  ];
}

const checks: readonly Check<DomainFacts>[] = [
  { id: 'catalog/advertised-domain-covered', title: 'Every advertised domain is covered by the catalog', scope: 'catalog', severity: 'error', authority: ['nap-package'], evaluate: advertisedCovered },
  { id: 'catalog/package-drift', title: 'Packaged types cover every specified operation of advertised domains', scope: 'catalog', severity: 'error', authority: ['nap-package'], evaluate: packageDrift },
  { id: 'catalog/package-field-drift', title: 'Packaged message fields match the pinned wire tables of advertised domains', scope: 'catalog', severity: 'error', authority: ['nap-package'], evaluate: packageFieldDrift },
  { id: 'catalog/capability-truthfulness', title: 'Advertised domains are actually serviced', scope: 'nip5d-core', severity: 'error', authority: ['nip5d'], evaluate: capabilityTruthfulness },
  ...SUPPORTED_DOMAINS.filter((domain) => domain !== 'shell').flatMap(domainChecks),
];

/** Per-domain wire-contract and NAP checks, plus the catalog coverage gate. */
export const DOMAINS_SCENARIO = defineScenario<DomainFacts>({ id: 'domains', collect, checks, coverage });
