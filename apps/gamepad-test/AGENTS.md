# Napplet Boilerplate Agent Guide

This repository is a starter for one NIP-5D napplet. Keep it small,
framework-light, and centered on the napplet side of the shell boundary.

## Before Editing

1. Install the current `napplet-*` agent skills with the skills.sh CLI
   (`npx skills add napplet/napplet`) and follow `napplet-make` for
   agent-driven napplet work. This template vendors no skill bodies.
2. Read `docs/context-map.md`.
3. Read the boundary document for the surface you are changing:
   - `docs/boundaries.md`
   - `docs/design-patterns.md`
   - `docs/package-surfaces.md`
4. If changing protocol assumptions, verify against the living NIP-5D reference
   in `docs/nip-5d.md`.
5. If the change appears to need a new NAP name, message domain, or numbered
   wire format, read `docs/new-nap-proposals.md` before writing code.

## Hard Boundaries

- Do not add shell implementation code to this template.
- Do not access signer keys, relay pools, cookies, service workers, or host DOM
  directly from napplet code.
- Do not use `localStorage` or `sessionStorage` for durable app state. Use
  `@napplet/sdk` storage helpers.
- Do not use direct `fetch`, `WebSocket`, or `EventSource`. NAP-CONNECT (the
  direct-network grant model) is currently deferred on the NAPs track, so there
  is no active direct-network surface. Use `resource.bytes()` for read-only
  external bytes.
- Do not import `@napplet/shim` from napplet code. The shell/runtime injects
  `window.napplet`; app calls use `@napplet/sdk`, while direct domain properties
  are only optional-domain availability checks.
- Use OUTBOX for normal Nostr reads and publishes. Use RELAY only when a feature
  names an explicit relay-local escape hatch.
- Add a domain to manifest `requires` only when the napplet cannot perform its
  core task without it. Guard optional domains and provide a graceful fallback.
- Do not invent app-local NAP names, numbers, or JSON envelope domains. Open a
  proposal PR to `napplet/naps` only after the guardrails in
  `docs/new-nap-proposals.md` are satisfied.

## Applet, Not Web Page

- Do not render the napplet's name, a tagline, an eyebrow, a masthead, or a
  footer. The runtime shows the name; the frame is working surface from the
  first pixel.
- Keep the compact defaults in `src/styles.css` (13px type, 4/8/12px spacing,
  28px controls, no page margins, no max-width column) unless the product has a
  written reason to change them.
- The napplet can be placed at any size and resized live. Keep the tiered
  layout (`tiny` < 240px, `compact`, `regular` ≥ 480px, `wide` ≥ 900px, short
  frames) working; check `200×160`, `320×560`, `900×600`, and a full-screen
  frame in both dark and light runtime themes.
- Declare a minimum size (and render a short notice below it) only when the
  UI genuinely cannot work smaller. The starter has no floor.
- Apply the runtime theme to the whole surface (`html`, `body`, `#app`, and
  every derived token), as `applyTheme` in `src/main.ts` does.

## Verification

Run these before claiming completion:

```bash
pnpm type-check
pnpm build
pnpm test:guidance
pnpm test:conformance
```

`test:conformance` loads the built napplet in a real `allow-scripts` iframe.
Read its report: manifest, wire, and lifecycle checks skip when their evidence
is not supplied. Use `pnpm test:conformance:ui` for the live runtime.

Use `pnpm dev` for shell/manual testing. A passing browser smoke test should
cover iframe load, injected-domain display, and at least one user-triggered SDK
operation in the target shell. Also verify that missing optional domains disable
only their enhancements without crashing the napplet.

## Controller tester scope

This app follows the parent Kehto bleeding-edge policy. The one bounded SDK exception is the canonical GAMEPAD API injected by merged Kehto PR 297: the published SDK wrapper is pending in napplet/web PR 242. Use only that documented injected API; do not implement transport, native readers, or namespace injection here. Replace the local structural types with packaged GAMEPAD types when that release ships. Theme calls remain SDK-first.
