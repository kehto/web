# Phase 26: Real Keys Backend - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Smart-discuss batch acceptance (user accepted all 3 grey-area recommendations)

<domain>
## Phase Boundary

Replace stub `@kehto/services` keys-service with a real document-level chord listener exposed via the `keys.*` NUB namespace. Define a `HostKeysBridge` interface so host apps (Electron/Tauri) can plug OS-level hotkey backends. Ship `apps/demo/napplets/hotkey-chord` demo napplet + Layer-B Playwright spec (E2E-12).

In scope:
- KEYS-01: Real `keys-service` with document listener, `keys.registerAction` / `keys.forward` round-trip.
- KEYS-02: `HostKeysBridge` interface + TypeScript types exported from `@kehto/services`.
- KEYS-03: `apps/demo/napplets/hotkey-chord` demo napplet.
- E2E-12: `tests/e2e/hotkey-chord.spec.ts`.

Out of scope:
- OS-level hotkey daemon implementation (Electron / Tauri reference impls) — deferred past v1.4 per REQUIREMENTS.md Future Requirements. We ship the interface and the browser reference impl only.
- Multi-chord sequences (e.g., Emacs-style `Ctrl+X Ctrl+K`) — v1.5+ if demand.
- Media-key handling via the same service — media keys belong to `@kehto/services/media-service` (Phase 27).

</domain>

<decisions>
## Implementation Decisions

### Area 1: Chord Detection Model (ACCEPTED)

