# Phase 18: Napplet SDK Migration - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous)

<domain>
## Phase Boundary

Migrate `apps/demo/napplets/bot/src/main.ts` and `apps/demo/napplets/chat/src/main.ts` from raw `window.addEventListener('message')` event-array handling to the `@napplet/sdk` envelope API. Both napplets must reach AUTH and exchange `ifc.emit`/`ipc.on` (or sdk equivalent) round-trip traffic that the demo debugger and Playwright can observe. After migration:
- `bot` exercises `ifc` + `storage`
- `chat` exercises `ifc` (and may emit a `relay.publish` for round-trip showcase)

This phase covers **NAP-01, NAP-02** + the **E2E-07** sub-specs `napplet-auth.spec.ts` and `ifc-roundtrip.spec.ts` + the **E2E-11** iteration-loop gate.

</domain>

<decisions>
## Implementation Decisions

### Locked Directives

**D-01 — Use `@napplet/sdk` exclusively for envelope traffic.** No `window.addEventListener('message')` in bot or chat src. No raw `['REGISTER', ...]` / `['EVENT', ...]` arrays. The shim handles AUTH implicitly; napplets call `sdk.<domain>.<action>(...)` and await the result.

**D-02 — `bot` napplet maps to ifc + storage.**
- Subscribes to `ipc.on('chat:message', handler)` (or `ifc.subscribe`)
- Stores rules via `storage.setItem('rules', ...)` / `storage.getItem('rules')` (kehto storage scoped per napplet)
- Replies via `ipc.emit('bot:response', payload)`

**D-03 — `chat` napplet exercises ifc (and optionally relay).**
- Sends `ipc.emit('chat:message', payload)` on user input
- Receives `ipc.on('bot:response', handler)`
- A "publish" button emits `relay.publish({ kind: 1, content })` to demonstrate signing path (no key handling in napplet — shell signs)

**D-04 — `chat` topology node visibly authenticates.** After SDK init resolves, the napplet posts a "ready" UI marker (e.g., `<div id="chat-status">authenticated</div>`). Same for bot. Phase 17's removal of the auth gate stands; Phase 18 reinstates a positive auth signal because the SDK actually completes AUTH now.

**D-05 — No legacy `napplet-runtime.js` / hand-rolled bus globals.** Anything not exported by `@napplet/sdk` (or `@napplet/shim`) must go.

**D-06 — Two new Playwright specs.** `tests/e2e/napplet-auth.spec.ts` asserts both bot + chat reach authenticated state. `tests/e2e/ifc-roundtrip.spec.ts` asserts a chat→bot→chat round trip via the demo debugger pane (or DOM signal). Use Phase 16 helpers (`waitForNappletReady` + `aclBeforeEach` for harness specs, or `demoBeforeEach` for demo specs targeting :4174).

**D-07 — E2E-11 gate.** Phase 18 closes only after a build → `pnpm test:e2e` cycle confirms `napplet-auth` + `ifc-roundtrip` green and the rest of the v1.3 suite still passes (no regression). Append to `.planning/phases/18-napplet-sdk-migration/18-ITERATION-LOG.md`.

### Claude's Discretion
- Exact `@napplet/sdk` import shape and method names (verify in `/home/sandwich/Develop/napplet/packages/sdk/src/index.ts`).
- Whether `bot` requires a UI at all (it can be invisible/iframe-headless).
- Whether the round-trip spec targets the harness or the demo (demo at :4174 is more end-to-end; harness at :4173 is more deterministic — pick what matches Phase 17's working baseline).
- Whether to introduce a third helper (`nappletAuth(page, frameSelector)`) or reuse `waitForNappletReady`.

### Anti-features (hard)
- No raw `window.addEventListener('message')` anywhere in bot/chat src.
- No NIP-01 array dispatch (`['EVENT', ...]`, `['REGISTER', ...]`).
- No BusKind, no kind 29001/29002, no signer-service, no `window.nostr`.
- No new consumers of `core-compat.ts` (DRIFT-CORE-06).
- No framework introduction (vanilla TypeScript per existing pattern).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@napplet/sdk` (`/home/sandwich/Develop/napplet/packages/sdk`) exposes the canonical envelope API.
- `@napplet/shim` handles AUTH handshake + envelope serialization automatically when imported.
- `@napplet/vite-plugin` already builds bot/chat into iframe-loadable artifacts.
- `tests/e2e/helpers/{wait-for-napplet-ready,demo-before-each,acl-beforeEach,index}.ts` from Phase 16 + 17.
- `tests/e2e/harness-smoke.spec.ts` shows how to load a napplet into the harness via `__loadNapplet__('napplet-name')`.

### Established Patterns
- Napplet `package.json` already imports `@napplet/shim` + `@napplet/sdk` (verified in 18-CONTEXT bootstrap step).
- Demo debugger at :4174 displays envelope `type` strings (Phase 17 17-04).
- Phase 17 17-07 iteration log notes chat/bot napplets DO NOT reach auth pre-migration; Phase 18 explicitly fixes this.

### Integration Points
- `apps/demo/napplets/bot/src/main.ts` — full rewrite to SDK
- `apps/demo/napplets/chat/src/main.ts` — full rewrite to SDK
- `apps/demo/index.html` (and chat/bot index.html) — keep iframe loaders as-is unless SDK requires script-tag changes
- `tests/e2e/napplet-auth.spec.ts` (NEW) and `tests/e2e/ifc-roundtrip.spec.ts` (NEW)
- `tests/e2e/harness/harness.ts` — may need a `__nappletReady__(windowId)` flag set by the SDK shim

</code_context>

<specifics>
## Specific Ideas

- Read `@napplet/sdk` `index.ts` first to learn the canonical surface — call shape may be `sdk.ipc.emit('topic', payload)` or `sdk.ifc.emit(...)` depending on the published API. Prefer ipc/ifc as the SDK names them — do not invent names.
- `chat` UI: simple `<input>` + `<button>` + a `<ul>` list of messages. Status `<div id="chat-status">` toggles to `"authenticated"` when SDK init resolves.
- `bot`: invisible/headless allowed. It must still be loaded as an iframe; iframe HTML can be empty body.
- For `napplet-auth.spec.ts`: load both via `__loadNapplet__` (harness) OR navigate the demo to a state where both load (demo); assert `#chat-status === "authenticated"` + bot's equivalent within 5s.
- For `ifc-roundtrip.spec.ts`: trigger a chat message via DOM input, wait for bot's reply to appear in the chat list (or in the debugger envelope tap).
- Iteration loop discipline: every fix touches root cause (e.g., wrong SDK method name) not symptoms (e.g., longer timeout).

</specifics>

<deferred>
## Deferred Ideas

- Adding a 3rd "broadcast" napplet — Phase 19.
- Migrating napplet `package.json` to npm-published `@napplet/*` once available — out of scope for v1.3.
- Per-napplet README with usage docs — Phase 22 (DOCS-03 covers).

</deferred>
