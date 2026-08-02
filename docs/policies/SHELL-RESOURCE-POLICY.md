<!--
  Kehto file: docs/policies/SHELL-RESOURCE-POLICY.md

  Status corrected in Phase 105: this is Kehto's non-normative host hardening
  policy, not a mirror of a NAP-RESOURCE specification. napplet/naps master at
  5ac0490461ca6fec2f0d2e45b4835cf9bc08de24 has no standalone NAP-RESOURCE.md.
  Do not infer a resource wire extension from this document.

  Kehto file:line cross-references (RESOURCE-05):
    - createResourceService factory:       packages/services/src/resource-service.ts (export function createResourceService)
    - H-03 construction guard:             packages/services/src/resource-service.ts (assertResourceOptions throws on missing getConnectGrants)
    - 'resource:fetch' capability:         packages/acl/src/capabilities.ts (ALL_CAPABILITIES 'resource:fetch' entry)
    - CAP_RESOURCE_FETCH constant:         packages/acl/src/capabilities.ts (export const CAP_RESOURCE_FETCH)
    - resourceMap() resolver:              packages/acl/src/resolve.ts (function resourceMap)
    - case 'resource' dispatch:            packages/acl/src/resolve.ts (case 'resource': return resourceMap(action))
    - handleResourceMessage dispatch:      packages/runtime/src/runtime.ts (function handleResourceMessage)
    - resourceAdapter (NapHandler):        packages/runtime/src/runtime.ts (const resourceAdapter: NapHandler)
    - napDispatch.registerNap('resource'): packages/runtime/src/runtime.ts (RESOURCE-02)
    - hostFetch (AbortController+timeout): apps/playground/src/demo-hooks.ts (async function hostFetch)
    - createResourceService wiring:        apps/playground/src/demo-hooks.ts (createResourceService({ fetch, isOriginGranted, getConnectGrants, resolveIdentity }))
    - origin grant source:                 apps/playground/src/demo-hooks.ts (STATIC_CONNECT_GRANTS static map)
    - resource-demo napplet:               apps/playground/napplets/resource-demo/
    - nap-resource.spec.ts (E2E-25):       tests/e2e/nap-resource.spec.ts (2 tests: granted + denied)

  Host-app-responsibility surface (D7, delegated to host-supplied fetch option):
    - Redirect limits (RFC 7231 §6.4, recommended max 5 hops with per-hop DNS re-validation)
    - MIME byte-sniffing (never pass upstream Content-Type to napplet — classify by byte-sniff)
    - SVG rasterization (rasterize to PNG/WebP in sandboxed Worker before delivery; never deliver raw SVG)
    - Private-IP blocking (RFC 1918 — reject 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 + link-local + loopback + cloud-metadata at DNS-resolution time, not URL-parse time)
    - Oversize response limits (stream-abort; recommended 10 MiB default per fetch)
    - Scheme allowlist (https:, data:, blossom:sha256:, nostr:<bech32>; block file:, gopher:, ftp:, etc.)

  Kehto's resource implementation is read-only host policy. It does not define
  a standalone NAP wire shape, capability advertisement, or result fields.

  Note on Kehto demo-mode relaxations (not production-conformant):
    The apps/playground hostFetch does NOT enforce the private-IP block list (demo runs
    on localhost). The E2E denied-origin test exercises the ACL gate (H-03 coupling
    at getConnectGrants), NOT the network-level policy (private-IP block / scheme
    whitelist). Production shells MUST implement the full policy checklist below.
-->

# Shell Resource Policy Checklist

> Kehto host-hardening guide for core 0.31.1 / nap 0.31.2 consumers using profile-media
> `resource.bytes` delegation.
> This is not a standalone NAP-RESOURCE specification and does not define wire
> messages, fields, or capability strings.

## Status

`napplet/naps` master at `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` has no
standalone `NAP-RESOURCE.md`. For profile picture and banner bytes, authority is
NAP-IDENTITY's explicit `resource.bytes` delegation plus the published
`@napplet/core` 0.31.1 / `@napplet/nap` 0.31.2 declarations. This document is a
non-normative Kehto deployment checklist; its MUST/SHOULD labels are local
hardening requirements, not protocol language. It does not infer any missing
resource wire semantics.

