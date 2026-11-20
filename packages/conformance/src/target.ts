/**
 * target.ts — The driver contract a runtime implements to be tested.
 *
 * A target owns everything side-effectful: booting the runtime, creating
 * sandboxed frames, verifying and admitting probe artifacts, and tapping the
 * wire. The engine only ever sees the plain data these methods return.
 */
import type { ConformanceProfile, ShellMode, TranscriptEntry } from './model.js';
import type { WireHold } from './probe/artifact.js';
import type { ProbePlan, ProbeReport } from './probe/plan.js';

/**
 * One profile variant a target is asked to boot.
 *
 * @example
 * ```ts
 * const variant: TargetVariant = { profile: 'full', shell: 'shell-absent' };
 * ```
 */
export interface TargetVariant {
  readonly profile: ConformanceProfile;
  readonly shell: ShellMode;
}

/**
 * A probe the engine asks the target to verify, admit and load.
 *
 * @example
 * ```ts
 * const spec: ProbeSpec = {
 *   plan: { label: 'theme', steps: [] }, dTag: 'probe-theme',
 *   requires: ['theme'], grants: ['theme', 'shell'], rawWire: true,
 * };
 * ```
 */
export interface ProbeSpec {
  readonly plan: ProbePlan;
  /** Manifest `d` tag. */
  readonly dTag: string;
  /** Manifest `R` domains. */
  readonly requires?: readonly string[];
  /** Manifest `O` domains. */
  readonly optional?: readonly string[];
  /**
   * Explicit host grants for this endpoint, independent of the manifest.
   * `all` grants every domain the variant advertises.
   */
  readonly grants: readonly string[] | 'all';
  /** Expose `window.__kehtoConformanceWire` before probe code runs. */
  readonly rawWire?: boolean;
  /** Traffic the raw-wire tap withholds until the probe releases it. Needs `rawWire`. */
  readonly hold?: WireHold;
  /** Which fixture publisher signs the manifest. Default `primary`. */
  readonly publisher?: 'primary' | 'secondary';
  /** Manifest kind. Default `35129` (named). */
  readonly manifestKind?: 5129 | 15129 | 35129;
}

/**
 * Host-side evidence about how a probe document was loaded.
 *
 * @example
 * ```ts
 * const { sandbox, src } = endpoint.evidence();
 * ```
 */
export interface FrameEvidence {
  /** The iframe's `sandbox` attribute value. */
  readonly sandbox: string;
  /** The iframe's `src` attribute, or `null` when it has none. */
  readonly src: string | null;
  /** The exact `srcdoc` assigned to the iframe. */
  readonly srcdoc: string;
  /** The verified artifact bytes the target was asked to load. */
  readonly artifact: string;
  /** sha256 the target computed over the artifact bytes while verifying the manifest. */
  readonly verifiedHash: string;
  /** Identity the runtime has bound to this endpoint, read from the runtime, or `null`. */
  readonly boundIdentity: { readonly dTag: string; readonly artifactHash: string } | null;
  /** Runtime-assigned opaque endpoint identifier, when the runtime exposes one. */
  readonly endpointId?: string;
}

/** Why a probe never ran. */
export interface ProbeRejection {
  /** `preflight`: refused before any document was assigned. `load`: refused later. */
  readonly stage: 'preflight' | 'load';
  readonly reason: string;
  /** Required domains the runtime could not expose. */
  readonly deniedRequired: readonly string[];
  /** Whether any probe byte executed before the refusal. */
  readonly executed: boolean;
}

/**
 * A loaded (or refused) probe.
 *
 * @example
 * ```ts
 * const endpoint = await session.loadProbe(spec);
 * const report = await endpoint.report();
 * ```
 */
export interface ProbeEndpoint {
  /** Target-assigned endpoint id; transcript entries use the same value. */
  readonly id: string;
  /** Set when the runtime refused to load the probe. */
  readonly rejection: ProbeRejection | null;
  /** Any warning the runtime surfaced while loading (e.g. incomplete required domains). */
  readonly warnings: readonly string[];
  /** Domains the host granted this endpoint, as the runtime reports them. */
  readonly grantedDomains: readonly string[];
  /** Host-side load evidence. */
  evidence(): FrameEvidence;
  /**
   * Wait for the probe's final report.
   *
   * @param timeoutMs - Longest to wait.
   * @returns The report, or `null` when the probe never finished.
   */
  report(timeoutMs?: number): Promise<ProbeReport | null>;
  /**
   * Wait until the probe reaches a `mark` step.
   *
   * @param name - Mark name.
   * @param timeoutMs - Longest to wait.
   * @returns Whether the mark arrived.
   */
  waitMark(name: string, timeoutMs?: number): Promise<boolean>;
  /** Wake a probe blocked on a `waitSignal` step. */
  signal(name: string): void;
  /**
   * Post a window-level message into the probe document, as any frame holding a
   * reference to it could. Used to prove forged window-level traffic is ignored.
   *
   * @param message - The message.
   * @param from - `parent`: the host window posts it. `sibling`: another frame
   *   of the host page posts it, so `MessageEvent.source` is not the parent.
   */
  forge(message: unknown, from?: 'parent' | 'sibling'): void;
}

