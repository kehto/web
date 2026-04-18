# Phase 20: Expanded-Domain Napplets - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous + user decisions captured)

<domain>
## Phase Boundary

Add three new single-purpose napplets — `feed`, `profile-viewer`, `theme-switcher` — to complete the 8-domain showcase. After this phase: identity, ifc, notify, relay (subscribe + publish), storage, theme are all exercised by at least one demo napplet (keys + media intentionally remain stub-only — deferred to v1.4).

Covers requirements: **NAP-06 (feed)**, **NAP-07 (profile-viewer)**, **NAP-08 (theme-switcher)**, **NAP-09 (8-domain coverage gate)**, **E2E-07 sub-specs (relay-subscribe, identity-flow, theme-broadcast)**, **E2E-11 (iteration gate)**.

</domain>

<decisions>
## Implementation Decisions

### Locked Directives — User-decided (this phase's open questions)

**D-USER-01 — feed delivery uses option (b): in-memory mock relay pool in demo.**
Replace the stub relay pool adapter (currently no-op) with an in-memory implementation in `apps/demo/src/shell-host.ts` (or a new `apps/demo/src/mock-relay-pool.ts` module) that:
- Holds a small fixture event set (e.g., 5 kind:1 text events with varied content + author pubkeys)
- On `relay.subscribe(filters)`: emits matching events synchronously (or via microtask), then emits EOSE
- On `relay.publish`: stores the published event and (optionally) replays to active subscriptions
- Stays a demo-only seam — no real relay traffic; deterministic for Playwright

**D-USER-02 — preferences napplet is the theme-broadcast observer.**
Extend the `apps/demo/napplets/preferences/` napplet (built in Phase 19) with:
- An SDK theme listener (`sdk.theme.on('changed', handler)` or equivalent — verify in @napplet/sdk)
- A visible style hook: when `theme.changed` payload's color hex arrives, set the napplet body's background-color to that hex (or apply a CSS variable). Keep simple — no full theme system in v1.3.
- A new DOM contract ID `#preferences-theme-applied` whose textContent reflects the most recent theme color (e.g., `'#1a1a2e'`).

### Locked Directives — Standard

**D-01 — Each napplet is its own pnpm workspace package** under `apps/demo/napplets/<name>/` mirroring composer/preferences/toaster. Naming: `@kehto/demo-feed`, `@kehto/demo-profile-viewer`, `@kehto/demo-theme-switcher`.

**D-02 — `feed` napplet (NAP-06 + relay-subscribe).**
- UI: `<ul id="feed-list">` showing received text events (truncate to ~5 most recent), status `<div id="feed-status">`
- On init: `sdk.relay.subscribe({ kinds: [1], limit: 5 })`; status → `'subscribed'` after subscribe-confirmed envelope; populate list as events arrive; on EOSE → status `'loaded (<n>)'`
- DOM contract: `#feed-status` reads `'authenticated'` → `'subscribed'` → `'loaded (5)'`; `#feed-list li` count >= 1 after EOSE

**D-03 — `profile-viewer` napplet (NAP-07 + identity-flow).**
- UI: `<div id="profile-pubkey">`, `<div id="profile-name">`, `<div id="profile-about">`, `<img id="profile-picture">` (optional/hidden if no picture), status `<div id="profile-status">`
- On init: `sdk.identity.getPublicKey()` populates pubkey (truncated), then `sdk.identity.getProfile()` populates name/about/picture if returned
- DOM contract: `#profile-status` → `'authenticated'` → `'loaded'`; `#profile-pubkey` non-empty after load

