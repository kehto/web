---
quick_id: 261101-u20
slug: nip5d-port-bound-identity
date: 2026-11-01
mode: quick (inline plan + execute; research done in-session)
---

# NIP-5D port-bound identity (security chase)

## Authority

- Spec: nostr-protocol/nips#2303 `5D.md` @ `51ef0cd33a5694784306f3260d90b1872545fdee` (draft; bleeding-edge policy applies).
- Packaged contract: napplet/web#302 (commit 180297b), released in Version Packages #303:
  `@napplet/core@0.37.0`, `@napplet/nap@0.36.0`, `@napplet/shim@0.35.0`, `@napplet/sdk@0.31.2`,
  `@napplet/conformance@0.24.0`, `@napplet/conformance-cli@0.5.0`.
- Reference shell behaviour: `@napplet/conformance` `bindNappletPort` (`packages/conformance/src/shell/port-binding.ts`).

## Vulnerability

A `Window` survives same-frame navigation and an injected `meta` CSP does not, so a verified napplet could
navigate its own frame to unverified content that kept the iframe's identity, grants and sessions because
Kehto keyed everything on `event.source`/`contentWindow` and replied with `iframeWindow.postMessage`.

## Spec requirements → Kehto changes

1. Bootstrap creates a `MessageChannel` before napplet scripts, keeps port1 private, posts
   `{type:'napplet.hello'}` with port2 once; all NAP traffic over the port.
   → `packages/shell/src/napplet-namespace.ts` prelude `post`/`listen` move to the private port.
2. Shell accepts hello only from a registered iframe `contentWindow` with exactly one port; binds identity
   to the port; processes NAP only from the port; never `iframeWindow.postMessage` NAP; never transfers a
   port into the iframe.
   → `origin-registry.ts` gains port binding (`bindPort`/`getPort`/`postToNapplet`/`getNappletTarget`) and a
   spent-window guard; `shell-bridge.ts` handles window-level hello and port dispatch; every sender
   (`hooks-adapter`, keys/media/notify proxies, audio-manager, shell-ready `shell.init`, theme/identity
   publish, scoped relay) goes through the port.
3. Second hello, any other window-level message after handoff, invalid hello, second `load`, port
   close/error → close port, revoke binding + sessions + subscriptions, remove frame; never re-bind an
   identity to an existing iframe.
   → `ShellBridge.revokeNapplet(windowId, reason)`, `ShellBridge.observeFrame(frame, windowId)` (second-load
   detection), `ShellAdapter.onNappletRevoked` hook (host removes the frame); `originRegistry.register`
   rejects a spent Window.
4. Hosts: Paja creates a fresh iframe per navigation/generation, removes revoked frames, logs outbound via
   `postToNapplet`, keeps shell-authored launcher messages out of the bridge; e2e harness binds ports,
   captures outbound via `postToNapplet`, injects test envelopes via `runtime.handleMessage`.
5. Deps: widen peer ranges to include core 0.37 / nap 0.36; bump dev pins; fixtures rely on the
   runtime-injected namespace (drop `import '@napplet/shim'`, which would send a second hello).
6. Tests (unit + static guard + e2e), docs (`docs/policies/NIP-5D-CONFORMANCE.md`, package docs,
   `docs/compatibility.md` retirement of window transport), changesets (minor, breaking on 0.x).

## No compatibility path

Window-level NAP transport is a security hole the spec forbids (MUST NOT process NAP from any source other
than the bound port). It is retired, not shimmed: negative tests prove legacy window-level envelopes revoke
the frame.

## Done

build, type-check, test:unit, docs:check, slop gate, relevant e2e, atomic commits, PR.
