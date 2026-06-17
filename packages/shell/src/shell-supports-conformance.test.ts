/**
 * shell-supports-conformance.test.ts
 *
 * Behavior verification of kehto-emitted capabilities against the REAL
 * @napplet/shim@0.13.0 supports() logic.
 *
 * ## What changed in 0.13 (capability model migration)
 *
 * @napplet/shim@0.13.0 no longer ships its own `createShellSupports`. On
 * `shell.init` it delegates to @napplet/nap@0.12's shell shim:
 *
 *   import { createShellEnvironment, makeSupports } from '@napplet/nap/shell/shim';
 *   const env = createShellEnvironment(msg);   // reads msg.capabilities.{domains, protocols}
 *   shell.supports = makeSupports(env);        // domains Set + protocols map
 *
 * The pre-0.13 model read a FLAT `capabilities.naps` string array and expanded
 * `domain:NAP-NN` entries in-shim. The 0.13 model reads a STRUCTURED
 * `capabilities.{ domains: string[], protocols: Record<string, string[]> }`.
 * This is a wire-shape change, not a rename.
 *
 * ## kehto's emitted wire shape (this release)
 *
 * `buildShellCapabilities` (shell-init.ts) emits `{ naps, nubs, sandbox }` — the
 * pre-0.13 flat-array vocabulary — and the runtime ifc+inc dual-route plus the
 * naps+nubs dual-emit are intentionally preserved for the back-compat window
 * (TERM-05). kehto does NOT yet emit `capabilities.{domains, protocols}`.
 *
 * Because of that, this test verifies kehto's emitted `naps` against the real
 * 0.13 `makeSupports` via the same `naps → { domains, protocols }` projection
 * the 0.13 shim's input contract requires (bare entries → domains; `d:NAP-NN`
 * entries → protocols[d] plus the bare domain `d`). The projection is the
 * minimal, faithful adapter from kehto's current wire vocabulary to the 0.13
 * capability object — it does NOT change kehto's emission and contains no
 * window references (safe under Node/vitest).
 *
 * NOTE (model-gap, tracked for the wire-format follow-up): fed kehto's raw
 * `{ naps }` object directly, the real 0.13 `makeSupports` returns `false` for
 * every query because `createShellEnvironment` reads `capabilities.domains`,
 * which kehto does not yet emit. The `feeds raw naps → all false` test below
 * pins that gap so the eventual runtime wire-format migration is caught.
 *
 * Verified against:
 *   node_modules/.pnpm/@napplet+shim@0.13.0/.../dist/index.js (handleShellInit)
 *   node_modules/.pnpm/@napplet+nap@0.12.0/.../dist/shell/shim.js (createShellEnvironment, makeSupports)
 */

import { describe, it, expect } from 'vitest';
// Real 0.13 supports() logic: @napplet/shim@0.13 delegates to these on shell.init.
import { createShellEnvironment, makeSupports } from '@napplet/nap/shell/shim';
import { buildShellCapabilities } from './shell-init.js';
import type { ShellAdapter } from './types.js';

// ---------------------------------------------------------------------------
// naps → capabilities.{ domains, protocols } projection.
//
// This mirrors the input contract of the real 0.13 `createShellEnvironment`:
//   - bare `domain` entries become `domains` members;
//   - `domain:NAP-NN` entries register `protocols[domain] += ['NAP-NN']` and
//     also surface the bare `domain` (parity with the pre-0.13 expansion).
// No shim logic is reimplemented here — `makeSupports` below is the real one.
// ---------------------------------------------------------------------------

function napsToCapabilityObject(
  naps: string[],
): { domains: string[]; protocols: Record<string, string[]> } {
  const domains = new Set<string>();
  const protocols: Record<string, string[]> = {};
  for (const entry of naps) {
    const match = /^([^:]+):(NAP-\d+)$/i.exec(entry);
    if (match) {
      const [, domain, protocol] = match;
      domains.add(domain);
      (protocols[domain] ??= []).push(protocol);
    } else {
      domains.add(entry);
    }
  }
  return { domains: [...domains], protocols };
}

/**
 * Build kehto's emitted naps, project them to the 0.13 capability object, and
 * return the REAL 0.13 `supports(domain, protocol?)` closure for them.
 */
