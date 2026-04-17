# Feature Research: v1.3 Demo-Functional & Playwright Parity

**Domain:** Sandboxed plugin runtime showcase — host-app demo + napplet suite + E2E validation
**Researched:** 2026-04-18
**Confidence:** HIGH — all findings sourced from live codebase (v1.2 packages + demo source + spec)

---

## Context

v1.2 shipped canonical NIP-5D conformance with 8 nub domains fully implemented in `@kehto/*`. The demo (`apps/demo`) and its two napplets (`bot`, `chat`) still use legacy patterns: they listen for raw `['OK', ...]` arrays via `window.addEventListener('message')` instead of the envelope-only `@napplet/sdk` API surface. Several E2E specs exercise APIs that were deleted in v1.2 (signer-service, window.nostr, BusKind.SIGNER_REQUEST as kind 29001, etc.).

v1.3 does **no protocol-level changes**. It is entirely a consume-and-showcase milestone. The target state: every demo surface, napplet, and Playwright spec works cleanly against the v1.2 `@kehto/*` + `@napplet/*` API surface.

---

## The 8 NUB Domains — Reference Mapping

Each domain has a stub reference service in `@kehto/services` (v1.2). The demo must wire real demo UX on top.

| Domain | Capability | What Shell Does | Current Demo State |
|--------|-----------|-----------------|-------------------|
| `identity` | — | Returns signer pubkey, profile reads | Partially wired: signer modal + NIP-46 client, no profile-viewer napplet |
| `ifc` | `relay:read` / `relay:write` | Routes topic pub/sub between napplets | Exercised by bot↔chat; no standalone napplet |
| `keys` | (hotkey:forward) | Forwards keyboard shortcuts from napplet to host | Topology node exists in services; no exercising napplet |
| `media` | — | Audio play/pause, volume, metadata | Stub service only; no demo napplet, no topology UI |
| `notify` | — | Create/list/read/dismiss notifications | Fully wired: notification node + inspector + toast layer |
| `relay` | `relay:read` / `relay:write` | Subscribe, publish, publishEncrypted | Exercised by chat napplet; no standalone feed/composer |
| `storage` | `state:read` / `state:write` | Scoped key-value store per napplet | Exercised by bot (rules) + chat (history); no standalone napplet |
| `theme` | — | Publish theme object to napplets | `bridge.publishTheme()` exists; no demo surface or napplet |

---

## Table Stakes

These must work for the demo to be called "functional." A developer evaluating kehto expects all of these on day one.

### A. Demo App Rewire

| Feature | Why Expected | Complexity | NUB Domain |
|---------|--------------|------------|-----------|
| Boot without `window.nostr` or signer-service | v1.2 MUST NOT mandate removed from spec; demo must model the canonical contract | LOW | identity |
| Topology renders all 8 service nodes | Developer must see the full domain map immediately on load | LOW | all |
| Shell node shows ephemeral host pubkey | Basic "host is alive" proof | LOW | identity |
| Signer modal: NIP-07 + NIP-46 flows | Canonical identity onboarding; no window.nostr path | MEDIUM | identity |
| Signer node reflects connected state (pubkey, method badge, recent requests) | Shows that identity.* is live | LOW | identity |
| ACL panel grants/revokes per-napplet capabilities | Core promise of the runtime: host controls what napplets can do | LOW | all |
| ACL history ring buffer + modal | Audit trail for capability decisions | LOW | all |
| Debugger tap shows real NIP-5D envelope verbs | Messages are now `{ type }` objects, not NIP-01 arrays | MEDIUM | all |
| Service toggle buttons (enable/disable per-service) | Demonstrates runtime service isolation | LOW | all |
| Color-mode edge animation (flash/rolling/decay/last/trace) | Makes message flow visually legible | LOW | all |
| Node inspector (click topology node → right-side detail pane) | Drill-down into per-node state | LOW | all |
| Kinds panel (NIP event kinds reference) | Dev reference — already built, must remain functional | LOW | — |
| Constants panel (protocol constants reference) | Dev reference — already built, must remain functional | LOW | — |

### B. Napplet Showcase — Domain Coverage

One purpose-built napplet per domain that convincingly exercises the nub contract. The "demonstrably working" bar is: a developer watching the demo can see the napplet send a message, the topology edge animate, and the host respond — all without opening DevTools.

