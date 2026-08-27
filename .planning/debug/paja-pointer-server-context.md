---
status: fixing
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
test: Reproduce without a signer and compare the pointer event, selected ROM
  event, publisher kind-10063 list, and resource resolver candidate inputs.
expecting: The pointer has `cdn.hzrd149.com`; the ROM has no server hints; the
  publisher has no kind-10063 event; no pointer servers reach the resource
  resolver.
next_action: Retain normalized pointer-event servers in `PajaResolvedPointer`,
  expose them as window-scoped runtime defaults after event/publisher/user
  discovery, add anonymous regression coverage, and verify the released Pages
  artifact against the original unsigned GBColor flow.

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
verification: Local regression and repository gates are green. Release and
  unsigned deployed GBColor verification remain pending.
files_changed: `packages/paja/src/runtime-resolver.ts`,
  `packages/paja/src/browser-runtime-tabs.ts`,
  `packages/paja/src/browser-adapter.ts`,
  `packages/paja/src/browser-blossom-events.ts`, their regression tests, Paja
  docs, and the patch changeset.
