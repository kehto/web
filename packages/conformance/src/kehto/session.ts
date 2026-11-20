/**
 * kehto/session.ts — One booted variant of the first-party Kehto target.
 *
 * Probes are loaded the way a Kehto host loads a napplet: a signed manifest is
 * verified, the artifact hash is computed from its bytes, and
 * `admitBrowserDocument` produces the CSP and namespace prelude and commits the
 * `srcdoc` after the frame's identity is registered.
 */
import {
  admitBrowserDocument,
  createShellBridge,
  originRegistry,
  resolveShellEnvironment,
  type NappletMessage,
  type OriginIdentity,
  type SessionEntry,
  type ShellAdapter,
  type ShellBridge,
} from '@kehto/shell';
import type { TranscriptEntry, WireDirection } from '../model.js';
import { renderProbeArtifact, renderWireTap } from '../probe/artifact.js';
import type { ProbePlan } from '../probe/plan.js';
import type {
  FrameEvidence, ProbeEndpoint, ProbeRejection, ProbeSpec, RevocationEvidence, RogueEvidence, TargetSession, TargetVariant,
} from '../target.js';
import { createBackends, type Backends } from './backends.js';
import { createProbeStage, type ProbeChannel, type ProbeStage } from './frames.js';
import { publishAndVerifyProbe } from './manifest.js';
import type { KehtoTamper } from './tamper.js';

const PRELUDE_MARKER = '<script data-kehto-nip5d-injection>';

/** Shared, mutable state of one session. */
interface SessionState {
  readonly variant: TargetVariant;
  readonly tamper: KehtoTamper;
  readonly stage: ProbeStage;
  readonly backends: Backends;
  readonly bridge: ShellBridge;
  readonly hooks: ShellAdapter;
  readonly grants: Map<string, ReadonlySet<string> | 'all'>;
  readonly frames: Map<string, HTMLIFrameElement>;
  readonly retire: Map<string, () => void>;
  readonly revocations: RevocationEvidence[];
  readonly transcript: TranscriptEntry[];
  readonly clock: { seq: number; readonly started: number };
  counter: number;
}

function record(
  state: SessionState, endpoint: string, direction: WireDirection, tap: 'frame' | 'host', envelope: unknown,
  extra: { withheld?: boolean; receivers?: number } = {},
): void {
  let copy: unknown;
  try { copy = JSON.parse(JSON.stringify(envelope === undefined ? null : envelope)) as unknown; } catch { copy = String(envelope); }
  state.transcript.push({
    seq: state.clock.seq += 1,
    at: Math.round((performance.now() - state.clock.started) * 10) / 10,
    variant: `${state.variant.profile}/${state.variant.shell}`,
    endpoint, direction, tap, envelope: copy,
    ...(extra.withheld ? { withheld: true } : {}),
    ...(extra.receivers !== undefined ? { receivers: extra.receivers } : {}),
  });
}

/** Insert the raw-wire tap ahead of the shell's own bootstrap. */
function instrument(srcdoc: string, spec: ProbeSpec): string {
  if (!spec.rawWire) return srcdoc;
  return srcdoc.replace(PRELUDE_MARKER, () => `${renderWireTap(spec.hold)}${PRELUDE_MARKER}`);
}

function endpointFor(state: SessionState, input: {
  id: string; frame: HTMLIFrameElement | null; channel: ProbeChannel | null; rejection: ProbeRejection | null;
  granted: readonly string[]; artifact: string; verifiedHash: string;
}): ProbeEndpoint {
  const { id, frame, channel, rejection, granted, artifact, verifiedHash } = input;
  return {
    id,
    rejection,
    warnings: [],
    grantedDomains: granted,
    evidence(): FrameEvidence {
      const entry = state.bridge.runtime.sessionRegistry.getEntryByWindowId(id);
      const endpointId = state.backends.incEndpointId(state.bridge, id);
      return {
        sandbox: frame?.getAttribute('sandbox') ?? '',
        src: frame?.getAttribute('src') ?? null,
        srcdoc: frame?.srcdoc ?? '',
        artifact,
        verifiedHash,
        boundIdentity: entry ? { dTag: entry.dTag, artifactHash: entry.aggregateHash } : null,
        ...(endpointId ? { endpointId } : {}),
      };
    },
    async report(timeoutMs = 4000) {
      if (!channel) return null;
      await state.stage.waitFor(channel, () => channel.report !== null, timeoutMs);
      return channel.report;
    },
    async waitMark(name, timeoutMs = 4000) {
      if (!channel) return false;
      return state.stage.waitFor(channel, () => channel.marks.includes(name), timeoutMs);
    },
    signal(name) {
      if (frame) state.stage.signal(frame, name);
    },
    forge(message, from = 'parent') {
      if (!frame) return;
      if (from === 'sibling') state.stage.postFromSibling(frame, message);
      else frame.contentWindow?.postMessage(message, '*');
    },
  };
}

