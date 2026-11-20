/**
 * scenarios/shell.ts — Optional NAP-SHELL: exactly-once readiness, parent-port
 * trust, retained environment, environment scope and local `supports`.
 *
 * Authority: NAP-SHELL at the `napplet/naps` master ref in `authority.ts`, and
 * NIP-5D for the port transport the exchange rides on.
 */
import { fail, pass, skip, type CheckOutcome, type TranscriptEntry } from '../model.js';
import { WIRE_HANDLE } from '../probe/artifact.js';
import type { ProbeReport, ProbeStep } from '../probe/plan.js';
import { anchorSteps, defineScenario, runProbe, sameSet, sorted, step, value, type Check, type CollectContext } from '../scenario.js';
import { UNAVAILABLE_DOMAIN } from './nip5d-load.js';

interface Environment { readonly capabilities?: { readonly domains?: readonly string[] }; readonly services?: readonly string[] }

interface EndpointWire {
  readonly outbound: readonly TranscriptEntry[];
  readonly inbound: readonly TranscriptEntry[];
}

interface OptionalFacts {
  readonly injected: readonly string[];
  readonly answered: boolean;
  readonly shellTraffic: readonly unknown[];
}

interface ShellFacts {
  readonly anchor: string | null;
  readonly variantShell: boolean;
  readonly advertised: readonly string[];
  readonly services: readonly string[];
  /** Endpoint granted every domain except shell, or the shell-absent variant's full grant. */
  readonly optional: OptionalFacts | null;
  readonly echo: { readonly ready: unknown; readonly state: string | undefined; readonly wire: EndpointWire } | null;
  readonly once: readonly { readonly wire: EndpointWire; readonly identityStable: boolean; readonly answeredAfter: boolean }[];
  readonly trust: { readonly report: ProbeReport | null; readonly rogueReceived: readonly unknown[]; readonly rogueDispatched: number } | null;
  readonly scope: readonly { readonly name: string; readonly injected: readonly string[]; readonly init: Environment | null; readonly granted: readonly string[] }[];
  readonly retained: { readonly report: ProbeReport | null; readonly wire: EndpointWire; readonly injected: readonly string[]; readonly ungranted: string } | null;
}

const typeOf = (envelope: unknown): string => String((envelope as { type?: unknown } | null)?.type ?? '');

function endpointWire(context: CollectContext, endpoint: string): EndpointWire {
  const entries = context.session.transcript().filter((entry) => entry.endpoint === endpoint && entry.tap === 'frame');
  return {
    outbound: entries.filter((entry) => entry.direction === 'napplet->runtime'),
    inbound: entries.filter((entry) => entry.direction === 'runtime->napplet'),
  };
}

const ofType = (entries: readonly TranscriptEntry[], type: string): TranscriptEntry[] => entries.filter((entry) => typeOf(entry.envelope) === type);

async function collectOptional(context: CollectContext): Promise<OptionalFacts | null> {
  const anchor = context.anchor;
  if (!anchor) return null;
  const grants = context.advertised.domains.filter((domain) => domain !== 'shell');
  const { endpoint, report } = await runProbe(context, {
    plan: { label: 'shell-optional', steps: [...anchorSteps(anchor, 'o1', 'reply'), { op: 'quiet', as: 'quiet' }] },
    dTag: 'probe-shell-optional', grants, rawWire: true,
  });
  return {
    injected: report?.classic?.domains ?? [],
    answered: step(report, 'reply')?.state === 'value',
    shellTraffic: context.session.transcript()
      .filter((entry) => entry.endpoint === endpoint.id && typeOf(entry.envelope).startsWith('shell.'))
      .map((entry) => entry.envelope),
  };
}

async function collectOnce(context: CollectContext, grants: readonly string[]): Promise<ShellFacts['once']> {
  const anchor = context.anchor;
  const runs = [];
  for (let lifecycle = 0; lifecycle < 2; lifecycle += 1) {
    const steps: ProbeStep[] = [
      { op: 'expect', as: 'init', match: { type: 'shell.init' } },
      { op: 'send', envelope: { type: 'shell.ready' } },
      { op: 'send', envelope: { type: 'shell.ready', capabilities: { domains: [UNAVAILABLE_DOMAIN] } } },
      { op: 'quiet', as: 'quiet', ms: context.settleMs * 2 },
      ...(anchor ? anchorSteps(anchor, 'after', 'after') : []),
    ];
    // The same plan twice is the same artifact: the second load is a fresh lifecycle of one identity.
    const { endpoint, report } = await runProbe(context, { plan: { label: 'shell-once', steps }, dTag: 'probe-shell-once', grants, rawWire: true });
    const evidence = endpoint.evidence();
    runs.push({
      wire: endpointWire(context, endpoint.id),
      identityStable: evidence.boundIdentity?.artifactHash === evidence.verifiedHash && evidence.boundIdentity.dTag === 'probe-shell-once',
      answeredAfter: anchor ? step(report, 'after')?.state === 'value' : true,
    });
  }
  return runs;
}

