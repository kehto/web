# NAP-SHELL — Bootstrap Handshake & Capability Negotiation

Status: repo-local mirror of the merged registry spec, for kehto conformance work.

Authoritative source: [`napplet/naps` · `naps/NAP-SHELL.md`](https://github.com/napplet/naps/blob/master/naps/NAP-SHELL.md).
Where this mirror and the registry differ, **the registry wins**. The NIP-5D
envelope/transport is defined by [`specs/NIP-5D.md`](./NIP-5D.md)
(authority: [`nostr-protocol/nips#2303`](https://github.com/nostr-protocol/nips/pull/2303)).

- **NAP ID:** NAP-SHELL
- **Domain:** `shell`
- **Required:** **Mandatory** — every conformant runtime MUST implement NAP-SHELL.
- **Web binding (NIP-5D):** `window.napplet.shell`

NAP-SHELL is the **foundational** capability: it defines `shell.supports()`
itself and is therefore the one NAP that cannot be discovered through
`shell.supports()`. A napplet MAY assume it is present.

## Why a handshake

Before a napplet can use any capability, two things must be true that neither
side can know on its own: the runtime must learn **when the napplet is ready to
receive messages**, and the napplet must learn **what the runtime offers**.
NAP-SHELL is the two-message handshake that resolves this bootstrap dependency.

The napplet signals readiness (`shell.ready`). The runtime replies **once** with
the environment (`shell.init`): the capabilities it offers, the named services it
exposes, and the napplet's assigned class. The napplet caches that environment,
which is what makes `shell.supports()` answerable **synchronously and locally**
thereafter — no round-trip per query. Receipt of the readiness signal is also the
point at which the runtime considers the napplet's **session established**.

NAP-SHELL standardizes the **handshake and the queryable capability set**, not
the internal byte layout of that set. A runtime is conformant as long as it
delivers an environment from which `supports(domain, protocol?)` can be answered
for every capability it offers.

## API surface (web binding)

```typescript
interface NappletShell {
  // Synchronous capability query, answered from the cached environment.
  // `protocol` narrows a domain to a specific numbered wire protocol within it.
  supports(domain: string, protocol?: string): boolean;

  readonly services: readonly string[];
  readonly class: number | null;            // opaque integer the runtime assigns, or null

  ready(): Promise<ShellEnvironment>;        // resolves once env is delivered
  onReady(handler: (env: ShellEnvironment) => void): Subscription;
}

interface ShellEnvironment {
  capabilities: ShellCapabilities;           // sufficient to answer supports(domain, protocol?)
  services: string[];
  class: number | null;
}
```

`supports(domain, protocol?)` is synchronous, reads the cached environment, and
returns `false` before the environment is delivered, for any unknown domain, and
for any unknown protocol. `class` is opaque — NAP-SHELL carries it but does not
define its meaning.

## Wire protocol

`shell.*` messages use the NIP-5D wire format (`{ "type": "domain.action", ...payload }`).
The handshake is two fire-and-forget messages; neither carries a correlation
`id`, because each occurs exactly once per napplet lifecycle.

| Type          | Direction          | Payload fields                  |
| ------------- | ------------------ | ------------------------------- |
| `shell.ready` | napplet → runtime  | *(none)*                        |
| `shell.init`  | runtime → napplet  | `capabilities`, `services`, `class` |

- `shell.ready` carries **no payload**. It is a liveness signal only ("my
  receiver is installed"). It MUST NOT carry napplet identity or capability
  claims; identity is assigned by the runtime at napplet creation (NIP-5A), not
  asserted over this channel.
- `shell.init` is sent **exactly once** in response to the first `shell.ready`.
- `shell.supports()` is answered **locally** from the cached `shell.init`
  environment — never a wire round-trip.
- The capability object's internal shape is non-normative; only that it can
  answer `supports(domain, protocol?)` for every offered capability.

### Example handshake

```
→ { "type": "shell.ready" }
← {
    "type": "shell.init",
    "capabilities": {
      "domains": ["<domain>", "<domain>"],
      "protocols": { "<domain>": ["NAP-N", "NAP-N"] }
    },
    "services": [],
    "class": 1
  }
```

Subsequent queries answer locally with no wire traffic:

```
shell.supports("<domain>")             // true if the runtime offers that domain
shell.supports("<domain>", "NAP-N")    // true if it also speaks that protocol
shell.supports("<unknown>")            // false — domain not offered
```

### Error handling

The handshake has no result envelope and therefore **no `error` field**. Failure
is expressed by **absence**: if `shell.init` never arrives, `supports()` returns
`false` for everything. A napplet SHOULD treat a missing environment after a
reasonable timeout as "running outside a conformant runtime" and degrade rather
than hang. A runtime that declines to service a napplet MAY withhold `shell.init`
entirely.

## Shell (runtime) behavior

- The runtime MUST send `shell.init` in response to the napplet's first
  `shell.ready`, only after the napplet's receiver is live (never speculatively).
- The runtime MUST establish the napplet's session upon the first `shell.ready`,
  binding it to the identity assigned at napplet creation (NIP-5A) — never to
  anything carried in the message.
- The runtime MUST send `shell.init` **exactly once** per napplet lifecycle.
- The delivered capability set MUST be sufficient to answer
  `supports(domain, protocol?)` truthfully for every capability it offers, and
  MUST answer `false` for capabilities it does not offer.
- A duplicate `shell.ready` MUST be treated as **idempotent**: it MUST NOT
  establish a second session or overwrite the first, and SHOULD NOT resend
  `shell.init`.
- The runtime MUST NOT service capability calls for a napplet whose session has
  not been established by the handshake.

## Kehto conformance notes

- Exactly-once `shell.init` and the idempotent-duplicate-`shell.ready` guard are
  enforced in `packages/shell/src/shell-ready.ts` (per-`windowId` `initSent`
  guard; SHELL-01 / gap G1).
- `class` is carried on the wire as `number | null` (opaque posture code),
  mapped at the `shell.init` build site from kehto's internal string label
  (SHELL-02 / gap G2).
- Kehto emits the conformant `capabilities.{ domains, protocols }` shape (read by
  `@napplet/shim@0.13`) as a **superset alongside** the legacy `naps`/`nubs`/
  `sandbox` fields, retained for the installed 0.5.0 shim (dual-emit; removal is
  tracked as CLEANUP-01). See `packages/shell/src/shell-init.ts`.

## References

- [`napplet/naps` · NAP-SHELL.md](https://github.com/napplet/naps/blob/master/naps/NAP-SHELL.md) — authoritative spec
- [`napplet/naps` · projections/web.md](https://github.com/napplet/naps/blob/master/projections/web.md) — web binding
- [`specs/NIP-5D.md`](./NIP-5D.md) — envelope / transport / identity
- [NIP-5D PR #2303](https://github.com/nostr-protocol/nips/pull/2303)
