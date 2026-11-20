/**
 * scenarios/inc.ts — NAP-INC across several real endpoints: opaque endpoint
 * identifiers, sender exclusion, topic routing, unsubscribe, channel
 * lifecycle and cleanup on endpoint destruction.
 *
 * Authority: NAP-INC at the `napplet/naps` master ref in `authority.ts`.
 */
import { fail, pass, skip, type CheckOutcome, type TranscriptEntry } from '../model.js';
import type { ProbeReport, ProbeStep } from '../probe/plan.js';
import { defineScenario, step, type Check, type CollectContext } from '../scenario.js';
import type { ProbeEndpoint, ProbeSpec } from '../target.js';

const TOPIC = 'napplet:conformance/inc';
const PEERS = 'napplet:conformance/peers';
type Envelope = Readonly<Record<string, unknown>>;

/** Topic-phase endpoints: two publishers share a d tag, one root manifest, two instances of one artifact. */
const TOPIC_ENDPOINTS = [
  { label: 'A', dTag: 'probe-inc-a', publisher: 'primary' },
  { label: 'B', dTag: 'probe-inc-b', publisher: 'primary' },
  { label: 'C', dTag: 'probe-inc-a', publisher: 'secondary' },
  { label: 'D', dTag: 'probe-inc-root', publisher: 'primary', manifestKind: 15129 },
  { label: 'E', dTag: 'probe-inc-e', publisher: 'primary' },
  { label: 'E', dTag: 'probe-inc-e', publisher: 'primary' },
] as const;

interface Loaded {
  readonly name: string;
  readonly label: string;
  readonly dTag: string;
  readonly endpoint: ProbeEndpoint;
  report: ProbeReport | null;
  hostId?: string;
}

interface IncFacts {
  readonly topics: readonly Loaded[];
  readonly channels: Readonly<Record<'X' | 'Y' | 'Z' | 'Y2', Loaded>>;
  /** E2's endpoint id and host transcript after it was destroyed. */
  readonly destroyed: { readonly id: string; readonly after: readonly TranscriptEntry[] };
  readonly transcript: readonly TranscriptEntry[];
}

const expectEvent = (as: string, label: string, timeoutMs?: number): ProbeStep => ({
  op: 'expect', as, match: { type: 'inc.event', topic: TOPIC, payload: { label } }, ...(timeoutMs ? { timeoutMs } : {}),
});

function topicPlan(label: string, settleMs: number): ProbeStep[] {
  const others = ['A', 'B', 'C', 'D'].filter((other) => other !== label);
  const steps: ProbeStep[] = [
    { op: 'send', envelope: { type: 'inc.subscribe', id: 'sub', topic: TOPIC } },
    { op: 'expect', as: 'sub', match: { id: 'sub' } },
    { op: 'mark', name: 'sub' },
    { op: 'waitSignal', name: 'emit' },
    { op: 'send', envelope: { type: 'inc.emit', topic: TOPIC, payload: { label }, sender: `forged-${label}` } },
    ...others.map((other) => expectEvent(`ev:${other}`, other)),
    expectEvent('ev:E1', 'E'),
    label === 'E' ? expectEvent('self', 'E', settleMs * 2) : expectEvent('ev:E2', 'E'),
    ...(label === 'E' ? [] : [expectEvent('self', label, settleMs * 2)]),
    { op: 'mark', name: 'round' },
    { op: 'waitSignal', name: 'round2' },
  ];
  if (label === 'B') steps.push({ op: 'send', envelope: { type: 'inc.unsubscribe', topic: TOPIC } }, { op: 'sleep', ms: settleMs });
  steps.push({ op: 'mark', name: 'ready2' }, { op: 'waitSignal', name: 'emit2' });
  if (label === 'A') steps.push({ op: 'send', envelope: { type: 'inc.emit', topic: TOPIC, payload: { label: 'A2' } } });
  if (label !== 'A') steps.push(expectEvent('ev:A2', 'A2', label === 'B' ? settleMs * 3 : undefined));
  return steps;
}

const peerEmit = (label: string): ProbeStep => ({ op: 'send', envelope: { type: 'inc.emit', topic: PEERS, payload: { label } } });
const peerExpect = (as: string, label: string): ProbeStep => ({ op: 'expect', as, match: { type: 'inc.event', topic: PEERS, payload: { label } } });
const fillFrom = (as: string, ...path: string[]) => ({ as, path });