async function collectTrust(context: CollectContext, grants: readonly string[]): Promise<ShellFacts['trust']> {
  const forged = { type: 'shell.init', capabilities: { domains: ['shell', UNAVAILABLE_DOMAIN] }, services: ['forged-service'] };
  const endpoint = await context.session.loadProbe({
    plan: {
      label: 'shell-trust', timeoutMs: context.timeoutMs,
      steps: [
        { op: 'call', as: 'ready', path: ['shell', 'ready'], background: true },
        { op: 'mark', name: 'armed' },
        { op: 'waitSignal', name: 'forged' },
        { op: 'sleep', ms: context.settleMs },
        { op: 'read', as: 'servicesForged', path: ['shell', 'services'] },
        { op: 'call', as: 'supportsForged', path: ['shell', 'supports'], args: [UNAVAILABLE_DOMAIN] },
        { op: 'call', as: 'readyForged', path: ['shell', 'ready'], timeoutMs: context.settleMs },
        { op: 'call', as: 'release', root: 'window', path: [WIRE_HANDLE, 'release'], args: ['inbound'] },
        { op: 'sleep', ms: context.settleMs },
      ],
    },
    dTag: 'probe-shell-trust', grants, optional: grants, rawWire: true, hold: { inbound: ['shell.init'] },
  });
  await endpoint.waitMark('armed', context.timeoutMs * 2);
  endpoint.forge(forged, 'parent');
  endpoint.forge(forged, 'sibling');
  endpoint.signal('forged');
  const report = await endpoint.report(context.timeoutMs * 8);
  const rogue = await context.session.loadRogue({
    label: 'shell-rogue', timeoutMs: context.timeoutMs, settleMs: context.settleMs,
    steps: [{ op: 'send', envelope: { type: 'shell.ready' } }, { op: 'quiet', as: 'quiet', ms: context.settleMs * 3 }],
  });
  return { report, rogueReceived: value<unknown[]>(rogue.report, 'quiet') ?? [], rogueDispatched: rogue.dispatched.length };
}

async function collectScope(context: CollectContext): Promise<ShellFacts['scope']> {
  const narrow = context.anchor ? ['shell', context.anchor.domain] : ['shell'];
  const results = [];
  for (const [name, grants] of [['narrow', narrow], ['all', 'all']] as const) {
    const { endpoint, report } = await runProbe(context, {
      plan: { label: `shell-scope-${name}`, steps: [{ op: 'call', as: 'ready', path: ['shell', 'ready'] }] },
      dTag: `probe-shell-scope-${name}`, grants,
    });
    const ready = step(report, 'ready');
    results.push({
      name, injected: report?.classic?.domains ?? [], granted: endpoint.grantedDomains,
      init: ready?.state === 'resolved' ? ready.value as Environment : null,
    });
  }
  return results;
}

