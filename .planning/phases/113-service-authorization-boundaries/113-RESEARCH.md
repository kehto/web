# Phase 113: Service Authorization Boundaries - Research

**Researched:** 2026-10-17
**Domain:** NAP-domain service authorization, network/resource mediation, and lifecycle revocation
**Confidence:** HIGH for the checked sources and current code; MEDIUM where protocol documents have not yet been supplied for a domain

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decisions inherited from the user goal and phase 111/112 artifacts; autonomous
planning/execution is authorized. Firewall is the policy authority, runtime owns
async coordination, hosts supply UI and actions, rate budgets stay independent.

Required scope: every implemented service and fallback path. Resource permissions
compose interface + exact original URI + actual network destinations. Bulk items
retain independent success/failure. Cache hits cannot bypass resource permission.
Relays, device/FS handles, upload, account operations and inherited calls need
operation-specific checks and revocation. Do not invent wire errors.

Use current exact upstream spec refs from research. RESOURCE draft PR80 uses urls
and canonical base64; local requests/server-hint/Blob wire shapes are older and
must migrate through shell, services, host adapters, tests and docs. Draft status
is not a blocker. Resource isolation prerequisite remains a phase114 host gate.

Phase112 is still open for integration closure: migrate old temporal gates and
validate general ingress as service boundaries become available. The completion
of this phase does not imply apps are migrated or the overall goal is achieved.

Security: validation precedes prompts; identity comes only from registered trusted
endpoints; requests are captured before await; cancellation/revocation invalidate
pending grants and backend results. Service runtime now supports a request-owned
signal as fifth authorizeOperation argument. Use it for cancel-capable domains.

Browser DNS/SSRF enforcement cannot be claimed from hostname string filtering.
Choose enforceable host behavior and explicitly report support boundaries. Do not
ship resource exposure on frames whose direct networking bypasses that policy.

## the agent's Discretion

No additional discretion section was supplied in CONTEXT.md.

## Deferred Ideas (OUT OF SCOPE)

No deferred ideas section was supplied in CONTEXT.md.
</user_constraints>

## Summary

Phase 112 supplies the correct shared enforcement seam: a registered handler receives a source-bound `ServiceRuntimeContext.authorizeOperation(windowId, operation, requirements, execute, signal)` that runs composed Firewall requirements, independent temporal budgets, cancellation, and lifecycle revalidation. It is currently consumed by LINK only; most handlers still call their host bridge directly after the older ingress gate. [VERIFIED: `packages/runtime/src/service-types.ts`, `packages/runtime/src/runtime.ts`, `packages/services/src/link-service.ts`]

Phase 113 must move each *sensitive side effect* behind that seam. An interface requirement remains necessary but does not imply access to a particular URL, relay, storage server, virtual path, browser-selected device, or long-lived handle. Resolve targets without contacting them, snapshot validated input, authorize every actual destination that will be contacted, pass the operation signal down to the transport, and suppress/close work on revocation. [VERIFIED: `packages/firewall/src/permission-types.ts`, `packages/runtime/src/permission-runtime.ts`, `packages/runtime/src/service-types.ts`]

**Primary recommendation:** Add a small authorization wrapper to each service family, using the existing runtime context and protocol-owned result/error shapes; complete host resolver enforcement in phase 113 and CSP enforcement in phase 114 rather than treating the browser’s hostname checks or discovery hints as network authorization.

## Project Constraints (from AGENTS.md)

