/**
 * probe/artifact.ts — The reference probe napplet and its optional wire tap.
 *
 * The three functions below are serialized into the probe artifact with
 * `Function.prototype.toString`, so each one is self-contained: no imports, no
 * module-scope references. Splitting them into helpers would leave unresolved
 * closures in the generated HTML.
 *
 * aislop-ignore-file complexity/function-too-long
 */
import type { ProbePlan, RealmSnapshot } from './plan.js';

/** Name of the same-origin frame a probe reports to. The shell window never sees these messages. */
export const COLLECTOR_FRAME_NAME = 'kehto-conformance-collector';

/** Field that marks a probe -> harness report. */
export const REPORT_FIELD = 'kehtoConformance';

/** Field that marks a harness -> probe signal. */
export const SIGNAL_FIELD = 'kehtoConformanceSignal';

/** Global a target exposes, before probe code runs, when a probe is loaded with `rawWire`. */
export const WIRE_HANDLE = '__kehtoConformanceWire';

type Emit = (kind: string, body: unknown) => void;

/** Post one report to the collector frame, falling back to every sibling frame. */
function collectorPost(kind: string, body: unknown): void {
  const message = { kehtoConformance: kind, body };
  const parent = window.parent as Window & Record<string, unknown>;
  try {
    const collector = parent['kehto-conformance-collector'] as Window | undefined;
    if (collector && typeof collector.postMessage === 'function') {
      collector.postMessage(message, '*');
      return;
    }
  } catch {
    // Named access can be refused; fall through to indexed siblings.
  }
  try {
    for (let index = 0; index < parent.length; index += 1) {
      const sibling = parent[index] as Window;
      if (sibling !== window) sibling.postMessage(message, '*');
    }
  } catch {
    // No collector is reachable; the harness reports the probe as silent.
  }
}

/**
 * Tap the first `MessageChannel` the injected bootstrap opens, so a probe can
 * send and observe raw port traffic through the same bound port.
 */
