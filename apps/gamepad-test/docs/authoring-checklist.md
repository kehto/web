# Authoring Checklist

Use this checklist before shipping meaningful changes to a napplet.

## App Boundary

- [ ] The app does not import `@napplet/shim`; the runtime injects
  `window.napplet`.
- [ ] Protocol calls use `@napplet/sdk` helpers. The documented GAMEPAD exception uses the shipped Kehto injected API while its SDK wrapper is pending; other direct domain access is limited to availability checks.
- [ ] No app code reads or writes signer keys.
- [ ] No app code reads shell DOM, parent cookies, service workers, or host
  storage.
- [ ] Durable app state goes through `storage`.

## Network And Resources

- [ ] Normal Nostr reads and publishes use OUTBOX or a higher-level social NAP.
- [ ] RELAY is used only for a documented relay-local escape hatch.
- [ ] Read-only external bytes use `resource.bytes()` or
  `resource.bytesAsObjectURL()`.
- [ ] No direct `fetch`/`WebSocket`/`EventSource` — NAP-CONNECT (direct-network
  grants) is currently deferred on the NAPs track, so there is no active
  direct-network surface.

## Configuration Schema Gap

- [ ] Before adding settings, re-read the living
  [NAP-CONFIG proposal](https://github.com/napplet/naps/pull/14).
- [ ] Do not treat vite-plugin `configSchema`, `config` manifest tags, or
  `napplet-config-schema` HTML metadata as interoperable protocol until a
  canonical document defines their encoding.
- [ ] If the manifest encoding remains undefined, use only the proposal's
  documented runtime registration path or flag the gap.

## Layout

- [ ] No napplet name, tagline, eyebrow, masthead, or footer is rendered; the
  runtime shows the name.
- [ ] Compact density; the root fills the frame; no page margins or max-width
  column.
- [ ] Checked at `200×160`, `320×560`, `900×600`, and a full-screen frame in
  dark and light runtime themes with no overflow or clipped controls.
- [ ] A minimum size is declared (with a notice below it) only if the UI truly
  breaks smaller.

## Lifecycle

- [ ] Long-lived subscriptions are closed on teardown.
- [ ] User-triggered operations surface shell errors without crashing the app.
- [ ] The app feature-detects optional NAPs with injected domain property
  presence, such as `window.napplet?.resource`.
- [ ] Optional features have a usable fallback and are omitted from manifest
  `requires`; every listed requirement is essential to the app's core task.
- [ ] Text that should be copyable opts into selection with
  `data-napplet-select` or a deliberate CSS override.

## Protocol Extensions

- [ ] The feature uses an existing NAP surface when one fits.
- [ ] No new NAP name, number, message domain, or shell conformance language is
  introduced inside this app.
- [ ] If a new NAP seems necessary, `docs/new-nap-proposals.md` has been applied
  and a focused PR to `https://github.com/napplet/naps` is the next step.
- [ ] Experimental app-local adapters are clearly marked as non-protocol and do
  not claim shell support.

## Build

- [ ] `pnpm type-check` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm test:guidance` passes.
- [ ] The build is a single self-contained `index.html` (JS/CSS inlined) with no
  external asset references — required for `iframe.srcdoc` loading.
- [ ] Manifest changes are intentional: one x tag hashes the self-contained artifact; R declares GAMEPAD and O declares optional THEME.