- Check the applicable NAP/NIP-5D authority before changing a protocol surface; record exact source refs and compare wire shape, direction, lifecycle, errors, and security requirements. [VERIFIED: `AGENTS.md`]
- Complete the whole consumer chain for changed NAP fields: runtime, reference service, Paja/playground adapters, docs, and regression tests. Relay-subscribe changes specifically require runtime, both reference relay services, playground, and conformance guards. [VERIFIED: `AGENTS.md`]
- Keep strict ESM TypeScript, public JSDoc, 2-space indentation, explicit-path staging, conventional commits, tests, docs, compatibility register/warnings for retained behavior, and appropriate changesets together. [VERIFIED: `AGENTS.md`]
- Run `pnpm build`, `pnpm type-check`, `pnpm test:unit`, relevant `pnpm test:e2e`, `pnpm docs:check`, and the AI-slop gate before shipping. [VERIFIED: `AGENTS.md`]
- Paja/playground loader changes must preserve verified `srcdoc` provenance and treat gateway output only as an untrusted accelerator. [VERIFIED: `AGENTS.md`]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| SVC-01 | LINK approval holds/settles current request and preserves opener isolation. | LINK is the reference integration; retain its exact URL snapshot, ID replay bound, protocol/scheme validation, and cancellation-aware opener. |
| SVC-02 | Resource authorization covers every URL, cache hit, redirect destination, and resolver. | NAP-RESOURCE draft requires independent per-URL processing, byte-equal cache keys, cancellation, verified identity cache partitioning, and destination checks. |
| SVC-03 | Network authorization covers actual selected relay/service destinations and inherited calls. | Relay/outbox/count/CVM/upload selection must resolve first, then compose exact network-origin requirements before connection/signing. |
| SVC-04 | FS/device/upload and other implemented paths use the shared mechanism with operation-specific constraints. | Map FS paths, picker grants, device sessions/GATT/serial, uploads, WebRTC/CVM, and account-facing services to host-side operation wrappers. |
| SVC-05 | Long-lived subscriptions/handles recheck and revoke authority without leaking data. | Existing per-window subscription/session maps become revocation owners; add `onPermissionRevoked` rather than relying on teardown-only cleanup. |
</phase_requirements>

## Protocol Authority and Current Drift