async function loadProbe(state: SessionState, spec: ProbeSpec): Promise<ProbeEndpoint> {
  const artifact = renderProbeArtifact(spec.plan, { requires: spec.requires, optional: spec.optional });
  const verified = await publishAndVerifyProbe(spec, artifact);
  const id = `ep-${state.counter += 1}`;
  const identity: OriginIdentity = Object.freeze({
    dTag: verified.manifest.dTag,
    aggregateHash: verified.artifactHash,
    permissionPrincipal: { kind: 'verified' as const, manifestKey: verified.manifest.catalogId, artifactHash: verified.artifactHash },
  });
  state.grants.set(verified.artifactHash, spec.grants === 'all' ? 'all' : new Set(spec.grants));
  const environment = resolveShellEnvironment(state.hooks, identity);
  const { frame, channel } = state.stage.createFrame((wire) => record(state, id, wire.direction, 'frame', wire.envelope, wire));
  const entry: SessionEntry = {
    pubkey: '', windowId: id, origin: 'null', type: 'nip5d',
    dTag: identity.dTag, aggregateHash: identity.aggregateHash,
    permissionPrincipal: identity.permissionPrincipal,
    registeredAt: Date.now(), instanceId: crypto.randomUUID(), provenance: 'nip-5d',
  };
  const result = await admitBrowserDocument({
    runtime: state.bridge.runtime,
    entry,
    verifiedHtml: artifact,
    available: environment.capabilities.domains,
    required: verified.manifest.requires,
    optional: verified.manifest.optional ?? [],
    remoteSources: [],
    isCurrentSource: () => frame.isConnected,
    commit(srcdoc, admitted) {
      const win = frame.contentWindow;
      if (!win) throw new Error('probe frame has no content window');
      const allowed = new Set(admitted.domains);
      originRegistry.register(win, id, identity);
      originRegistry.setEnvironment(win, Object.freeze({
        capabilities: Object.freeze({ domains: Object.freeze([...admitted.domains]) }),
        services: Object.freeze(environment.services.filter((service) => allowed.has(service))),
      }));
      state.bridge.observeFrame(frame, id);
      state.frames.set(id, frame);
      const prepared = instrument(srcdoc, spec);
      frame.srcdoc = state.tamper.srcdoc?.(prepared, spec) ?? prepared;
    },
    onRetire() {
      const win = frame.contentWindow;
      if (win && originRegistry.getWindowId(win) === id) originRegistry.unregister(id);
    },
  });
  if (result.status !== 'committed') {
    frame.remove();
    return endpointFor(state, {
      id, frame: null, channel: null, granted: [], artifact, verifiedHash: verified.artifactHash,
      rejection: { stage: 'preflight', reason: result.status, deniedRequired: result.deniedRequired, executed: false },
    });
  }
  state.retire.set(id, result.retire);
  return endpointFor(state, { id, frame, channel, rejection: null, granted: result.domains, artifact, verifiedHash: verified.artifactHash });
}

/** Load a frame the runtime never registered, with its own hello and raw port. */
async function loadRogue(state: SessionState, plan: ProbePlan): Promise<RogueEvidence> {
  const id = `rogue-${state.counter += 1}`;
  const { frame, channel } = state.stage.createFrame((wire) => record(state, id, wire.direction, 'frame', wire.envelope, wire));
  state.tamper.adoptRogue?.(frame, id, state.bridge);
  const hello = '<script>(function(){var c=new MessageChannel();c.port1.start();window.parent.postMessage({type:"napplet.hello"},"*",[c.port2]);})();</script>';
  frame.srcdoc = renderProbeArtifact(plan).replace('<head>', () => `<head>${renderWireTap()}${hello}`);
  await state.stage.waitFor(channel, () => channel.report !== null, 6000);
  const dispatched = state.transcript.filter((entry) => entry.endpoint === id && entry.tap === 'host');
  frame.remove();
  return { report: channel.report, dispatched };
}

