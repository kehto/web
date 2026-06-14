/**
 * shell-init.test.ts — buildShellCapabilities advertisement.
 *
 * Verifies the shell advertises the NAP-UPLOAD `upload` domain only when the
 * host wires an upload backend (ShellAdapter.upload), so napplets discover it
 * via shell.supports('upload').
 */

import { describe, it, expect } from 'vitest';
import { buildShellCapabilities } from './shell-init.js';
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

describe('buildShellCapabilities — NAP-UPLOAD advertisement', () => {
  it('does NOT advertise upload when no upload backend is wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.nubs).not.toContain('upload');
  });

  it('advertises upload when an upload backend is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      upload: { getUploader: () => ({ rails: ['nip96', 'blossom'] }) },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.nubs).toContain('upload');
  });
});
