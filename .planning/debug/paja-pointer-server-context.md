---
status: resolved
trigger: "Deployed Paja still returns Blossom blocked-by-policy for GBColor when no signer supplies a working server list"
created: 2026-08-27
updated: 2026-08-27
---

# Paja verified-pointer Blossom server context

## Symptoms

expected: Paja should use every relevant ordered Blossom candidate source and
  fetch a ROM anonymously when the verified napplet pointer event supplies a
  working server hint.
actual: The deployed Paja resolves GBColor and lists its Global ROM events, but
  selecting NHL Blades of Steel returns `resource.bytes.error` with
  `blocked-by-policy` before any ROM HTTP request.
errors: `ROM bytes unavailable (Blossom: blocked-by-policy)`.
timeline: The signer-assisted path passed after Paja 0.16.2, but the anonymous
  deployed path remained broken.
reproduction: Open deployed Paja without a signer, resolve GBColor event
  `409e850fb9d920c7d718bd0fdc9d94dfac06aa26d66d92813c406b7512777ee2`,
  choose Games, Global, then NHL Blades of Steel.

## Current Focus

hypothesis: Confirmed. Paja uses verified pointer-event server tags to resolve
  the napplet artifact but discards them before window-scoped NAP-RESOURCE
  resolution.
test: Re-run the original deployed flow in a fresh browser without a signer and
  observe the exact ROM HTTP responses plus terminal NAP-RESOURCE envelope.
expecting: After the ROM-local candidate misses, the verified pointer server
  returns the exact ROM and Paja emits `resource.bytes.result`.
result: Passed on the Pages artifact deployed from `37c6fca`.
next_action: None; the reported failure is resolved and released in Paja 0.16.3.

## Evidence

- timestamp: 2026-08-27T20:10:00Z
  result: Anonymous live Pages replay returned `blocked-by-policy` and made zero
    requests for the requested ROM hash.
- timestamp: 2026-08-27T20:12:00Z
  result: The selected kind-32560 ROM event has a canonical Blossom source but
    no `server` hints, and publisher
    `cef96fb4fa1e949c7e215abcb2bb95bdf4f1dacedf31b295d2a382ae8299984c`
    has no discoverable kind-10063 event on the sampled relays.
- timestamp: 2026-08-27T20:12:00Z
  result: The verified GBColor kind-35129 pointer event has ordered `server`
    tags including `https://cdn.hzrd149.com`, the only sampled host containing
    the ROM.
- timestamp: 2026-08-27T20:14:00Z
  result: `PajaResolvedPointer.blossomServers` exists, but
    `resolvePajaPointer` returns only caller-configured servers and does not
    retain the pointer event's server tags. The service bundle has no
    window-scoped pointer-server input.
- timestamp: 2026-08-27T20:18:00Z
  result: NAP-RESOURCE PR 80 head
    `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1` no longer defines wire-level
    Blossom server hints. NIP-5D PR 2303 head
    `24711d9c47bbdd07908bf1d52bf677d9cbc530f0` still defines manifest `server`
    tags for the verified artifact. Reusing those accepted HTTPS origins as
    per-window runtime defaults is bounded host policy, not new wire surface.
- timestamp: 2026-08-27T20:25:00Z
  result: Focused regressions prove request, ROM-event, publisher, shell-user,
    verified-pointer, and configured candidates remain ordered, and that an
    anonymous ROM request succeeds from the pointer server alone.
- timestamp: 2026-08-27T20:27:00Z
  result: Full local validation passed: build, type-check, 1,719 unit tests,
    strict docs, 84 Playwright tests, and AI-slop 100/100.
- timestamp: 2026-08-27T20:33:00Z
  result: PR 260 and Version Packages PR 261 merged. Automated release run
    33113454065 published `@kehto/paja@0.16.3` to npm and JSR, and Pages run
    33113318023 deployed exact commit
    `37c6fca5a4f00f95901aad75a8b0f606fef9d7d8`.
- timestamp: 2026-08-27T20:34:00Z
  result: A fresh deployed browser with no signer loaded 137 global games,
    selected NHL Blades of Steel, received 404 from `blssm.us`, then fetched
    1,048,576 bytes from `cdn.hzrd149.com` with SHA-256
    `5a7915efb3edcbb4b4bce512359e63ad6f6ba782b0534f4bd37d8838d5df6f53`.
    The host log contained `resource.bytes` followed by
    `resource.bytes.result`, with no `resource.bytes.error`.

## Eliminated

- hypothesis: The deployed Pages bundle is stale.
  reason: Anonymous reproduction ran against the post-0.16.2 Pages deployment.
- hypothesis: ROM MIME decoding still causes this message.
  reason: No ROM request occurs and the terminal error is
    `blocked-by-policy`, before byte classification.

## Resolution

root_cause: `resolvePajaPointer` used its caller-configured Blossom servers to
  fetch the napplet artifact and returned them, but did not retain the verified
  manifest event's own `server` tags. Runtime-tab navigation then discarded the
  returned server context entirely. With no ROM hint, publisher kind-10063
  list, signer, or global fallback, NAP-RESOURCE correctly had zero accepted
  candidates and returned `blocked-by-policy`.
fix: Normalize and retain verified manifest `server` tags in the resolved
  pointer, bind them to the exact runtime window before iframe navigation, and
  add them after request/event/publisher/user discovery but before configured
  fallbacks. Clear the pointer context with the window.
verification: Local regression and all repository gates are green. Paja 0.16.3
  is published to npm and JSR. The exact unsigned GBColor/NHL Blades of Steel
  flow passes on the Pages artifact deployed from `37c6fca`.
files_changed: `packages/paja/src/runtime-resolver.ts`,
  `packages/paja/src/browser-runtime-tabs.ts`,
  `packages/paja/src/browser-adapter.ts`,
  `packages/paja/src/browser-blossom-events.ts`, their regression tests, Paja
  docs, and the patch changeset.