function destroyEndpoint(state: SessionState, id: string): void {
  state.bridge.revokeNapplet(id, 'host');
  state.retire.get(id)?.();
  state.retire.delete(id);
  state.frames.get(id)?.remove();
  state.frames.delete(id);
}

/** Wire the host-side taps and revocation handling into the adapter. */
function tapHooks(state: Omit<SessionState, 'bridge' | 'hooks'>, hooks: ShellAdapter, self: () => SessionState): ShellAdapter {
  const tamper = state.tamper;
  const tapped: ShellAdapter = {
    ...hooks,
    capabilities: {
      ...hooks.capabilities,
      resolveEnvironment(identity, available) {
        const grant = state.grants.get(identity.aggregateHash);
        if (!grant || grant === 'all') return available;
        return { domains: available.domains.filter((domain) => grant.has(domain)), services: available.services.filter((name) => grant.has(name)) };
      },
    },
    onNappletMessage(windowId, message) {
      record(self(), windowId, 'napplet->runtime', 'host', message);
    },
    onNappletRevoked(revocation) {
      const frame = state.frames.get(revocation.windowId);
      frame?.remove();
      state.frames.delete(revocation.windowId);
      state.revocations.push({ endpoint: revocation.windowId, reason: revocation.reason, frameRemoved: frame ? !frame.isConnected : true });
    },
    ...(tamper.filterMessage ? { filterNappletMessage: (windowId: string, message: NappletMessage) => tamper.filterMessage!(windowId, message) } : {}),
  };
  return tamper.hooks?.(tapped) ?? tapped;
}

/**
 * Boot one variant.
 *
 * @param variant - Profile and shell mode.
 * @param host - Element that receives the probe stage.
 * @param tamper - Interposition points used only by the mutation self-tests.
 * @returns The session.
 */
export async function bootKehtoSession(variant: TargetVariant, host: HTMLElement, tamper: KehtoTamper = {}): Promise<TargetSession> {
  const stage = createProbeStage(host);
  const backends = createBackends(variant);
  const partial = {
    variant, tamper, stage, backends,
    grants: new Map<string, ReadonlySet<string> | 'all'>(),
    frames: new Map<string, HTMLIFrameElement>(),
    retire: new Map<string, () => void>(),
    revocations: [] as RevocationEvidence[],
    transcript: [] as TranscriptEntry[],
    clock: { seq: 0, started: performance.now() },
    counter: 0,
  };
  // The adapter needs the session for its taps, and the session needs the bridge.
  const holder: { state?: SessionState } = {};
  const hooks = tapHooks(partial, backends.hooks, () => holder.state as SessionState);
  const bridge = createShellBridge(hooks);
  const state: SessionState = { ...partial, bridge, hooks };
  holder.state = state;
  backends.attach(bridge);

  const postToNapplet = originRegistry.postToNapplet.bind(originRegistry);
  originRegistry.postToNapplet = (windowId: string, message: unknown): boolean => {
    const outgoing = tamper.outbound ? tamper.outbound(windowId, message) : [message];
    let delivered = false;
    for (const item of outgoing) {
      record(state, windowId, 'runtime->napplet', 'host', item);
      delivered = postToNapplet(windowId, item) || delivered;
    }
    return delivered;
  };
  window.addEventListener('message', bridge.handleMessage);

  const advertised = (): { domains: readonly string[]; services: readonly string[] } => {
    const environment = resolveShellEnvironment(hooks, { dTag: 'advertised', aggregateHash: '' });
    const live = { domains: environment.capabilities.domains, services: environment.services };
    return tamper.advertised?.(live) ?? live;
  };

  return {
    variant,
    advertised,
    loadProbe: (spec) => loadProbe(state, spec),
    loadRogue: (plan) => loadRogue(state, plan),
    async destroyEndpoint(id) { destroyEndpoint(state, id); },
    revocations: () => [...state.revocations],
    transcript: () => [...state.transcript],
    controls: backends.controls,
    control: (name, payload) => backends.control(name, payload, { bridge, hooks }),
    async dispose() {
      for (const id of Array.from(state.frames.keys())) destroyEndpoint(state, id);
      window.removeEventListener('message', bridge.handleMessage);
      originRegistry.postToNapplet = postToNapplet;
      bridge.destroy();
      backends.dispose();
      originRegistry.clear();
      stage.dispose();
    },
  };
}
