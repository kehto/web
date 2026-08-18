# Phase 83: NAP Ontology Alignment - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning
**Source:** Verified investigation against packed `@napplet 0.9.0` dist + issue kehto/web#24

<domain>
## Phase Boundary

Align the `@kehto/*` `shell.init` capability handshake **and** the INC dispatch rail with the NAP renames `@napplet/*` adopted at `0.9.0`, so a napplet built against `@napplet/* >=0.9.0` negotiates capabilities and uses the inter-napplet-communication rail correctly inside a kehto shell. Resolves kehto/web#24.

**In scope:** the emitted `shell.init` capabilities payload; the runtime dispatch key + ACL resolver for the IFC/INC domain; the IFC handler's response/event message-type prefixes; one authoritative conformance test; one changeset.

**Explicitly OUT of scope (deferred to a future cleanup milestone):**
- Upgrading `@napplet/core` / `@napplet/nub` from `0.5.0` (NOT needed — see decisions).
- Mass-renaming internal `ifc` symbols, `nub-*` E2E test fixtures, or docs.
- Removing the legacy `nubs` dual-emit and `ifc`/`NUB-0N` aliases (intentional back-compat window).
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Source of truth (verified against packed 0.9.0 dist — do NOT re-derive)
- `@napplet/shim@0.9.0` `createShellSupports(capabilities)` reads **only** `capabilities.naps` (an array of strings). It ignores `capabilities.nubs`. `perm:*` entries are checked against `capabilities.sandbox`.
- Protocol match regex: `/^([^:]+):(NAP-\d+)$/i`. For each `domain:NAP-NN` entry it ALSO adds the bare `domain`, so `supports('inc')` returns true whenever any `inc:NAP-NN` entry is present.
- `normalizeCapabilityDomain` strips a leading `nap:` prefix (so `nap:inc` ≡ `inc`).
- `@napplet/core@0.9.0` `NapDomain` includes `inc` and does NOT include `ifc`. `NapProtocolId = \`NAP-${number}\``.
- A `>=0.9.0` napplet emits wire messages `inc.emit` / `inc.subscribe` / `inc.unsubscribe` (from `@napplet/nap@0.9.0` `/inc/shim`) and its shim delivers inbound events only on the type `inc.event`.

### D1 — No `@napplet/core` upgrade
Keep `@napplet/core@^0.5.0` and `@napplet/nub@^0.5.0` as runtime deps. Verified: core `0.5.0` `createDispatch().registerNub(domain, handler)` routes `${domain}.*` by raw string prefix and accepts ANY domain key with no validation. All required changes are string-level.

### D2 — Handshake field: emit `naps`, dual-emit `nubs` (back-compat window)
In `packages/shell/src/shell-init.ts` `buildShellCapabilities` and `packages/shell/src/types.ts` `ShellCapabilities`: emit BOTH `naps` (new, primary — consumed by the 0.9.0 shim) and `nubs` (legacy, identical-or-legacy contents — consumed by `<=0.8.x`/`@napplet/nub` shims) for ONE release. `sandbox` is unchanged. `postShellInit` in `shell-ready.ts` posts the object verbatim, so it needs no change beyond the type.

### D3 — Domain rename `ifc` → `inc` in the ADVERTISED set
The `naps` array advertises domain `inc` (not `ifc`) and protocol IDs `inc:NAP-01 .. inc:NAP-06` (the legacy `ifc:NUB-01..06` aliased to `inc:NAP-01..06`; also replace `ifc:NAP-01` with `inc:NAP-01`). After this change the emitted `naps` set contains NO unaliased `ifc` or `NUB-NN` identifiers. Decision on `nubs` (legacy) contents: keep the legacy `ifc`/`ifc:NUB-0N` vocabulary in the `nubs` array (that is what legacy shims expect) — the dual-emit's whole point is that each shim reads its own field. `CANONICAL_NUB_DOMAINS` and `SUPPORTED_IFC_PROTOCOLS` should be refactored so the two field vocabularies are produced cleanly (e.g. a NAP-vocabulary list for `naps` and the existing legacy list for `nubs`).