function realShimSupports(naps: string[]): (domain: string, protocol?: string) => boolean {
  const capabilities = napsToCapabilityObject(naps);
  const env = createShellEnvironment({
    type: 'shell.init',
    capabilities,
    services: [],
    class: null,
  });
  return makeSupports(env);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
// Conformance — kehto-emitted naps fed through the real 0.13 supports() logic
// ---------------------------------------------------------------------------

describe('real @napplet/shim@0.13 makeSupports fed kehto-emitted naps (projected)', () => {
  const caps = buildShellCapabilities(baseHooks());
  const supports = realShimSupports(caps.naps);

  describe('bare inc domain', () => {
    it('supports("inc") === true (bare domain present via inc:NAP-NN projection)', () => {
      expect(supports('inc')).toBe(true);
    });
  });

  describe('inc:NAP-0N protocol queries', () => {
    it('supports("inc", "NAP-01") === true', () => {
      expect(supports('inc', 'NAP-01')).toBe(true);
    });
    it('supports("inc", "NAP-02") === true', () => {
      expect(supports('inc', 'NAP-02')).toBe(true);
    });
    it('supports("inc", "NAP-03") === true', () => {
      expect(supports('inc', 'NAP-03')).toBe(true);
    });
    it('supports("inc", "NAP-04") === true', () => {
      expect(supports('inc', 'NAP-04')).toBe(true);
    });
    it('supports("inc", "NAP-05") === true', () => {
      expect(supports('inc', 'NAP-05')).toBe(true);
    });
    it('supports("inc", "NAP-06") === true', () => {
      expect(supports('inc', 'NAP-06')).toBe(true);
    });
  });

  describe('other advertised bare domains', () => {
    it('supports("storage") === true', () => {
      expect(supports('storage')).toBe(true);
    });
    it('supports("identity") === true', () => {
      expect(supports('identity')).toBe(true);
    });
    it('supports("theme") === true', () => {
      expect(supports('theme')).toBe(true);
    });
    it('supports("relay") === true (always wired — relayPool is required ShellAdapter field)', () => {
      expect(supports('relay')).toBe(true);
    });
  });

  describe('removed / unknown domain queries', () => {
    it('supports("ifc") === false (removed from naps; only in legacy nubs)', () => {
      // ifc is NOT in naps — only inc is. The 0.13 shim reads naps only (via projection).
      expect(supports('ifc')).toBe(false);
    });
    it('supports("bogus") === false (not advertised)', () => {
      expect(supports('bogus')).toBe(false);
    });
    it('supports("ifc", "NAP-01") === false (protocol exists only as inc:NAP-01)', () => {
      expect(supports('ifc', 'NAP-01')).toBe(false);
    });
  });

  describe('naps field — NOT nubs (0.13 shim never reads nubs)', () => {
    it('only-nubs naps=[] → false; populated naps → true', () => {
      const onlyNubs = realShimSupports([]);
      expect(onlyNubs('inc')).toBe(false);
      const onlyNaps = realShimSupports(caps.naps);
      expect(onlyNaps('inc')).toBe(true);
    });
  });

  describe('model-gap pin (wire-format follow-up)', () => {
    it('feeds raw {naps} (no projection) → real 0.13 makeSupports returns false for every query', () => {
      // createShellEnvironment reads capabilities.{domains, protocols}; kehto emits
      // capabilities.{naps, nubs, sandbox}. Until the runtime emits the structured
      // shape, the raw object resolves to { domains: [], protocols: {} }.
      const env = createShellEnvironment({
        type: 'shell.init',
        capabilities: { naps: caps.naps, nubs: caps.nubs, sandbox: caps.sandbox },
        services: [],
        class: null,
      });
      const supportsRaw = makeSupports(env);
      expect(supportsRaw('inc')).toBe(false);
      expect(supportsRaw('relay')).toBe(false);
      expect(supportsRaw('inc', 'NAP-01')).toBe(false);
    });
  });
});

describe('real @napplet/shim@0.13 makeSupports — without upload backend', () => {
  it('supports("upload") === false when upload not wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    const supports = realShimSupports(caps.naps);
    expect(supports('upload')).toBe(false);
  });
});

describe('real @napplet/shim@0.13 makeSupports — with upload backend', () => {
  it('supports("upload") === true when upload is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      upload: { getUploader: () => ({ rails: ['nip96'] }) },
    };
    const caps = buildShellCapabilities(hooks);
    const supports = realShimSupports(caps.naps);
    expect(supports('upload')).toBe(true);
  });
});
