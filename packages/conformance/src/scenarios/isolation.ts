/**
 * scenarios/isolation.ts — Cross-domain denial and endpoint-isolation checks.
 *
 * `catalog/acl-denial`: for every advertised domain whose first request maps
 * to an ACL capability, revoke it for one endpoint and prove the backend never
 * runs and the endpoint sees only message types the owning NAP defines:
 * silence, or the canonical result type (with or without `error`; the pinned
 * NAPs leave the projection of a policy denial open).
 *
 * `catalog/endpoint-isolation`: for every advertised domain with a push, two
 * endpoints receive it; destroying one must stop delivery to it without
 * affecting the other.
 *
 * Both need target controls (`acl.revoke`, `backend.calls`); a target without
 * them skips the check.
 */
import { FIXTURES } from '../fixtures/index.js';
import type { DomainFixture, OperationCase, PushCase } from '../fixtures/types.js';
import { fail, pass, skip, type CheckOutcome, type TranscriptEntry } from '../model.js';
import type { ProbeStep } from '../probe/plan.js';
import { defineScenario, step, type Check, type CollectContext } from '../scenario.js';

type Envelope = Readonly<Record<string, unknown>>;

interface DenialRow {
  readonly domain: string;
  readonly request: string;
  /** Capability the target revoked, or `null` when the request needs none. */
  readonly capability: string | null;
  readonly backendCalls: number;
  readonly reply: Envelope | null;
}

interface IsolationRow {
  readonly domain: string;
  readonly push: string;
  readonly survivorGot: boolean;
  /** Runtime -> napplet entries addressed to the destroyed endpoint after it was destroyed. */
  readonly afterDestroy: readonly TranscriptEntry[];
}

/** A push delivered to an endpoint that has sent nothing at all. */
interface SilentListenerRow {
  readonly domain: string;
  readonly push: string;
  readonly got: boolean;
}

interface IsolationFacts {
  readonly controls: boolean;
  readonly denial: readonly DenialRow[];
  readonly isolation: readonly IsolationRow[];
  readonly silent: readonly SilentListenerRow[];
}

const firstRequest = (fixture: DomainFixture): OperationCase | undefined => fixture.cases.find((item) => item.reply !== null && !item.noId);

function selected(context: CollectContext): DomainFixture[] {
  return context.advertised.domains
    .filter((domain) => domain !== 'shell' && (!context.domains.length || context.domains.includes(domain)))
    .map((domain) => FIXTURES[domain])
    .filter((fixture): fixture is DomainFixture => fixture !== undefined);
}

async function deny(context: CollectContext, fixture: DomainFixture, request: OperationCase): Promise<DenialRow> {
  const envelope = { type: request.type, id: `denied-${request.id}`, ...request.payload };
  const endpoint = await context.session.loadProbe({
    plan: {
      label: `deny-${fixture.domain}`, timeoutMs: context.timeoutMs,
      steps: [
        { op: 'mark', name: 'loaded' },
        { op: 'waitSignal', name: 'go' },
        { op: 'send', envelope },
        { op: 'expect', as: 'reply', match: { id: envelope.id }, timeoutMs: context.settleMs * 3 },
      ],
    },
    dTag: `probe-deny-${fixture.domain}`, grants: [fixture.domain], optional: [fixture.domain], rawWire: true,
  });
  await endpoint.waitMark('loaded', context.timeoutMs * 2);
  const capability = await context.session.control('acl.revoke', { endpoint: endpoint.id, envelope }) as string | null;
  const before = await context.session.control('backend.calls', fixture.domain) as number;
  endpoint.signal('go');
  const report = await endpoint.report(context.timeoutMs * 3);
  const after = await context.session.control('backend.calls', fixture.domain) as number;
  await context.session.destroyEndpoint(endpoint.id);
  const record = step(report, 'reply');
  return {
    domain: fixture.domain, request: request.type, capability: capability ?? null, backendCalls: after - before,
    reply: record?.state === 'value' ? record.value as Envelope : null,
  };
}