**D-04 — `theme-switcher` napplet (NAP-08 + theme-broadcast).**
- UI: 3 buttons "Light", "Dark", "Custom" + `<input type="color" id="theme-custom-color">`, status `<div id="theme-status">`
- On click: dispatches host `publishTheme(theme)` via the shell-exposed control path. The shell-side `bridge.publishTheme(theme)` is the host API (Phase 17 17-05 already wires `getThemeServiceBundle()`).
- Note: `theme-switcher` itself does NOT directly call `bridge.publishTheme` (that's a host API not napplet API). Instead, the napplet emits via SDK and the demo host bridges to `publishTheme`. If SDK doesn't expose this, use one narrowly-guarded `window.parent.postMessage({ type: 'demo.publishTheme', theme })` listener in the demo host (similar to toaster's documented SDK gap exemption in Plan 19-03).
- DOM contract: `#theme-status` reads `'authenticated'`; clicking a button reflects "active" state

**D-05 — 8-domain coverage gate (NAP-09).**
After this phase: identity (profile-viewer), ifc (chat/bot), notify (toaster), relay-publish (composer), relay-subscribe (feed), storage (preferences), theme (theme-switcher) — 7 domains covered by demo napplets. Plus identity is also exercised by signer-modal in the demo host. `keys` and `media` reference services remain stub-only with a documented service-registration comment in `shell-host.ts` explaining the v1.4 deferral.

**D-06 — Layer-B specs target :4174.** New specs:
- `tests/e2e/relay-subscribe.spec.ts` — feed napplet subscribes, receives the seeded fixture events from the in-memory mock pool, EOSE fires, list populates
- `tests/e2e/identity-flow.spec.ts` — profile-viewer shows truncated pubkey from `identity.getPublicKey`
- `tests/e2e/theme-broadcast.spec.ts` — theme-switcher button click → preferences napplet's `#preferences-theme-applied` reflects the chosen color
All use `demoBeforeEach` + `waitForNappletReady`.

**D-07 — Iteration loop.** Phase closes after all v1.3 Layer-B specs (Phase 17 + 18 + 19 + 20) green. Record in `.planning/phases/20-expanded-domain-napplets/20-ITERATION-LOG.md`.

### Claude's Discretion
- Exact UI layout and styling (UnoCSS utility classes per existing pattern)
- Whether the in-memory mock relay pool replays events on every subscribe or filters per request
- Whether `bridge.publishTheme` exposure to the demo's button handler uses `getThemeServiceBundle()` from Phase 17 directly or adds a thin demo-side helper
- Whether `theme-switcher` uses the SDK theme API (if exposed) or the documented postMessage exemption (mirror Plan 19-03's pattern)

### Anti-features (hard)
- No `addEventListener('message')` in any new napplet src EXCEPT theme-switcher's documented exemption (and only if SDK doesn't expose theme publishing).
- No raw NIP-01 arrays, no BusKind, no kind 29001/29002.
- No `window.nostr`.
- No new core-compat.ts consumers.
- No framework introduction.
- The mock relay pool MUST stay demo-only (don't pollute @kehto/* runtime packages).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- composer/preferences/toaster napplets (Phase 19) are templates for new napplets — copy structure exactly.
- `apps/demo/src/shell-host.ts` `createDemoHooks()` already registers theme service via `createThemeService()` (Phase 17) and exposes `getThemeServiceBundle()` with `publishTheme` callable.
- `apps/demo/src/shell-host.ts` `DEMO_NAPPLETS[]` is where new napplet registrations land.
- ACL panel (Phase 17 17-05) needs new branches for `feed`/`profile-viewer`/`theme-switcher` per Phase 19 19-04 pattern.
- Phase 19 19-04 also extended DEMO_CAPABILITIES — may need additional caps for new napplets (`identity:read` for profile-viewer; `theme:read`/`theme:write` for theme-switcher; `relay:read` for feed).

### Established Patterns
- Each napplet's `package.json` mirrors the others; `@napplet/shim` + `@napplet/sdk` link deps.
- Shim handles AUTH; first SDK call resolves once identity assigned.
- Toaster's documented postMessage exemption (Plan 19-03) is the precedent for any new SDK gap workarounds.
- Demo at :4174 with topology + per-role inspector (Phase 17/18/19 baseline).
- Preferences napplet listener pattern (Phase 19 19-02) is the template for adding the theme observer.

### Integration Points
- New: `apps/demo/napplets/{feed,profile-viewer,theme-switcher}/` directories
- New: `apps/demo/src/mock-relay-pool.ts` (in-memory mock per D-USER-01) wired into `createDemoHooks()` `ShellAdapter.relayPool` slot
- Modified: `apps/demo/src/shell-host.ts` — DEMO_NAPPLETS additions + relay pool wiring
- Modified: `apps/demo/src/acl-panel.ts` — DEMO_CAPABILITIES + renderAclPanels branches for 3 new napplets
- Modified: `apps/demo/napplets/preferences/src/main.ts` — add theme listener + `#preferences-theme-applied` (D-USER-02)
- New: 3 spec files (`relay-subscribe`, `identity-flow`, `theme-broadcast`)
- Iteration log at `.planning/phases/20-expanded-domain-napplets/20-ITERATION-LOG.md`

</code_context>

<specifics>
## Specific Ideas

- Mock relay fixture events: 5 kind:1 events with content like `"Welcome to kehto demo!"`, `"NIP-5D ships v1.3"`, etc. Author pubkeys can be 64-char fixture strings.
- For identity-flow spec: the demo's NIP-46 / signer modal flow may auto-populate a pubkey on startup; check Phase 17 behavior. If pubkey is unset, `identity.getPublicKey` returns empty — spec should either use a fixture or trigger sign-in first.
- For theme-broadcast: simplest path is to have the theme-switcher button handler use `window.parent.postMessage({ type: 'demo.publishTheme', theme: { background: '#xyz' } })`. Demo host listens for this in `main.ts` and calls `getThemeServiceBundle().publishTheme(theme)`. Document this as the SDK gap exemption.
- Verify `@napplet/sdk` exposes `theme.on` / `theme.subscribe` for the preferences observer — if not, use a postMessage listener inside preferences with the same exemption.

</specifics>

<deferred>
## Deferred Ideas

- A dedicated `theme-consumer` napplet — preferences serves dual purpose per D-USER-02; no extra napplet needed.
- Feed napplet "load more" pagination — out of scope; v1.3 shows 5 events.
- Profile-viewer mutation (edit-profile button) — read-only in v1.3.
- Custom color picker producing a full theme object (background+foreground+accents) — single color suffices for theme-broadcast.
- hotkey-chord and media-controller napplets — explicitly deferred to v1.4 (NAP-09 gate; keys+media stay stub-only).

</deferred>