| Surface | Authority checked | Binding finding |
|---|---|---|
| Resource | NAP-RESOURCE PR #80, `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` (rechecked unchanged) | `resource.bytes`/`bytesMany` use `url`/`urls`, canonical padded-base64 `blob`, per-item outcomes, `resource.cancel`, and verified manifest+artifact cache isolation. The current service still has legacy request/server/`Blob` assumptions; migration must not silently retain that wire shape. [CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`; VERIFIED: `packages/services/src/resource-service.ts`] |
| Relay | NAP-RELAY PR #2, `9f30b3505335a52c574ff570576687d6467021ff` | `relay.subscribe` may name one exact relay; the service must preserve subscribe/close/event/eose/closed contracts while enforcing the selected destination. [CITED: `/tmp/kehto-firewall-specs/NAP-RELAY.md`] |
| Outbox | NAP-OUTBOX PR #32, `8865f73d52a4864afee145f28d26520476273927` | Explicit and discovered relay plans must be policy-allowed before fanout; streams run until close or `outbox.closed`; publish must create at most one signed event per request. [CITED: `/tmp/kehto-firewall-specs/NAP-OUTBOX.md`] |
| Filesystem | NAP-FS PR #88, `bd1b9e912f05203bf38f7a1b04f920744fe6d625` | Pickers are user-mediated authority requests, `info` is advisory, post-pick operations remain permission-checked, paths are privacy-sensitive, and watches must stop/stop leaking on revocation. [CITED: `/tmp/kehto-firewall-specs/NAP-FS.md`] |
| Upload | NAP-UPLOAD PR #33, `f5cc981e527e2cc1572793a7a6e5082e5271ac49` | Every upload is untrusted network egress and an identity-linking action; prompt shows target/type/size/identity, shell owns signing, and status is a push lifetime. [CITED: `/tmp/kehto-firewall-specs/NAP-UPLOAD.md`] |
| Direct network | NAP-CONNECT PR #19, `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f` | A direct-origin grant changes CSP before iframe execution; parent cannot see, rate-limit, or revoke individual direct requests, and revocation takes effect on next load. This is phase 114 host work, not a service-handler substitute. [CITED: `/tmp/kehto-firewall-specs/NAP-CONNECT.md`] |
| BLE, serial, WebRTC, CVM, DM/social/common/lists/count | No corresponding NAP document was present in the captured exact-ref set; the upstream master listing returned only NAP-INTENT among these names. | Treat existing `@napplet/nap/*/types` and handlers as implementation evidence only. Before changing their wire contracts, obtain and record their owning NAP or write a bounded host-policy/spec-gap note. [VERIFIED: `/tmp/kehto-firewall-specs`; VERIFIED: `gh api repos/napplet/naps/contents/naps?ref=master`] |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Requirement evaluation, prompt coordination, budgets, cancellation | Runtime / Firewall | Service | The runtime holds trusted session identity, store, lifecycle, and rate state; the handler supplies operation-specific scopes. [VERIFIED: `packages/runtime/src/permission-runtime.ts`, `packages/runtime/src/service-types.ts`] |
| Protocol validation and canonical result/error envelopes | Service | Runtime | Handlers own NAP request parsing, correlation, and terminal/error semantics. [VERIFIED: `packages/services/src/{link-service,resource-service,relay-pool-service,outbox-service,fs-service,upload-service}.ts`] |
| Resolver destination validation and SSRF-safe connection | Host transport / resolver | Service | A browser page cannot enforce DNS-time private-IP checks; the actual resolver/transport must make the connection decision. [CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`; VERIFIED: `packages/paja/src/browser-resource.ts`] |
| Direct-network CSP and launch-time consent/reload revocation | Paja/playground host | Shell | CSP is emitted before iframe code and cannot be inspected per request by the parent. [CITED: `/tmp/kehto-firewall-specs/NAP-CONNECT.md`; VERIFIED: `packages/paja/src/runtime-resolver.ts`] |
| Subscription/handle revocation | Service | Runtime | Runtime aborts authorization; each handler owns physical unsubscribe/close and late-event suppression. [VERIFIED: `packages/runtime/src/service-dispatch.ts`, `packages/services/src/{outbox-service,relay-pool-service,fs-service,cvm-service,upload-service}.ts`] |

## Required Migration Pattern

1. Validate the incoming envelope and create a detached, bounded snapshot of the payload, ID, target, and any request-owned cancellation signal before awaiting. Use the current handler’s duplicate-ID ownership rules. [VERIFIED: `packages/runtime/src/approval-envelope.ts`, `packages/services/src/link-service.ts`, `packages/services/src/resource-service.ts`]
2. Resolve candidates without I/O when possible. A relay selector, resolver plan, or picker result is not a grant. Build an interface requirement plus one resource/network requirement for each selected sensitive target. [VERIFIED: `packages/firewall/src/permission-types.ts`, `packages/firewall/src/permission-scopes.ts`]
3. Call `runtime.authorizeOperation` around the entire side effect, passing its signal through to fetches, subscriptions, uploads, and host bridges. Require an `executed` result before emitting protocol success; map denied/cancelled/busy/unavailable to that NAP’s existing result/error contract. Do not introduce a generic Firewall envelope. [VERIFIED: `packages/runtime/src/service-types.ts`, `packages/services/src/link-service.ts`]
4. Persist service-local ownership keyed by window plus request/subscription/session ID. `onPermissionRevoked` closes only affected live work, retains correlation history where a canonical terminal response remains required, and blocks late callbacks; `onWindowDestroyed` additionally removes state. [VERIFIED: `packages/runtime/src/service-dispatch.ts`, `packages/services/src/{link-service,outbox-service,fs-service,cvm-service,upload-service}.ts`]
5. Delete the old Firewall gate for a migrated domain only when its service-side requirements are live. Any temporary host-only path needs a bounded warning, compatibility register entry, both-path test, and removal condition. [VERIFIED: `AGENTS.md`, `packages/services/src/link-service.ts`, `docs/compatibility.md`]

### Requirement Construction

Use only existing categories: `interface` for `domain.access`, `resource` for exact opaque resource keys or virtual file paths/directories, and `network` for normalized actual origins. `network` scopes are origins; resource matching preserves the protocol’s original byte-equal URL/cache key and must not rewrite it into the normalized authorization scope. `extension:*` is available only after registration and is not a substitute for inventing a new protocol category. [VERIFIED: `packages/firewall/src/{permission-types,permission-scopes}.ts`]

For a selected relay/server list, the operation receives all chosen network requirements as one composed approval, so the UI can show every destination and a once grant releases exactly one operation. For a redirect, do not let the fetch library auto-follow unreviewed hops: either use an enforceable resolver/proxy that validates and authorizes each hop or disable implicit redirects and approve each visible hop before contacting it. [CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`; ASSUMED: composed requirements are the clearest existing API fit for one prompt]

## Service Migration Matrix

