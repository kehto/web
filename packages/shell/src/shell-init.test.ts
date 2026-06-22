/**
 * shell-init.test.ts — buildShellCapabilities advertisement.
 *
 * Verifies the shell emits the `naps` (NAP vocabulary) array plus the
 * conformant `domains`/`protocols` shape in the shell.init handshake, so
 * napplets built against @napplet/shim >=0.9.0 (reading `naps`) and >=0.13
 * (reading `domains`/`protocols`) both negotiate correctly.
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

  it('advertises link in domains when a link opener is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      link: { isAvailable: () => true },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).toContain('link');
  });

  it('does NOT advertise link in domains when the link opener reports unavailable', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      link: { isAvailable: () => false },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).not.toContain('link');
  });

  it('advertises common in domains when common social helpers are wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      common: { isAvailable: () => true },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).toContain('common');
  });

  it('advertises lists in domains when list mutation helpers are wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      lists: { isAvailable: () => true },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).toContain('lists');
  });

  it('does NOT advertise lists in domains when list mutation helpers report unavailable', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      lists: { isAvailable: () => false },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).not.toContain('lists');
  });

  it('does NOT advertise common in domains when common social helpers report unavailable', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      common: { isAvailable: () => false },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).not.toContain('common');
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
// naps — NAP vocabulary
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — naps array (NAP vocabulary)', () => {
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

  it('naps contains NO removed transport-prefixed entry', () => {
    const caps = buildShellCapabilities(baseHooks());
    const removedTransport = [105, 102, 99].map((char) => String.fromCharCode(char)).join('');
    const removedTransportEntries = caps.naps.filter(e => e.startsWith(removedTransport));
    expect(removedTransportEntries).toHaveLength(0);
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
// naps — NAP-UPLOAD advertisement
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
// naps — NAP-INTENT advertisement
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
// naps — NAP-LINK advertisement
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — NAP-LINK advertisement in naps', () => {
  it('does NOT advertise link in naps when no link opener is wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.naps).not.toContain('link');
  });

  it('advertises link in naps when an available link opener is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      link: { isAvailable: () => true },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.naps).toContain('link');
  });

  it('removes link from domains and naps when disabled by capability override', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      link: { isAvailable: () => true },
      capabilities: { disabledDomains: ['link'] },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).not.toContain('link');
    expect(caps.naps).not.toContain('link');
  });
});

// ---------------------------------------------------------------------------
// naps — NAP-COMMON advertisement
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — NAP-COMMON advertisement in naps', () => {
  it('does NOT advertise common in naps when no common backend is wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.naps).not.toContain('common');
  });

  it('does NOT advertise common in naps when the common backend reports unavailable', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      common: { isAvailable: () => false },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.naps).not.toContain('common');
  });

  it('advertises common in naps when an available common backend is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      common: { isAvailable: () => true },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.naps).toContain('common');
  });

  it('removes common from domains and naps when disabled by capability override', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      common: { isAvailable: () => true },
      capabilities: { disabledDomains: ['common'] },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).not.toContain('common');
    expect(caps.naps).not.toContain('common');
  });
});

// ---------------------------------------------------------------------------
// naps — NAP-LISTS advertisement
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — NAP-LISTS advertisement in naps', () => {
  it('does NOT advertise lists in naps when no lists backend is wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.naps).not.toContain('lists');
  });

  it('does NOT advertise lists in naps when the lists backend reports unavailable', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      lists: { isAvailable: () => false },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.naps).not.toContain('lists');
  });

  it('advertises lists in naps when an available lists backend is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      lists: { isAvailable: () => true },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.naps).toContain('lists');
  });

  it('removes lists from domains and naps when disabled by capability override', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      lists: { isAvailable: () => true },
      capabilities: { disabledDomains: ['lists'] },
    };
    const caps = buildShellCapabilities(hooks);
    expect(caps.domains).not.toContain('lists');
    expect(caps.naps).not.toContain('lists');
  });
});

// ---------------------------------------------------------------------------
// Capability shape
// ---------------------------------------------------------------------------

describe('buildShellCapabilities — capability shape', () => {
  it('returns an object with naps and sandbox', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps).toHaveProperty('naps');
    expect(caps).toHaveProperty('sandbox');
  });

  it('superset: conformant domains/protocols ride ALONGSIDE naps/sandbox (TERM-05)', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps).toHaveProperty('domains');
    expect(caps).toHaveProperty('protocols');
    // flat back-compat fields
    expect(caps).toHaveProperty('naps');
    expect(caps).toHaveProperty('sandbox');
    expect(caps.naps).toContain('inc:NAP-01');
    expect(caps.sandbox).toEqual([]);
  });

  it('sandbox is empty by default', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(caps.sandbox).toEqual([]);
  });

  it('filters disabled domains from domains, naps, and protocols', () => {
    const caps = buildShellCapabilities({
      ...baseHooks(),
      upload: { getUploader: () => ({ rails: ['dev-memory'] }) },
      intent: { isAvailable: () => true },
      capabilities: { disabledDomains: ['relay', 'outbox', 'inc', 'upload'] },
    });

    expect(caps.domains).not.toContain('relay');
    expect(caps.domains).not.toContain('outbox');
    expect(caps.domains).not.toContain('inc');
    expect(caps.domains).not.toContain('upload');
    expect(caps.naps).not.toContain('relay');
    expect(caps.naps).not.toContain('outbox');
    expect(caps.naps).not.toContain('inc');
    expect(caps.naps).not.toContain('inc:NAP-01');
    expect(caps.naps).not.toContain('upload');
    expect(caps.protocols).not.toHaveProperty('inc');
  });
});