function openerPlan(settleMs: number): ProbeStep[] {
  return [
    { op: 'send', envelope: { type: 'inc.subscribe', id: 'sub', topic: PEERS } },
    { op: 'expect', as: 'sub', match: { id: 'sub' } },
    { op: 'mark', name: 'sub' },
    peerExpect('evY', 'Y'),
    peerExpect('evZ', 'Z'),
    { op: 'send', envelope: { type: 'inc.channel.open', id: 'open-y' }, fill: { target: fillFrom('evY', 'sender') } },
    { op: 'expect', as: 'openY', match: { id: 'open-y' } },
    { op: 'send', envelope: { type: 'inc.channel.emit', payload: { m: 'direct' } }, fill: { channelId: fillFrom('openY', 'channelId') } },
    { op: 'send', envelope: { type: 'inc.channel.list', id: 'list' } },
    { op: 'expect', as: 'list', match: { id: 'list' } },
    { op: 'send', envelope: { type: 'inc.channel.broadcast', payload: { m: 'broadcast' } } },
    { op: 'expect', as: 'selfEcho', match: { type: 'inc.channel.event' }, timeoutMs: settleMs * 2 },
    { op: 'send', envelope: { type: 'inc.channel.open', id: 'open-z' }, fill: { target: fillFrom('evZ', 'sender') } },
    { op: 'expect', as: 'openZ', match: { id: 'open-z' } },
    { op: 'send', envelope: { type: 'inc.channel.close' }, fill: { channelId: fillFrom('openZ', 'channelId') } },
    { op: 'expect', as: 'closedZ', match: { type: 'inc.channel.closed' } },
    { op: 'mark', name: 'pre-destroy' },
    { op: 'waitSignal', name: 'destroyed' },
    { op: 'expect', as: 'closedY', match: { type: 'inc.channel.closed', reason: 'peer destroyed' } },
    { op: 'mark', name: 'pre-replace' },
    { op: 'waitSignal', name: 'replaced' },
    peerExpect('evY2', 'Y'),
    { op: 'send', envelope: { type: 'inc.channel.emit', payload: { m: 'stale' } }, fill: { channelId: fillFrom('openY', 'channelId') } },
    { op: 'send', envelope: { type: 'inc.channel.open', id: 'open-y2' }, fill: { target: fillFrom('evY2', 'sender') } },
    { op: 'expect', as: 'openY2', match: { id: 'open-y2' } },
  ];
}

/** One plan for Y and its replacement Y2: the same artifact, so the same identity. */
function targetPlan(settleMs: number, timeoutMs: number): ProbeStep[] {
  return [
    { op: 'waitSignal', name: 'go' },
    peerEmit('Y'),
    { op: 'expect', as: 'opened', match: { type: 'inc.channel.opened' } },
    // For the replacement, stale traffic (if wrongly delivered) arrives before its own opened.
    { op: 'expect', as: 'stale', match: { type: 'inc.channel.event', payload: { m: 'stale' } }, timeoutMs: settleMs * 3 },
    { op: 'expect', as: 'direct', match: { type: 'inc.channel.event', payload: { m: 'direct' } }, timeoutMs },
    { op: 'expect', as: 'bcast', match: { type: 'inc.channel.event', payload: { m: 'broadcast' } }, timeoutMs },
  ];
}

function closerPlan(): ProbeStep[] {
  return [
    { op: 'waitSignal', name: 'go' },
    peerEmit('Z'),
    { op: 'expect', as: 'opened', match: { type: 'inc.channel.opened' } },
    { op: 'expect', as: 'closed', match: { type: 'inc.channel.closed' } },
  ];
}

async function load(context: CollectContext, name: string, label: string, steps: ProbeStep[], spec: Partial<ProbeSpec> & { dTag: string }): Promise<Loaded> {
  const endpoint = await context.session.loadProbe({
    plan: { label: `inc-${label}`, steps, timeoutMs: context.timeoutMs * 3, settleMs: context.settleMs },
    grants: ['inc'], optional: ['inc'], rawWire: true, ...spec,
  });
  const loaded: Loaded = { name, label, dTag: spec.dTag, endpoint, report: null };
  loaded.hostId = endpoint.evidence().endpointId;
  return loaded;
}

async function waitAll(items: readonly Loaded[], mark: string, timeoutMs: number): Promise<void> {
  await Promise.all(items.map((item) => item.endpoint.waitMark(mark, timeoutMs)));
}