| Napplet | Domain | "Demonstrably Working" Behavior | Complexity |
|---------|--------|--------------------------------|-----------|
| **feed** | relay (subscribe) | Subscribes to `{ kinds: [1], limit: 20 }`, renders received text events in a scrollable list; EOSE triggers "loaded" label | MEDIUM |
| **composer** | relay (publish + publishEncrypted) | Text input + "Publish" button → `relay.publish(kind:1)`; optional "Encrypted" toggle → `relay.publishEncrypted` (NIP-44 default); shows OK/denied in status area | MEDIUM |
| **profile-viewer** | identity | Calls `identity.getPublicKey()` → shows truncated pubkey; calls `identity.getProfile()` → shows name/about/picture if returned by signer | MEDIUM |
| **hotkey-chord** | keys | Registers a demo hotkey chord (e.g., Ctrl+Shift+K) via `keys.register()`; shows "chord fired" in UI when host forwards the keypress | MEDIUM |
| **media-controller** | media | Play/pause/volume buttons wired to `media.*` requests; displays current track title + playback state returned by service | MEDIUM |
| **toaster** | notify | "Create Notification" button → `notify.create({ title, body })`; displays own notification in a mini list, reflects `notify.list` response | SMALL |
| **preferences** | storage | Renders 3-4 editable preference fields (e.g., display name, theme preference); saves via `storage.setItem`, loads on mount via `storage.getItem`; shows "saved" / "loaded" status | SMALL |
| **theme-switcher** | theme | Shows current theme colors from `theme.get()`; provides "Light / Dark / Custom" toggle that calls host `publishTheme()`; reflects `theme.changed` push events | MEDIUM |
| **multiplayer-chat** (migrate from `chat`) | ifc | Sends `ifc.emit('chat:message')`, receives `ifc.on('bot:response')`; also calls `relay.publish` so both ifc + relay domains are exercised simultaneously | MEDIUM |
| **bot** (migrate from `bot`) | ifc + storage | Receives `ifc.on('chat:message')`, stores learned rules via `storage.setItem/getItem`, emits `ifc.emit('bot:response')` | MEDIUM |

**Complexity key:** SMALL = 1-2 days; MEDIUM = 3-5 days; LARGE = 1+ week

### C. Playwright Suite

| Spec | What It Proves | Type | Complexity |
|------|---------------|------|-----------|
| **demo-boot** | Shell mounts, all 8 service nodes visible, topology edges rendered, napplets reach AUTH | golden path | SMALL |
| **napplet-auth** | Each napplet successfully completes identity assignment (replaces old `auth-handshake.spec.ts`) | golden path | SMALL |
| **acl-grant-revoke** | Grant/revoke per capability; napplet sees denial in its status area (replaces `acl-enforcement`) | capability matrix | MEDIUM |
| **acl-block-unblock** | Block entire napplet; all operations denied; unblock restores | capability matrix | SMALL |
| **relay-subscribe** | `feed` napplet: topology edge animates; debugger shows `relay.subscribe` + `relay.event` | domain | MEDIUM |
| **relay-publish** | `composer` napplet: publish flow; OK visible in debugger and napplet status | domain | MEDIUM |
| **relay-publish-encrypted** | `composer` napplet: publishEncrypted flow; shell does NIP-44 internally; no ciphertext sent from napplet | domain | MEDIUM |
| **identity-flow** | `profile-viewer` napplet: `identity.getPublicKey()` returns connected signer pubkey | domain | MEDIUM |
| **ifc-roundtrip** | `multiplayer-chat` → `bot` → `multiplayer-chat` round-trip; both napplet status areas reflect message receipt | domain | MEDIUM |
| **storage-persist** | `preferences` napplet: setItem → reload page → getItem returns same value | domain | MEDIUM |
| **notify-lifecycle** | `toaster` napplet: create → list → read → dismiss; host toast layer and napplet UI both update | domain | MEDIUM |
| **theme-broadcast** | `theme-switcher` napplet: toggle triggers `publishTheme()` host-side; other napplets receive `theme.changed` push | domain | MEDIUM |
| **acl-revoke-relay-write** | Revoke `relay:write`; composer publish denied with legible reason in debugger | capability matrix | SMALL |
| **acl-revoke-storage-write** | Revoke `state:write`; preferences save denied | capability matrix | SMALL |
| **demo-node-inspector** | Click each topology node → inspector pane opens with role content | demo surface | SMALL |
| **demo-debugger** | Debugger receives envelope events (type strings, not NIP-01 verbs) while napplets are active | demo surface | SMALL |
| **demo-service-toggle** | Toggle a service off → napplet request fails; toggle back on → succeeds | demo surface | SMALL |
| **demo-notification-service** | Migrate existing spec to canonical API (no BusKind; pure envelope events) | demo surface | SMALL |
| **harness-smoke** | Test harness boot, `__SHELL_READY__`, `__loadNapplet__`, `__TEST_MESSAGES__` | infrastructure | SMALL |