### D4 — Runtime dispatch accepts `inc.*`
In `packages/runtime/src/runtime.ts`, in addition to `nubDispatch.registerNub('ifc', adapt(handlers.ifc))`, register the SAME handler under `'inc'`: `nubDispatch.registerNub('inc', adapt(handlers.ifc))`. Legacy `ifc.*` continues to route unchanged.

### D5 — ACL resolver treats `inc` identically to `ifc`
In `packages/acl/src/resolve.ts` `resolveCapabilitiesNub`, the domain switch must map `inc` to the SAME `ifcMap(action)` resolution as `ifc` (e.g. `case 'ifc': case 'inc': return ifcMap(action);`). Without this, `inc.emit` falls through to the `unknown → null/null` branch and bypasses the `relay:write` gate that `ifc.emit` enforces — a security/correctness regression. Update the JSDoc mapping table to list `inc` alongside `ifc`.

### D6 — IFC handler is domain-aware (the key correctness change)
`packages/runtime/src/ifc-handler.ts` currently hardcodes `ifc.*` in every outgoing message (`ifc.event`, `ifc.subscribe.result`, `ifc.channel.open.result`, `ifc.channel.event`, `ifc.channel.list.result`, `ifc.channel.closed`). A 0.9.0 napplet only listens for `inc.*`, so the handler MUST stop hardcoding the prefix:
- **Direct responses to the requester** (subscribe.result, channel.open.result, channel.list.result, channel.closed-to-self): use the prefix derived from the INCOMING request's `msg.type` domain (the slice before the first `.`). A napplet that sent `inc.subscribe` gets `inc.subscribe.result`.
- **Events/pushes delivered to OTHER napplets** (emit → subscribers; channel.emit/broadcast → peer; channel.closed → peer; destroyWindow channel.closed): use the RECIPIENT napplet's own domain prefix, because the recipient's shim only listens on its own vocabulary. Track each napplet's domain prefix per `windowId` (record the first `ifc.*`/`inc.*` message it sends; one napplet speaks exactly one vocabulary, set by its SDK version). When a recipient's domain is unknown, fall back to the emitter/sender's domain.
- Net effect: an all-`inc` shell works end-to-end (inc.subscribe → inc.subscribe.result; inc.emit → inc.event to inc subscribers); an all-`ifc` shell is byte-for-byte unchanged; a MIXED shell delivers each recipient its own vocabulary.

### D7 — Authoritative conformance test (ALIGN-07)
Add `@napplet/shim@0.9.0` as a **devDependency** (test-only — do NOT change runtime deps). Add a unit test (vitest, in `packages/shell`) that:
- Builds capabilities via the real `buildShellCapabilities` (with and without `hooks.relayPool` / `hooks.upload`).
- Imports the real `createShellSupports` from `@napplet/shim` (0.9.0) and feeds it the kehto-emitted `naps`/`sandbox` (mirroring what the shim reads from `shell.init.capabilities`).
- Asserts `supports('inc') === true`, `supports('inc','NAP-01') === true` (and the other `inc:NAP-0N`), bare-domain queries for other advertised domains, and that a removed/unknown query is false.
- This is behavior verification against the real shim, NOT string matching. Note: the shim is browser-oriented; import only `createShellSupports` (a pure function) — if a bare import pulls in `window`, isolate the import or use the dist's exported function directly. Confirm the import path during planning/execution.

### D8 — Changeset (ALIGN-08)
Add a changeset (minor for `@kehto/shell`; include `@kehto/acl` + `@kehto/runtime` since the dispatch/ACL strings changed). Document the public `ShellCapabilities` change (`naps` added, `nubs` retained for one release), the `inc` domain/`inc:NAP-0N` advertisement, the `inc.*` dispatch acceptance, and downstream-consumer impact (hyprgate must consume `naps`).

