import { describe, expect, it } from 'vitest';
import * as shell from './index.js';
import { renderNappletNamespacePrelude } from './napplet-namespace.js';
import { buildShellCapabilities, resolveShellEnvironment } from './shell-init.js';
import type { ShellAdapter } from './types.js';

function baseHooks(): ShellAdapter {
  return {
    relayPool: {
      getRelayPool: () => null,
      trackSubscription: () => {},
      untrackSubscription: () => {},
      openScopedRelay: () => {},
      closeScopedRelay: () => {},
      publishToScopedRelay: () => false,
      selectRelayTier: () => [],
    },
    relayConfig: {
      addRelay: () => {},
      removeRelay: () => {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => null,
    },
    windowManager: { createWindow: () => null },
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => null },
    crypto: { verifyEvent: async () => true },
  };
}

function service(name: string) {
  return {
    descriptor: { name, version: '1.0.0' },
    handleMessage: () => {},
  };
}

describe('buildShellCapabilities', () => {
  it('emits only a copied readonly domain collection', () => {
    const first = buildShellCapabilities(baseHooks());
    const second = buildShellCapabilities(baseHooks());

    expect(Object.keys(first)).toEqual(['domains']);
    expect(first.domains).toEqual([
      'relay', 'identity', 'storage', 'inc', 'theme', 'keys', 'media', 'notify',
    ]);
    expect(first.domains).not.toBe(second.domains);
    expect(() => (first.domains as string[]).push('forged')).toThrow();
  });

  const unwiredDomains: ReadonlyArray<readonly [string, Partial<ShellAdapter>]> = [
    ['config', {}],
    ['resource', {}],
    ['cvm', {}],
    ['outbox', {}],
    ['upload', { upload: { getUploader: () => null } }],
    ['intent', { intent: { isAvailable: () => false } }],
    ['link', { link: { isAvailable: () => false } }],
    ['common', { common: { isAvailable: () => false } }],
    ['lists', { lists: { isAvailable: () => false } }],
    ['serial', { serial: { isAvailable: () => false } }],
    ['ble', { ble: { isAvailable: () => false } }],
    ['webrtc', { webrtc: { isAvailable: () => false } }],
    ['dm', {}],
    ['count', {}],
  ];

  it.each(unwiredDomains)('does not advertise unwired service-only domain %s', (domain, adapter) => {
    expect(buildShellCapabilities({ ...baseHooks(), ...adapter }).domains).not.toContain(domain);
  });

  it('advertises only registered service domains with available adapters', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      services: {
        config: service('config'),
        resource: service('resource'),
        cvm: service('cvm'),
        outbox: service('outbox'),
        upload: service('upload'),
        intent: service('intent'),
        link: service('link'),
        common: service('common'),
        lists: service('lists'),
        serial: service('serial'),
        ble: service('ble'),
        webrtc: service('webrtc'),
        dm: service('dm'),
        count: service('count'),
      },
      upload: { getUploader: () => ({ rails: ['nip96'] }) },
      intent: { isAvailable: () => true },
      link: { isAvailable: () => true },
      common: { isAvailable: () => true },
      lists: { isAvailable: () => true },
      serial: { isAvailable: () => true },
      ble: { isAvailable: () => true },
      webrtc: { isAvailable: () => true },
      dm: { sendDm: async () => ({ success: true }) },
    };

    expect(buildShellCapabilities(hooks).domains).toEqual([
      'relay', 'identity', 'storage', 'inc', 'theme', 'keys', 'media', 'notify',
      'outbox', 'config', 'resource', 'cvm', 'upload', 'intent', 'link', 'common',
      'lists', 'serial', 'ble', 'webrtc', 'dm', 'count',
    ]);
  });
});

describe('resolveShellEnvironment', () => {
  it('limits identity grants to ordered, live, undisabled domains and services', () => {
    const observed: { domains?: readonly string[]; services?: readonly string[] } = {};
    const hooks: ShellAdapter = {
      ...baseHooks(),
      services: { config: service('config'), count: service('count') },
      capabilities: {
        disabledDomains: ['identity'],
        resolveEnvironment(identity, available) {
          expect(identity).toEqual({ dTag: 'a', aggregateHash: 'hash-a' });
          observed.domains = available.domains;
          observed.services = available.services;
          return {
            domains: ['count', 'identity', 'unknown', 'COUNT', 'relay', 'relay'],
            services: ['count', 'config', 'missing', 'COUNT', 'count'],
          };
        },
      },
    };

    const environment = resolveShellEnvironment(hooks, { dTag: 'a', aggregateHash: 'hash-a' });

    expect(environment).toEqual({
      capabilities: { domains: ['relay', 'count'] },
      services: ['config', 'count'],
    });
    expect(Object.isFrozen(environment)).toBe(true);
    expect(Object.isFrozen(environment.capabilities)).toBe(true);
    expect(Object.isFrozen(environment.capabilities.domains)).toBe(true);
    expect(Object.isFrozen(environment.services)).toBe(true);
    expect(() => (observed.domains as string[]).push('forged')).toThrow();
    expect(() => (observed.services as string[]).push('forged')).toThrow();
  });

  it('returns equal but independently immutable snapshots for identical inputs', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      capabilities: {
        resolveEnvironment: () => ({ domains: ['relay'], services: [] }),
      },
    };
    const identity = { dTag: 'same', aggregateHash: 'same-hash' };
    const first = resolveShellEnvironment(hooks, identity);
    const second = resolveShellEnvironment(hooks, identity);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.capabilities).not.toBe(second.capabilities);
    expect(first.capabilities.domains).not.toBe(second.capabilities.domains);
    expect(first.services).not.toBe(second.services);
  });

  it('is exported only by the host adapter barrel', () => {
    expect(shell.resolveShellEnvironment).toBe(resolveShellEnvironment);
    expect(renderNappletNamespacePrelude({ domains: ['relay'] })).not.toContain('resolveShellEnvironment');
  });
});