function wireTap(emit: Emit, hold: { outbound: string[]; inbound: string[]; echoInit: boolean }): void {
  const NativeChannel = window.MessageChannel;
  const listeners: Array<(data: unknown) => void> = [];
  const heldOut: unknown[] = [];
  const heldIn: unknown[] = [];
  const released = new WeakSet<Event>();
  const backlog: unknown[] = [];
  let bound: MessagePort | null = null;
  let receivers = 0;
  let send: (message: unknown) => void = () => undefined;
  const typeOf = (value: unknown): string => String((value as { type?: unknown } | null)?.type ?? '');
  const copy = (value: unknown): unknown => {
    try { return JSON.parse(JSON.stringify(value === undefined ? null : value)) as unknown; } catch { return String(value); }
  };
  Object.defineProperty(window, '__kehtoConformanceWire', {
    enumerable: false,
    value: {
      post(message: unknown): boolean {
        if (!bound) return false;
        bound.postMessage(message);
        return true;
      },
      listen(listener: (data: unknown) => void): void {
        listeners.push(listener);
        // Messages that arrived before probe code ran are replayed to the first listener.
        if (listeners.length === 1) for (const data of backlog.splice(0)) listener(data);
      },
      /** Deliver a message to the bootstrap's listeners as if the runtime had sent it on the port. */
      inject(data: unknown): void {
        const event = new MessageEvent('message', { data });
        released.add(event);
        bound?.dispatchEvent(event);
      },
      /** Let withheld traffic through, in arrival order, and stop withholding that direction. */
      release(direction: 'outbound' | 'inbound'): number {
        const queue = direction === 'outbound' ? heldOut.splice(0) : heldIn.splice(0);
        if (direction === 'outbound') { hold.outbound = []; for (const message of queue) send(message); }
        else {
          hold.inbound = [];
          for (const data of queue) {
            const event = new MessageEvent('message', { data });
            released.add(event);
            bound?.dispatchEvent(event);
          }
        }
        return queue.length;
      },
    },
  });
  const Tapped = function (): MessageChannel {
    const channel = new NativeChannel();
    if (!bound) {
      bound = channel.port1;
      const port = bound;
      const nativePost = port.postMessage.bind(port) as (message: unknown, transfer?: Transferable[]) => void;
      send = (message: unknown): void => {
        emit('wire', { direction: 'napplet->runtime', envelope: copy(message) });
        nativePost(message);
      };
      port.postMessage = ((message: unknown, transfer?: Transferable[]): void => {
        if (hold.outbound.includes(typeOf(message))) { heldOut.push(message); return; }
        emit('wire', { direction: 'napplet->runtime', envelope: copy(message), receivers });
        if (transfer) nativePost(message, transfer); else nativePost(message);
        // Answer the first shell.ready synchronously, inside the bootstrap's own
        // postMessage call: only a receiver installed before the signal left sees it.
        if (hold.echoInit && typeOf(message) === 'shell.ready') {
          hold.echoInit = false;
          const ns = Reflect.get(window, 'napplet') as Record<string, unknown> | undefined;
          const data = { type: 'shell.init', capabilities: { domains: ns ? Object.keys(ns) : [] }, services: ['conformance-echo'] };
          const event = new MessageEvent('message', { data });
          released.add(event);
          emit('wire', { direction: 'runtime->napplet', envelope: copy(data), withheld: false });
          port.dispatchEvent(event);
        }
      }) as MessagePort['postMessage'];
      port.addEventListener('message', (event: MessageEvent) => {
        if (!released.has(event) && hold.inbound.includes(typeOf(event.data))) {
          heldIn.push(event.data);
          event.stopImmediatePropagation();
          emit('wire', { direction: 'runtime->napplet', envelope: copy(event.data), withheld: true });
          return;
        }
        if (!released.has(event)) emit('wire', { direction: 'runtime->napplet', envelope: copy(event.data) });
        if (listeners.length === 0) backlog.push(event.data);
        for (const listener of listeners) listener(event.data);
      });
      // Count the bootstrap's own receivers, so a check can prove one was
      // installed before the readiness signal left.
      const nativeListen = port.addEventListener.bind(port) as (type: string, listener: unknown, options?: unknown) => void;
      port.addEventListener = ((type: string, listener: unknown, options?: unknown): void => {
        if (type === 'message') receivers += 1;
        nativeListen(type, listener, options);
      }) as MessagePort['addEventListener'];
      window.MessageChannel = NativeChannel;
    }
    return channel;
  };
  Reflect.set(window, 'MessageChannel', Tapped);
}

/** Install the realm snapshot helper and take the classic-script snapshot. */
function snapshotInstall(): void {
  const scan = (root: unknown, label: string, maxDepth: number, found: string[]): void => {
    const seen = new Set<unknown>();
    const queue: Array<{ value: unknown; path: string; depth: number }> = [{ value: root, path: label, depth: 0 }];
    let visited = 0;
    while (queue.length > 0 && visited < 4000) {
      const { value, path, depth } = queue.shift() as { value: unknown; path: string; depth: number };
      visited += 1;
      if ((typeof value !== 'object' && typeof value !== 'function') || value === null || seen.has(value)) continue;
      seen.add(value);
      if (typeof MessagePort === 'function' && value instanceof MessagePort) { found.push(path); continue; }
      if (depth >= maxDepth) continue;
      let names: string[] = [];
      try { names = Object.getOwnPropertyNames(value); } catch { continue; }
      for (const name of names) {
        if (label === 'window' && depth === 0 && /^(window|self|parent|top|frames|document|globalThis|opener)$/.test(name)) continue;
        let child: unknown;
        try { child = (value as Record<string, unknown>)[name]; } catch { continue; }
        queue.push({ value: child, path: `${path}.${name}`, depth: depth + 1 });
      }
    }
  };
  const snapshot = (): RealmSnapshot => {
    const global = window as Window & { napplet?: Record<string, unknown>; nostr?: unknown };
    const namespace = global.napplet;
    const reachablePorts: string[] = [];
    scan(global, 'window', 2, reachablePorts);
    if (namespace) scan(namespace, 'window.napplet', 6, reachablePorts);
    let storage: 'blocked' | 'accessible' = 'blocked';
    try { storage = typeof window.localStorage === 'object' ? 'accessible' : 'blocked'; } catch { storage = 'blocked'; }
    const signing = ['nostr', 'webln', 'nip07', 'nostrSigner'].filter((name) => name in global);
    return {
      napplet: typeof namespace,
      domains: namespace && typeof namespace === 'object' ? Object.keys(namespace).sort() : [],
      nostr: typeof global.nostr,
      nostrPresent: 'nostr' in global,
      signingGlobals: signing,
      origin: String(window.origin),
      href: String(window.location.href),
      storage,
      reachablePorts,
    };
  };
  Object.defineProperty(window, '__kehtoProbe', { enumerable: false, value: { snapshot, classic: snapshot(), module: null } });
}

