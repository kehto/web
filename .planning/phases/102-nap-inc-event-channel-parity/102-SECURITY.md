---
phase: 102
slug: nap-inc-event-channel-parity
status: verified
# threats_open counts OPEN threats at or above workflow.security_block_on (high).
threats_open: 0
asvs_level: 1
created: 2026-07-23
---

# Phase 102 — Security

> Verified threat contract for NAP-INC event and symmetric-channel parity.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Napplet iframe endpoint → authenticated runtime session | The shell associates each message source window with a registered napplet endpoint and dTag. Caller-supplied identity is not trusted. | Wire envelopes, authenticated source window, runtime-attested dTag |
| Runtime → peer napplet | The runtime resolves exact recipients, establishes symmetric channel membership, and delivers events or channel lifecycle messages only to eligible peers. | Attested sender/peer identity, opaque payloads, channel lifecycle |
| Injected binding → normalized wire request | The binding validates convention URIs and transposes query sugar before sending a queryless identity to the runtime. | Convention URI, shallow text payload, normalized topic |
| Runtime → direct host services | Host services are selected only through their exact message-type domains; INC topics are never interpreted as service routes. | Direct notification/storage/relay requests and results |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-102-01 | Spoofing | Event sender | high | mitigate | Derive sender from the authenticated runtime session; forged caller identity is overwritten. | closed |
| T-102-02 | Tampering | Topic routing | high | mitigate | Transpose query sugar once in the binding and route only by exact queryless identity. | closed |
| T-102-03 | Information Disclosure | Event fan-out | medium | mitigate | Exclude the authenticated source endpoint from delivery. | closed |
| T-102-04 | Spoofing | Channel target and peer | high | mitigate | Resolve one live dTag and derive both peer fields from trusted sessions. | closed |
| T-102-05 | Elevation of Privilege | Channel membership | high | mitigate | Use runtime-issued opaque IDs and exact membership checks for every channel action. | closed |
| T-102-06 | Denial of Service | Teardown indexes | medium | mitigate | Use one bilateral teardown primitive and remove all routes atomically. | closed |
| T-102-07 | Information Disclosure | Destroyed peer | medium | mitigate | Remove routes before notifying only surviving endpoints. | closed |
| T-102-08 | Elevation of Privilege | Channel open | high | mitigate | Authorize both source and target for `relay:read` before creating state. | closed |
| T-102-09 | Tampering | Established-channel payload | high | mitigate | Treat payloads as opaque and authorize routing solely through channel membership. | closed |
| T-102-10 | Elevation of Privilege | ACL revocation | high | mitigate | Tear down affected channels synchronously on block or relevant revoke. | closed |
| T-102-11 | Denial of Service | Unrelated ACL mutations | low | accept | Grants, unblocks, and unrelated revokes are tested as inert; residual explicit host-policy mutation is accepted. | closed — accepted |
| T-102-12 | Tampering | Convention URI parser | high | mitigate | Decode once and reject fragments, malformed encoding, duplicate decoded names, and query-plus-payload conflicts. | closed |
| T-102-12A | Tampering | Namespace replacement | high | mitigate | Protect convention operations across both supported proxy assignment forms. | closed |
| T-102-13 | Spoofing | Result and event listeners | high | mitigate | Require the parent source plus exact type and correlation identity. | closed |
| T-102-14 | Denial of Service | Retained channel lifecycle | high | mitigate | Bound pending handles/messages, close on overflow, and retain terminal closure deterministically. | closed |
| T-102-15 | Information Disclosure | Cross-channel events | high | mitigate | Route callbacks by exact channel ID and deactivate them on close. | closed |
| T-102-16 | Spoofing | Paja target source | high | mitigate | Register the trusted target before `srcdoc` and expose the API only after the ready lifecycle. | closed |
| T-102-17 | Tampering | Parallel Paja INC implementation | medium | mitigate | Reuse the shell binding prelude and forbid a separate parser/client. | closed |
| T-102-17A | Tampering | Bundled shim reassignment | high | mitigate | Preserve protected INC normalization after real bundle assignment. | closed |
| T-102-18 | Denial of Service | Reload listeners | medium | mitigate | Recreate state on reload and prevent old callbacks from observing new traffic. | closed |
| T-102-19 | Spoofing | Cross-frame sender | high | mitigate | Register distinct dTags and derive every delivered sender/peer from runtime session state. | closed |
| T-102-20 | Tampering | Query-bearing wire topic | high | mitigate | Reject query-aware base matching; raw query-bearing topics cannot match stable subscriptions. | closed |
| T-102-20A | Spoofing | Caller sender field | high | mitigate | Ignore forged raw sender values and attest the authenticated session dTag. | closed |
| T-102-21 | Elevation of Privilege | Opaque channel ID | high | mitigate | Accept only runtime-issued IDs held by the caller; post-close traffic is inert. | closed |
| T-102-22 | Information Disclosure | Opaque channel payload | medium | mitigate | Preserve payloads without inspection and deliver only to the selected peer. | closed |
| T-102-22A | Tampering | Target handle and ordering | high | mitigate | Implement symmetric handles, target-open-before-result ordering, and retained early/terminal notifications per draft PR #92. | closed |
| T-102-23 | Tampering | Protocol authority drift | high | mitigate | Pin draft PR heads #89, #90, and #92 and require re-audit when they change. | closed |
| T-102-24 | Repudiation | Scope provenance | medium | mitigate | Record binding/runtime ownership and Phase 104/105 boundaries in active policy and package guidance. | closed |
| T-102-25 | Denial of Service | Historical false positives | low | accept | Structural guards are scoped to active surfaces while classified historical records remain preserved. | closed — accepted |
| T-102-26 | Repudiation | Package release impact | medium | mitigate | Keep package changesets tied to observable source changes and the pinned upstream head. | closed |
| T-102-27 | Tampering | Incomplete validation | high | mitigate | Run focused cross-layer proof plus build, type, unit, browser, documentation, and diff gates. | closed |
| T-102-28 | Information Disclosure | Test payloads | low | accept | Browser vectors use only synthetic non-secret values and opaque test payloads. | closed — accepted |
| T-102-29 | Elevation of Privilege | Generic service selection | high | mitigate | Select services only by exact message-type domain; never interpret INC topic contents. | closed |
| T-102-30 | Elevation of Privilege | Notification side effects | high | mitigate | Ignore INC inputs and accept only the explicit direct notification domain. | closed |
| T-102-31 | Spoofing | Synthetic INC delivery | high | mitigate | Remove senderless fabrication; only the authenticated INC runtime delivers events. | closed |
| T-102-32 | Elevation of Privilege | Playground service triggers | high | mitigate | Remove prefix-based service producers and consumers and prove direct-domain behavior. | closed |
| T-102-33 | Spoofing | Synthetic demo events | high | mitigate | Remove senderless demo dependencies and prove canonical direct notification behavior. | closed |
| T-102-34 | Repudiation | Historical preservation | medium | mitigate | Scope active-surface guards narrowly and leave preserved records untouched. | closed |
| T-102-35 | Spoofing | Guidance-generated events | high | mitigate | Document runtime-attested sender delivery and reject synthetic `inc.event` examples. | closed |
| T-102-SC | Tampering | Dependency supply chain | high | mitigate | Install or upgrade nothing; preserve Phase 105 as the published-package adoption gate. | closed |

All 40 distinct threat identifiers declared across the Phase 102 plans are represented above. Repeated per-plan `T-102-SC` declarations are consolidated into one register entry.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-102-01 | T-102-11 | Tests prove grants, unblocks, and unrelated revokes leave channels intact; residual risk is limited to deliberate host policy mutation. | Project threat model | 2026-07-23 |
| AR-102-02 | T-102-25 | Active-surface scoping prevents historical records from producing release-blocking false positives. | Project threat model | 2026-07-23 |
| AR-102-03 | T-102-28 | Test payloads are synthetic, non-secret, and opaque. | Project threat model | 2026-07-23 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-23 | 40 | 40 | 0 | gsd-security-auditor (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-23