async function collectTopics(context: CollectContext): Promise<{ topics: Loaded[]; destroyed: IncFacts['destroyed'] }> {
  const wait = context.timeoutMs * 6;
  const topics: Loaded[] = [];
  for (const [index, item] of TOPIC_ENDPOINTS.entries()) {
    const spec = { dTag: item.dTag, publisher: item.publisher, ...('manifestKind' in item ? { manifestKind: item.manifestKind } : {}) };
    topics.push(await load(context, item.label === 'E' ? `E${index - 3}` : item.label, item.label, topicPlan(item.label, context.settleMs), spec));
  }
  await waitAll(topics, 'sub', wait);
  for (const item of topics) item.endpoint.signal('emit');
  await waitAll(topics, 'round', wait);
  const e2 = topics.find((item) => item.name === 'E2') as Loaded;
  await context.session.destroyEndpoint(e2.endpoint.id);
  const destroyedAt = context.session.transcript().length;
  const live = topics.filter((item) => item !== e2);
  for (const item of live) item.endpoint.signal('round2');
  await waitAll(live, 'ready2', wait);
  for (const item of live) item.endpoint.signal('emit2');
  await Promise.all(live.map(async (item) => { item.report = await item.endpoint.report(wait); }));
  const after = context.session.transcript().slice(destroyedAt).filter((entry) => entry.endpoint === e2.endpoint.id && entry.direction === 'runtime->napplet');
  for (const item of live) await context.session.destroyEndpoint(item.endpoint.id);
  return { topics, destroyed: { id: e2.hostId ?? e2.endpoint.id, after } };
}

async function collectChannels(context: CollectContext): Promise<IncFacts['channels']> {
  const wait = context.timeoutMs * 6;
  const x = await load(context, 'X', 'X', openerPlan(context.settleMs), { dTag: 'probe-inc-x' });
  const y = await load(context, 'Y', 'Y', targetPlan(context.settleMs, context.timeoutMs), { dTag: 'probe-inc-y' });
  const z = await load(context, 'Z', 'Z', closerPlan(), { dTag: 'probe-inc-z' });
  await x.endpoint.waitMark('sub', wait);
  y.endpoint.signal('go');
  z.endpoint.signal('go');
  [y.report, z.report] = await Promise.all([y.endpoint.report(wait), z.endpoint.report(wait)]);
  await x.endpoint.waitMark('pre-destroy', wait);
  await context.session.destroyEndpoint(y.endpoint.id);
  x.endpoint.signal('destroyed');
  await x.endpoint.waitMark('pre-replace', wait);
  const y2 = await load(context, 'Y2', 'Y', targetPlan(context.settleMs, context.timeoutMs), { dTag: 'probe-inc-y' });
  y2.endpoint.signal('go');
  x.endpoint.signal('replaced');
  [x.report, y2.report] = await Promise.all([x.endpoint.report(wait), y2.endpoint.report(wait)]);
  for (const item of [x, z, y2]) await context.session.destroyEndpoint(item.endpoint.id);
  return { X: x, Y: y, Z: z, Y2: y2 };
}

async function collect(context: CollectContext): Promise<IncFacts | null> {
  if (!context.advertised.domains.includes('inc')) return null;
  if (context.domains.length && !context.domains.includes('inc')) return null;
  const { topics, destroyed } = await collectTopics(context);
  const channels = await collectChannels(context);
  return { topics, channels, destroyed, transcript: context.session.transcript() };
}

const got = (loaded: Loaded, as: string): Envelope | null => {
  const record = step(loaded.report, as);
  return record?.state === 'value' ? record.value as Envelope : null;
};

/** The sender every observer saw for each emitting endpoint, by name. */
function observedSenders(facts: IncFacts): { byName: Record<string, string[]>; missing: string[] } {
  const byName: Record<string, string[]> = {};
  const missing: string[] = [];
  for (const observer of facts.topics.filter((item) => item.report)) {
    const pairs: [string, string][] = [['A', 'ev:A'], ['B', 'ev:B'], ['C', 'ev:C'], ['D', 'ev:D'], ['E*', 'ev:E1'], ['E*', 'ev:E2']];
    for (const [name, as] of pairs) {
      if (name === observer.label || (observer.label === 'E' && as === 'ev:E2')) continue;
      const sender = got(observer, as)?.sender;
      if (typeof sender === 'string') (byName[name] ??= []).push(sender);
      else missing.push(`${observer.name} got no ${as}`);
    }
  }
  return { byName, missing };
}

const NOT_RUN = skip('inc is not advertised or is outside the --domain filter');

function unfinished(facts: IncFacts): string[] {
  const live = [...facts.topics.filter((item) => item.name !== 'E2'), ...Object.values(facts.channels)];
  return live.filter((item) => !item.report?.completed).map((item) => item.name);
}

