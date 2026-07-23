import { describe, expect, it } from 'vitest';
import * as shellPublicApi from './index.js';
import { renderNappletNamespacePrelude } from './napplet-namespace.js';
import { buildShellCapabilities, resolveShellEnvironment } from './shell-init.js';
import type { ShellAdapter, ShellCapabilities } from './types.js';

function baseHooks(): ShellAdapter {
  return {
    relayPool: { getRelayPool: () => null, trackSubscription: () => {}, untrackSubscription: () => {}, openScopedRelay: () => {}, closeScopedRelay: () => {}, publishToScopedRelay: () => false, selectRelayTier: () => [] },
    relayConfig: { addRelay: () => {}, removeRelay: () => {}, getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }), getNip66Suggestions: () => null },
    windowManager: { createWindow: () => null }, auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' }, hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => null }, crypto: { verifyEvent: async () => true },
  };
}

function createInjectedShell(): {
  shell: { supports: (domain: string) => boolean };
  init: (environment: { capabilities: ShellCapabilities; services: readonly string[] }) => void;
  posted: unknown[];
} {
  const listeners = new Set<(event: { source: unknown; data: unknown }) => void>();
  const posted: unknown[] = [];
  const parent = { postMessage: (message: unknown) => posted.push(message) };
  const target = {
    parent,
    crypto: { randomUUID: () => 'id-1' },
    addEventListener: (type: string, listener: (event: { source: unknown; data: unknown }) => void) => {
      if (type === 'message') listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: { source: unknown; data: unknown }) => void) => listeners.delete(listener),
  } as { parent: typeof parent; crypto: { randomUUID: () => string }; napplet?: { shell?: { supports: (domain: string) => boolean } }; addEventListener: unknown; removeEventListener: unknown };
  const script = renderNappletNamespacePrelude({ domains: [] });
  const source = script.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  if (!source) throw new Error('missing prelude source');
  new Function('window', source)(target);

  return {
    shell: target.napplet?.shell ?? (() => { throw new Error('missing injected shell'); })(),
    init: (environment) => {
      for (const listener of listeners) listener({ source: parent, data: { type: 'shell.init', ...environment } });
    },
    posted,
  };
}

describe('shell.supports domain-only environment', () => {
  it('keeps the public type, shell.init environment, and injected unary results aligned', () => {
    const capabilities = buildShellCapabilities(baseHooks());
    const typedCapabilities: ShellCapabilities = capabilities;
    const environment = resolveShellEnvironment(baseHooks(), { dTag: 'napplet-a', aggregateHash: 'hash-a' });
    const injected = createInjectedShell();

    expect(Object.keys(typedCapabilities)).toEqual(['domains']);
    expect(Object.keys(environment)).toEqual(['capabilities', 'services']);
    expect(environment.capabilities).toEqual(capabilities);
    expect(injected.posted).toEqual([{ type: 'shell.ready' }]);
    expect(injected.shell.supports.length).toBe(1);
    expect(injected.shell.supports('inc')).toBe(false);
    injected.init(environment);
    expect(injected.shell.supports('inc')).toBe(true);
    expect(injected.shell.supports('outbox')).toBe(false);
  });

  it('exports the environment resolver only for host integrators', () => {
    const script = renderNappletNamespacePrelude({ domains: ['relay'] });

    expect(shellPublicApi.resolveShellEnvironment).toBe(resolveShellEnvironment);
    expect(script).toContain('function supports(domain)');
    expect(script).not.toContain('resolveShellEnvironment');
  });
});