## Why this exists

Profile-media byte retrieval makes the host shell a network-fetch path on behalf
of sandboxed napplets. The shell-as-fetch-proxy model is an irreducible attack
surface: a naively-implemented shell becomes an SSRF gadget that can probe
internal addresses, exfiltrate cloud-metadata credentials, or scan the deployer's
intranet on behalf of an attacker-supplied URL. This checklist makes Kehto's
operator-visible hardening decisions explicit.

Shells that do not meet the local hardening requirements below SHOULD NOT be
deployed in adversarial contexts. They are not classified here as NAP-RESOURCE
protocol non-conformance.


## Private-IP Block List (MUST, at DNS-resolution time)

The single most important policy. Reject URLs whose **resolved IP** falls in any blocked range. Check happens **after** the DNS resolver returns an address and **before** the HTTP connection is opened. Each redirect hop is re-validated independently.

URL-parse-time checks (looking at the literal hostname) are NOT sufficient — an attacker-controlled DNS record can resolve `attacker.example.com` to `127.0.0.1` and bypass any naive check. DNS pinning to the validated address defeats DNS-rebinding and TOCTOU attacks.

### Required ranges

- [ ] `10.0.0.0/8` — RFC1918 private IPv4
- [ ] `172.16.0.0/12` — RFC1918 private IPv4
- [ ] `192.168.0.0/16` — RFC1918 private IPv4
- [ ] `127.0.0.0/8` — IPv4 loopback
- [ ] `::1/128` — IPv6 loopback
- [ ] `169.254.0.0/16` — IPv4 link-local
- [ ] `fe80::/10` — IPv6 link-local
- [ ] `fc00::/7` — IPv6 unique-local
- [ ] `169.254.169.254` (singleton) — Cloud metadata service (AWS, GCP, Azure, DigitalOcean, etc.)

### Implementation requirements

- [ ] Validation runs **after** DNS resolves to an IP, **before** the TCP connection is opened
- [ ] Each redirect hop is re-validated independently against the same list
- [ ] Failed validation emits `code: "blocked-by-policy"` with an error string identifying the matching range (so deployers can debug policy)
- [ ] Additional addresses MAY be allowed behind explicit shell-administrator policy (enterprise on-prem services), but the default for community-deployed shells MUST be restrictive


## Sidecar Pre-Resolution (default OFF)

Where a Kehto host elects to pre-fetch resources referenced by an event, it may
maintain a host-local sidecar cache. That cache is not a NAP wire field or
published resource contract; profile media remains constrained to the explicit
NAP-IDENTITY `resource.bytes(url)` delegation.

### Privacy rationale (why default OFF)

Pre-fetching reveals user activity to upstream hosts before the user has chosen to render the event. An avatar URL on every event in a 1000-event timeline becomes 1000 HTTP requests, each one a fingerprint visible to the upstream host operator. Default OFF preserves the user's "I haven't rendered this yet" semantic.

### Checklist

- [ ] Sidecar emission defaults to **OFF** (no pre-resolution unless explicitly opted in)
- [ ] Opt-in is per **shell deployment policy** — not a per-napplet capability the napplet can negotiate
- [ ] Opt-in SHOULD be scoped by a **per-event-kind allowlist** (e.g., enable for kind 0 metadata only; do not pre-fetch resources from arbitrary user-content kinds)
- [ ] Sidecar bytes obey the **same policy** as direct `resource.bytes(url)` calls (private-IP block, MIME byte-sniffing, size cap, SVG rasterization)
- [ ] The `mime` field on each sidecar entry is shell-classified by byte-sniffing — **never** populated from the upstream `Content-Type` header
- [ ] SVG entries appearing in a sidecar are rasterized to PNG/WebP **before** being placed on the wire (the sidecar is not a bypass for SVG rasterization)
- [ ] Operators document any deviation from default-OFF in the shell's user-facing privacy notice


## SVG Rasterization Caps (MUST)