| Family / owning files | Sensitive boundary and required scopes | Revocation / wire preservation | Phase-113 test proof |
|---|---|---|---|
| LINK — `packages/services/src/link-service.ts` | Keep `link.open` exact resource URL plus interface access when the handler is runtime-attached; scheme validation precedes prompting and the opener receives the approval signal. | Keep the request ID reserved and emit its existing `link.open.result`; suppress teardown-late response. | URL protocol denial, granted exact URL, no side effect after deny/revoke/abort, duplicate IDs, host-only compatibility warning. [VERIFIED: `packages/services/src/link-service.ts`] |
| RESOURCE — `packages/services/src/resource-service.ts`, Paja `browser-resource.ts` | Parent owns detailed migration: authorize each captured URL across cache hit, scheme resolution, fetch, and body read; use exact original URI resource scope plus actual network origin/hop requirements. Resolver takes the authorization signal/`authorizeNetwork` callback. | `resource.cancel` bypasses approval/rate and aborts exactly its request; cancelled IDs get no late terminal envelope. Move legacy `requests`/`servers`/Blob wire to draft `urls`/base64 without losing per-item ordering. | Cache hit and miss both prompt/check; bulk one denied sibling; redirect/private-IP/unsupported scheme; resolver cancellation; verified-principal cache isolation; canonical base64/error shapes. [CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`; VERIFIED: `packages/services/src/resource-service.ts`, `packages/paja/src/browser-resource.ts`] |
| RELAY and coordinated relay — `relay-pool-service.ts`, `coordinated-relay.ts`, runtime `relay-handler.ts`, Paja/playground relay runtimes | Resolve `message.relay` or selected tier before connection, then compose interface plus exact `wss` network scopes. Publish/sign must authorize every fanout destination, not merely the selected input. | On revocation unsubscribe and emit `relay.closed` only if that is the NAP’s required terminal path; never deliver later events/EOSE. Preserve explicit relay hint semantics across all four consumers. | Explicit relay vs selector, two target prompt, denied target makes no socket/publish, stream revocation, cache delivery after revocation, close/id replacement, playground/Paja parity. [CITED: `/tmp/kehto-firewall-specs/NAP-RELAY.md`; VERIFIED: `packages/services/src/{relay-pool-service,coordinated-relay}.ts`, `apps/playground/src/playground-relay-service.ts`, `packages/paja/src/browser-relay-runtime.ts`] |
| OUTBOX and router — `outbox-service.ts`, `relay-pool-outbox-router.ts` | Resolve plan first, then authorize the resulting relay origins for query/get/subscribe/publish. Explicit `options.relays`, NIP-65, and fallback relays must take the same path. | Close subscriptions on revocation and prevent late event push; preserve one signed event per publish and canonical `outbox.closed`/result shape. | Discovered/explicit/fallback target denial, fanout approval, no sign/publish before approval, stream revoke, target dedup, status/error correlation. [CITED: `/tmp/kehto-firewall-specs/NAP-OUTBOX.md`; VERIFIED: `packages/services/src/{outbox-service,relay-pool-outbox-router}.ts`] |
| COUNT — `count-service.ts`, relay backends | Count has no dedicated captured NAP authority; when its backend selects relays, authorize the exact relay origins before remote count. Keep local/cache-only count from requesting a network grant. | Abort query on revocation and suppress late count result. | Local count no prompt; remote selected relay requires grant; deny/no transport; abort/revoke no late result. [VERIFIED: `packages/services/src/count-service.ts`, `packages/paja/src/browser-relay-runtime.ts`] |
| FS — `fs-service.ts`, Paja `browser-fs.ts` | Map picker operation separately from post-pick path access. After a pick, authorize exact file or directory scope plus operation (`read`, `write`, `list`, `watch`, `remove`, `move` needs both source and destination); do not infer broad root access from interface approval. | `onPermissionRevoked` closes matching watches and backend handles, suppresses `fs.changed`, and keeps wire `cancelled`/error semantics. | Picker cancellation, narrow file/directory boundary, move two-scope check, path traversal, watch revoke, window isolation, user-gesture bridge not called on denial. [CITED: `/tmp/kehto-firewall-specs/NAP-FS.md`; VERIFIED: `packages/services/src/fs-service.ts`, `packages/paja/src/browser-fs.ts`] |
| SERIAL / BLE — `serial-service.ts`, `ble-service.ts`, Paja `browser-device-services.ts` | Gate chooser/open before host bridge; bind resulting session to window and a host-private device scope. Reads/writes/subscriptions require owned live session plus operation-specific device/attribute scope; do not derive approval from supplied session ID alone. | Revocation closes serial/BLE connections, stops notifications, invalidates pending opens, and prevents buffered/late event delivery. | Deny avoids chooser; session spoof across windows; GATT attribute boundary; write/read distinction; revoke during pending open/subscription; teardown cleanup. [VERIFIED: `packages/services/src/{serial-service,ble-service}.ts`, `packages/paja/src/browser-device-services.ts`] |
| UPLOAD — `upload-service.ts`, `http-uploader.ts`, Paja `browser-upload.ts` | Validate cloned payload metadata, choose a server, then authorize interface plus upload resource/egress operation and exact selected network origin before NIP-98/Blossom signing or byte upload. `upload.info` stays advisory and must not grant/avoid approval. | Cancel request and uploader on revocation; stop `upload.status.changed` after ownership ends; status lookup never crosses window ownership. | Target/type/size snapshot, no sign/network on deny, discovered server is not grant, progress revoke, missing/changed signer, public URL validation, failure/cancelled result shape. [CITED: `/tmp/kehto-firewall-specs/NAP-UPLOAD.md`; VERIFIED: `packages/services/src/upload-service.ts`, `packages/paja/src/browser-upload.ts`] |
| CVM / WebRTC / DM — `cvm-service.ts`, `webrtc-service.ts`, `dm-service.ts`, Paja transport/controllers | Keep current wire contract pending authority check. Authorize mediated selected relay/server origins before transport or signing; WebRTC direct peer traffic requires a separately documented host/CSP policy, not a fictitious per-message proxy. | Close CVM/DM/WebRTC sessions and unsubscribe events on revocation; source replacement cannot receive events. | No remote transport on denial; relay/server selection scope; revoke closes active session; no late fanout; exact legacy errors remain. [VERIFIED: `packages/services/src/{cvm-service,webrtc-service,dm-service}.ts`, `packages/paja/src/{browser-webrtc,browser-cvm}.ts`] |
| COMMON / LISTS / IDENTITY / KEYS / INTENT and other account-facing services | Preserve existing interface/ACL ceilings. Only add a resource/network requirement where a handler actually uses an external destination or exposes a selected account/device/path; do not fake a network scope for pure local actions. Map signing/account consent through the shared host decision in phase 114. | Handlers with async sends/subscriptions implement revocation cleanup; intent push already uses `sendToEligibleNapplet` but still needs an authorization boundary for launching an external target. | Per-operation ACL + interface negative cases, account/service prompt no double-prompt, target identity is runtime-attested, revoke blocks late sends. [VERIFIED: `packages/services/src/{common-service,lists-service,intent-service,keys-service,identity-service}.ts`, `packages/runtime/src/service-types.ts`] |

## Resolver and Host Boundary Required Now

Phase 113 must define an enforceable resolver interface, even though phase 114 supplies UI/CSP plumbing. Resource and host-mediated service resolvers should accept the operation cancellation signal and a callback of the form `authorizeNetwork(destination, execute)`. The callback normalizes an origin only for Firewall scope matching; cache keys and NAP payload URLs remain unmodified. A resolver may not contact a resolved address, follow a redirect, query a relay, sign an upload, or open a socket before the relevant callback succeeds. [VERIFIED: `packages/runtime/src/service-types.ts`, `packages/firewall/src/permission-scopes.ts`; CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`]

