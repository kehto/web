# NAP-CVM (ContextVM Bridge) — kehto shell implementation

Date: 2026-06-14
Status: approved (autonomous goal execution)
Upstream draft: napplet/nubs PR #31 `NAP-CVM` (namespace `window.napplet.cvm`, discovery `shell.supports("cvm")`)
Protocol: ContextVM — MCP JSON-RPC transported over Nostr (kind 25910), optional CEP-4 gift-wrap encryption.

## Goal

Implement the **shell side** of NAP-CVM in kehto so napplets can call ContextVM
(MCP-over-Nostr) servers through the shell, and add a working **Relatr** CVM
napplet to the playground. The shell owns ContextVM transport, signing,
encryption, relay routing, and policy; the napplet only supplies a server
identity and the MCP operation.

## Validated protocol facts (live-probed against Relatr)

- Server identity: pubkey `750682303c9f...e404c5fa3`, name "Relatr", relays from
  its kind-10002 list: `relay.contextvm.org`, `relay2.contextvm.org`,
  `relay.primal.net`. Tools: `calculate_trust_score`, `calculate_trust_scores`,
  `search_profiles`.
- All MCP traffic = kind **25910** events, `content` = stringified JSON-RPC.
- Request addressing: inner event `p`-tags the server pubkey.
- Relatr requires **CEP-4 encryption** (advertises `support_encryption` +
  `support_encryption_ephemeral`). Plaintext requests are ignored.
- CEP-4 gift wrap (two-layer): inner signed kind-25910 (client key) → JSON →
  NIP-44 encrypt to recipient → wrap event kind **21059** (ephemeral) /
  **1059** (regular), signed by a fresh random ephemeral key, `p`-tagged to
  recipient. Responses come back the same way, `p`-tagged to the client.
- Correlation in encrypted mode is by inner **JSON-RPC `id`** (the gift-wrap
  event id is opaque). Client subscribes `{kinds:[1059,21059], '#p':[clientPub]}`.
- Discovery announcements: kind **11316** (server: name/about/website/picture/
  support_encryption tags), **11317** (tools/list), 11318/11319/11320.

## Architecture

### Wire contract (mirrors upstream NAP-CVM byte-for-byte)

NIP-5D envelopes (`{ type: "cvm.<action>", ... }`):

| Type | Direction | Fields |
|------|-----------|--------|
| `cvm.discover` | napplet→shell | `id`, `query?` |
| `cvm.discover.result` | shell→napplet | `id`, `servers`, `error?` |
| `cvm.request` | napplet→shell | `id`, `server`, `message`, `options?` |
| `cvm.request.result` | shell→napplet | `id`, `message?`, `error?` |
| `cvm.close` | napplet→shell | `id`, `server` |
| `cvm.close.result` | shell→napplet | `id`, `error?` |
| `cvm.event` | shell→napplet | `server`, `message` (no `id`) |

`message` is an MCP `McpMessage`. MCP-level errors ride in `message.error`;
transport/policy errors ride in the envelope `error`. These wire types are
mirrored as a kehto-internal model in `@kehto/services/cvm-types.ts` (same
convention as NUB-RESOURCE / Decision #31) — no new `@napplet/core` version bump.

### Packages

1. **`@kehto/acl`** — new capability `cvm:call`.
   - `ALL_CAPABILITIES` += `'cvm:call'`; `CAP_CVM_CALL` const + export.
   - `resolve.ts`: `case 'cvm'` → `cvmMap`. Napplet-originated
     (`discover`/`request`/`close`) gate sender `cvm:call`; shell→napplet
     pushes (`*.result`, `event`) gate recipient `cvm:call`.

2. **`@kehto/services`** — protocol + transport.
   - `cvm-types.ts` — MCP types + 7 wire envelopes (internal model).
   - `cvm-service.ts` — `createCvmService({ transport })` → `ServiceHandler`.
     Pure envelope router: validates `cvm.*`, calls the injected `CvmTransport`,
     echoes `id` in `*.result`, captures per-window `send` for `cvm.event`
     fan-out to windows with an active session for that server. No nostr deps.
     Exports the `CvmTransport` interface.
   - `cvm-nostr-transport.ts` — `createNostrCvmTransport(options)` concrete
     ContextVM transport (CEP-4 gift wrap kind 21059, discovery 11316/11317/
     10002 relay resolution, JSON-RPC `id` correlation, initialize handshake).
     Depends on `nostr-tools`. Shipped on a **separate entry** so the core
     bundle stays nostr-free: export `@kehto/services/cvm-nostr-transport`.
   - Tests: `cvm-service.test.ts` (mock transport), `cvm-nostr-transport.test.ts`
     (mock relay pool + real nip44 round-trip simulating the server).

3. **`@kehto/runtime`** — route the `cvm` domain.
   - `domain-handlers.ts`: add `cvm` to `RuntimeDomainHandlers`, wire
     `handleServiceOnlyMessage(context,'cvm',…)`.
   - `runtime.ts`: `nubDispatch.registerNub('cvm', adapt(handlers.cvm))`.
   - Test: `cvm-dispatch.test.ts` (routes when registered + ACL allow/deny).

4. **`@kehto/shell`** — advertise capability.
   - `shell-init.ts`: add `'cvm'` to `CANONICAL_NUB_DOMAINS` so
     `shell.supports('cvm')` is true.

5. **`apps/playground`** — the Relatr napplet.
   - `playground-cvm-transport.ts` — builds `createNostrCvmTransport` with a
     real `SimplePool`, an ephemeral per-session client key (privacy: never the
     user's identity), default relays = Relatr's relay set. Test seam: honors a
     `window.__cvmTransportFixture__` override for deterministic e2e.
   - `demo-hooks.ts`: instantiate `createCvmService({ transport })`, add
     `cvm` to `services`.
   - `demo-definitions.ts`: `DEMO_NAPPLETS` + `CLASS_BY_DTAG` entry `cvm-relatr`.
   - `shell-host.ts`: add `'cvm:call'` to the ACL snapshot `Record`.
   - `index.html`: status + frame container for `cvm-relatr`.
   - `napplets/cvm-relatr/` — new single-file napplet: `import '@napplet/shim'`,
     await `shell.supports('cvm')`, raw-postMessage `cvm.discover` then
     `cvm.request` (`tools/call calculate_trust_score`), render the trust score.
     (Raw postMessage like resource-demo — avoids @napplet version coupling.)

## Security / policy

- Client key is shell-managed & ephemeral; napplets never see keys, relay
  sockets, or NIP-44 material (NAP-CVM §Security).
- `cvm:call` gates the whole domain; default playground ACL policy is permissive
  so the demo works out-of-the-box, toggleable in the ACL panel.
- Transport verifies responses are NIP-44-decryptable from the wrap author and
  carry the server's signed inner event; only the requested server's relays are
  used.

## Testing

- Unit: ACL resolve (cvm cases), cvm-service (mock transport: discover/request/
  close/event/onWindowDestroyed/id echo/error paths), nostr-transport (encrypt
  round-trip, id correlation, timeout, discovery parse).
- Runtime: cvm-dispatch (routing + ACL allow/deny).
- E2E: load `cvm-relatr`, install a fixture transport, assert it dispatches
  `cvm.request` and renders the returned trust score.
- Live: a manual node probe confirmed real Relatr round-trips (kept out of CI).

## Out of scope

- NAP-VALUE payment prompts (referenced by NAP-CVM but a separate draft).
- Server-side ContextVM (kehto is the client/shell).
- Bumping `@napplet/core` to 0.7.0 (wire types mirrored locally instead).
