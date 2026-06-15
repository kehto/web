/**
 * shell-init.test.ts — buildShellCapabilities advertisement.
 *
 * Verifies the shell dual-emits both `naps` (NAP vocabulary, primary) and
 * `nubs` (legacy vocabulary) in the shell.init handshake, so napplets built
 * against @napplet/shim >=0.9.0 (reading `naps`) and legacy shims (reading
 * `nubs`) both negotiate correctly.
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

// ---------------------------------------------------------------------------
// naps — NAP vocabulary (primary: consumed by @napplet/shim >=0.9.0)
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — naps array (NAP vocabulary, D2/D3)', () => {
  it('returns a naps array', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(Array.isArray(caps.naps)).toBe(true);
  });

  it('naps contains bare domain "inc"', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.naps).toContain('inc');
  });

  it('naps contains all six inc:NAP-0N protocol entries', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.naps).toContain('inc:NAP-01');
    expect(caps.naps).toContain('inc:NAP-02');
    expect(caps.naps).toContain('inc:NAP-03');
    expect(caps.naps).toContain('inc:NAP-04');
    expect(caps.naps).toContain('inc:NAP-05');
    expect(caps.naps).toContain('inc:NAP-06');
  });

  it('naps contains NO ifc-prefixed entry', () => {
    const caps = buildShellCapabilities(baseHooks());
    const ifcEntries = caps.naps.filter(e => e.startsWith('ifc'));
    expect(ifcEntries).toHaveLength(0);
  });

  it('naps contains NO NUB- substring', () => {
    const caps = buildShellCapabilities(baseHooks());
    const nubEntries = caps.naps.filter(e => e.includes('NUB-'));
    expect(nubEntries).toHaveLength(0);
  });

  it('naps deep-equals the exact ordered list (relayPool is always wired — required ShellAdapter field)', () => {
    // relayPool is a required ShellAdapter field so relay+outbox are always present.
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.naps).toEqual([
      'relay', 'outbox',
      'identity', 'storage', 'inc', 'theme', 'keys', 'media', 'notify',
      'config', 'resource', 'connect', 'class', 'cvm',
      'inc:NAP-01', 'inc:NAP-02', 'inc:NAP-03', 'inc:NAP-04', 'inc:NAP-05', 'inc:NAP-06',
    ]);
  });

  it('naps contains relay/outbox when relayPool is wired (always present — required ShellAdapter field)', () => {
    // relayPool is a required ShellAdapter field, so relay+outbox are always prepended.
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.naps).toContain('relay');
    expect(caps.naps).toContain('outbox');
  });
});

// ---------------------------------------------------------------------------
// naps — NAP-UPLOAD advertisement (D2/D3)
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — NAP-UPLOAD advertisement in naps', () => {
  it('does NOT advertise upload in naps when no upload backend is wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.naps).not.toContain('upload');
  });

  it('advertises upload in naps when an upload backend is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      upload: { getUploader: () => ({ rails: ['nip96', 'blossom'] }) },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.naps).toContain('upload');
  });
});

// ---------------------------------------------------------------------------
// naps — NAP-INTENT advertisement (D2/D3)
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — NAP-INTENT advertisement in naps', () => {
  it('does NOT advertise intent in naps when no intent dispatcher is wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.naps).not.toContain('intent');
  });

  it('does NOT advertise intent in naps when the dispatcher reports unavailable', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      intent: { isAvailable: () => false },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.naps).not.toContain('intent');
  });

  it('advertises intent in naps when an available intent dispatcher is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      intent: { isAvailable: () => true },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.naps).toContain('intent');
  });
});

// ---------------------------------------------------------------------------
// nubs — legacy vocabulary (back-compat: consumed by @napplet/nub and <=0.8.x shims)
// The existing assertions are preserved unchanged to confirm nubs is unaffected.
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — NAP-UPLOAD advertisement (nubs, legacy)', () => {
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

describe('buildShellCapabilities — NAP-INTENT advertisement (nubs, legacy)', () => {
  it('does NOT advertise intent when no intent dispatcher is wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.nubs).not.toContain('intent');
  });

  it('does NOT advertise intent when the dispatcher reports unavailable', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      intent: { isAvailable: () => false },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.nubs).not.toContain('intent');
  });

  it('advertises intent when an available intent dispatcher is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      intent: { isAvailable: () => true },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.nubs).toContain('intent');
  });
});

describe('buildShellCapabilities — nubs legacy vocabulary content (D3)', () => {
  it('nubs still contains bare domain "ifc"', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.nubs).toContain('ifc');
  });

  it('nubs contains ifc:NUB-01 (legacy protocol)', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.nubs).toContain('ifc:NUB-01');
  });

  it('nubs contains ifc:NAP-01 (legacy protocol)', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.nubs).toContain('ifc:NAP-01');
  });

  it('nubs does NOT contain inc or inc:NAP-0N (those belong only in naps)', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.nubs).not.toContain('inc');
    expect(caps.nubs).not.toContain('inc:NAP-01');
  });
});

// ---------------------------------------------------------------------------
// Dual-emit shape
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — dual-emit shape (D2)', () => {
  it('returns an object with naps, nubs, and sandbox', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps).toHaveProperty('naps');
    expect(caps).toHaveProperty('nubs');
    expect(caps).toHaveProperty('sandbox');
  });

  it('sandbox is empty by default', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.sandbox).toEqual([]);
  });
});
