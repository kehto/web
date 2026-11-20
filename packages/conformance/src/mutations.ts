/**
 * mutations.ts — Named ways to break the first-party target, for self-tests.
 *
 * Each mutation corrupts exactly one property of the real Kehto target and
 * names the stable checks that must fail because of it. A self-test runs the
 * catalog with the mutation and asserts that the failing set is exactly
 * `expect` plus the target's known findings, so a mutation that breaks
 * everything (or nothing) is caught. Mutations are selected by name so they
 * can cross `page.evaluate`.
 *
 * @module
 */
import type { NappletMessage, ShellAdapter, ShellBridge } from '@kehto/shell';
import { originRegistry } from '@kehto/shell';
import type { KehtoTamper } from './kehto/tamper.js';

/** A mutation and the checks it must fail. */
export interface MutationSpec {
  readonly name: string;
  readonly description: string;
  /** Stable check ids that must fail, and no others beyond known findings. */
  readonly expect: readonly string[];
  /** Domain filter the self-test runs with. Default `['storage']`: NIP-5D and NAP-SHELL checks always run. */
  readonly domains?: readonly string[];
  /** Build a fresh tamper. `applied` counts the places the mutation actually changed something. */
  create(applied: { count: number }): KehtoTamper;
}

const PRELUDE_MARKER = '<script data-kehto-nip5d-injection>';
const SUPPORTS_BODY = /function supports\(domain\) \{\s*return /;

function rewriteSrcdoc(applied: { count: number }, rewrite: (srcdoc: string) => string): KehtoTamper {
  return {
    srcdoc(srcdoc) {
      const next = rewrite(srcdoc);
      if (next !== srcdoc) applied.count += 1;
      return next;
    },
  };
}

function shellEnvironmentIncludesShell(windowId: string): boolean {
  const win = originRegistry.getIframeWindow(windowId);
  return Boolean(win && originRegistry.getEnvironment(win)?.capabilities.domains.includes('shell'));
}

/** Defer every non-shell envelope from a shell-exposed endpoint until it has sent `shell.ready`. */
function gateOnShellReady(applied: { count: number }): KehtoTamper {
  const ready = new Set<string>();
  let bridge: ShellBridge | null = null;
  return {
    attached(attachedBridge) { bridge = attachedBridge; },
    hooks(hooks: ShellAdapter): ShellAdapter {
      return {
        ...hooks,
        onNappletMessage(windowId, message) {
          hooks.onNappletMessage?.(windowId, message);
          if (message.type !== 'shell.ready' || ready.has(windowId)) return;
          ready.add(windowId);
          queueMicrotask(() => { bridge?.releaseDeferred(windowId); });
        },
      };
    },
    filterMessage(windowId: string, _message: NappletMessage) {
      if (ready.has(windowId) || !shellEnvironmentIncludesShell(windowId)) return 'dispatch';
      applied.count += 1;
      return 'defer';
    },
  };
}

/** Rewrite every INC endpoint identifier the runtime delivers to the d tag of that endpoint. */
function incIdentifiersAsDTags(applied: { count: number }): KehtoTamper {
  let bridge: ShellBridge | null = null;
  const dTags = new Map<string, string>();
  const learn = (windowId: string): void => {
    const id = bridge?.runtime.getIncEndpointId(windowId);
    const dTag = bridge?.runtime.sessionRegistry.getEntryByWindowId(windowId)?.dTag;
    if (id && dTag !== undefined) dTags.set(id, dTag);
  };
  return {
    attached(attachedBridge) { bridge = attachedBridge; },
    outbound(windowId, message) {
      learn(windowId);
      const envelope = message as Record<string, unknown> | null;
      if (!envelope || typeof envelope.type !== 'string' || !envelope.type.startsWith('inc.')) return [message];
      const rewritten = { ...envelope };
      for (const field of ['sender', 'peer']) {
        const id = rewritten[field];
        if (typeof id === 'string' && dTags.has(id)) { rewritten[field] = dTags.get(id); applied.count += 1; }
      }
      return [rewritten];
    },
  };
}

/**
 * Every mutation the self-tests run.
 *
 * @example
 * ```ts
 * const spec = MUTATIONS.find((mutation) => mutation.name === 'inject-window-nostr');
 * ```
 */
export const MUTATIONS: readonly MutationSpec[] = [
  {
    name: 'inject-window-nostr',
    description: 'The host injects a NIP-07 window.nostr next to the namespace prelude.',
    expect: ['nip5d/no-window-nostr'],
    create: (applied) => rewriteSrcdoc(applied, (srcdoc) => srcdoc.replace(PRELUDE_MARKER, () => `<script>window.nostr = { getPublicKey: async () => '' };</script>${PRELUDE_MARKER}`)),
  },
  {
    name: 'accept-forged-source',
    description: 'Frames the runtime never verified are admitted and serviced.',
    expect: ['nip5d/source-binding', 'shell/source-trust'],
    create: (applied) => {
      applied.count += 1;
      return { adoptRogue: true };
    },
  },
  {
    name: 'omit-granted-shell',
    // Injection truthfulness fails first; every check that needs the shell
    // object then fails downstream. Wire-only and non-shell checks still pass.
    description: 'window.napplet.shell is never injected although shell stays granted and advertised.',
    expect: [
      'nip5d/injection-order', 'nip5d/injection-scope', 'nip5d/readiness-independent',
      'shell/environment-scope', 'shell/local-supports', 'shell/receiver-order', 'shell/retained-environment', 'shell/source-trust',
    ],
    // The prelude is invoked as `(prelude)(["shell", ...], ...)`; dropping
    // "shell" from that argument removes the object but not the grant.
    create: (applied) => rewriteSrcdoc(applied, (srcdoc) => srcdoc.replace(/(<script data-kehto-nip5d-injection>[\s\S]*?\}\)\(\[)"shell",?/, '$1')),
  },
  {
    name: 'duplicate-shell-init',
    description: 'The runtime sends every shell.init twice.',
    expect: ['shell/once-per-lifecycle'],
    create: (applied) => ({
      outbound(_windowId, message) {
        if ((message as { type?: unknown } | null)?.type !== 'shell.init') return [message];
        applied.count += 1;
        return [message, message];
      },
    }),
  },
  {
    name: 'gate-on-shell-ready',
    description: 'Domain requests from shell-exposed endpoints wait for shell.ready.',
    expect: ['nip5d/readiness-independent'],
    create: gateOnShellReady,
  },
  {
    name: 'advertise-uncovered-domain',
    domains: ['conformance-fake'],
    description: 'The runtime advertises a domain the catalog has no fixture for.',
    expect: ['catalog/advertised-domain-covered'],
    create: (applied) => ({
      advertised(live) {
        applied.count += 1;
        return { domains: [...live.domains, 'conformance-fake'], services: live.services };
      },
    }),
  },
  {
    name: 'drop-correlation-id',
    domains: ['theme'],
    description: 'theme.get.result comes back with a different id than the request.',
    // With no correlated reply, theme has no proved coverage and nothing that works.
    expect: ['catalog/advertised-domain-covered', 'catalog/capability-truthfulness', 'theme/correlation', 'theme/semantics'],
    create: (applied) => ({
      outbound(_windowId, message) {
        const envelope = message as Record<string, unknown> | null;
        if (envelope?.type !== 'theme.get.result') return [message];
        applied.count += 1;
        return [{ ...envelope, id: `${String(envelope.id)}-rewritten` }];
      },
    }),
  },
  {
    name: 'inc-dtag-identity',
    domains: ['inc'],
    description: 'INC sender and peer fields carry manifest d tags instead of runtime endpoint identifiers.',
    expect: ['inc/channel-lifecycle', 'inc/endpoint-identity'],
    create: incIdentifiersAsDTags,
  },
  {
    name: 'retain-state-after-destroy',
    domains: ['inc'],
    description: 'Destroying an endpoint leaves its runtime session, subscriptions and channels in place.',
    expect: ['inc/channel-lifecycle', 'inc/topic-routing'],
    create: (applied) => {
      applied.count += 1;
      return { keepRuntimeStateOnDestroy: true };
    },
  },
  {
    name: 'supports-depends-on-init',
    description: 'shell.supports() returns false until shell.init arrives.',
    expect: ['shell/local-supports'],
    create: (applied) => rewriteSrcdoc(applied, (srcdoc) => srcdoc.replace(SUPPORTS_BODY, 'function supports(domain) { if (!environment) return false; return ')),
  },
  {
    name: 'init-invents-domain',
    description: 'shell.supports() trusts the domains listed in shell.init.',
    expect: ['shell/local-supports'],
    create: (applied) => rewriteSrcdoc(applied, (srcdoc) => srcdoc.replace(SUPPORTS_BODY, 'function supports(domain) { if (environment && environment.capabilities.domains.includes(domain)) return true; return ')),
  },
];

/**
 * Look up a mutation and build its tamper.
 *
 * @param name - Mutation name.
 * @returns The spec, a fresh tamper and its application counter.
 * @throws When no mutation has that name.
 * @example
 * ```ts
 * const { tamper, applied } = createMutation('duplicate-shell-init');
 * ```
 */
export function createMutation(name: string): { spec: MutationSpec; tamper: KehtoTamper; applied: { count: number } } {
  const spec = MUTATIONS.find((mutation) => mutation.name === name);
  if (!spec) throw new Error(`Unknown mutation "${name}"`);
  const applied = { count: 0 };
  return { spec, tamper: spec.create(applied), applied };
}