- **Listener scope: `document`** — `document.addEventListener('keydown', ...)` at service-init time; natural host-focus scoping (fires only when browser tab has focus; iframes have their own events which don't bubble to parent document by default). Iframe-nested napplets don't hear chords directly — the shell detects and forwards via `keys.forward` envelopes through `keys-forwarder.ts`.
- **Chord format: string** — e.g., `"Ctrl+Shift+K"`, `"Alt+F4"`, `"Cmd+P"`. Parsed internally at subscribe-time into struct `{ ctrl, alt, shift, meta, key }` matching the existing wire format. Napplet-facing API is strings; on-the-wire envelope is struct (no API break for existing nub-keys consumers).
- **Held-key repeat: ignore** — check `event.repeat` on keydown; fire only when `!event.repeat` (true for initial press, false for OS-autorepeat). Matches user intent: "I pressed the chord once" → one fire.
- **Focus: page-focused only** — document listener implicitly has this. Documented limitation for browser impl; OS-bridge impl (out of scope for v1.4) would widen this.

### Area 2: HostKeysBridge Interface (ACCEPTED)

- **Shape: OS-aware with browser default** —
  ```ts
  export interface HostKeysBridge {
    subscribe(chord: string, callback: (event: KeyboardEvent | HostKeyEvent) => void): () => void;
    registerGlobalHotkey?(chord: string): boolean;  // optional; throws 'not supported' in browser impl
    onGlobalHotkey?(callback: (chord: string) => void): () => void;  // optional
  }
  ```
  Browser impl omits `registerGlobalHotkey` + `onGlobalHotkey` (interface fields are optional). Electron/Tauri impls would provide all three.
- **Reference impl**: Lives in `@kehto/services/keys-service.ts`. Satisfies `HostKeysBridge` structurally. `HostKeysBridge` is a TypeScript type exported from `@kehto/services` (like `ServiceDescriptor`, `ServiceHandler`).
- **Override model**: Host apps call `runtime.registerService('keys', customHandler)` to replace the entire service. Same pattern as today's stub-service override convention. `createKeysService({ hostBridge: customBridge })` factory accepts an optional bridge — if omitted, uses the built-in document listener.

### Area 3: Napplet API + E2E Strategy (ACCEPTED)

- **Napplet API: reuse `@napplet/nub-keys`** — existing envelope types work:
  - `keys.registerAction({ actionId, defaultKey })` → shell subscribes `actionId` to `defaultKey` via service, responds with `.result`
  - `keys.forward` push from shell → napplet receives chord delivery (fire-and-forget, already defined)
  - `keys.unregisterAction({ actionId })` → unsubscribe
  No new SDK methods; no new envelopes.
- **Auto-unsubscribe**: sessionRegistry tracks `windowId → actionIds` via a new `cleanupKeysForNapplet(windowId)` entry in `cleanupNappState()`. When a napplet unloads, all its actions clear from the service's subscription table.
- **E2E delivery evidence**: `apps/demo/napplets/hotkey-chord` napplet DOM:
  - `#hotkey-chord-status` — text sentinel transitions `connecting... → authenticated → subscribed`
  - `#hotkey-chord-count` — numeric counter; increments on each chord delivery
  - `#hotkey-chord-last` — text of last fired chord
  
  Playwright spec drives `page.keyboard.press('Control+Shift+K')` (Playwright's KeyboardEvent shim fires real document keydown) and asserts `#hotkey-chord-count` goes 0 → 1.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/services/src/keys-service.ts` (stub) — factory + handler exist; need to replace stub body with real listener + bridge support.
- `packages/services/src/keys-service.test.ts` — existing unit tests (stub-scope); augment with real-listener tests.
- `packages/shell/src/keys-forwarder.ts` — already wires `keys.forward` envelopes with ACL cap-lookup (`hasKeysForwardCap`); reuse as-is.
- `@napplet/nub-keys@^0.2.1` — on npm, declares `KeysForwardMessage`, `KeysRegisterActionMessage`, etc. Reuse.
- `@napplet/sdk@^0.2.1` — on npm, already exercises nub-keys envelopes via generic envelope dispatch; no new SDK method needed.
- Demo napplet structure (from Phase 20 patterns) — `apps/demo/napplets/<name>/{package.json, index.html, src/main.ts, vite.config.ts}` + turbo build:napplets task registers automatically.

### Established Patterns
- Services factory pattern: `createXService(options: XServiceOptions): ServiceHandler` — hostBridge is a new option, optional.
- Napplets use `@napplet/sdk` envelope handling; no raw `window.addEventListener('message')` per v1.4 anti-features. Napplet subscribes via `sdk.dispatch('keys.registerAction', ...)`.
- E2E specs follow `demoBeforeEach` + `waitForNappletReady` from `tests/e2e/helpers/`.
- turbo task `build:napplets` picks up new napplet dirs via glob; no explicit turbo.json edit needed.

### Integration Points
- `apps/demo/src/shell-host.ts` — `createDemoHooks()` currently registers `keys-service` as stub; switch to real-backed. Demo napplets list (`DEMO_NAPPLETS` const) grows by 1 (+ `hotkey-chord`).
- `apps/demo/napplets/hotkey-chord/` — new napplet dir.
- `packages/services/src/index.ts` — add `HostKeysBridge` type export + potentially `createBrowserKeysBridge()` if factored out.
- `tests/e2e/hotkey-chord.spec.ts` — new Layer-B spec.

</code_context>

<specifics>
## Specific Ideas

- **Chord parsing: reuse an existing small parser** — if there's no clean existing impl, write a minimal one (~30 lines). Support `Ctrl/Alt/Shift/Meta/Cmd` prefixes + single key. No fancy syntax (no `<kbd>`, no sequences).
- **Subscription storage**: `Map<windowId, Set<actionId>>` + `Map<actionId, {chord, targetWindowId}>`. Look up chord on keydown, fan out via `onForward` (existing hook) which `keys-forwarder` turns into `keys.forward` envelopes per ACL.
- **hotkey-chord napplet test chord**: `Ctrl+Shift+K` (non-interfering with common browser chords; K for "Kehto").
- **Playwright keyboard API**: `page.keyboard.press('Control+Shift+K')` — cross-platform (Playwright translates `Control` to `Meta` on macOS if needed; we test on `ubuntu-latest` so `Control` maps directly to the Ctrl modifier).

</specifics>

<deferred>
## Deferred Ideas

- **Electron / Tauri reference impls** — defer to v1.5+ or host-app example repos per REQUIREMENTS.md Future Requirements.
- **Multi-chord sequences** — defer.
- **Chord conflict resolution across napplets** — out of v1.4 scope (current ACL cap check already gates; two napplets both subscribing to `Ctrl+K` would both get the event — document this, don't over-engineer).
- **Visual chord recorder UI** — defer; hotkey-chord napplet uses a hardcoded test chord in v1.4.

</deferred>
