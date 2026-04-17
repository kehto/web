/**
 * shell-init.ts — Shell initialization utilities.
 *
 * Provides two complementary mechanisms for the NIP-5D shell initialization:
 *
 * 1. buildShellCapabilities() — Derives the shell's static NUB capability set
 *    from the ShellAdapter configuration. Used in the shell.ready/shell.init
 *    handshake (Option B) so napplets can query shell.supports() synchronously.
 *
 * 2. generateNostrBootstrap() — Generates a JavaScript source string that
 *    installs window.nostr as a postMessage-based proxy. Used as an Option A
 *    (srcdoc) fallback for shim-less napplets that need window.nostr without
 *    bundling @napplet/shim.
 */

// DRIFT-SHELL-01 — Phase 12: delete generateNostrBootstrap() and all window.nostr injection; canonical NIP-5D forbids window.nostr in napplet iframes
// DRIFT-SHELL-03 — Phase 12: signing moves into shell-owned relay-publish paths (relay.publishEncrypted); remove signer postMessage surface

import type { ShellAdapter, ShellCapabilities } from './types.js';

/**
 * Build the shell's static capability set from adapter configuration.
 *
 * NUB capabilities are derived from which hooks are provided:
 * - 'relay' if relayPool hooks exist (relay NUB is wired)
 * - 'signer' always (auth hooks are required — signing is always available)
 * - 'storage' always (statePersistence is part of RuntimeAdapter)
 * - 'ifc' always (built-in inter-frame communication NUB in runtime)
 *
 * Sandbox permissions would be derived from the iframe's sandbox attribute,
 * but since the shell does not control iframe creation directly (the host app
 * does via onNip5dIframeCreate), sandbox is left empty by default. Host apps
 * can extend the capabilities after construction.
 *
 * @param hooks - The ShellAdapter provided by the host app
 * @returns ShellCapabilities with nubs and sandbox arrays
 * @example
 * ```ts
 * const caps = buildShellCapabilities(hooks);
 * // caps.nubs => ['relay', 'signer', 'storage', 'ifc'] (with relay pool)
 * // caps.nubs => ['signer', 'storage', 'ifc'] (without relay pool)
 * // caps.sandbox => []
 * ```
 */
// DRIFT-SHELL-02 — Phase 12: route sandbox perms through 'perm:<permission>' namespace; bare names kept only for NUB-capability lookups
// DRIFT-SHELL-04 — Phase 12: replace ['signer', 'storage', 'ifc'] with canonical 8-domain list ['relay','identity','storage','ifc','theme','keys','media','notify']
export function buildShellCapabilities(hooks: ShellAdapter): ShellCapabilities {
  const nubs: string[] = ['signer', 'storage', 'ifc'];
  // relay is conditional on relayPool being provided
  if (hooks.relayPool) nubs.unshift('relay');
  return { nubs, sandbox: [] };
}

/**
 * Generate a JavaScript bootstrap script that installs window.nostr
 * as a postMessage-based proxy in a napplet iframe.
 *
 * This is the Option A (srcdoc) fallback for napplets that do not include
 * @napplet/shim. The script is injected into the iframe's srcdoc before
 * any napplet code runs, ensuring window.nostr is available synchronously.
 *
 * The proxy routes all NIP-07 methods through signer.* NUB envelope
 * messages via postMessage to the parent shell. All seven NIP-07 method
 * groups are covered: getPublicKey, signEvent, getRelays, nip04.encrypt,
 * nip04.decrypt, nip44.encrypt, nip44.decrypt.
 *
 * Security: No private key material is injected. All signing is proxied
 * through the shell's auth.getSigner(). The iframe's window.nostr makes
 * postMessage calls; the shell forwards them to the signer NUB handler
 * and returns only the result. The ACL enforcement path and consent gating
 * for destructive signing kinds apply as normal.
 *
 * @returns JavaScript source code string (not wrapped in <script> tags)
 *
 * @example
 * ```ts
 * const bootstrap = generateNostrBootstrap();
 * iframe.srcdoc = `<script>${bootstrap}</script>${nappletHtml}`;
 * ```
 */
export function generateNostrBootstrap(): string {
  // The script uses ES5-compatible syntax (var, function) for maximum
  // iframe compatibility. Uses crypto.randomUUID() for request IDs —
  // available in all modern browsers including sandboxed iframes.
  return `(function() {
  var _pending = {};

  function _shellRequest(type, params) {
    return new Promise(function(resolve, reject) {
      var id = crypto.randomUUID();
      _pending[id] = { resolve: resolve, reject: reject };
      window.parent.postMessage(Object.assign({ type: type, id: id }, params), '*');
    });
  }

  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data.type !== 'string' || !e.data.id) return;
    var entry = _pending[e.data.id];
    if (!entry) return;
    delete _pending[e.data.id];
    if (e.data.type.endsWith('.error')) {
      entry.reject(new Error(e.data.error || 'Unknown error'));
    } else {
      entry.resolve(e.data);
    }
  });

  window.nostr = {
    getPublicKey: function() {
      return _shellRequest('signer.getPublicKey', {}).then(function(r) { return r.pubkey; });
    },
    signEvent: function(event) {
      return _shellRequest('signer.signEvent', { event: event }).then(function(r) { return r.event; });
    },
    getRelays: function() {
      return _shellRequest('signer.getRelays', {}).then(function(r) { return r.relays; });
    },
    nip04: {
      encrypt: function(pubkey, plaintext) {
        return _shellRequest('signer.nip04.encrypt', { pubkey: pubkey, plaintext: plaintext }).then(function(r) { return r.ciphertext; });
      },
      decrypt: function(pubkey, ciphertext) {
        return _shellRequest('signer.nip04.decrypt', { pubkey: pubkey, ciphertext: ciphertext }).then(function(r) { return r.plaintext; });
      }
    },
    nip44: {
      encrypt: function(pubkey, plaintext) {
        return _shellRequest('signer.nip44.encrypt', { pubkey: pubkey, plaintext: plaintext }).then(function(r) { return r.ciphertext; });
      },
      decrypt: function(pubkey, ciphertext) {
        return _shellRequest('signer.nip44.decrypt', { pubkey: pubkey, ciphertext: ciphertext }).then(function(r) { return r.plaintext; });
      }
    }
  };
})();`;
}