async function collectRetained(context: CollectContext, grants: readonly string[]): Promise<ShellFacts['retained']> {
  const ungranted = context.advertised.domains.find((domain) => !grants.includes(domain)) ?? UNAVAILABLE_DOMAIN;
  const supports = (as: string, domain: string): ProbeStep => ({ op: 'call', as, path: ['shell', 'supports'], args: [domain] });
  const forgedInit = { type: 'shell.init', capabilities: { domains: [...grants, ungranted] }, services: ['forged-service'] };
  const steps: ProbeStep[] = [
    { op: 'read', as: 'servicesBefore', path: ['shell', 'services'] },
    ...grants.map((domain) => supports(`before:${domain}`, domain)),
    supports('before:ungranted', ungranted),
    supports('before:unknown', UNAVAILABLE_DOMAIN),
    { op: 'call', as: 'ready', path: ['shell', 'ready'], background: true },
    { op: 'call', as: 'readyAgain', path: ['shell', 'ready'], background: true },
    { op: 'call', as: 'early', path: ['shell', 'onReady'], args: [{ $callback: 'early' }] },
    { op: 'quiet', as: 'heldQuiet' },
    { op: 'call', as: 'release', root: 'window', path: [WIRE_HANDLE, 'release'], args: ['inbound'] },
    { op: 'sleep', ms: context.settleMs },
    { op: 'read', as: 'servicesAfter', path: ['shell', 'services'] },
    { op: 'call', as: 'mutate', path: ['shell', 'services', 'push'], args: ['mutated'] },
    { op: 'assign', as: 'reassign', path: ['shell', 'services'], value: ['reassigned'] },
    { op: 'call', as: 'late', path: ['shell', 'onReady'], args: [{ $callback: 'late' }] },
    { op: 'call', as: 'inject', root: 'window', path: [WIRE_HANDLE, 'inject'], args: [forgedInit] },
    { op: 'sleep', ms: context.settleMs },
    { op: 'read', as: 'servicesFinal', path: ['shell', 'services'] },
    supports('after:ungranted', ungranted),
    { op: 'call', as: 'readyFinal', path: ['shell', 'ready'] },
    { op: 'quiet', as: 'tailQuiet' },
  ];
  const { endpoint, report } = await runProbe(context, {
    plan: { label: 'shell-retained', steps }, dTag: 'probe-shell-retained', grants, rawWire: true, hold: { inbound: ['shell.init'] },
  });
  return { report, wire: endpointWire(context, endpoint.id), injected: report?.classic?.domains ?? [], ungranted };
}

async function collect(context: CollectContext): Promise<ShellFacts> {
  const variantShell = context.variant.shell === 'shell-present' && context.advertised.domains.includes('shell');
  const grants = context.anchor ? ['shell', context.anchor.domain] : ['shell'];
  const base = {
    anchor: context.anchor?.domain ?? null, variantShell,
    advertised: context.advertised.domains, services: context.advertised.services,
    optional: await collectOptional(context),
  };
  if (!variantShell) return { ...base, echo: null, once: [], trust: null, scope: [], retained: null };
  const echoRun = await runProbe(context, {
    plan: { label: 'shell-echo', steps: [{ op: 'call', as: 'ready', path: ['shell', 'ready'] }, { op: 'quiet', as: 'quiet' }] },
    dTag: 'probe-shell-echo', grants, rawWire: true, hold: { echoInit: true },
  });
  return {
    ...base,
    echo: { ready: value(echoRun.report, 'ready'), state: step(echoRun.report, 'ready')?.state, wire: endpointWire(context, echoRun.endpoint.id) },
    once: await collectOnce(context, grants),
    trust: await collectTrust(context, grants),
    scope: await collectScope(context),
    retained: await collectRetained(context, grants),
  };
}

const NOT_EXPOSED = skip('shell is not exposed in this variant');

function optional(facts: ShellFacts): CheckOutcome {
  if (!facts.optional) return skip('No working non-shell domain is advertised in this variant');
  const diagnostics = facts.optional;
  if (facts.optional.injected.includes('shell')) return fail('window.napplet.shell was injected for an endpoint not granted shell', diagnostics);
  if (!facts.optional.answered) return fail(`${facts.anchor} did not answer without shell`, diagnostics);
  if (facts.optional.shellTraffic.length) return fail('shell.* traffic crossed the wire for an endpoint without shell', diagnostics);
  return pass(`Without shell, ${facts.anchor} was injected and serviced with no readiness exchange`, diagnostics);
}

function receiverOrder(facts: ShellFacts): CheckOutcome {
  if (!facts.echo) return NOT_EXPOSED;
  const ready = ofType(facts.echo.wire.outbound, 'shell.ready');
  const diagnostics = { ready: ready.map((entry) => entry.envelope), state: facts.echo.state, environment: facts.echo.ready };
  if (ready.length !== 1) return fail(`The binding sent ${ready.length} shell.ready signals; expected exactly one`, diagnostics);
  if (Object.keys(ready[0]!.envelope as object).join() !== 'type') return fail('shell.ready carries fields beyond type', diagnostics);
  const services = (facts.echo.ready as Environment | undefined)?.services ?? [];
  if (facts.echo.state !== 'resolved' || !services.includes('conformance-echo')) {
    return fail('A shell.init delivered synchronously with shell.ready was missed: the receiver was not installed first', diagnostics);
  }
  return pass('The receiver caught a shell.init answered synchronously with the one bare shell.ready', diagnostics);
}

