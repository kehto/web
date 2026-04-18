# Phase 19: Core-Domain Napplets - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous)

<domain>
## Phase Boundary

Add three new single-purpose napplets under `apps/demo/napplets/` that exercise the relay/storage/notify NUB domains end-to-end. Each napplet has a real UI, registers as a `DEMO_NAPPLETS[]` entry in the demo, and is observable via the demo debugger and Playwright. After this phase, 5 of 8 NUB domains (identity, ifc, relay, storage, notify) have a live demo napplet.

Covers requirements: **NAP-03 (composer)**, **NAP-04 (preferences)**, **NAP-05 (toaster)**, **E2E-07 sub-specs (relay-publish, relay-publish-encrypted, storage-persist, notify-lifecycle)**, **E2E-08 (capability-matrix specs)**, **E2E-11 (iteration gate)**.

Does NOT cover: feed/profile-viewer/theme-switcher (Phase 20), fixture napplets (Phase 21).
</domain>

<decisions>
## Implementation Decisions

### Locked Directives

**D-01 — Each napplet is its own pnpm workspace package** under `apps/demo/napplets/<name>/`, mirroring `bot`/`chat` structure: `package.json` (links @napplet/sdk + @napplet/shim + @napplet/vite-plugin), `index.html`, `src/main.ts`, `vite.config.ts`, `tsconfig.json`. Naming: `@kehto/demo-composer`, `@kehto/demo-preferences`, `@kehto/demo-toaster`.

**D-02 — `composer` napplet (NAP-03 + relay-publish + relay-publish-encrypted).**
- UI: text `<input>`, "Publish" button, "Encrypted" toggle (`<input type="checkbox">`), status `<div id="composer-status">`
- On Publish: `sdk.relay.publish({ kind: 1, content: input.value })` (NIP-44 default if encrypted toggled → `sdk.relay.publishEncrypted`)
- Status reflects OK/denied envelope reply
- DOM contract: `#composer-status` reads `'authenticated'` after init, `'published: <eventId>'` or `'denied: <reason>'` after publish

**D-03 — `preferences` napplet (NAP-04 + storage-persist).**
- UI: 2 editable inputs (e.g., `<input id="pref-display-name">`, `<input id="pref-theme-preference">`), "Save" button, status `<div id="preferences-status">`
- On Save: `sdk.storage.setItem('display-name', value)` and `sdk.storage.setItem('theme-preference', value)`
- On mount: `sdk.storage.getItem('display-name')` / `getItem('theme-preference')` populate inputs
- After page reload: same values appear (storage persists per-napplet identity scope)
- DOM contract: `#preferences-status` reads `'loaded'` after first getItem resolves, `'saved'` after setItem completes

**D-04 — `toaster` napplet (NAP-05 + notify-lifecycle).**
- UI: title `<input>`, body `<input>`, "Notify" button, list `<ul id="toaster-list">` showing own notifications, "Dismiss all" button
- On Notify: `sdk.notify.create({ title, body })` → host toast layer fires + napplet inserts into list
- "Dismiss all": `sdk.notify.list()` → for each id `sdk.notify.dismiss(id)` → list empties
- DOM contract: `#toaster-status` = `'authenticated'`, `#toaster-list li` count reflects active notifications

**D-05 — Demo registers all 3 napplets in topology.** Update `apps/demo/src/demo-config.ts` (or wherever `DEMO_NAPPLETS[]` lives) to include composer/preferences/toaster. Each napplet appears as a topology napplet node, loadable via the demo's load mechanism.

**D-06 — pnpm-workspace.yaml already includes `apps/demo/napplets/*`** (confirmed in earlier inspection). The new napplets will be auto-discovered.

**D-07 — Layer-B specs target :4174.** New specs:
- `tests/e2e/relay-publish.spec.ts` — composer publishes a kind:1 event, debugger shows `relay.publish` envelope, status reflects success
- `tests/e2e/relay-publish-encrypted.spec.ts` — composer with Encrypted toggle, debugger shows `relay.publishEncrypted`
- `tests/e2e/storage-persist.spec.ts` — preferences save → page.goto('/') → values still present
- `tests/e2e/notify-lifecycle.spec.ts` — toaster create/list/dismiss round-trip; toast layer + napplet list both update
- `tests/e2e/acl-revoke-relay-write.spec.ts` (E2E-08) — revoke composer's relay:write → publish denied with legible reason in debugger
- `tests/e2e/acl-revoke-storage-write.spec.ts` (E2E-08) — revoke preferences's state:write → save denied