---

## Differentiators

Features that make this demo stand out as a developer resource beyond "it runs."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Per-edge directional animation with 5 color modes** | Makes protocol traffic visible; turns an abstract concept into observable flow | LOW | Already built; needs napplet traffic to animate |
| **ACL audit history** | Real-time log of every capability decision; useful for debugging security contracts | LOW | Already built; ring buffer wired to `onAclCheck` hook |
| **Inline debugger tap showing envelope `type` strings** | Developer can read the wire protocol without DevTools; confirms what spec says matches what runs | MEDIUM | Requires updating the debugger to display JSON envelope keys |
| **Service enable/disable toggle per node** | Demonstrates that services are runtime-pluggable; not hardwired | LOW | Already built; needs more napplets to make this interesting |
| **Node inspector with per-role content** | Click ACL node → see grant/revoke table; click runtime node → see registered NUBs; click napplet node → see capability state | LOW | Already built; extend with NUB list for runtime node |
| **publishEncrypted as first-class demo** | Shows the shell-mediated encryption model: napplet sends plaintext, shell does NIP-44, no keys ever cross the sandbox boundary | MEDIUM | Requires `composer` napplet |
| **theme-broadcast round-trip** | Makes the theme domain tangible; napplets visually change when host toggles theme | MEDIUM | Requires `theme-switcher` + at least one theme-consuming napplet |
| **Playwright MCP loop as development discipline** | Each phase ends with a live Playwright run; failures drive fixes before moving on | LOW | Process, not code |

---

## Anti-Features

These must be explicitly excluded. Call them out so no phase plan re-introduces them.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Rebuild `window.nostr` as a napplet-visible surface** | Canonically forbidden by NIP-5D ("Shells MUST NOT provide window.nostr"); rebuilding it would make the demo demonstrate the wrong contract | Use `identity.getPublicKey()` and `relay.publish` / `relay.publishEncrypted` exclusively |
| **Raw `window.addEventListener('message')` in napplets** | The current bot/chat napplets do this; it bypasses the `@napplet/sdk` envelope API and listens for legacy `['OK', ...]` arrays directly | Migrate to `@napplet/sdk`'s `relay`, `ipc`, `storage` objects; AUTH is implicit via shim, no explicit event listener needed |
| **Signer-service as a separate registered service** | Was deleted in v1.2; shell mediates all signing via `relay.publishEncrypted` internally | Demo must show the canonical path: napplet calls `relay.publish` → shell signs internally; no signer-service |
| **BusKind / kind 29001 / kind 29002 in napplet code** | These are now internal shell implementation details, not part of the napplet-visible protocol | Use `@napplet/sdk` which abstracts this |
| **Demo napplets that directly use `ipc.emit` + `relay.publish` in the same send path** | The current `chat` napplet emits to both relay and ifc for a single message, conflating two domains | Single-domain napplets; `multiplayer-chat` should focus on `ifc`, `composer` on `relay.publish` |
| **E2E specs that inject raw kind 29001 / kind 29003 events via `__publishEvent__`** | These specs test the internal signer protocol, which is no longer napplet-visible; they are testing deleted API | Delete `acl-matrix-signer.spec.ts`, `signer-delegation.spec.ts`; replace with domain-level specs against real napplets |
| **E2E specs that depend on `#chat-status` / `#bot-status` auth badge pattern** | These DOM IDs couple the spec to the napplet's legacy auth listener; the badge pattern goes away with the SDK migration | Playwright specs should look for napplet-rendered status using SDK-produced state |
| **Mega-napplet that exercises all domains** | NIP-5D philosophy: "A napplet SHOULD be single-purpose rather than monolithic"; a multi-domain napplet obscures what each NUB does | One napplet per domain in the showcase |
| **CI/CD integration in this milestone** | Deferred by PROJECT.md decision; adding it creates scope drift | Run Playwright locally via Playwright MCP; no CI setup |

---

## Feature Dependencies