function endpointIdentity(facts: IncFacts | null): CheckOutcome {
  if (!facts) return NOT_RUN;
  if (unfinished(facts).length) return fail(`INC probes did not finish: ${unfinished(facts).join(', ')}`);
  const { byName, missing } = observedSenders(facts);
  const hostIds = Object.fromEntries(facts.topics.map((item) => [item.name, item.hostId]));
  const diagnostics = { observed: byName, hostIds, missing, replacement: { Y: facts.channels.Y.hostId, Y2: facts.channels.Y2.hostId } };
  if (missing.length) return fail('Some endpoints never saw another endpoint\'s event, so identifiers are unproven', diagnostics);
  for (const [name, seen] of Object.entries(byName)) {
    if (name !== 'E*' && new Set(seen).size !== 1) return fail(`Observers disagree on the sender identifier of ${name}`, diagnostics);
  }
  const ids = facts.topics.map((item) => item.hostId);
  if (ids.some((id) => !id)) return fail('The runtime exposes no INC endpoint identifier for a live endpoint', diagnostics);
  if (new Set(ids).size !== ids.length) return fail('Two endpoints share an INC identifier (publishers, root manifests or simultaneous instances are aliased)', diagnostics);
  for (const item of facts.topics.filter((entry) => entry.label !== 'E')) {
    if (byName[item.label]?.[0] !== item.hostId) return fail(`${item.name}'s delivered sender differs from its runtime endpoint identifier`, diagnostics);
  }
  const eSeen = new Set(byName['E*']);
  if (eSeen.size !== 2) return fail('The two simultaneous instances of one artifact were not delivered under two distinct identifiers', diagnostics);
  const dTags = new Set(facts.topics.map((item) => item.dTag));
  const leaked = Object.values(byName).flat().filter((id) => dTags.has(id) || id.startsWith('forged-'));
  if (leaked.length) return fail(`Delivered senders are manifest d tags or caller-supplied values: ${[...new Set(leaked)].join(', ')}`, diagnostics);
  const { Y, Y2 } = facts.channels;
  const channelIds = [facts.channels.X.hostId, Y.hostId, facts.channels.Z.hostId];
  if (!Y2.hostId || channelIds.includes(Y2.hostId) || ids.includes(Y2.hostId)) return fail('A replacement endpoint reused an earlier endpoint identifier', diagnostics);
  return pass('Senders are opaque, runtime-assigned, distinct per publisher, manifest and instance, never d tags, and not reused', diagnostics);
}

function senderExclusion(facts: IncFacts | null): CheckOutcome {
  if (!facts) return NOT_RUN;
  if (unfinished(facts).length) return fail(`INC probes did not finish: ${unfinished(facts).join(', ')}`);
  const echoed = facts.topics.filter((item) => item.report && got(item, 'self') !== null).map((item) => item.name);
  const echo = got(facts.channels.X, 'selfEcho');
  if (echoed.length) return fail(`inc.event was delivered back to its emitter: ${echoed.join(', ')}`, { echoed });
  if (echo) return fail('inc.channel.broadcast was delivered back to the sender', { echo });
  return pass('No emitter received its own inc.event, and broadcast excluded the sender');
}

function topicRouting(facts: IncFacts | null): CheckOutcome {
  if (!facts) return NOT_RUN;
  if (unfinished(facts).length) return fail(`INC probes did not finish: ${unfinished(facts).join(', ')}`);
  const live = facts.topics.filter((item) => item.name !== 'E2');
  const unsubscribed = live.find((item) => item.label === 'B') as Loaded;
  const subscribed = live.filter((item) => item.label !== 'A' && item.label !== 'B');
  const subs = live.map((item) => ({ name: item.name, reply: got(item, 'sub') }));
  const diagnostics = { subs, a2: Object.fromEntries(live.filter((item) => item.label !== 'A').map((item) => [item.name, got(item, 'ev:A2')])), cleanup: facts.destroyed };
  const badSub = subs.find((item) => item.reply?.type !== 'inc.subscribe.result' || item.reply.error !== undefined);
  if (badSub) return fail(`inc.subscribe from ${badSub.name} did not get a correlated inc.subscribe.result`, diagnostics);
  const missed = subscribed.filter((item) => got(item, 'ev:A2') === null).map((item) => item.name);
  if (missed.length) return fail(`Subscribers missed an event on the exact topic: ${missed.join(', ')}`, diagnostics);
  if (got(unsubscribed, 'ev:A2') !== null) return fail('inc.unsubscribe did not remove the subscription', diagnostics);
  if (facts.destroyed.after.length) return fail('The runtime still delivered to a destroyed endpoint\'s subscription', diagnostics);
  return pass('Events reach exact-topic subscribers, unsubscribe is honored, and destroyed endpoints get nothing', { subscribers: subscribed.length });
}