### Claude's Discretion (planner/executor decides)
- Exact data structure for D6 per-window domain tracking (e.g. a `Map<windowId, 'ifc'|'inc'>` on `IfcState`, or threading domain through the subscription/channel records). Keep it minimal and zero-dep.
- Whether to extract a small `domainOf(type)` / `prefix(type)` helper.
- Exact `naps` vocabulary construction/refactor in `shell-init.ts`.
- Test file name/location and how to safely import `createShellSupports` from the 0.9.0 shim in a vitest (node) environment.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files to modify
- `packages/shell/src/shell-init.ts` — `CANONICAL_NUB_DOMAINS`, `SUPPORTED_IFC_PROTOCOLS`, `buildShellCapabilities` (D2, D3).
- `packages/shell/src/types.ts` — `ShellCapabilities` interface (`naps` field; keep `nubs`) (D2).
- `packages/shell/src/shell-ready.ts` — `postShellInit` posts the capabilities object; type-only impact (D2).
- `packages/runtime/src/runtime.ts` — `registerNub('ifc', …)` block (~L144) (D4).
- `packages/runtime/src/ifc-handler.ts` — all `sendToNapplet({ type: 'ifc.*' })` sites (D6).
- `packages/acl/src/resolve.ts` — `resolveCapabilitiesNub` domain switch + `ifcMap` + JSDoc table (D5).

### Authoritative external evidence (already verified; in /tmp/napplet-verify if re-inspection needed)
- `@napplet/shim@0.9.0` dist `createShellSupports` — reads `capabilities.naps`; regex `^([^:]+):(NAP-\d+)$`.
- `@napplet/core@0.9.0` dist — `NapDomain` includes `inc`, not `ifc`.
- `@napplet/nap@0.9.0` `/inc/shim` — wire types `inc.emit`/`inc.subscribe`/`inc.unsubscribe`; inbound `inc.event`.

### Existing tests to keep green / extend
- `packages/shell/src/shell-init.test.ts` — handshake shape assertions (update for `naps`).
- `packages/runtime/src/dispatch.test.ts` — `ifc.*` routing (must stay green; add `inc.*` parallels).
- `packages/acl/src/resolve.test.ts` — `ifc` resolution (add `inc` parallels).
- `tests/unit/nip5d-conformance-guard.test.ts` — NIP-5D conformance guard.
- Full suite: 840 unit + 86 E2E must stay green.
</canonical_refs>

<specifics>
## Specific Ideas

- The emitted `naps` array (relayPool present) should look like:
  `['relay','outbox','identity','storage','inc','theme','keys','media','notify','config','resource','connect','class','cvm', 'inc:NAP-01','inc:NAP-02','inc:NAP-03','inc:NAP-04','inc:NAP-05','inc:NAP-06']`
  plus `'upload'` when `hooks.upload`. (Bare domains + the `inc:NAP-0N` protocol entries. Confirm the legacy `ifc:NAP-01` maps to `inc:NAP-01`, not a duplicate.)
- The legacy `nubs` array keeps the current vocabulary (`'ifc'`, `'ifc:NUB-01'..06`, `'ifc:NAP-01'`) so legacy shims are unaffected.
- D6 acceptance proof: a test where window A sends `inc.subscribe`, window B sends `inc.emit`, and A receives a message of type `inc.event`; plus the existing `ifc.*` roundtrip test still passes unchanged.
</specifics>

<deferred>
## Deferred Ideas

- CLEANUP-01: drop `nubs` dual-emit + `ifc`/`NUB-0N` aliases once downstreams are on `>=0.9.0`.
- CLEANUP-02: retire the internal `ifc` dispatch key and rename internal `ifc` handlers / `nub-*` fixtures to NAP vocabulary.
</deferred>

---

*Phase: 83-nap-ontology-alignment*
*Context gathered: 2026-06-15 via verified investigation (issue kehto/web#24 + packed @napplet 0.9.0 dist)*
