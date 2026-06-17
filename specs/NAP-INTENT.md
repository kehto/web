# NAP-INTENT — Archetype Intent Dispatcher

Status: repo-local mirror of the merged registry spec, for kehto conformance work.

Authoritative source: [`napplet/naps` · `naps/NAP-INTENT.md`](https://github.com/napplet/naps/blob/master/naps/NAP-INTENT.md).
Where this mirror and the registry differ, **the registry wins**. The NIP-5D
envelope/transport is defined by [`specs/NIP-5D.md`](./NIP-5D.md)
(authority: [`nostr-protocol/nips#2303`](https://github.com/nostr-protocol/nips/pull/2303)).

- **NAP ID:** NAP-INTENT
- **Domain:** `intent`
- **Web binding (NIP-5D):** `window.napplet.intent` · `shell.supports("intent")`

## What it does

NAP-INTENT provides napplets with a shell-mediated interface for invoking
*another* napplet by its **archetype** — a shared role name such as `note`,
`profile`, or `emoji-list`. A napplet describes *what role* it wants, *what
action* to perform, and *what payload* to deliver; the shell resolves the role to
an installed napplet, applies the user's default-handler preference, creates or
focuses the window, and delivers the payload. This is the napplet equivalent of
an OS implicit intent with a "default application": the caller names a role and
an action, never a specific napplet.

NAP-INTENT standardizes the **envelope**, not the payload. The two routing axes
are orthogonal (N:M) and evolve independently:

- **archetype** — *routing*: which napplet should handle this, and whose default
  applies.
- **protocol** — *parsing*: what wire format (`NAP-N`) the opaque `payload` is in.

Resolution of an archetype to a concrete napplet is **shell policy**. Napplets
never address each other directly.

## API surface (web binding)

```typescript
interface NappletIntent {
  invoke(request: IntentRequest): Promise<IntentResult>;       // via intent.invoke
  open(archetype: string, payload?: unknown,
       opts?: Omit<IntentRequest, "archetype" | "action" | "payload">): Promise<IntentResult>; // sugar: action "open"
  available(archetype: string): Promise<IntentAvailability>;   // via intent.available
  handlers(): Promise<IntentAvailability[]>;                   // via intent.handlers
  onChanged(handler: (a: IntentAvailability) => void): Subscription;
}

interface IntentRequest {
  archetype: string;                 // role slug, e.g. "note"
  action?: string;                   // verb, default "open" ("open" | "edit" | "pick" | "share" | …)
  protocol?: string;                 // NAP-N id shaping `payload`; omit → archetype's recommended default
  payload?: unknown;                 // opaque, typed by `protocol`
  handler?: "default" | "choose" | string;  // user default | "open with…" prompt | a specific napplet dTag
  behavior?: { focus?: boolean; newWindow?: boolean; reuse?: boolean };
}

interface IntentCandidate {
  dTag: string;                      // a napplet that fulfills the archetype
  title?: string;
  actions: string[];                 // verbs this candidate supports for the archetype
  protocols: string[];               // NAP-N ids this candidate accepts for the archetype
  isDefault?: boolean;
}

interface IntentAvailability {
  archetype: string;
  available: boolean;                // at least one installed napplet fulfills it
  candidates: IntentCandidate[];     // sourced from the manifest catalog, not running instances
  hasDefault: boolean;
}

interface IntentResult {
  ok: boolean;
  archetype: string;
  action: string;
  handled: boolean;
  handler?: string;                  // dTag of the napplet that handled it
  windowId?: string;
  protocol?: string;                 // the wire format actually used
  error?: string;
}
```

The **action is a field** (`request.action`), never encoded into the message
type, so new actions never expand the wire surface. `available()` is the
pre-flight guardrail: a caller checks availability before showing an affordance,
sourced from the **installed-napplet catalog** (signed manifests), so it reports
`true` for an installed handler that is not yet running.

## Wire protocol

`intent.*` messages use the NIP-5D wire format (`{ "type": "domain.action", ...payload }`).

| Type                     | Direction        | Payload fields                |
| ------------------------ | ---------------- | ----------------------------- |
| `intent.invoke`          | napplet → shell  | `id`, `request`               |
| `intent.invoke.result`   | shell → napplet  | `id`, `result`, `error?`      |
| `intent.available`       | napplet → shell  | `id`, `archetype`             |
| `intent.available.result`| shell → napplet  | `id`, `availability`, `error?`|
| `intent.handlers`        | napplet → shell  | `id`                          |
| `intent.handlers.result` | shell → napplet  | `id`, `handlers`, `error?`    |
| `intent.changed`         | shell → napplet  | `availability` *(push, no `id`)* |

- Request/result pairs use `id` for correlation; `intent.changed` is a shell push
  with no `id`.
- The shell delivers `payload` to the resolved handler using the named
  `protocol`'s own delivery mechanism — typically a NAP-N INC topic event (e.g.
  `note:open`), or initial state passed at instantiation for a cold-started
  handler. NAP-INTENT governs resolution, default handling, and window lifecycle;
  the NAP-N protocol governs the payload wire and its delivery.
- `protocol` and `archetype` are independent — the shell MUST NOT assume a
  one-to-one mapping.

### Error handling (sanctioned structured errors)

Unlike most NAP domains, result messages **MAY include `error`** when the request
cannot be fulfilled. The shell SHOULD return a structured `result` with
`ok: false` and `handled: false` when resolution or delivery fails. Common error
strings: `"unknown archetype"`, `"no handler"`, `"unsupported action"`,
`"unsupported protocol"`, `"user cancelled"`, `"invoke failed"`. This is the
NAP-sanctioned exception to NIP-5D's silently-ignore rule for the `intent` domain
(see [`specs/NIP-5D.md` → Wire Format](./NIP-5D.md)).

## Shell behavior

- The shell MUST resolve an `archetype` to a handler using its catalog of
  installed napplets and the user's default-handler preference for that archetype.
- The shell MUST keep a user-overridable default per archetype; `invoke` without
  an explicit `handler` MUST route to it when one exists.
- The shell SHOULD offer an "open with…" chooser on `handler: "choose"`, or when
  no default exists and more than one candidate is available.
- The shell MUST source `available()` / `handlers()` from the **installed-napplet
  catalog** (signed NIP-5A manifests), not from currently-running instances.
- The shell MUST respond to every request with a result message carrying the same
  `id`, and MUST deliver `payload` only after the handler is ready to receive it.
- A napplet MUST NOT learn the identity of, or address, another napplet except
  through this resolution — callers name roles, never instances (unless the user
  granted a specific `handler` dTag).

## Archetype axis (NIP-5D manifest)

NAP-INTENT resolution is keyed on the **archetype**, declared in a napplet's
NIP-5D manifest as `["archetype", "<slug>", "<NAP-N>"]` (the optional third
element is the recommended default wire protocol). The shell sources its catalog
from these signed manifest tags — see [`specs/NIP-5D.md` → Manifest](./NIP-5D.md).

## Kehto conformance notes

- The `intent.*` wire types, `IntentRequest`/`Result`/`Availability`/`Candidate`
  shapes, default-handler routing, chooser, and error strings live in
  `packages/services/src/intent-*.ts` and `catalog-intent-resolver.ts`.
- The `["archetype", …]` (and optional `source`) manifest tags are parsed by
  `@kehto/nip/5d` into a structured `archetypes` field on `NappletManifest`
  (ARCH-01); `manifestToIntentCatalogEntry` in `@kehto/services` derives the
  catalog entry from a resolved signed manifest (ARCH-02), so `available()` /
  `handlers()` are sourced from signed manifests rather than host-injected data.

## References

- [`napplet/naps` · NAP-INTENT.md](https://github.com/napplet/naps/blob/master/naps/NAP-INTENT.md) — authoritative spec
- [`napplet/naps` · ARCHETYPES.md](https://github.com/napplet/naps/blob/master/ARCHETYPES.md) — archetype role registry
- [`specs/NIP-5D.md`](./NIP-5D.md) — envelope / transport / manifest / identity
- [NIP-5D PR #2303](https://github.com/nostr-protocol/nips/pull/2303)
