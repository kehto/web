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
// domains + protocols — conformant NAP-SHELL shape (TERM-03: @napplet/core@0.12,
// read by @napplet/shim@0.13 via createShellEnvironment + makeSupports)
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — domains array (conformant NAP-SHELL, TERM-03)', () => {
  it('returns a domains array', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(Array.isArray(caps.domains)).toBe(true);
  });

  it('domains deep-equals the bare NAP domains (naps MINUS inc:NAP-NN; relayPool always wired)', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.domains).toEqual([
      'relay', 'outbox',
      'identity', 'storage', 'inc', 'theme', 'keys', 'media', 'notify',
      'config', 'resource', 'cvm',
    ]);
  });

  it('domains contains NO inc:NAP-NN protocol strings (those live in protocols)', () => {
    const caps = buildShellCapabilities(baseHooks());
    const protocolEntries = caps.domains.filter(e => /:NAP-\d+$/.test(e));
    expect(protocolEntries).toHaveLength(0);
  });

  it('domains contains relay/outbox when relayPool is wired (always — required ShellAdapter field)', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.domains).toContain('relay');
    expect(caps.domains).toContain('outbox');
  });

  it('does NOT advertise upload in domains when no upload backend is wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.domains).not.toContain('upload');
  });

  it('advertises upload in domains when an upload backend is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      upload: { getUploader: () => ({ rails: ['nip96'] }) },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).toContain('upload');
  });

  it('advertises intent in domains when an available intent dispatcher is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      intent: { isAvailable: () => true },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).toContain('intent');
  });

  it('does NOT advertise intent in domains when the dispatcher reports unavailable', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      intent: { isAvailable: () => false },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).not.toContain('intent');
  });
});

describe('buildShellCapabilities — protocols map (conformant NAP-SHELL, TERM-03)', () => {
  it('protocols.inc deep-equals NAP-01..NAP-06 (inc: prefix stripped)', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.protocols).toEqual({
      inc: ['NAP-01', 'NAP-02', 'NAP-03', 'NAP-04', 'NAP-05', 'NAP-06'],
    });
  });

  it('protocols values carry NO inc: prefix (bare NAP-NN ids only)', () => {
    const caps = buildShellCapabilities(baseHooks());
    for (const list of Object.values(caps.protocols)) {
      for (const p of list) expect(p.startsWith('inc:')).toBe(false);
    }
  });
});

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
      'config', 'resource', 'cvm',
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

  it('superset: conformant domains/protocols ride ALONGSIDE legacy naps/nubs/sandbox (TERM-05)', () => {
    const caps = buildShellCapabilities(baseHooks());
    // conformant 0.13 fields
    expect(caps).toHaveProperty('domains');
    expect(caps).toHaveProperty('protocols');
    // legacy back-compat fields preserved
    expect(caps).toHaveProperty('naps');
    expect(caps).toHaveProperty('nubs');
    expect(caps).toHaveProperty('sandbox');
    expect(caps.naps).toContain('inc:NAP-01');
    expect(caps.nubs).toContain('ifc');
    expect(caps.sandbox).toEqual([]);
  });

  it('sandbox is empty by default', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.sandbox).toEqual([]);
  });
});