function pushPlan(push: PushCase, label: string, context: CollectContext, first?: OperationCase, setup: readonly OperationCase[] = []): ProbeStep[] {
  const subscribe = push.subscribe;
  return [
    ...setup.flatMap((item): ProbeStep[] => [
      { op: 'send', envelope: { type: item.type, ...(item.noId ? {} : { id: item.id }), ...item.payload } },
      ...(item.noId || item.reply === null ? [] : [{ op: 'expect', as: `setup:${item.id}`, match: { id: item.id } } as ProbeStep]),
    ]),
    // Isolation is judged on endpoints the runtime has certainly bound: each sends one request first.
    ...(first && !subscribe ? [
      { op: 'send', envelope: { type: first.type, id: first.id, ...first.payload } } as ProbeStep,
      { op: 'expect', as: 'first', match: { id: first.id } } as ProbeStep,
    ] : []),
    ...(subscribe ? [
      { op: 'send', envelope: { type: subscribe.type, id: subscribe.id, ...subscribe.payload } } as ProbeStep,
      { op: 'expect', as: 'sub', match: { id: subscribe.id } } as ProbeStep,
    ] : []),
    { op: 'mark', name: 'ready' },
    { op: 'expect', as: 'push', match: { type: push.type }, timeoutMs: context.timeoutMs * 2 },
    { op: 'mark', name: `${label}-done` },
  ];
}

function setupOf(fixture: DomainFixture, push: PushCase): OperationCase[] {
  const ids = push.isolation ? push.isolation.setup : [];
  const known = [...fixture.cases, ...(fixture.pushes ?? []).flatMap((item) => [item.subscribe, item.unsubscribe])];
  return ids.map((id) => known.find((item) => item?.id === id)).filter((item): item is OperationCase => item !== undefined);
}

async function isolate(context: CollectContext, fixture: DomainFixture, push: PushCase): Promise<IsolationRow> {
  const grants = [fixture.domain, ...(fixture.alsoGrant ?? [])].filter((domain) => context.advertised.domains.includes(domain));
  const load = (label: string) => context.session.loadProbe({
    plan: { label: `isolate-${fixture.domain}`, steps: pushPlan(push, label, context, firstRequest(fixture), setupOf(fixture, push)), timeoutMs: context.timeoutMs },
    dTag: `probe-isolate-${fixture.domain}-${label}`, grants, optional: grants, rawWire: true,
  });
  const doomed = await load('doomed');
  const survivor = await load('survivor');
  await Promise.all([doomed.waitMark('ready', context.timeoutMs * 2), survivor.waitMark('ready', context.timeoutMs * 2)]);
  await context.session.destroyEndpoint(doomed.id);
  const from = context.session.transcript().length;
  await context.session.control(push.trigger!.control, push.trigger!.payload);
  const report = await survivor.report(context.timeoutMs * 4);
  const afterDestroy = context.session.transcript().slice(from)
    .filter((entry) => entry.tap === 'host' && entry.endpoint === doomed.id && entry.direction === 'runtime->napplet');
  await context.session.destroyEndpoint(survivor.id);
  return { domain: fixture.domain, push: push.id, survivorGot: step(report, 'push')?.state === 'value', afterDestroy };
}

async function listen(context: CollectContext, fixture: DomainFixture, push: PushCase): Promise<SilentListenerRow> {
  const endpoint = await context.session.loadProbe({
    plan: {
      label: `listen-${fixture.domain}`, timeoutMs: context.timeoutMs,
      steps: [{ op: 'mark', name: 'ready' }, { op: 'expect', as: 'push', match: { type: push.type }, timeoutMs: context.timeoutMs * 2 }],
    },
    dTag: `probe-listen-${fixture.domain}`, grants: [fixture.domain], optional: [fixture.domain], rawWire: true,
  });
  await endpoint.waitMark('ready', context.timeoutMs * 2);
  await context.session.control(push.trigger!.control, push.trigger!.payload);
  const report = await endpoint.report(context.timeoutMs * 4);
  await context.session.destroyEndpoint(endpoint.id);
  return { domain: fixture.domain, push: push.id, got: step(report, 'push')?.state === 'value' };
}

async function collect(context: CollectContext): Promise<IsolationFacts> {
  const controls = ['acl.revoke', 'backend.calls'].every((name) => context.session.controls.includes(name));
  if (!controls) return { controls, denial: [], isolation: [], silent: [] };
  const denial: DenialRow[] = [];
  const isolation: IsolationRow[] = [];
  const silent: SilentListenerRow[] = [];
  for (const fixture of selected(context)) {
    const request = firstRequest(fixture);
    if (request) denial.push(await deny(context, fixture, request));
    // Only host-triggered pushes: isolation needs to fire the push after one endpoint is gone.
    const push = (fixture.pushes ?? []).find((item) => item.trigger !== undefined && item.isolation !== false && context.session.controls.includes(item.trigger.control));
    if (!push) continue;
    isolation.push(await isolate(context, fixture, push));
    const broadcast = (fixture.pushes ?? []).find((item) => item.broadcast && item.trigger && context.session.controls.includes(item.trigger.control));
    if (broadcast) silent.push(await listen(context, fixture, broadcast));
  }
  return { controls, denial, isolation, silent };
}