Browser-only Paja fetch code cannot prove NAP-RESOURCE’s DNS-time private-IP rule. The plan must choose and test one explicit enforcement policy: (1) a trusted server/proxy/transport that resolves DNS, blocks private ranges, and checks every redirect; or (2) do not advertise/use the host-mediated network/resource operation on a browser-only path. URL hostname filtering alone is insufficient evidence of conformance. [CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`; VERIFIED: `packages/paja/src/browser-resource.ts`]

Relay and Blossom discovery are candidates only. Existing Paja pointer/upload resolution merges embedded hints, configured relays, and discovered servers; those values must remain untrusted until operation authorization selects the actual contacted target. Phase 114 must additionally stop injecting discovery values into iframe `connect-src` automatically. [VERIFIED: `packages/paja/src/{runtime-resolver,browser-upload,browser-adapter}.ts`; CITED: `/tmp/kehto-firewall-specs/NAP-CONNECT.md`]

## Common Pitfalls

- **Approving a relay hint rather than the contacted relays:** outbox and coordinated relay expand plans after parsing. Authorize the post-resolution list and all publish fanout targets. [CITED: `/tmp/kehto-firewall-specs/NAP-OUTBOX.md`; VERIFIED: `packages/services/src/relay-pool-outbox-router.ts`]
- **Authorizing only a resource cache miss:** NAP-RESOURCE requires each URL to follow policy, and cache state is identity-scoped. Check before cache delivery as well as every network hop. [CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`]
- **Treating browser `fetch` as SSRF control:** the NAP requires DNS-time checks and redirect rechecks, which a parent browser host cannot establish by URL parsing. [CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`]
- **Sending a generic denial:** domain handlers must keep their canonical result/error/correlation semantics. The runtime coordinator does not own wire errors. [VERIFIED: `packages/runtime/src/service-types.ts`, `packages/services/src/link-service.ts`]
- **Using teardown cleanup as revocation:** `onWindowDestroyed` is broader and can erase correlation state. Add `onPermissionRevoked` for live sources that own streams/handles. [VERIFIED: `packages/runtime/src/service-dispatch.ts`]
- **Granting a direct browser origin in a service handler:** only frame CSP is the enforcement point; it is launch-time policy with reload-based revocation. [CITED: `/tmp/kehto-firewall-specs/NAP-CONNECT.md`]

## Validation Architecture

| Property | Value |
|---|---|
| Framework | Vitest unit suites plus Playwright browser coverage. [VERIFIED: `package.json`, `vitest.config.ts`, `playwright.config.ts`] |
| Quick focused command | `pnpm exec vitest run packages/services/src/<changed>.test.ts packages/runtime/src/<changed>.test.ts` |
| Full unit command | `pnpm test:unit` |
| Browser command after Paja/playground adapter changes | `pnpm test:e2e` |
| Release gates | `pnpm build && pnpm type-check && pnpm docs:check` plus AI-slop scan. [VERIFIED: `AGENTS.md`, `package.json`] |

### Required Regression Matrix

| Requirement | Tests that must be added or extended |
|---|---|
| SVC-01 | LINK current request, exact URL, opener signal, revoked/aborted/late response, legacy warning. |
| SVC-02 | Per URL/cache/redirect/resolver, bulk partial outcomes, cancel, canonical wire/base64, principal cache partition, no private-destination transport. |
| SVC-03 | Relay explicit/selected/fanout origins, outbox discovery/fallback, count remote/local, CVM/upload target selection, no transport/sign before grant. |
| SVC-04 | FS picker/path/move/watch, serial/BLE session and attribute scope, upload public egress/signer, account service boundaries. |
| SVC-05 | Subscription/handle revoke, replacement/teardown, late callback/event/result suppression, sibling request isolation, no resource leak. |

## Security Domain

| ASVS category | Applies | Phase control |
|---|---|---|
| V3 Session Management | Yes | Runtime-bound principal/session generation; service maps keyed by window and owned IDs. [VERIFIED: `packages/runtime/src/permission-runtime.ts`] |
| V4 Access Control | Yes | Compose interface with exact resource/network/device/file scope; revalidate before side effect. [VERIFIED: `packages/firewall/src/permission-types.ts`] |
| V5 Input Validation | Yes | Validate and snapshot envelopes before await; canonical URL/path/base64 rules remain domain-owned. [VERIFIED: `packages/runtime/src/approval-envelope.ts`; CITED: `/tmp/kehto-firewall-specs/NAP-{RESOURCE,FS}.md`] |
| V6 Cryptography | Yes | Upload and relay signing remains host-owned; service code must not expose signing material. [CITED: `/tmp/kehto-firewall-specs/NAP-UPLOAD.md`] |

| Threat | Mitigation |
|---|---|
| SSRF through resource/relay/upload discovery or redirects | Enforce post-resolution target authorization and DNS/private-address checks in the actual resolver; recheck every redirect. [CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`] |
| Confused-deputy device/file/session access | Bind handles to window, authorize operation-specific scope, close on revoke/replacement. [CITED: `/tmp/kehto-firewall-specs/NAP-FS.md`; VERIFIED: `packages/services/src/{fs-service,serial-service,ble-service}.ts`] |
| Data exfiltration through storage upload | Prompt target/type/size/identity before signing or egress; terminate status stream on revoke. [CITED: `/tmp/kehto-firewall-specs/NAP-UPLOAD.md`] |
| Late or cross-window stream delivery | Per-window ownership, abort signal, `onPermissionRevoked`, and send-current guards. [VERIFIED: `packages/runtime/src/service-dispatch.ts`] |