function oncePerLifecycle(facts: ShellFacts): CheckOutcome {
  if (!facts.variantShell) return NOT_EXPOSED;
  if (facts.once.length !== 2) return fail('Lifecycle evidence was not collected');
  const counts = facts.once.map((run) => ofType(run.wire.inbound, 'shell.init').length);
  const diagnostics = { initsPerLifecycle: counts, identityStable: facts.once.map((run) => run.identityStable), answeredAfter: facts.once.map((run) => run.answeredAfter) };
  if (counts.some((count) => count !== 1)) return fail('Duplicate shell.ready produced another shell.init, or a lifecycle got none', diagnostics);
  if (facts.once.some((run) => !run.identityStable)) return fail('Duplicate shell.ready changed the bound identity', diagnostics);
  if (facts.once.some((run) => !run.answeredAfter)) return fail('Duplicate shell.ready changed policy for another domain', diagnostics);
  return pass('Each lifecycle got exactly one shell.init; duplicates changed nothing; a reload got its own', diagnostics);
}

function sourceTrust(facts: ShellFacts): CheckOutcome {
  if (!facts.trust) return NOT_EXPOSED;
  const { report, rogueReceived, rogueDispatched } = facts.trust;
  const diagnostics = {
    servicesForged: value(report, 'servicesForged'), supportsForged: value(report, 'supportsForged'),
    readyForged: step(report, 'readyForged')?.state, readyFinal: step(report, 'ready')?.state, rogueReceived, rogueDispatched,
  };
  if (!report) return fail('The trust probe did not finish', diagnostics);
  if (diagnostics.readyForged !== 'pending') return fail('A window-level shell.init resolved ready()', diagnostics);
  if ((diagnostics.servicesForged as unknown[] | undefined)?.length) return fail('A window-level shell.init populated services', diagnostics);
  if (diagnostics.supportsForged !== false) return fail('A window-level shell.init made an absent domain supported', diagnostics);
  if (diagnostics.readyFinal !== 'resolved') return fail('ready() never resolved from the port-delivered shell.init', diagnostics);
  if (rogueReceived.length || rogueDispatched) return fail('An unregistered source got a reply to shell.ready or was dispatched', diagnostics);
  return pass('Forged window-level shell.init from parent and sibling was ignored; an unregistered shell.ready got nothing', diagnostics);
}

function environmentScope(facts: ShellFacts): CheckOutcome {
  if (!facts.variantShell) return NOT_EXPOSED;
  if (facts.scope.length !== 2) return fail('Scope evidence was not collected');
  for (const item of facts.scope) {
    const domains = item.init?.capabilities?.domains ?? [];
    const services = item.init?.services ?? [];
    const diagnostics = { endpoint: item.name, injected: sorted(item.injected), initDomains: sorted(domains), services, granted: sorted(item.granted) };
    if (!item.init) return fail(`The ${item.name} endpoint received no environment`, diagnostics);
    if (!sameSet(domains, item.injected)) return fail(`The ${item.name} endpoint's shell.init domains differ from its injected domains`, diagnostics);
    const foreign = services.filter((name) => !facts.services.includes(name) || !item.granted.includes(name));
    if (foreign.length) return fail(`The ${item.name} endpoint's shell.init lists services it was not exposed: ${foreign.join(', ')}`, diagnostics);
  }
  const [narrow, all] = facts.scope;
  if (narrow && all && sameSet(narrow.injected, all.injected) && !sameSet(facts.advertised, narrow.injected)) {
    return fail('Two endpoints with different grants were injected the same domains', facts.scope);
  }
  return pass('Each shell.init describes exactly its own endpoint\'s exposed domains and services', facts.scope.map((item) => ({ endpoint: item.name, domains: sorted(item.init?.capabilities?.domains ?? []) })));
}

