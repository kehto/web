/**
 * scenarios/nip5d-wire.ts — NIP-5D checks about the bound port: identity binding,
 * document replacement, unknown and malformed traffic, and readiness independence.
 *
 * Authority: NIP-5D (nostr-protocol/nips#2303) and NAP-SHELL at the refs in `authority.ts`.
 */
import { fail, pass, skip, type CheckOutcome, type TranscriptEntry } from '../model.js';
import { WIRE_HANDLE } from '../probe/artifact.js';
import type { ProbeStep } from '../probe/plan.js';
import { anchorSteps, defineScenario, runProbe, step, value, type Check, type CollectContext } from '../scenario.js';
import type { FrameEvidence, RevocationEvidence } from '../target.js';

interface ReplacementFacts {
  readonly trigger: string;
  /** Kehto's label for the trigger; diagnostic only, NIP-5D defines no reason vocabulary. */
  readonly expectedReason: string;
  /** The port answered a request before the trigger. */
  readonly liveBefore: boolean;
  readonly revocation: RevocationEvidence | null;
  /** Whether the runtime still holds an identity for the endpoint afterwards. */
  readonly stillBound: boolean;
}

interface QuietFacts {
  readonly sent: readonly unknown[];
  /** Everything the napplet received during the quiet window after sending. */
  readonly received: readonly unknown[];
  /** The binding still answered a valid request afterwards. */
  readonly aliveAfter: boolean;
  readonly revoked: boolean;
}