`image/svg+xml` is a parseable XML execution surface — `<script>`, `<foreignObject>`, `<image href>` external references, `<use href>` recursion, DOCTYPE entity expansion (the "billion laughs" pattern), `@font-face src:` URLs. Delivering raw SVG bytes to a sandboxed napplet recreates every attack surface the sandbox was designed to eliminate.

### Required behavior

- [ ] When the byte-sniffer identifies a fetched resource as `image/svg+xml`, the shell rasterizes it to a bitmap (PNG or WebP) **before** delivery
- [ ] The `mime` field on the result envelope for any SVG-source-input is `image/png` or `image/webp` — **never** `image/svg+xml`
- [ ] The rasterizer runs in a **sandboxed Worker** with **no network** access (no `XMLHttpRequest`, no `fetch`, no `WebSocket`, no `EventSource`, no `<img>` external `href` resolution, no `<use href>` external resolution, no `@font-face src:` resolution, no DOCTYPE entity URL resolution)

### Recommended caps (SHOULD, all enforced together)

| Cap | Recommended default | On exceed |
|-----|---------------------|-----------|
| Max input bytes | **5 MiB** | `code: "too-large"` |
| Max output dimensions | **4096 × 4096 pixels** | `code: "too-large"` |
| Wall-clock rasterization budget | **2 seconds** | `code: "timeout"` |

All three caps mitigate distinct attacks:
- Input cap → billion-laughs entity expansion is bounded
- Output cap → recursive-`<use>` rendering bombs are bounded
- Wall-clock cap → `<foreignObject>` script-driven CPU exhaustion is bounded

Relaxing any one cap undermines the others.


## MIME Byte-Sniffing Allowlist (MUST)

The upstream `Content-Type` header is attacker-controlled. A content host can declare `text/html` for what is actually `image/png` (or vice-versa) and coerce a napplet into a confused-render attack.

### Required behavior