/** A revocation the runtime performed. */
export interface RevocationEvidence {
  readonly endpoint: string;
  readonly reason: string;
  /** Whether the revoked frame is no longer in the document. */
  readonly frameRemoved: boolean;
}

/**
 * What a frame the runtime never created observed after attempting the handoff.
 *
 * @example
 * ```ts
 * const rogue = await session.loadRogue({ label: 'rogue', steps: [] });
 * ```
 */
export interface RogueEvidence {
  /** The rogue probe's report, or `null` when it never finished. */
  readonly report: ProbeReport | null;
  /** Messages the runtime dispatched on behalf of the rogue frame. Must be empty. */
  readonly dispatched: readonly TranscriptEntry[];
}

/**
 * A booted variant of a runtime.
 *
 * @example
 * ```ts
 * const session = await target.boot({ profile: 'minimal', shell: 'shell-present' });
 * try { await session.loadProbe(spec); } finally { await session.dispose(); }
 * ```
 */
export interface TargetSession {
  readonly variant: TargetVariant;
  /** Domains and services the runtime says it can expose in this variant. */
  advertised(): { readonly domains: readonly string[]; readonly services: readonly string[] };
  /** Verify, admit and load one probe. */
  loadProbe(spec: ProbeSpec): Promise<ProbeEndpoint>;
  /**
   * Load a probe in a sandboxed frame the runtime never registered. The frame
   * performs its own `napplet.hello` and then runs `plan` on that port.
   */
  loadRogue(plan: ProbePlan): Promise<RogueEvidence>;
  /** Destroy one endpoint the way the host does when a napplet closes. */
  destroyEndpoint(id: string): Promise<void>;
  /** Destroy every live endpoint; the engine calls it between scenarios. */
  releaseEndpoints?(): Promise<void>;
  /** Revocations performed so far, oldest first. */
  revocations(): readonly RevocationEvidence[];
  /** Host-side wire entries captured so far. Frame-side entries arrive through probe taps. */
  transcript(): readonly TranscriptEntry[];
  /**
   * Run a named host-side control. Controls are how the engine triggers pushes
   * and reads backend evidence; the vocabulary is listed in the package README.
   *
   * @param name - Control name, e.g. `theme.publish`.
   * @param payload - Control argument.
   * @returns The control's result, or `undefined` when the target has no such control.
   */
  control(name: string, payload?: unknown): Promise<unknown>;
  /** Controls this target implements. A missing control skips the cases that need it. */
  readonly controls: readonly string[];
  /**
   * Boot a scoped session of the same variant whose runtime denies requests
   * through a legacy behavioral Firewall gate instead of its usual one. The
   * scoped session must offer the `firewall.block` ({ endpoint }) and
   * `firewall.rejections` ({ endpoint }) controls plus `backend.calls`. Do not
   * use this session until the scoped one is disposed. A target without the
   * gate omits the method and the Firewall checks skip.
   */
  openLegacyFirewall?(): Promise<TargetSession>;
  /** Tear the runtime down. */
  dispose(): Promise<void>;
}

/**
 * A runtime under test.
 *
 * @example
 * ```ts
 * const target = createKehtoTarget();
 * const run = await runConformance(target, { profile: 'full' });
 * ```
 */
export interface ConformanceTarget {
  /** Display name, e.g. `kehto`. */
  readonly name: string;
  /** Versions of the packages under test. */
  readonly packages: Readonly<Record<string, string>>;
  /**
   * Whether an unavailable required (`R`) domain is refused before execution.
   * `strict` enables the `kehto/requires-preflight` policy check.
   */
  readonly requiredDomainPolicy: 'strict' | 'warn';
  /** Boot one profile variant with fresh state. */
  boot(variant: TargetVariant): Promise<TargetSession>;
}
