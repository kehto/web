# Phase 33: Reserved Chord Surface + E2E-17 - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A shell can declare WM-absolute chords once via `createKeysService` and have the keys service short-circuit to the shell bridge — precedence `reserved > registered` — so a napplet claiming the same chord via `keys.registerAction` never gets the event. Layer-B Playwright locks the contract.

Scope-in:
- `packages/services/src/keys-service.ts` — new `reservedChords?: ReadonlyArray<string>` option on `KeysServiceOptions`; reservation-check in `keys.forward` handler
- `packages/services/src/keys-service.test.ts` — unit coverage for reserved path (fires shell handler; suppresses napplet `keys.action`) and non-reserved path (unchanged behavior)
- `packages/services/README.md` — Keys H2 section extension with reserved-chord docs + WM-launcher example + precedence note
- `tests/e2e/reserved-chord.spec.ts` — new Layer-B Playwright spec (E2E-17)
- E2E iteration loop: 53 → 54 passed

Scope-out:
- Dynamic runtime updates to the reserved set (static declaration only — if needed later, add `HostKeysBridge.reserveAbsolute()` alongside without breaking this phase's shape)
- Shell-side WM launcher implementation (hyprgate-local, not kehto scope)
- Global hotkey support changes (`registerGlobalHotkey` / `onGlobalHotkey` on `HostKeysBridge` — already present, unchanged)

</domain>

<decisions>
## Implementation Decisions

### Reserved Chord Surface Shape (Grey Area 1/1 — all locked)

- **Declaration shape:** `reservedChords?: ReadonlyArray<string>` as an option on `KeysServiceOptions`. Declarative at service construction. Static WM chord sets (workspace switch, window kill, launcher) fit cleanly. Rejected `HostKeysBridge.reserveAbsolute()` method form — adds lifecycle complexity for a fundamentally static contract.
- **Suppression scope on `keys.forward(chord)` with reserved chord:** suppress `keys.action` dispatch to ANY napplet that registered the same chord via `keys.registerAction`; still invoke `onForward` callback (or bridge equivalent). The shell WANTS the event — that's why it reserved the chord.
- **Interaction with `hostBridge`:** reserved chords take precedence regardless of whether `hostBridge` is set. `onForward` fires (default path) OR `bridge.subscribe(...)`-registered callback fires (bridge path). Napplet `keys.action` suppressed either way. Consistent semantics across default and bridged paths.
- **Normalization:** chord strings normalized via the existing `parseChord` before comparison. `Ctrl+K` / `Control+K` / `ctrl+k` all match. Reserved chord strings pass through `parseChord` once at service construction; incoming `keys.forward` payloads normalize to the same `ChordSpec` shape for comparison.

### Claude's Discretion
- Exact location in the existing `keys-service.ts` handleMessage where reservation-check gates: after `keys.forward` wire-parse, before the `onForward` invocation branch and before any napplet-action dispatch.
- Internal representation of the reserved set: a `Set<string>` keyed on a canonical string form of `ChordSpec` (derived via a new `chordSpecKey(spec)` helper) — hash lookup O(1) per forward.
- Unit test structure: mirror existing `keys-service.test.ts` patterns (arrange/act/assert; per-branch coverage). Add dedicated `describe('reserved chords', ...)` block.
- E2E spec structure: mirror existing `hotkey-chord.spec.ts` fixture usage (`demoBeforeEach`, `waitForNappletReady`). Synthetic reserved chord driven via `page.keyboard.press`. Assertions: shell handler invocation observed via DOM sentinel OR `window.__grantKeysForward__` hook; absence of napplet `keys.action` observed via the napplet's DOM sentinel (e.g., `#hotkey-chord-status` or equivalent).
- Whether to wire a reserved chord into the demo's existing `hotkey-chord` napplet (to exercise the contract end-to-end) or stand up a dedicated test fixture — decide in plan based on fixture effort.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/services/src/keys-service.ts` (630 lines, v1.2-v1.4 established):
  - `HostKeysBridge` interface (line 101) — `subscribe(chord, cb): () => void` + optional `registerGlobalHotkey` / `onGlobalHotkey`
  - `KeysServiceOptions` (line 167) — has `onForward?`, `listenerTarget?`, `hostBridge?` — extend with `reservedChords?: ReadonlyArray<string>`
  - `parseChord(str): ChordSpec` — canonical chord parser already handles modifier aliases (Ctrl/Control, Alt/Option, Cmd/Command/Meta); reuse for normalization of reserved set
  - `ChordSpec` struct (line 147) — internal representation; match `keys.forward` incoming chord against reserved set at this layer
  - Existing message types: `KeysForwardMessage`, `KeysRegisterActionMessage`, `KeysActionMessage` from `@napplet/nub/keys/types` (post-Phase-32 subpath form)
- `packages/services/src/keys-service.test.ts` — 37 existing test cases across dispatch, forward, registerAction, unregisterAction, window-destroy cleanup, HostKeysBridge integration (lines 564+)
- `tests/e2e/hotkey-chord.spec.ts` (v1.4 Phase 26) — reference E2E pattern for chord dispatch; uses `demoBeforeEach` + `waitForNappletReady` + `page.keyboard.press` + DOM sentinel

### Established Patterns
- Service handler `handleMessage(windowId, message, send)` dispatch pattern — switch on `message.type`
- Options-field guard idiom: `if (options.hostBridge) { ... } else { /* default path */ }`
- Default-path short-circuit when a feature branch is taken (bridge.subscribe replaces document keydown listener in Plan 26-01)
- Wire-to-DOM field translation (compact `{ctrl,alt,shift,meta}` wire ↔ DOM `{ctrlKey,altKey,shiftKey,metaKey}`) — keep reserved-chord comparison on the wire shape
- `KEYS_SERVICE_VERSION = '1.1.0'` — bump to `1.2.0` on this addition (per-service semver)

### Integration Points
- `packages/services/src/keys-service.ts` line 305 — `if (options.hostBridge) { ... }` branch; reservation check integrates before this branch for forward messages
- `packages/services/README.md` — existing `## Keys Service` H2 section (extend with `### Reserved Chords` sub-section)
- `tests/e2e/helpers/` — `demoBeforeEach`, `waitForNappletReady` fixtures (v1.3 Phase 16)
- Demo shell (`apps/demo/src/shell-host.ts`) — shell receives `onForward` callback path; reserved-chord reservation set is declared here in real shells (hyprgate pattern). For this phase's demo + E2E, a small set of reserved chords can be declared at the demo's `createKeysService(...)` call site.
- `apps/demo/napplets/hotkey-chord/` — candidate consumer for the E2E reserved-chord test case (register `Ctrl+Shift+K` via `keys.registerAction`, then shell reserves `Ctrl+Shift+K`, then `page.keyboard.press` — assertion: shell handler fires, napplet does NOT)

</code_context>

<specifics>
## Specific Ideas

- **Reserved-chord string format:** identical to `@napplet/nub/keys`'s wire format (e.g. `"Ctrl+Shift+K"`). `parseChord` already accepts this — no new format.
- **Semver on `@kehto/services`:** this is an additive, non-breaking change. Version bump: minor (1.2.0 → 1.3.0 or equivalent). Phase 32 changeset already bumped the package on DEP-01..05; Phase 33 changeset adds another minor bump (two minors in v1.6 is fine — changesets aggregate at publish time).
- **Precedence prose in README:** "Reserved chords take precedence over napplet-registered actions. When a napplet forwards a reserved chord via `keys.forward`, the shell's `onForward` callback (or `HostKeysBridge.subscribe` callback) fires; the napplet's `keys.action` push is suppressed. This is how WM launcher / workspace switch chords are routed: declare them in `reservedChords` at shell boot, route them to your WM logic in `onForward`, and napplet code never sees them."
- **E2E fixture pattern:** the demo shell declares `reservedChords: ['Ctrl+Shift+R']` (or a chord that doesn't collide with any real hotkey in the demo); hotkey-chord napplet registers `Ctrl+Shift+R` via `keys.registerAction`; test presses `Ctrl+Shift+R`; assert shell-side sentinel flips, napplet-side sentinel does NOT.

</specifics>

<deferred>
## Deferred Ideas

- **Dynamic reserved set updates:** `HostKeysBridge.reserveAbsolute(chords)` method for runtime updates. Not in v1.6 scope — if a future consumer needs it, add alongside `reservedChords` without breaking the static option.
- **OS global hotkey reservation:** reserving at the OS level (Electron `globalShortcut`) so the chord never reaches browser focus. Belongs to a future Electron/Tauri HostKeysBridge reference impl milestone (v1.7+).
- **Per-napplet reservation scoping:** "this chord is reserved when napplet X is focused but not when napplet Y is." Adds runtime context to reservation; out of v1.6 scope.

</deferred>