## Planning Decisions and Assigned Authority Checks

The planning questions above now have executable owners. A retrieved draft is evidence
that an authority exists; it is not evidence that its wire, directionality, error, or
lifecycle semantics have already been reviewed. Each owning plan must read the exact
document before its first implementation edit, record the checked head, and revise the
local contract toward that authority when the current code differs.

1. **Protected resource transport is chosen for Phase 113.** Plans 01 and 02 own a
   trusted Paja development-server resolver/proxy and the equivalent supported
   playground host transport. The endpoint uses a random server-instance request
   capability retained by main-frame host code, exact Origin and Host validation,
   POST plus a non-simple content type, no permissive CORS, and rejection of null,
   foreign, simple, or uncredentialed requests before DNS lookup or connection. The
   capability cannot enter app init/config, iframe messages, or napplet-visible state.
   DNS answers and IP literals must satisfy an explicit global-reachability policy;
   the connection pins one approved address while preserving the original hostname for
   Host and TLS identity. Redirects are not implicit: each hop is reauthorized,
   re-resolved, and rechecked. Abort, byte, and time bounds cover the response body.
   A standalone browser environment that cannot provide this trusted transport must
   state that support boundary, while supported hosts preserve actual network resource
   resolution rather than deleting or narrowing the requested feature.