```
Napplet SDK migration (bot, chat → @napplet/sdk)
  └──required by──> multiplayer-chat napplet (ifc domain)
  └──required by──> Playwright specs that interact with real napplets

Demo shell boot (no window.nostr, no signer-service)
  └──required by──> all napplets loading and reaching identity state
  └──required by──> all domain specs

identity domain wired (signer modal + identity service)
  └──required by──> profile-viewer napplet
  └──required by──> relay.publish (shell needs signer to sign internally)
  └──required by──> relay.publishEncrypted

relay.publish working end-to-end
  └──required by──> composer napplet
  └──required by──> relay-publish Playwright spec
  └──enhances──> relay.publishEncrypted (same path, adds encryption step)

ifc domain working (multiplayer-chat → bot round-trip)
  └──required by──> ifc-roundtrip Playwright spec
  └──depends on──> both napplets migrated to @napplet/sdk

storage domain working
  └──required by──> preferences napplet
  └──required by──> storage-persist Playwright spec

notify domain working (already done in v1.2)
  └──required by──> toaster napplet
  └──enhances──> demo-notification-service spec (already written, needs API update)

theme domain wired (bridge.publishTheme exists)
  └──required by──> theme-switcher napplet
  └──required by──> theme-broadcast Playwright spec
  └──note──> theme-broadcast requires at least one theme-consuming napplet to observe the push

Playwright harness (test infra)
  └──required by──> all E2E specs
  └──note──> harness-smoke spec verifies the harness itself; must pass before domain specs run

E2E triage (delete obsolete specs)
  └──must happen before──> Playwright green run
  └──targets──> signer-delegation.spec.ts, acl-matrix-signer.spec.ts, auth.spec.ts (legacy verb tests)
```

### Dependency Notes

- **relay.publish requires identity**: Shell signs events internally before publishing; if no signer is connected, publish returns an error. The demo should either auto-connect a demo ephemeral signer or make the "no signer" error state a teachable moment.
- **theme-broadcast depends on relay working**: `publishTheme()` is a host-side push (not a napplet request), but observing the `theme.changed` response in a napplet requires the napplet to have completed identity assignment — which runs through the same postMessage channel as relay.
- **Playwright demo-functional specs depend on the demo server running**: Unlike the harness specs (which boot a minimal test shell), the demo specs spawn a real `vite` dev server and interact with the full demo app. These take longer and must be run after all napplet migrations are complete.
- **ACL specs should run against real napplets, not `__publishEvent__`**: The old harness-level specs injected raw protocol events; the new specs should interact through the napplet UIs (fill text, click button) so the full envelope path is exercised.

---

## MVP Definition for v1.3

### Must Have (Phase Blocker)

- [ ] Demo boots without errors; all 8 service nodes visible; signer modal works (NIP-07 + NIP-46)
- [ ] `multiplayer-chat` + `bot` napplets migrated to `@napplet/sdk`; ifc round-trip observable in debugger
- [ ] `composer` napplet: relay.publish and relay.publishEncrypted flows work; debugger shows correct envelope types
- [ ] `preferences` napplet: storage.getItem / setItem round-trip survives page reload
- [ ] `toaster` napplet: notify.create / notify.list cycle updates both napplet and host toast layer
- [ ] E2E triage complete: obsolete specs deleted; surviving harness specs green
- [ ] `demo-boot`, `napplet-auth`, `acl-grant-revoke`, `ifc-roundtrip`, `relay-publish`, `storage-persist`, `notify-lifecycle` Playwright specs green
- [ ] Debugger displays envelope `type` strings (not raw NIP-01 verbs)

### Add After Core Is Green

- [ ] `feed` napplet: relay.subscribe with scrolling event list
- [ ] `profile-viewer` napplet: identity.getPublicKey + identity.getProfile
- [ ] `theme-switcher` napplet: theme.get + publishTheme toggle
- [ ] `identity-flow`, `relay-subscribe`, `theme-broadcast` Playwright specs
- [ ] Node inspector: extend runtime node to show registered NUBs

### Defer to Future Milestone

- [ ] `hotkey-chord` napplet: keys domain requires host hotkey forwarding infrastructure; no reference implementation in `@kehto/services` yet (stub only)
- [ ] `media-controller` napplet: media domain service is a stub with no real audio backend; napplet would only show "not implemented" responses
- [ ] CI/CD: deferred per PROJECT.md decision
- [ ] `changeset publish`: blocked on `@napplet/core` npm publication

---

## Feature Prioritization Matrix

