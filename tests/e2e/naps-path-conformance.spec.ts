/**
 * naps-path-conformance.spec.ts — TERM-04 / G6.
 *
 * Proves the migrated playground exercises the REAL released @napplet/shim
 * (0.13) naps→supports() path — not the removed hand-rolled override that read
 * the legacy `nubs` array.
 *
 * Background (verified against the installed dist):
 *   - @kehto/shell advertises conformant NAP-SHELL capabilities in shell.init:
 *     `capabilities.domains` (carries bare 'inc') + `capabilities.protocols`
 *     (`{ inc: ['NAP-01'..'NAP-06'] }`), emitted as a superset alongside the
 *     legacy naps/nubs arrays (TERM-05 back-compat).
 *   - @napplet/shim 0.13's makeSupports(env) builds supports(domain, protocol?)
 *     from `capabilities.{domains, protocols}`:
 *       * supports(domain)            → domains.has(domain)
 *       * supports(domain, protocol)  → protocols[domain]?.includes(protocol)
 *     It does NOT strip a `nub:` prefix, and it does NOT treat a colon-joined
 *     'inc:NAP-01' as a domain. So the modern two-arg protocol form is the only
 *     one that resolves a numbered NAP protocol at the shim layer.
 *   - The playground layers a thin `nap:` alias on top of the real shim
 *     (apps/playground/src/theme.ts `patchNapSupportsAlias`, installed via
 *     installNapTheme() in each napplet): it strips a leading `nap:` and
 *     resolves `supports(domain) || supports('nub:'+domain)`. So in the
 *     PLAYGROUND host, `supports('nap:inc') === true` (TERM-01 primary prefix),
 *     while `supports('nub:inc')` stays false (the alias does not strip nub:).
 *
 * Target: the migrated profile-viewer napplet (requires ['inc', ...]; checks
 * supports('inc', 'NAP-01')). Asserting these booleans in-frame proves the real
 * shim resolved them from the shell's naps/domains capabilities.
 *
 * Honors workers:1 (serial, no describe.configure parallel) and the reload-heavy
 * demo boot (test.setTimeout(120000)).
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

test('profile-viewer resolves supports() via the real shim 0.13 naps/domains path', async ({ page }) => {
  test.setTimeout(120_000);

  await demoBeforeEach(page);

  // Resolve the profile-viewer content frame (srcdoc → opaque origin, so go via
  // the container element, not the URL), then wait until the shim has installed
  // window.napplet.shell.supports (set on shell.init).
  let frameSupportsReady = false;
  await expect.poll(async () => {
    const handle = await page.locator('#profile-viewer-frame-container iframe').elementHandle();
    const frame = handle ? await handle.contentFrame() : null;
    if (!frame) return false;
    frameSupportsReady = await frame.evaluate(() => {
      const w = window as Window & {
        napplet?: { shell?: { supports?: unknown } };
      };
      return typeof w.napplet?.shell?.supports === 'function';
    });
    return frameSupportsReady;
  }, { timeout: 30_000 }).toBe(true);

  const handle = await page.locator('#profile-viewer-frame-container iframe').elementHandle();
  expect(handle, 'profile-viewer iframe handle').not.toBeNull();
  const frame = await handle!.contentFrame();
  expect(frame, 'profile-viewer content frame').not.toBeNull();

  // Single evaluate → deterministic boolean shape under workers:1.
  const result = await frame!.evaluate(() => {
    const w = window as Window & {
      napplet?: { shell?: { supports?: (domain: string, protocol?: string) => boolean } };
    };
    const supports = w.napplet!.shell!.supports!;
    return {
      // Modern naps/domains path — what the real shim resolves true:
      incDomain: supports('inc'),                  // 'inc' ∈ domains
      incProtocolTwoArg: supports('inc', 'NAP-01'), // protocols['inc'] includes 'NAP-01'
      // Legacy / unsupported forms — the 0.13 shim resolves these false:
      ifcDomain: supports('ifc'),                  // 'ifc' not in domains (renamed → inc)
      incProtocolSingleArg: supports('inc:NAP-01'),// colon-joined is NOT a bare domain
      napPrefixed: supports('nap:inc'),            // playground nap: alias → true (TERM-01)
      nubPrefixed: supports('nub:inc'),            // neither shim nor alias strips nub:
      unknownDomain: supports('nostrdb'),          // not advertised at all
    };
  });

  // The migration's integration proof: the modern wire/domain resolves true,
  // the legacy 'ifc' domain resolves false, only the two-arg protocol form
  // resolves a numbered NAP protocol under the real shim 0.13, and the
  // playground's nap: primary-prefix alias resolves while nub: does not.
  expect(result).toEqual({
    incDomain: true,
    incProtocolTwoArg: true,
    ifcDomain: false,
    incProtocolSingleArg: false,
    napPrefixed: true,
    nubPrefixed: false,
    unknownDomain: false,
  });
});