All use `demoBeforeEach` + `waitForNappletReady`.

**D-08 — Iteration loop.** Phase closes after `pnpm test:e2e` shows all v1.3 specs green (Phase 17's 5 + Phase 18's 2 + Phase 19's 6 = 13). Record in `.planning/phases/19-core-domain-napplets/19-ITERATION-LOG.md`.

### Claude's Discretion
- Exact UI styling (UnoCSS utility classes, simple boxes ok)
- Whether toaster's host-toast UI lives in the napplet iframe or in the demo shell (default: host shell shows toast as already plumbed via `notify.create` host handler)
- Whether revoke-relay-write spec uses ACL panel UI clicks or direct `__aclRevoke__` harness call (prefer the latter for determinism)

### Anti-features
- No `addEventListener('message')` in any napplet src.
- No raw NIP-01 arrays or BusKind.
- No `window.nostr`.
- No new core-compat.ts consumers.
- No framework introduction.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bot`/`chat` napplet skeletons (Phase 18) are templates for new napplets — copy structure, replace src/main.ts and index.html.
- `apps/demo/napplets/bot/vite.config.ts` + `tsconfig.json` are reference shapes.
- `apps/demo/src/demo-config.ts` (or `main.ts`) holds `DEMO_NAPPLETS[]` registration.
- Phase 17 17-06 demo-spec pattern (5 specs) shows how to assert against :4174.
- Phase 18 18-03 napplet-auth + ifc-roundtrip patterns show how to assert via DOM contracts.

### Established Patterns
- Each napplet's `package.json` mirrors bot/chat: `@napplet/sdk` + `@napplet/shim` link deps; `@napplet/vite-plugin` devDep; vite + typescript devDeps.
- Shim handles AUTH automatically; first SDK call resolves once identity assigned.
- Demo at :4174 uses Phase 17's 8-service topology + per-role inspector.
- Anti-term grep is the standard hygiene check (Phase 17/18 baseline).

### Integration Points
- New: `apps/demo/napplets/{composer,preferences,toaster}/` directories
- Modified: `apps/demo/src/demo-config.ts` (DEMO_NAPPLETS registration); maybe `apps/demo/src/main.ts` if topology bootstrap needs napplet refs
- New tests: 6 specs total (4 domain + 2 capability-matrix)
- Iteration log at `.planning/phases/19-core-domain-napplets/19-ITERATION-LOG.md`

</code_context>

<specifics>
## Specific Ideas

- The composer "publish" + "publishEncrypted" can share one button + a checkbox toggle. Keep UI minimal.
- For storage-persist spec: do NOT call `__aclClear__()` after the save — the canonical `demoBeforeEach` clears localStorage which is what makes the assertion stronger; instead, leverage page.reload() within the spec (allowed in this spec because it doesn't touch ACL — but document the exception).
- For notify-lifecycle: ensure the host toast layer (Phase 17 17-05) actually receives the `notify.create` envelope via the demo tap (Phase 17 17-04 envelope-aware) — should already work.
- For ACL-revoke specs: prefer harness-style `__aclRevoke__('composer', 'relay:write')` if exposed, otherwise click through the demo ACL panel. Either way the assertion is "publish attempt produces denied envelope visible in debugger".

</specifics>

<deferred>
## Deferred Ideas

- A storage `clear` button in preferences napplet — `storage.clear` was deprecated in v1.2 (DRIFT-SVC-06). Skip.
- Inline encryption-key picker in composer — encryption uses default NIP-44 path, not user-pickable. Out of scope.
- Toast stacking/animation polish — visual nicety, defer to Phase 20 if there's time.
- Hotkey for "Publish" / "Save" / "Notify" — keys napplet is deferred to v1.4.

</deferred>