2. **Exact draft authorities are retrieved and mapped below.** Each row remains an
   implementation-time semantic recheck until its owning plan records the comparison.

| Surface | Exact authority | Owning plan | Planning status |
|---|---|---|---|
| NIP-5D loader/provenance | `5560820fa4f37f45b8ab742a11aeb3001b17dc67` | 01, 02, 17 | Retrieved; mandatory semantic recheck |
| RESOURCE | PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` | 01, 02 | Retrieved; mandatory semantic recheck |
| LINK | PR #53 `50a2cd45e76f06e87b87e93842badf4c61f17bde` | 16 | Retrieved; mandatory semantic recheck |
| RELAY | PR #2 `9f30b3505335a52c574ff570576687d6467021ff` | 03, 04 | Retrieved; mandatory semantic recheck |
| OUTBOX | PR #32 `8865f73d52a4864afee145f28d26520476273927` | 04 | Retrieved; mandatory semantic recheck |
| COUNT | PR #69 `9353a0c6c02c595f7e65ebd6df3802a7a45fc6bf` | 04 | Retrieved; mandatory semantic recheck |
| FS | PR #88 `bd1b9e912f05203bf38f7a1b04f920744fe6d625` | 05 | Retrieved; mandatory semantic recheck |
| SERIAL | PR #61 `0c6e88ab8003f5bf88c8ddee5b5e3cd382ab7e1c` | 06 | Retrieved; mandatory semantic recheck |
| BLE | PR #62 `b46b86913c23cd509d2ace14f1de55b0c451e0f9` | 06 | Retrieved; mandatory semantic recheck |
| UPLOAD | PR #33 `f5cc981e527e2cc1572793a7a6e5082e5271ac49` | 07 | Retrieved; mandatory semantic recheck |
| CONNECT | PR #19 `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f` | Phase 114 | Retrieved; manifest admission, grant UI, and CSP are explicitly outside Phase 113. NAP-CONNECT has no operation wire and does not replace Phase 113 mediated destination authorization. |
| CVM | PR #31 `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f` | 08 | Retrieved; mandatory semantic recheck |
| DM | PR #74 `2c4e4423f40e72675822225acacea2ee5889ade2` | 09 | Retrieved; mandatory semantic recheck |
| WEBRTC | PR #59 `69523e8cf44c8653155c5e77d25340d4ea3d0887` | 10 | Retrieved; mandatory semantic recheck |
| COMMON | PR #67 `8cd0eae8550575771bb616a384e2dfbcade31673` | 11 | Retrieved; mandatory semantic recheck |
| LISTS | PR #68 `7cf00cdb7bca6bb59dc5ef082e9fe8ac9278fa46` | 11 | Retrieved; mandatory semantic recheck |
| INTENT | prior PR #106 `fc121fc264615482143eda86125863d2e1f741a2` | 13 | Historical ref only; requery current authority before edit |

3. **Relay and outbox revocation terminals stay domain-specific.** Plans 03-04 must
   derive the exact terminal envelope and reason semantics from their respective draft
   heads, then lock them with tests. Planning does not invent a shared generic reason.
4. **Services without a mapped authority keep an explicit implementation gate.** Plans
   12, 14, and 15 must check identity, keys, cache, config, theme, gamepad, media,
   notification, and notify against current `napplet/naps` before changing wire
   behavior. If no owning NAP exists after that check, the plan records a bounded
   Kehto host-policy decision and avoids presenting it as protocol authority.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Composing all selected network requirements into a single authorization is the intended use of the present coordinator. | Prompt behavior may need per-destination sequencing instead. |
| A2 | Retrieved open-draft heads are the working authorities listed above, but each owning plan still performs and records the semantic comparison before code changes. | A moved draft head or overlooked rule may require the plan to update its wire/lifecycle behavior before implementation. |

## Sources

### Primary

- NAP-RESOURCE PR #80 exact head `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` — resource wire, identity, cache, resolver, redirect, and security rules. [CITED: `/tmp/kehto-firewall-specs/NAP-RESOURCE.md`]
- NAP-RELAY PR #2 `9f30b3505335a52c574ff570576687d6467021ff`; NAP-OUTBOX PR #32 `8865f73d52a4864afee145f28d26520476273927`; NAP-FS PR #88 `bd1b9e912f05203bf38f7a1b04f920744fe6d625`; NAP-UPLOAD PR #33 `f5cc981e527e2cc1572793a7a6e5082e5271ac49`; NAP-CONNECT PR #19 `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f`. [CITED: `/tmp/kehto-firewall-specs`]
- Runtime permission/service source and reference handlers. [VERIFIED: `packages/runtime/src/{permission-runtime,service-types,service-dispatch,runtime}.ts`; VERIFIED: `packages/services/src`]

## Metadata

**Confidence breakdown:**
- Architecture: HIGH — based on present runtime/service APIs and concrete handler ownership.
- Protocol constraints: HIGH for the mapped exact refs as authorities; semantic-review status remains plan-specific as recorded above.
- Host resolver policy: HIGH for the browser limitation, NAP-RESOURCE mandate, and chosen protected trusted-transport design.

**Research date:** 2026-10-17
**Valid until:** recheck draft heads before implementing or shipping.


## Authority follow-up after research handoff

The root agent queried all open `napplet/naps` PRs and found every draft listed as
missing from the captured set above. Absence from master is not a spec gap. These
exact documents are now downloaded in `/tmp/kehto-firewall-specs`; the planner and
executor must inspect their semantics before changing each domain. This table
records retrieval and exact refs, not a claim of completed semantic review.

| Document | PR | Retrieved head |
|---|---|---|
| NAP-DM | #74 | `2c4e4423f40e72675822225acacea2ee5889ade2` |
| NAP-COUNT | #69 | `9353a0c6c02c595f7e65ebd6df3802a7a45fc6bf` |
| NAP-LISTS | #68 | `7cf00cdb7bca6bb59dc5ef082e9fe8ac9278fa46` |
| NAP-COMMON | #67 | `8cd0eae8550575771bb616a384e2dfbcade31673` |
| NAP-BLE | #62 | `b46b86913c23cd509d2ace14f1de55b0c451e0f9` |
| NAP-SERIAL | #61 | `0c6e88ab8003f5bf88c8ddee5b5e3cd382ab7e1c` |
| NAP-WEBRTC | #59 | `69523e8cf44c8653155c5e77d25340d4ea3d0887` |
| NAP-CVM | #31 | `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f` |

Resolver destination enforcement is phase 113 work, including actual Paja and
playground resolver consumers. Phase 114 owns admission/UI/CSP. Do not resolve the
DNS limitation by silently deleting the requested network resource functionality:
plan an enforceable trusted transport with explicit support boundaries.

## Transport implementation references

Checked 2026-10-17: [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry/)
and [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry/).
Use the registries' destination/global-reachability distinctions to build explicit
address-policy vectors. Private/loopback checks alone miss shared-address,
link-local, documentation, benchmark, reserved, and translation ranges. Record
any intentionally stricter host policy instead of claiming all special-purpose
ranges are private. Validate IPv4-mapped IPv6 and literal addresses as well as DNS
answers. Refresh source dates when implementing; tests must cite real ranges.

[Node HTTPS request documentation](https://nodejs.org/api/https.html) is the
connection API reference. Preserve original hostname for Host/TLS identity while
pinning only the already-validated socket address; do not disable certificate
verification. Use one-hop requests without implicit redirects, bounded byte/time
budgets, and actual disconnect/abort cleanup. A browser-origin check is separate
from target address checks: the endpoint additionally needs host-only request
authority so an app cannot bypass the approval coordinator by calling it directly.