interface WireFacts {
  readonly anchor: string | null;
  readonly shellPresent: boolean;
  readonly forged: { readonly before: FrameEvidence['boundIdentity']; readonly after: FrameEvidence['boundIdentity']; readonly verifiedHash: string; readonly dTag: string; readonly answered: boolean } | null;
  readonly rogue: { readonly completed: boolean; readonly received: readonly unknown[]; readonly dispatched: readonly TranscriptEntry[] } | null;
  readonly replacements: readonly ReplacementFacts[];
  readonly unknown: QuietFacts | null;
  readonly malformed: QuietFacts | null;
  readonly readiness: {
    /** Shell absent: the anchor answered and no `shell.*` message crossed the wire. */
    readonly absent?: { readonly answered: boolean; readonly shellTraffic: readonly unknown[] };
    /** `shell.ready` withheld: the anchor answered before any readiness signal left. */
    readonly beforeReady?: { readonly answered: boolean; readonly initBeforeRelease: boolean; readonly initAfterRelease: boolean };
    /** `shell.init` withheld: the anchor answered while `ready()` was still pending. */
    readonly duringWithheld?: { readonly answered: boolean; readonly readyStateWhileWithheld: string | undefined; readonly readyFinal: string | undefined };
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

async function waitRevocation(context: CollectContext, endpoint: string): Promise<RevocationEvidence | null> {
  const deadline = Date.now() + context.timeoutMs;
  for (;;) {
    const found = context.session.revocations().find((entry) => entry.endpoint === endpoint);
    if (found || Date.now() > deadline) return found ?? null;
    await sleep(15);
  }
}

async function replacement(context: CollectContext, trigger: string, expectedReason: string, steps: readonly ProbeStep[]): Promise<ReplacementFacts> {
  const anchor = context.anchor!;
  const endpoint = await context.session.loadProbe({
    plan: {
      label: `replace-${trigger}`, timeoutMs: context.timeoutMs,
      steps: [...anchorSteps(anchor, 'pre', 'pre'), { op: 'mark', name: 'live' }, ...steps, { op: 'sleep', ms: context.timeoutMs }],
    },
    dTag: `probe-replace-${trigger}`, grants: [anchor.domain], optional: [anchor.domain], rawWire: true,
  });
  const liveBefore = await endpoint.waitMark('live', context.timeoutMs * 2);
  const revocation = await waitRevocation(context, endpoint.id);
  return { trigger, expectedReason, liveBefore, revocation, stillBound: endpoint.evidence().boundIdentity !== null };
}

async function quietAfter(context: CollectContext, label: string, sent: readonly unknown[]): Promise<QuietFacts> {
  const anchor = context.anchor!;
  const { endpoint, report } = await runProbe(context, {
    plan: {
      label,
      steps: [
        ...anchorSteps(anchor, 'pre', 'pre'),
        ...sent.map((envelope): ProbeStep => ({ op: 'send', envelope })),
        { op: 'quiet', as: 'quiet', ms: context.settleMs * 2 },
        ...anchorSteps(anchor, 'post', 'post'),
      ],
    },
    dTag: `probe-${label}`, grants: [anchor.domain], rawWire: true,
  });
  return {
    sent,
    received: value<unknown[]>(report, 'quiet') ?? [],
    aliveAfter: step(report, 'post')?.state === 'value',
    revoked: context.session.revocations().some((entry) => entry.endpoint === endpoint.id),
  };
}

async function collectReadiness(context: CollectContext): Promise<WireFacts['readiness']> {
  const anchor = context.anchor!;
  if (context.variant.shell === 'shell-absent') {
    const { endpoint, report } = await runProbe(context, {
      plan: { label: 'ready-absent', steps: [...anchorSteps(anchor, 'r1', 'reply'), { op: 'quiet', as: 'quiet' }] },
      dTag: 'probe-ready-absent', grants: [anchor.domain], rawWire: true,
    });
    const shellTraffic = context.session.transcript()
      .filter((entry) => entry.endpoint === endpoint.id && String((entry.envelope as { type?: unknown } | null)?.type).startsWith('shell.'))
      .map((entry) => entry.envelope);
    return { absent: { answered: step(report, 'reply')?.state === 'value', shellTraffic } };
  }
  const grants = ['shell', anchor.domain];
  const release = (direction: string): ProbeStep => ({ op: 'call', as: `release-${direction}`, root: 'window', path: [WIRE_HANDLE, 'release'], args: [direction] });
  const before = await runProbe(context, {
    plan: {
      label: 'ready-before',
      steps: [
        ...anchorSteps(anchor, 'r1', 'reply'),
        { op: 'quiet', as: 'quiet' },
        release('outbound'),
        { op: 'expect', as: 'init', match: { type: 'shell.init' } },
      ],
    },
    dTag: 'probe-ready-before', grants, rawWire: true, hold: { outbound: ['shell.ready'] },
  });
  const during = await runProbe(context, {
    plan: {
      label: 'ready-withheld',
      steps: [
        { op: 'call', as: 'ready', path: ['shell', 'ready'], background: true },
        ...anchorSteps(anchor, 'r1', 'reply'),
        { op: 'quiet', as: 'quiet' },
        { op: 'call', as: 'pendingProbe', path: ['shell', 'ready'], timeoutMs: context.settleMs },
        release('inbound'),
        { op: 'sleep', ms: context.settleMs },
      ],
    },
    dTag: 'probe-ready-withheld', grants, rawWire: true, hold: { inbound: ['shell.init'] },
  });
  const quietBefore = value<Array<{ type?: string }>>(before.report, 'quiet') ?? [];
  return {
    beforeReady: {
      answered: step(before.report, 'reply')?.state === 'value',
      initBeforeRelease: quietBefore.some((message) => message?.type === 'shell.init'),
      initAfterRelease: step(before.report, 'init')?.state === 'value',
    },
    duringWithheld: {
      answered: step(during.report, 'reply')?.state === 'value',
      readyStateWhileWithheld: step(during.report, 'pendingProbe')?.state,
      readyFinal: step(during.report, 'ready')?.state,
    },
  };
}

async function collect(context: CollectContext): Promise<WireFacts> {
  const { anchor } = context;
  const shellPresent = context.variant.shell === 'shell-present';
  if (!anchor) {
    return { anchor: null, shellPresent, forged: null, rogue: null, replacements: [], unknown: null, malformed: null, readiness: {} };
  }
  const claims = { dTag: 'forged-identity', aggregateHash: 'f'.repeat(64), pubkey: 'e'.repeat(64), windowId: 'ep-1', identity: { dTag: 'forged-identity' } };
  const forgedProbe = await context.session.loadProbe({
    plan: {
      label: 'forged-claims', timeoutMs: context.timeoutMs,
      steps: [
        { op: 'mark', name: 'loaded' },
        { op: 'waitSignal', name: 'go' },
        { op: 'send', envelope: { ...anchor.request('f1'), ...claims } },
        { op: 'expect', as: 'reply', match: { type: anchor.resultType, id: 'f1' } },
        { op: 'send', envelope: { type: 'shell.ready', ...claims } },
        { op: 'sleep', ms: context.settleMs },
      ],
    },
    dTag: 'probe-forged-claims', grants: [anchor.domain], optional: [anchor.domain], rawWire: true,
  });
  await forgedProbe.waitMark('loaded', context.timeoutMs * 2);
  // Any first envelope binds the session; read identity after one has been processed.
  forgedProbe.signal('go');
  const forgedReport = await forgedProbe.report(context.timeoutMs * 6);
  const after = forgedProbe.evidence();
  const rogue = await context.session.loadRogue({
    label: 'rogue', timeoutMs: context.timeoutMs, settleMs: context.settleMs,
    steps: [
      { op: 'send', envelope: { type: 'shell.ready' } },
      { op: 'send', envelope: anchor.request('rogue-1') },
      { op: 'quiet', as: 'quiet', ms: context.settleMs * 3 },
    ],
  });
  const hello = { type: 'napplet.hello' };
  return {
    anchor: anchor.domain,
    shellPresent,
    forged: {
      before: { dTag: 'probe-forged-claims', artifactHash: after.verifiedHash },
      after: after.boundIdentity,
      verifiedHash: after.verifiedHash,
      dTag: 'probe-forged-claims',
      answered: step(forgedReport, 'reply')?.state === 'value',
    },
    rogue: { completed: rogue.report?.completed === true, received: value<unknown[]>(rogue.report, 'quiet') ?? [], dispatched: rogue.dispatched },
    replacements: [
      await replacement(context, 'second-hello', 'second-hello', [{ op: 'windowPost', message: hello, withPort: true }]),
      await replacement(context, 'window-message', 'window-message', [{ op: 'windowPost', message: anchor.request('w1') }]),
      await replacement(context, 'navigation', 'second-load', [{ op: 'call', as: 'navigate', root: 'window', path: ['location', 'replace'], args: ['about:blank'] }]),
    ],
    unknown: await quietAfter(context, 'unknown-envelope', [
      { type: 'conformance-nosuch.action', id: 'u1' },
      { type: `${anchor.domain}.conformanceNoSuchAction`, id: 'u2' },
      { type: 'unqualified', id: 'u3' },
    ]),
    malformed: await quietAfter(context, 'plain-object-wire', [
      ['REQ', 'legacy-sub', { kinds: [1] }],
      ['EVENT', { kind: 1, content: 'legacy', tags: [], created_at: 0 }],
      ['CLOSE', 'legacy-sub'],
      'theme.get',
      42,
      null,
      { id: 'no-type' },
      { type: 7, id: 'numeric-type' },
      [anchor.request('array-wrapped')],
    ]),
    readiness: await collectReadiness(context),
  };
}

const NO_ANCHOR = skip('No working non-shell domain is advertised in this variant');

function sourceBinding(facts: WireFacts): CheckOutcome {
  if (!facts.forged || !facts.rogue) return NO_ANCHOR;
  const { forged, rogue } = facts;
  if (!forged.answered) return fail('A registered endpoint got no reply to a valid request', { forged });
  if (forged.after?.artifactHash !== forged.verifiedHash || forged.after.dTag !== forged.dTag) {
    return fail('Identity claims in a request payload or readiness message changed the bound identity', { forged });
  }
  if (rogue.received.length > 0 || rogue.dispatched.length > 0) {
    return fail('A frame the runtime never created was serviced after its own napplet.hello', { rogue });
  }
  if (!rogue.completed) return fail('The unregistered-source probe did not finish, so silence is unproven', { rogue });
  return pass('Identity comes from verified bytes; payload claims are ignored and an unmapped source is dropped', { bound: forged.after });
}

function portBinding(facts: WireFacts): CheckOutcome {
  if (facts.replacements.length === 0) return NO_ANCHOR;
  for (const item of facts.replacements) {
    if (!item.liveBefore) return fail(`The port was not live before the ${item.trigger} trigger`, item);
    if (!item.revocation) return fail(`The binding survived ${item.trigger}`, item);
    if (!item.revocation.frameRemoved) return fail(`The frame was not removed after ${item.trigger}`, item);
    if (item.stillBound) return fail(`An identity is still bound after ${item.trigger}`, item);
  }
  // NIP-5D (Identity) names the evidence and the teardown, not a reason vocabulary:
  // the target's reason label is reported in diagnostics only.
  return pass('A second hello, a window-level message and a navigation each revoke the binding and remove the frame', facts.replacements);
}

function quietCheck(label: string, facts: QuietFacts | null): CheckOutcome {
  if (!facts) return NO_ANCHOR;
  if (facts.received.length > 0) return fail(`${label} produced an observable reply`, { sent: facts.sent, received: facts.received });
  if (facts.revoked) return fail(`${label} revoked the binding instead of being ignored`, { sent: facts.sent });
  if (!facts.aliveAfter) return fail(`The port stopped answering valid requests after ${label}`, { sent: facts.sent });
  return pass(`${label} is silently ignored and the binding keeps working`, { sent: facts.sent.length });
}

function readinessIndependent(facts: WireFacts): CheckOutcome {
  if (!facts.anchor) return NO_ANCHOR;
  const { absent, beforeReady, duringWithheld } = facts.readiness;
  if (absent) {
    if (!absent.answered) return fail('With shell absent, a granted domain did not answer', absent);
    if (absent.shellTraffic.length) return fail('With shell absent, shell.* traffic still crossed the wire', absent);
    return pass(`With shell absent, ${facts.anchor} answered with no readiness exchange at all`, absent);
  }
  if (!beforeReady || !duringWithheld) return fail('Readiness evidence was not collected');
  const diagnostics = { beforeReady, duringWithheld };
  if (!beforeReady.answered) return fail(`${facts.anchor} did not answer before shell.ready was sent`, diagnostics);
  if (beforeReady.initBeforeRelease) return fail('shell.init arrived before any shell.ready was sent', diagnostics);
  if (!beforeReady.initAfterRelease) return fail('shell.init never arrived once shell.ready was released', diagnostics);
  if (!duringWithheld.answered) return fail(`${facts.anchor} did not answer while shell.init was withheld`, diagnostics);
  if (duringWithheld.readyStateWhileWithheld !== 'pending') return fail('ready() settled while shell.init was withheld', diagnostics);
  if (duringWithheld.readyFinal !== 'resolved') return fail('ready() did not resolve once shell.init was delivered', diagnostics);
  return pass(`${facts.anchor} answered before shell.ready and while shell.init was withheld`, diagnostics);
}

const authority = ['nip5d'] as const;
const checks: readonly Check<WireFacts>[] = [
  { id: 'nip5d/source-binding', title: 'Identity is bound to the verified source, never to payload claims', scope: 'nip5d-core', severity: 'error', authority, evaluate: sourceBinding },
  { id: 'nip5d/port-binding', title: 'Evidence of document replacement revokes the port binding', scope: 'nip5d-core', severity: 'error', authority, evaluate: portBinding },
  { id: 'nip5d/unknown-envelope', title: 'Unknown domain.action types are silently ignored', scope: 'nip5d-core', severity: 'error', authority, evaluate: (facts) => quietCheck('An unknown envelope type', facts.unknown) },
  { id: 'nip5d/plain-object-wire', title: 'Legacy arrays and malformed envelopes are not an active path', scope: 'nip5d-core', severity: 'error', authority, evaluate: (facts) => quietCheck('Legacy or malformed wire traffic', facts.malformed) },
  { id: 'nip5d/readiness-independent', title: 'Granted domains work before, during and without shell readiness', scope: 'nip5d-core', severity: 'error', authority: ['nip5d', 'nap-shell'], evaluate: readinessIndependent },
];

/** NIP-5D port and wire checks. */
export const NIP5D_WIRE_SCENARIO = defineScenario<WireFacts>({ id: 'nip5d-wire', collect, checks });