function seqOf(transcript: readonly TranscriptEntry[], endpoint: string, match: (envelope: Envelope) => boolean): number {
  return transcript.find((entry) => entry.tap === 'host' && entry.endpoint === endpoint && entry.direction === 'runtime->napplet' && match(entry.envelope as Envelope))?.seq ?? -1;
}

function channelLifecycle(facts: IncFacts | null): CheckOutcome {
  if (!facts) return NOT_RUN;
  const { X, Y, Z, Y2 } = facts.channels;
  if (unfinished(facts).length) return fail(`INC probes did not finish: ${unfinished(facts).join(', ')}`);
  if (!got(Y2, 'opened')) return fail('The replacement endpoint never received its own channel, so stale delivery is unproven');
  const openY = got(X, 'openY');
  const opened = got(Y, 'opened');
  const list = got(X, 'list');
  const diagnostics = {
    openY, opened, list, direct: got(Y, 'direct'), bcast: got(Y, 'bcast'), openZ: got(X, 'openZ'), closedZ: got(X, 'closedZ'),
    zClosed: got(Z, 'closed'), closedY: got(X, 'closedY'), stale: got(Y2, 'stale'), openY2: got(X, 'openY2'),
    ids: { X: X.hostId, Y: Y.hostId, Z: Z.hostId, Y2: Y2.hostId },
  };
  const channelId = openY?.channelId;
  if (typeof channelId !== 'string' || openY?.peer !== Y.hostId) return fail('inc.channel.open.result lacks a channelId or reports the wrong peer', diagnostics);
  if (opened?.channelId !== channelId || opened.peer !== X.hostId) return fail('inc.channel.opened at the target does not match the channel or the opener', diagnostics);
  const openedSeq = seqOf(facts.transcript, Y.endpoint.id, (envelope) => envelope.type === 'inc.channel.opened');
  const resultSeq = seqOf(facts.transcript, X.endpoint.id, (envelope) => envelope.type === 'inc.channel.open.result' && envelope.id === 'open-y');
  if (openedSeq < 0 || resultSeq < 0 || openedSeq > resultSeq) return fail('inc.channel.opened was not enqueued before the successful inc.channel.open.result', { ...diagnostics, openedSeq, resultSeq });
  if (diagnostics.direct?.sender !== X.hostId || diagnostics.direct?.channelId !== channelId) return fail('inc.channel.emit was not delivered to the peer as inc.channel.event from the opener', diagnostics);
  const channels = Array.isArray(list?.channels) ? list.channels as Envelope[] : [];
  if (!channels.some((item) => item.id === channelId && item.peer === Y.hostId)) return fail('inc.channel.list does not list the open channel with its peer', diagnostics);
  if (!diagnostics.bcast) return fail('inc.channel.broadcast did not reach the open channel peer', diagnostics);
  if (!diagnostics.closedZ || !diagnostics.zClosed) return fail('inc.channel.close did not notify both endpoints', diagnostics);
  if (diagnostics.closedY?.channelId !== channelId) return fail('Destroying the peer did not close the channel with reason "peer destroyed"', diagnostics);
  if (diagnostics.stale) return fail('A replacement endpoint received traffic on a channel opened to its predecessor', diagnostics);
  if (typeof diagnostics.openY2?.channelId !== 'string' || diagnostics.openY2.channelId === channelId) return fail('The replacement endpoint did not get a new channel', diagnostics);
  return pass('Channels open, deliver, list, broadcast, close, clean up on peer destruction and never survive replacement', diagnostics);
}

const authority = ['nap-inc'] as const;
const checks: readonly Check<IncFacts | null>[] = [
  { id: 'inc/endpoint-identity', title: 'INC identifiers are opaque runtime endpoint ids, never d tags or reused', scope: 'nap-spec', severity: 'error', domain: 'inc', authority, evaluate: endpointIdentity },
  { id: 'inc/sender-exclusion', title: 'Emitters never receive their own inc.event or broadcast', scope: 'nap-spec', severity: 'error', domain: 'inc', authority, evaluate: senderExclusion },
  { id: 'inc/topic-routing', title: 'Exact-topic routing, unsubscribe and destroyed-endpoint cleanup', scope: 'nap-spec', severity: 'error', domain: 'inc', authority, evaluate: topicRouting },
  { id: 'inc/channel-lifecycle', title: 'Channel open, delivery, list, broadcast, close and teardown', scope: 'nap-spec', severity: 'error', domain: 'inc', authority, evaluate: channelLifecycle },
];

/** Multi-endpoint NAP-INC semantics. */
export const INC_SCENARIO = defineScenario<IncFacts | null>({ id: 'inc', collect, checks });

