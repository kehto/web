# NAP-INTENT — Archetype intent dispatch (kehto runtime)

**Date:** 2026-06-15
**Status:** Approved (autonomous /goal execution)
**Spec source:** `napplet/naps` `NAP-INTENT.md` (draft)
**SDK side:** `napplet/web` `packages/nap/src/intent/*` + `packages/core/src/types.ts` (changeset `nap-intent`, not yet published to `@napplet/core@0.5.0`)

## Goal

Implement the **shell/runtime side** of NAP-INTENT in kehto. A napplet names a
**role** (archetype) such as `note` or `emoji-list`, an **action** (`open`,
`edit`, `pick`, `share`), and an opaque **payload** tagged by a **protocol**
(a NAP-N wire id); the shell resolves the archetype to an installed napplet
(honoring the user's default-handler preference), creates or focuses its window,
and delivers the payload. This is the napplet equivalent of an OS implicit
intent with a default app: the caller names a role, never a specific napplet.

Routing (`archetype` — *which* napplet + whose default) and payload format
(`protocol` — *what* wire shape) are orthogonal (N:M). NAP-INTENT standardizes
the **envelope**; the named NAP-N protocol governs the payload and its delivery.
Napplets never address each other directly — archetype resolution is the trust
boundary.

## Wire protocol (NIP-5D)

The protocol value types (`IntentRequest`, `IntentResult`, `IntentAvailability`,
`IntentCandidate`, `IntentBehavior`, `IntentHandlerPreference`) shipped upstream
in `@napplet/core` via the `nap-intent` changeset, but the version kehto
currently depends on (`@napplet/core@0.5.0`) predates them. So — exactly as
**NAP-CVM** did with `cvm-types.ts` — kehto defines them locally in
`intent-types.ts`, **wire-compatible** with the upstream shapes, importing only
the generic `NappletMessage` envelope from `@napplet/core`.

| Type | Direction | Payload |
|------|-----------|---------|
| `intent.invoke` | napplet → shell | `id`, `request` |
| `intent.invoke.result` | shell → napplet | `id`, `result?`, `error?` |
| `intent.available` | napplet → shell | `id`, `archetype` |
| `intent.available.result` | shell → napplet | `id`, `availability?`, `error?` |
| `intent.handlers` | napplet → shell | `id` |
| `intent.handlers.result` | shell → napplet | `id`, `handlers?`, `error?` |
| `intent.changed` | shell → napplet | `availability` (push, no `id`) |

The action is carried as `request.action`, never encoded into the message type —
`intent.invoke` is the single dispatch verb for every action. The shell SHOULD
return a structured `result` with `ok: false` / `handled: false` when resolution
or delivery fails, and a top-level `error` when the request itself is malformed
(no `result` produced).

## Architecture (mirrors NAP-OUTBOX / NAP-UPLOAD, the most recent vertical slices)

### 1. ACL — `@kehto/acl`
- `capabilities.ts`: add `'intent:read'` and `'intent:write'` to
  `ALL_CAPABILITIES`; export `CAP_INTENT_READ` / `CAP_INTENT_WRITE`.
- `resolve.ts`: add `intentMap(action)` and a `case 'intent'`:
  - `invoke` → `senderCap: 'intent:write'` (the focus-stealing cross-napplet
    dispatch op).
  - `available` / `handlers` / unknown → `senderCap: 'intent:read'` (read-side
    catalog introspection).
  - `changed` / `*.result` / `*.error` (shell→napplet pushes) →
    `recipientCap: 'intent:read'` (a napplet without the read cap never sees
    availability updates or invoke results).

**Capability decision — read/write split.** Mirrors `outbox` / `relay`: the
sensitive op is the write side. Introspecting available handlers
(`available`/`handlers`) is harmless read-only catalog access; **dispatch**
(`invoke`) is a navigation + focus-stealing action that crosses the napplet
trust boundary. Splitting the caps lets a read-only (class-2) napplet show
"open in…" affordances without being able to actually steal focus.

### 2. NAP-CLASS restriction
`intent:write` **is** added to the `class-2` exclusion set in `enforce.ts`,
alongside `relay:write` and `outbox:write`. A restricted (class-2) napplet may
introspect (`intent:read`) but may not dispatch — the read-only posture can
route/query but not publish, sign, or steal focus.

### 3. Runtime dispatch — `@kehto/runtime`
- `acl-state.ts`: add `CAP_INTENT_READ = 1 << 21` and
  `CAP_INTENT_WRITE = 1 << 22` to the bitfield + `CAP_MAP`.
- `domain-handlers.ts`: add `intent` to `RuntimeDomainHandlers`, widen the
  `handleServiceOnlyMessage` name union, and route
  `intent: (windowId, msg) => handleServiceOnlyMessage(context, 'intent', …)`.
- `runtime.ts`: `napDispatch.registerNap('intent', adapt(handlers.intent));`
  (the registerNap lesson — registering the service is not enough; the domain
  must be wired into the dispatcher).

### 4. Services — `@kehto/services`
- **`intent-types.ts`** — kehto-internal, wire-compatible value types (see Wire
  protocol above).
- **`intent-service.ts`** — `createIntentService({ resolver }) → ServiceHandler`.
  A pure envelope router, exactly like `outbox-service.ts`:
  - On `intent.invoke`: validates the request carries a non-empty `archetype`
    (else top-level `error: 'invalid request'`), then delegates to
    `resolver.invoke(request, { windowId })` and replies `intent.invoke.result`
    with the structured `result` (or a top-level `error` if the resolver throws).
  - On `intent.available`: validates `archetype` (else `'invalid archetype'`),
    delegates to `resolver.available`, replies `intent.available.result`.
  - On `intent.handlers`: delegates to `resolver.handlers`, replies
    `intent.handlers.result`.
  - Tracks the latest `send` per served window and fans `resolver.onChanged`
    availability updates out to all of them as `intent.changed` pushes;
    `onWindowDestroyed` drops the window from the broadcast set.
  - A `settle` helper normalizes sync-or-async resolver calls to a promise and
    catches a synchronous throw the same way as an async rejection.
  - Abstract injected interface (the "shell owns resolution" seam):
    ```ts
    interface IntentResolverContext { windowId: string }
    interface IntentResolver {
      invoke(request: IntentRequest, ctx: IntentResolverContext): IntentResult | Promise<IntentResult>;
      available(archetype: string): IntentAvailability | Promise<IntentAvailability>;
      handlers(): IntentAvailability[] | Promise<IntentAvailability[]>;
      onChanged?(listener: (a: IntentAvailability) => void): () => void;
    }
    ```
- **`catalog-intent-resolver.ts`** — `createCatalogIntentResolver({ loadCatalog,
  windows, getDefaultHandler?, chooseHandler?, defaultProtocol? }) →
  CatalogIntentResolver`. The concrete reference resolver (analog of
  `relay-pool-outbox-router.ts` / `http-uploader.ts`):
  - Gathers candidates for an archetype from the installed-napplet catalog.
  - Picks the handler — an explicit `handler` dTag, a `handler: "choose"` user
    choice, the user's default, the sole candidate, or a deterministic
    first-candidate fallback.
  - Validates the resolved handler supports the requested `action`
    (`unsupported action`) and `protocol` (`unsupported protocol`), defaulting
    the protocol to the archetype's recommendation then the candidate's first
    accepted protocol.
  - Opens or focuses the handler window through an injected
    `IntentWindowController` (`invoke failed` on throw) and returns its id.
  - `available()` / `handlers()` source from the catalog (installed manifests,
    not running instances), so not-yet-running handlers are discoverable.
  - `notifyChanged(archetype)` recomputes availability and fires `onChanged`
    listeners — the host's hook for catalog/default changes.
  - Catalog, defaults, chooser, and window controller are all injected, so the
    resolver carries no shell, manifest, or DOM dependency and is fully
    unit-testable.
- `index.ts`: export `createIntentService`, `createCatalogIntentResolver`, and
  their public types.

### 5. Shell — `@kehto/shell`
- `types.ts`: add an optional `intent?: IntentHooks` to `ShellAdapter` — a
  presence/availability signal (`isAvailable()`). The host app still wires the
  concrete service via `runtime.registerService('intent', …)`, matching how
  outbox/upload services are registered.
- `shell-init.ts`: advertise `'intent'` in `buildShellCapabilities` when
  `hooks.intent?.isAvailable()`, so napplets discover it via
  `shell.supports('intent')`.

### 6. Tests
- `acl/src/resolve.test.ts`: `intent.*` cap resolution (invoke→write,
  available/handlers→read, pushes→recipient read) + `ALL_CAPABILITIES` content.
- `runtime/src/intent-dispatch.test.ts`: domain routing to a registered
  `intent` service; ACL denial → `intent.available.error`; class-2 denied
  `intent.invoke` but allowed `intent.available`.
- `services/src/intent-service.test.ts`: mock `IntentResolver` — invoke/
  available/handlers result marshalling, structural validation, error
  surfacing, and the `intent.changed` broadcast fan-out + window teardown.
- `services/src/catalog-intent-resolver.test.ts`: candidate gathering, handler
  selection (explicit/choose/default/sole/first-fallback), action + protocol
  validation and defaulting, window-open failure, availability/handlers
  reporting, and the `onChanged`/`notifyChanged` path.
- `shell/src/shell-init.test.ts`: `intent` advertised only when an available
  dispatcher is wired.

### 7. Release & stop condition
- `.changeset/nap-intent.md`: minor bump for `@kehto/acl`, `@kehto/runtime`,
  `@kehto/services`, `@kehto/shell`.
- `pnpm build` + `pnpm type-check` + full test run green.
- `npx aislop scan` with a good score.
- Commit, push, and tag.

## Availability change pushes — supported, not out of scope
`intent.changed` IS part of the protocol and the service. A resolver streams
availability updates through `onChanged` (fired by the catalog resolver's
`notifyChanged` when a napplet is installed/removed or a default changes); the
service forwards each to every served napplet. The catalog resolver's change
trigger is a host hook because *what* counts as a catalog change (a manifest
sync, a settings write) is host policy, not part of the NAP wire contract.

## Out of scope (YAGNI)
- The default-handler store, the "open with…" chooser UI, per-archetype policy,
  rate-limiting/user-gesture gating of focus-stealing, and the manifest catalog
  itself — these are host-app/runtime policy decisions behind the
  `IntentResolver` / `IntentWindowController` / `IntentHooks` seams, not part of
  the NAP wire contract. The bundled `createCatalogIntentResolver` is a
  reference; a host may supply any `IntentResolver`.
- Cold-start payload delivery mechanics — the resolved NAP-N protocol governs
  *how* the payload reaches the handler (an INC topic event, initial state);
  NAP-INTENT governs resolution, default handling, and window lifecycle.