/** Execute a plan and report every step to the collector. */
function probeMain(plan: ProbePlan, emit: Emit): void {
  type Wire = { post(message: unknown): boolean; listen(listener: (data: unknown) => void): void };
  type Record_ = { index: number; op: string; as?: string; state: string; value?: unknown; error?: string; at: number };
  const global = window as Window & {
    napplet?: Record<string, unknown>;
    __kehtoProbe?: { snapshot(): RealmSnapshot; classic: RealmSnapshot; module: RealmSnapshot | null };
    __kehtoConformanceWire?: Wire;
  };
  // Installed by snapshotInstall in the head, before this body script runs.
  const probe = global.__kehtoProbe!;
  const wire = global.__kehtoConformanceWire;
  const started = performance.now();
  const defaultTimeout = plan.timeoutMs ?? 2000;
  const defaultSettle = plan.settleMs ?? 120;
  const records: Record_[] = [];
  const callbacks: Record<string, unknown[][]> = {};
  const handles: Record<string, unknown> = {};
  const marks: string[] = [];
  const inbound: unknown[] = [];
  const consumed = new Set<number>();
  const inboundWaiters: Array<() => void> = [];
  const signals = new Set<string>();
  const signalWaiters: Array<() => void> = [];
  const background: Array<{ record: Record_; promise: Promise<unknown> }> = [];

  const safe = (value: unknown, depth = 0): unknown => {
    if (value === undefined) return { $undefined: true };
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'function') return { $function: true };
    if (typeof value !== 'object') return String(value);
    if (depth > 8) return '[depth]';
    if (value instanceof Error) return { $error: value.message, name: value.name };
    if (value instanceof ArrayBuffer) return { $bytes: Array.from(new Uint8Array(value).slice(0, 64)), length: value.byteLength };
    if (ArrayBuffer.isView(value)) return { $bytes: Array.from(new Uint8Array(value.buffer, value.byteOffset, Math.min(value.byteLength, 64))), length: value.byteLength };
    if (typeof Blob === 'function' && value instanceof Blob) return { $blob: value.size, mime: value.type };
    if (Array.isArray(value)) return value.slice(0, 256).map((item) => safe(item, depth + 1));
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = safe((value as Record<string, unknown>)[key], depth + 1);
    return out;
  };
  const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
  const record = (index: number, op: string, as: string | undefined, state: string, extra: { value?: unknown; error?: string } = {}): Record_ => {
    const entry: Record_ = { index, op, ...(as ? { as } : {}), state, ...extra, at: performance.now() - started };
    records.push(entry);
    return entry;
  };
  const resolveArgs = (args: readonly unknown[] | undefined): unknown[] => (args ?? []).map((arg) => {
    if (arg && typeof arg === 'object' && typeof (arg as { $callback?: unknown }).$callback === 'string') {
      const name = (arg as { $callback: string }).$callback;
      callbacks[name] ??= [];
      return (...values: unknown[]): void => { callbacks[name]?.push(values.map((value) => safe(value))); };
    }
    if (arg && typeof arg === 'object' && typeof (arg as { $handle?: unknown }).$handle === 'string') {
      return handles[(arg as { $handle: string }).$handle];
    }
    return arg;
  });
  const lookup = (root: unknown, path: readonly string[]): { owner: unknown; value: unknown; found: boolean } => {
    let owner: unknown = undefined;
    let value: unknown = root;
    for (const key of path) {
      if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return { owner, value: undefined, found: false };
      owner = value;
      value = (value as Record<string, unknown>)[key];
    }
    return { owner, value, found: value !== undefined };
  };
  const matches = (message: unknown, match: Readonly<Record<string, unknown>>): boolean => {
    if (!message || typeof message !== 'object') return false;
    return Object.keys(match).every((key) => JSON.stringify((message as Record<string, unknown>)[key]) === JSON.stringify(match[key]));
  };
  const settle = async (index: number, op: string, as: string, produced: unknown, timeoutMs: number, isBackground: boolean): Promise<void> => {
    if (produced && (typeof produced === 'object' || typeof produced === 'function')) handles[as] = produced;
    const thenable = produced && typeof (produced as { then?: unknown }).then === 'function';
    if (!thenable) { record(index, op, as, 'value', { value: safe(produced) }); return; }
    const promise = produced as Promise<unknown>;
    if (isBackground) {
      const entry = record(index, op, as, 'pending');
      background.push({ record: entry, promise });
      promise.then(
        (value) => { entry.state = 'resolved'; entry.value = safe(value); handles[as] = value; },
        (error) => { entry.state = 'rejected'; entry.error = errorText(error); },
      );
      return;
    }
    const outcome = await Promise.race([
      promise.then((value) => ({ state: 'resolved', value }), (error) => ({ state: 'rejected', error: errorText(error) })),
      sleep(timeoutMs).then(() => ({ state: 'pending' })),
    ]) as { state: string; value?: unknown; error?: string };
    if (outcome.state === 'resolved' && outcome.value && typeof outcome.value === 'object') handles[as] = outcome.value;
    record(index, op, as, outcome.state, {
      ...(outcome.state === 'resolved' ? { value: safe(outcome.value) } : {}),
      ...(outcome.error !== undefined ? { error: outcome.error } : {}),
    });
  };

  if (wire) {
    wire.listen((data) => {
      inbound.push(data);
      for (const wake of inboundWaiters.splice(0)) wake();
    });
  }
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const name = (event.data as { kehtoConformanceSignal?: unknown } | null)?.kehtoConformanceSignal;
    if (typeof name !== 'string') return;
    signals.add(name);
    for (const wake of signalWaiters.splice(0)) wake();
  });

  const waitFor = async (ready: () => boolean, waiters: Array<() => void>, timeoutMs: number): Promise<boolean> => {
    const deadline = performance.now() + timeoutMs;
    while (!ready()) {
      const remaining = deadline - performance.now();
      if (remaining <= 0) return false;
      await Promise.race([new Promise<void>((resolve) => { waiters.push(resolve); }), sleep(remaining)]);
    }
    return true;
  };

  const runStep = async (step: ProbePlan['steps'][number], index: number): Promise<void> => {
    if (step.op === 'call' || step.op === 'read') {
      const root = step.root === 'window' ? global : global.napplet;
      const target = lookup(root, step.path);
      if (step.op === 'read') {
        record(index, step.op, step.as, target.found ? 'value' : 'missing', { value: safe(target.value) });
        return;
      }
      if (typeof target.value !== 'function') { record(index, step.op, step.as, 'missing'); return; }
      let produced: unknown;
      try { produced = (target.value as (...args: unknown[]) => unknown).apply(target.owner, resolveArgs(step.args)); }
      catch (error) { record(index, step.op, step.as, 'threw', { error: errorText(error) }); return; }
      await settle(index, step.op, step.as, produced, step.timeoutMs ?? defaultTimeout, step.background === true);
      return;
    }
    if (step.op === 'invoke') {
      const owner = handles[step.handle] as Record<string, unknown> | undefined;
      const method = owner?.[step.method];
      if (typeof method !== 'function') { record(index, step.op, step.as, 'missing'); return; }
      let produced: unknown;
      try { produced = (method as (...args: unknown[]) => unknown).apply(owner, resolveArgs(step.args)); }
      catch (error) { record(index, step.op, step.as, 'threw', { error: errorText(error) }); return; }
      await settle(index, step.op, step.as, produced, step.timeoutMs ?? defaultTimeout, false);
      return;
    }
    if (step.op === 'send') {
      let envelope = step.envelope;
      if (step.fill && envelope && typeof envelope === 'object') {
        const filled: Record<string, unknown> = { ...(envelope as Record<string, unknown>) };
        for (const [field, source] of Object.entries(step.fill)) {
          const found = records.find((entry) => entry.as === source.as);
          const picked = lookup(found?.value, source.path);
          if (picked.found) filled[field] = picked.value;
        }
        envelope = filled;
      }
      const sent = wire ? wire.post(envelope) : false;
      record(index, step.op, undefined, sent ? 'value' : 'missing');
      return;
    }
    if (step.op === 'expect') {
      let found = -1;
      const ready = (): boolean => {
        found = inbound.findIndex((message, position) => !consumed.has(position) && matches(message, step.match));
        return found >= 0;
      };
      const arrived = await waitFor(ready, inboundWaiters, step.timeoutMs ?? defaultTimeout);
      if (arrived) consumed.add(found);
      record(index, step.op, step.as, arrived ? 'value' : 'timeout', { value: arrived ? safe(inbound[found]) : null });
      return;
    }
    if (step.op === 'quiet') {
      const from = inbound.length;
      await sleep(step.ms ?? defaultSettle);
      record(index, step.op, step.as, 'value', { value: inbound.slice(from).map((message) => safe(message)) });
      return;
    }
    if (step.op === 'mark') {
      marks.push(step.name);
      emit('mark', { name: step.name });
      record(index, step.op, undefined, 'value');
      return;
    }
    if (step.op === 'waitSignal') {
      const arrived = await waitFor(() => signals.has(step.name), signalWaiters, step.timeoutMs ?? defaultTimeout * 4);
      signals.delete(step.name);
      record(index, step.op, step.as, arrived ? 'value' : 'timeout', { value: arrived });
      return;
    }
    if (step.op === 'sleep') { await sleep(step.ms); record(index, step.op, undefined, 'value'); return; }
    if (step.op === 'snapshot') { record(index, step.op, step.as, 'value', { value: probe.snapshot() }); return; }
    if (step.op === 'assign') {
      const target = lookup(global.napplet, step.path.slice(0, -1));
      const key = step.path[step.path.length - 1] as string;
      try {
        (target.value as Record<string, unknown>)[key] = step.value;
        record(index, step.op, step.as, 'value');
      } catch (error) { record(index, step.op, step.as, 'threw', { error: errorText(error) }); }
      return;
    }
    if (step.op === 'windowPost') {
      const transfer = step.withPort ? [new MessageChannel().port2] : [];
      window.parent.postMessage(step.message, '*', transfer);
      record(index, step.op, undefined, 'value');
    }
  };

  const run = async (): Promise<void> => {
    emit('boot', { label: plan.label, classic: probe.classic, module: probe.module });
    let completed = true;
    for (let index = 0; index < plan.steps.length; index += 1) {
      try { await runStep(plan.steps[index] as ProbePlan['steps'][number], index); }
      catch (error) { record(index, plan.steps[index]?.op ?? 'call', undefined, 'threw', { error: errorText(error) }); completed = false; break; }
    }
    emit('done', { label: plan.label, classic: probe.classic, module: probe.module, steps: records, callbacks, marks, completed });
  };
  const start = (): void => { void run(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Manifest declarations embedded in a probe artifact as NIP-5D publishing metadata.
 *
 * @example
 * ```ts
 * const declarations: ProbeDeclarations = { requires: ['theme'], optional: ['shell'] };
 * ```
 */
export interface ProbeDeclarations {
  /** `R` domains, mirrored in `<meta name="napplet-requires">`. */
  readonly requires?: readonly string[];
  /** `O` domains, mirrored in `<meta name="napplet-optional">`. */
  readonly optional?: readonly string[];
}

/**
 * Render the reference probe as a self-contained napplet artifact.
 *
 * The returned string is the exact byte sequence a target hashes and verifies:
 * the plan is part of it, so each plan is a distinct artifact identity.
 *
 * @param plan - Instructions the probe executes.
 * @param declarations - Manifest `R`/`O` domains to mirror in the HTML metadata.
 * @returns The artifact HTML.
 * @example
 * ```ts
 * const html = renderProbeArtifact({ label: 'boot', steps: [] }, { requires: ['theme'] });
 * ```
 */
export function renderProbeArtifact(plan: ProbePlan, declarations: ProbeDeclarations = {}): string {
  const meta = [
    declarations.requires?.length ? `<meta name="napplet-requires" content="${declarations.requires.join(' ')}">` : '',
    declarations.optional?.length ? `<meta name="napplet-optional" content="${declarations.optional.join(' ')}">` : '',
  ].join('');
  return [
    '<!doctype html><html><head><meta charset="utf-8"><title>Kehto conformance probe</title>',
    `<meta name="description" content="Reference probe: ${plan.label.replace(/[^a-z0-9 ._/-]/gi, '')}">`,
    meta,
    `<script>(${snapshotInstall.toString()})();</script>`,
    '<script type="module">window.__kehtoProbe.module = window.__kehtoProbe.snapshot();</script>',
    '</head><body>',
    `<script>(${probeMain.toString()})(${scriptJson(plan)}, ${collectorPost.toString()});</script>`,
    '</body></html>',
  ].join('');
}

/**
 * Traffic a raw-wire tap withholds until the probe releases it.
 *
 * @example
 * ```ts
 * const hold: WireHold = { inbound: ['shell.init'] };
 * ```
 */
export interface WireHold {
  /** Napplet -> runtime message types to queue instead of sending. */
  readonly outbound?: readonly string[];
  /** Runtime -> napplet message types to queue before the bootstrap's own listeners see them. */
  readonly inbound?: readonly string[];
  /**
   * Answer the bootstrap's first `shell.ready` with a synthetic `shell.init`
   * (services `['conformance-echo']`) dispatched synchronously, before the
   * runtime sees the signal. Proves the receiver was installed first.
   */
  readonly echoInit?: boolean;
}

/**
 * Render the raw-wire tap a target injects ahead of its own bootstrap when a
 * probe is loaded with `rawWire`. It wraps the first `MessageChannel` the
 * bootstrap opens, exposes `window.__kehtoConformanceWire` (`post`, `listen`,
 * `release`), and restores the native constructor. It is host-owned injection,
 * never part of the artifact.
 *
 * @param hold - Message types to withhold until the probe calls `release`.
 * @returns An inline script tag.
 * @example
 * ```ts
 * const srcdoc = prepared.replace('<script data-kehto-nip5d-injection>', `${renderWireTap()}<script data-kehto-nip5d-injection>`);
 * ```
 */
export function renderWireTap(hold: WireHold = {}): string {
  const held = { outbound: [...(hold.outbound ?? [])], inbound: [...(hold.inbound ?? [])], echoInit: hold.echoInit === true };
  return `<script data-kehto-conformance-tap>(${wireTap.toString()})(${collectorPost.toString()}, ${scriptJson(held)});</script>`;
}