function judgeDenial(row: DenialRow): string | null {
  if (row.capability === null) return null;
  if (row.backendCalls > 0) return `the ${row.domain} backend ran ${row.backendCalls} times after ${row.capability} was revoked`;
  if (!row.reply) return null;
  const canonical = `${row.request}.result`;
  const nativeError = row.domain === 'resource' && row.reply.type === `${row.request}.error`;
  if (row.reply.type !== canonical && !nativeError) return `denial was answered with ${String(row.reply.type)}, a type ${row.domain}'s NAP does not define (expected silence or ${canonical})`;
  // A canonical result without `error` (a safe default) is not judged: the
  // pinned NAPs do not say how a policy denial projects onto their results.
  return null;
}

function aclDenial(facts: IsolationFacts): CheckOutcome {
  if (!facts.controls) return skip('The target has no acl.revoke / backend.calls controls');
  if (!facts.denial.length) return skip('No advertised domain with a request case in this variant');
  const problems = facts.denial.map((row) => ({ ...row, problem: judgeDenial(row) })).filter((row) => row.problem);
  const uncapped = facts.denial.filter((row) => row.capability === null).map((row) => row.domain);
  const silentDefault = facts.denial.filter((row) => row.capability !== null && row.reply && row.reply.error === undefined).map((row) => row.domain);
  const diagnostics = { problems, noCapability: uncapped, deniedAsSafeDefault: silentDefault, tested: facts.denial.filter((row) => row.capability !== null).map((row) => row.domain) };
  if (problems.length) return fail(`${problems.length} domains mishandled an ACL denial`, diagnostics);
  return pass(`ACL denial ran no backend and was silent or canonical in ${diagnostics.tested.length} domains`, diagnostics);
}

function endpointIsolation(facts: IsolationFacts): CheckOutcome {
  if (!facts.controls) return skip('The target has no acl.revoke / backend.calls controls');
  if (!facts.isolation.length) return skip('No advertised domain has a push runnable in this variant');
  const problems = facts.isolation.filter((row) => !row.survivorGot || row.afterDestroy.length > 0);
  if (problems.length) return fail(`${problems.length} domains leaked or lost a push across endpoint destruction`, problems);
  return pass(`Destroying one endpoint stopped its pushes and left the other endpoint served in ${facts.isolation.length} domains`, facts.isolation.map((row) => row.domain));
}

function broadcastToLoaded(facts: IsolationFacts): CheckOutcome {
  if (!facts.controls) return skip('The target has no acl.revoke / backend.calls controls');
  if (!facts.silent.length) return skip('No advertised domain has a required broadcast runnable in this variant');
  const missed = facts.silent.filter((row) => !row.got);
  if (missed.length) {
    return fail(`A loaded endpoint the domain is exposed to, which has sent nothing yet, got no ${missed.map((row) => row.push).join(', ')}`, facts.silent);
  }
  return pass('Required broadcasts reach every loaded endpoint the domain is exposed to, before it sends anything', facts.silent);
}

const checks: readonly Check<IsolationFacts>[] = [
  { id: 'catalog/broadcast-to-loaded', title: 'Required broadcasts reach loaded napplets before their first message', scope: 'nap-spec', severity: 'error', authority: ['nap-theme', 'nap-identity', 'nap-shell'], evaluate: broadcastToLoaded },
  { id: 'catalog/acl-denial', title: 'ACL denial runs no backend and answers only as the NAP allows', scope: 'wire-contract', severity: 'error', authority: ['nap-package'], evaluate: aclDenial },
  { id: 'catalog/endpoint-isolation', title: 'Destroying an endpoint releases its pushes without affecting another', scope: 'nip5d-core', severity: 'error', authority: ['nip5d'], evaluate: endpointIsolation },
];

/** Cross-domain denial and endpoint-isolation checks. */
export const ISOLATION_SCENARIO = defineScenario<IsolationFacts>({ id: 'isolation', collect, checks });