| Feature | Developer Value | Implementation Cost | Priority |
|---------|----------------|---------------------|----------|
| Demo boot + signer modal | HIGH | LOW | P1 |
| multiplayer-chat + bot SDK migration | HIGH | MEDIUM | P1 |
| composer napplet (relay.publish) | HIGH | MEDIUM | P1 |
| E2E triage (delete obsolete specs) | HIGH | LOW | P1 |
| Playwright demo-boot + napplet-auth | HIGH | LOW | P1 |
| preferences napplet (storage) | HIGH | SMALL | P1 |
| toaster napplet (notify) | HIGH | SMALL | P1 |
| Debugger envelope verb display | HIGH | MEDIUM | P1 |
| feed napplet (relay.subscribe) | HIGH | MEDIUM | P2 |
| profile-viewer napplet (identity) | MEDIUM | MEDIUM | P2 |
| theme-switcher napplet (theme) | MEDIUM | MEDIUM | P2 |
| relay-publish-encrypted spec | HIGH | MEDIUM | P2 |
| All domain Playwright specs | HIGH | MEDIUM | P2 |
| Node inspector NUB list | LOW | LOW | P2 |
| hotkey-chord napplet (keys) | LOW | HIGH | P3 |
| media-controller napplet (media) | LOW | HIGH | P3 |
| Docs refresh (READMEs + docs/) | MEDIUM | LOW | P2 |
| Release rehearsal (changeset dry-run) | MEDIUM | LOW | P2 |

---

## Comparable Systems Analysis

This research draws from how similar sandboxed plugin demo hosts present their capabilities.

**Figma plugins** — Each capability (network access, UI creation, file read) is declared in `manifest.json` and shown in a permission prompt. The Figma plugin runner shows the plugin iframe embedded in the host. A good Figma plugin demo shows permission grant → API call → host reaction. Kehto should show the equivalent: ACL grant → napplet API call → topology edge flash → service response.

**VS Code extension host** — The extension host communicates over a JSON-RPC bridge. VS Code's own extension development workflow includes an "Extension Development Host" window that shows the extension running in isolation. Kehto's topology view is the equivalent: each napplet is a node, the shell/ACL/runtime/services are the host infrastructure layers.

**Obsidian plugins** — Obsidian's plugin dev experience is notable for immediate visual feedback: a plugin calls `app.vault.create()` and the file appears in the file tree. The host state change is the proof. Kehto's equivalent: a napplet calls `notify.create()` and the toast appears in the host. This is already implemented for notify; the other 7 domains need equivalent host-visible feedback.

**Bangle.io workers** — Uses web workers behind a message-passing API. Their demo isolates the worker but the main thread reflects state changes in the editor. The isolation boundary is the key teaching point, same as kehto's sandbox enforcement.

**Common pattern across all four:** The showcase demo has three layers:
1. **Protocol visualization** (topology + edges, message log) — answers "how does communication work?"
2. **Capability enforcement** (ACL panel, grant/revoke) — answers "who controls what?"
3. **Live functional proof** (napplet UI doing something observable) — answers "does it actually work?"

Kehto's demo already has layers 1 and 2. v1.3 completes layer 3 for all 8 domains.

---

## Sources

All findings sourced from live codebase. Confidence: HIGH.

- `/home/sandwich/Develop/kehto/specs/NIP-5D.md` — Canonical NIP-5D spec (synced at v1.2)
- `/home/sandwich/Develop/kehto/apps/demo/src/main.ts` — Demo entry point
- `/home/sandwich/Develop/kehto/apps/demo/src/shell-host.ts` — Shell boot, napplet definitions, service registration
- `/home/sandwich/Develop/kehto/apps/demo/src/notification-demo.ts` — Reference for domain-specific demo controller pattern
- `/home/sandwich/Develop/kehto/apps/demo/napplets/chat/src/main.ts` — Current chat napplet (legacy auth listener pattern)
- `/home/sandwich/Develop/kehto/apps/demo/napplets/bot/src/main.ts` — Current bot napplet (legacy auth listener + ifc + storage)
- `/home/sandwich/Develop/kehto/tests/e2e/*.spec.ts` — Current E2E suite (triage targets identified above)
- `/home/sandwich/Develop/kehto/.planning/PROJECT.md` — v1.3 scope, decisions, constraints

---
*Feature research for: kehto v1.3 Demo-Functional & Playwright Parity*
*Researched: 2026-04-18*
