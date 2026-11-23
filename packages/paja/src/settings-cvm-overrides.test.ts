/**
 * Proves `cvm.serverRequestTimeoutMs` reaches `createCvmService` from Paja's
 * window-scoped multiplayer CVM service. NAP-CVM #31 @ 28cf1bdb leaves server
 * request expiry to "session policy"; the registry max (300000) matches the
 * Timeouts bound `createCvmService` enforces, so no setting can exceed it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { PajaMultiplayerConfig } from './multiplayer-config.js';
import type { PajaRelayBackend } from './browser-relay-runtime.js';
import { getPajaSettingDefault, PAJA_SETTING_DEFINITIONS, setActivePajaSettings } from './settings.js';

const created = vi.hoisted(() => [] as { serverRequestTimeoutMs?: number }[]);

vi.mock('@kehto/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kehto/services')>();
  return {
    ...actual,
    createCvmService: (options: Parameters<typeof actual.createCvmService>[0]) => {
      created.push({ serverRequestTimeoutMs: options.serverRequestTimeoutMs });
      return actual.createCvmService(options);
    },
  };
});

const { createPajaMultiplayerServices } = await import('./browser-multiplayer-services.js');

afterEach(() => {
  setActivePajaSettings({});
  created.length = 0;
});

function openCvmScope(): void {
  const { cvm } = createPajaMultiplayerServices({
    config: { relays: [] } as unknown as PajaMultiplayerConfig,
    registry: [],
    scopeKey: () => 'scope',
    namespace: () => undefined,
    backend: () => ({}) as unknown as PajaRelayBackend,
  });
  cvm.handleMessage('w1', { type: 'cvm.close', id: 'probe', session: 'none' } as unknown as NappletMessage, () => undefined);
}

describe('cvm.serverRequestTimeoutMs', () => {
  it('defaults to the NAP-CVM Timeouts default and stays inside its bound', () => {
    const definition = PAJA_SETTING_DEFINITIONS.find((entry) => entry.key === 'cvm.serverRequestTimeoutMs');
    expect(getPajaSettingDefault('cvm.serverRequestTimeoutMs')).toBe(30_000);
    expect(definition?.max).toBe(300_000);
  });

  it('passes the override to the window-scoped CVM service', () => {
    setActivePajaSettings({ 'cvm.serverRequestTimeoutMs': 45_000 });
    openCvmScope();
    expect(created).toEqual([{ serverRequestTimeoutMs: 45_000 }]);
  });
});