function retainedEnvironment(facts: ShellFacts): CheckOutcome {
  if (!facts.retained) return NOT_EXPOSED;
  const { report, wire } = facts.retained;
  const ready = step(report, 'ready');
  const env = ready?.value as Environment | undefined;
  const readySignals = ofType(wire.outbound, 'shell.ready').length;
  const callbacks = report?.callbacks ?? {};
  const diagnostics = {
    readySignals, ready: ready?.state, readyAgain: step(report, 'readyAgain')?.state, environment: env,
    servicesBefore: value(report, 'servicesBefore'), servicesAfter: value(report, 'servicesAfter'), servicesFinal: value(report, 'servicesFinal'),
    mutate: step(report, 'mutate')?.state, early: callbacks.early?.length ?? 0, late: callbacks.late?.length ?? 0,
    readyFinal: value(report, 'readyFinal'),
  };
  if (!report || ready?.state !== 'resolved') return fail('ready() did not resolve from the first parent shell.init', diagnostics);
  if (readySignals !== 1) return fail(`Repeated ready() calls sent ${readySignals} readiness signals; expected one`, diagnostics);
  if ((diagnostics.servicesBefore as unknown[] | undefined)?.length !== 0) return fail('services was not empty before shell.init', diagnostics);
  if (JSON.stringify(diagnostics.servicesAfter) !== JSON.stringify(env?.services)) return fail('services does not expose the delivered snapshot', diagnostics);
  if (diagnostics.mutate !== 'threw' || JSON.stringify(diagnostics.servicesFinal) !== JSON.stringify(env?.services)) {
    return fail('services is writable, or a later shell.init replaced the retained snapshot', diagnostics);
  }
  if (diagnostics.early !== 1 || diagnostics.late !== 1) return fail('onReady is not one-shot for handlers registered before and after delivery', diagnostics);
  if (JSON.stringify(diagnostics.readyFinal) !== JSON.stringify(ready.value)) return fail('ready() resolved to a different environment later', diagnostics);
  return pass('ready(), services and onReady retain the first environment; repeats send nothing; later inits are ignored', diagnostics);
}

function localSupports(facts: ShellFacts): CheckOutcome {
  if (!facts.retained) return NOT_EXPOSED;
  const { report, wire, injected, ungranted } = facts.retained;
  const before = Object.fromEntries((report?.steps ?? []).filter((record) => record.as?.startsWith('before:')).map((record) => [record.as!.slice(7), record.value]));
  const queries = wire.outbound.filter((entry) => typeOf(entry.envelope).startsWith('shell.') && typeOf(entry.envelope) !== 'shell.ready');
  const diagnostics = { injected: sorted(injected), before, afterUngranted: value(report, 'after:ungranted'), ungranted, wireQueries: queries.map((entry) => entry.envelope) };
  if (!report) return fail('The supports probe did not finish', diagnostics);
  const wrong = injected.filter((domain) => domain in before && before[domain] !== true);
  if (wrong.length) return fail(`supports() was not true before shell.init for injected domains: ${wrong.join(', ')}`, diagnostics);
  if (before.ungranted !== false || before.unknown !== false) return fail('supports() is true for an unexposed or unknown domain', diagnostics);
  if (diagnostics.afterUngranted !== false) return fail('A shell.init claiming an absent domain made it supported', diagnostics);
  if (queries.length) return fail('supports() sent a wire query', diagnostics);
  return pass('supports() is local, works before shell.init and follows injected presence only', diagnostics);
}

const authority = ['nap-shell'] as const;
const checks: readonly Check<ShellFacts>[] = [
  { id: 'shell/optional', title: 'Shell can be omitted while another granted domain works', scope: 'nap-spec', severity: 'error', domain: 'shell', authority, evaluate: optional },
  { id: 'shell/receiver-order', title: 'The shell receiver is installed before one bare shell.ready', scope: 'nap-spec', severity: 'error', domain: 'shell', authority, evaluate: receiverOrder },
  { id: 'shell/once-per-lifecycle', title: 'Exactly one shell.init per endpoint lifecycle', scope: 'nap-spec', severity: 'error', domain: 'shell', authority, evaluate: oncePerLifecycle },
  { id: 'shell/source-trust', title: 'Only the bound port delivers shell.init; unregistered sources get nothing', scope: 'nap-spec', severity: 'error', domain: 'shell', authority: ['nap-shell', 'nip5d'], evaluate: sourceTrust },
  { id: 'shell/environment-scope', title: 'Each shell.init describes only its own endpoint', scope: 'nap-spec', severity: 'error', domain: 'shell', authority, evaluate: environmentScope },
  { id: 'shell/retained-environment', title: 'ready, services and onReady retain the first environment', scope: 'nap-spec', severity: 'error', domain: 'shell', authority, evaluate: retainedEnvironment },
  { id: 'shell/local-supports', title: 'supports(domain) is local and follows injected presence', scope: 'nap-spec', severity: 'error', domain: 'shell', authority, evaluate: localSupports },
];

/** Optional NAP-SHELL checks. */
export const SHELL_SCENARIO = defineScenario<ShellFacts>({ id: 'shell', collect, checks });