- [ ] Classify response bytes via a byte-sniffing strategy ([WHATWG MIME Sniffing Standard](https://mimesniff.spec.whatwg.org/) or equivalent)
- [ ] **Never** pass through the upstream `Content-Type` header to the napplet
- [ ] Enforce a **scheme-appropriate MIME allowlist**; bytes whose sniffed MIME falls outside the allowlist are rejected with `code: "blocked-by-policy"`

### Recommended baseline allowlist (image-rendering shells)

- [ ] `image/png`
- [ ] `image/jpeg`
- [ ] `image/webp`
- [ ] `image/gif`
- [ ] `image/svg+xml` — only acceptable as **input** to the rasterizer; **never** delivered to the napplet as `image/svg+xml`

Shells delivering non-image bytes (e.g., `application/json` for `nostr:` resolution) extend the allowlist per scheme. Maintain one allowlist per scheme rather than a global union — the threat model differs per scheme.


## Redirect Chain Limits (SHOULD, with per-hop re-validation)

Public hosts can 302 to internal addresses. Without per-hop re-validation, a redirect chain trivially bypasses the private-IP block list.

### Recommended values

- [ ] Cap redirect chain at **5 hops**
- [ ] **Each hop is re-validated independently** against the private-IP block list (DNS pinning per hop)
- [ ] Excess hops or a redirect to a blocked address emits `code: "blocked-by-policy"`


## Recommended Operational Caps (SHOULD)

These mitigate resource-exhaustion attacks against the shell itself.

| Cap | Recommended default | On exceed |
|-----|---------------------|-----------|
| Per-response size | **10 MiB** | `code: "too-large"` |
| Per-URL fetch timeout (wall-clock) | **30 seconds** | `code: "timeout"` |
| Per-napplet concurrent in-flight `resource.bytes` calls | **10** | `code: "blocked-by-policy"` |
| Per-napplet `resource.bytes` rate limit (sliding window) | **60 calls / minute** | `code: "blocked-by-policy"` |
| Per-napplet outstanding-Blob quota | **~50 MiB** | `code: "quota-exceeded"` |

Community-deployed shells SHOULD NOT raise the response size cap above ~50 MiB without explicit operator opt-in.


## Single-Flight Cache (SHOULD)

Coalesce concurrent same-URL fetches.

- [ ] Cache keyed on the URL string as supplied by the napplet (byte-equal — this NAP does not mandate canonicalization)
- [ ] N concurrent calls for the same URL share **one** in-flight fetch and resolve with the same `Blob` reference
- [ ] Cache scope partitioned per `(dTag, aggregateHash)` per NIP-5D — napplets MUST NOT see another napplet's cached resources
- [ ] Aborted entries are removed from the in-flight map for retryability


## Scheme Whitelist (MUST)

Only the canonical schemes plus shell-administrator opt-ins are dispatched. Smuggling-prone schemes are never enabled by default.

### Canonical schemes

- [ ] `data:` (RFC 2397) — decoded in-shim with zero shell round-trip; size cap still applies on the decoded `Blob`
- [ ] `https:` — full Default Resource Policy applies
- [ ] `blossom:sha256:<hex>` — shell verifies hash against the URL's declared digest **before** delivery; mismatch → `code: "decode-failed"`
- [ ] `nostr:<bech32>` — single-hop NIP-19 resolution; recursive resolution is **not** the shell's job

### Never enable by default

- [ ] `file:` — local filesystem read; trivial sandbox escape
- [ ] `gopher:`, `dict:`, `ftp:`, `tftp:` — protocol smuggling vectors
- [ ] `http:` (cleartext) — opt-in only behind explicit shell-administrator policy (e.g., enterprise on-prem services)

Unknown schemes emit `code: "unsupported-scheme"`.


## Capability Advertisement Boundary

No standalone NAP-RESOURCE document authorizes resource-specific capability
advertisement. Do not infer `nap:resource` or `resource:scheme:*` support
strings from this policy. Hosts may continue to expose independently documented
Kehto policy capabilities, but they must not present them as NAP authority.

- [ ] Do not advertise `nap:resource` or `resource:scheme:*` as a published NAP contract.
- [ ] If a host advertises `perm:strict-csp`, document that it is a Kehto host
  policy and independently verify the enforced iframe CSP.


## Audit Checklist (one-page summary)

Use this as a deployment sign-off:

- [ ] Private-IP block list enforced at DNS-resolution time, all 9 ranges covered
- [ ] Each redirect hop independently DNS-pinned and re-validated
- [ ] MIME byte-sniffing replaces upstream `Content-Type` for the value delivered to the napplet
- [ ] SVG rasterization runs in a sandboxed Worker with no network; raw `image/svg+xml` bytes never reach the napplet
- [ ] SVG caps (5 MiB input / 4096×4096 output / 2s wall-clock) all enforced together
- [ ] Sidecar pre-resolution defaults OFF; opt-in per shell deployment policy + per-event-kind allowlist
- [ ] Sidecar bytes obey the same MIME/SVG/size policy as direct calls
- [ ] Single-flight cache scoped per `(dTag, aggregateHash)`
- [ ] Scheme dispatch is a whitelist; smuggling-prone schemes blocked
- [ ] No resource capability advertisement is represented as standalone NAP authority
- [ ] Resource bytes treated as observable (cleartext over postMessage); deployers document this in user-facing notice if relevant


## References

- [NAP-IDENTITY](https://github.com/napplet/naps) at
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` — profile-media
  `resource.bytes` delegation; `napplet/naps` has no standalone
  `NAP-RESOURCE.md` at this ref
- Published `@napplet/core` 0.31.1 / `@napplet/nap` 0.31.2 declarations — released
  implementation contract, NAP-INTENT authority `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`,
  napplet/web#199 source `3037200c932488f14f7f369b8583c39c9c16510a` / merge
  `b3f0007867eac109fa4917fac9c285d3b7cc6155`, and Version Packages #198 release
  source `dc1d24153c759152b6ba31a6ec9bea967798f2df`
- [NIP-5D Conformance](./NIP-5D-CONFORMANCE.md) — napplet-shell protocol alignment; Security Considerations subsection covers strict-CSP posture and `sandbox="allow-scripts"` reaffirmation
- [WHATWG MIME Sniffing Standard](https://mimesniff.spec.whatwg.org/) — recommended byte-sniffing reference
