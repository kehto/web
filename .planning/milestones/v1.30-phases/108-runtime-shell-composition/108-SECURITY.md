---
phase: 108
slug: runtime-shell-composition
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-08-20
---

# Phase 108 — Security

> ASVS L1 verification of the plan-time STRIDE register for the experimental IPC runtime-shell composition.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Local peer → projection | Untrusted canonical-looking envelopes arrive through a host-bound opaque peer handle. | Decoded NIP-5D envelopes without trusted identity |
| Projection → runtime | Readiness, frozen registration, and current connection generation gate public runtime dispatch. | Canonical envelopes plus host-owned window identity |
| Runtime → IPC endpoint | Runtime output is eligible only for the current ready registration and its targeted peer queue. | Canonical response, push, and lifecycle envelopes |
| Endpoint terminal event → lifecycle cleanup | Asynchronous peer, endpoint, unregister, and shutdown paths converge on shared cleanup. | Private connection/endpoint generations and cleanup promises |
| Shared runtime → sibling endpoint | Per-window destruction may generate NAP-INC lifecycle output for a surviving napplet. | Canonical `inc.channel.closed` routed to one eligible peer |

## Threat Register

| Threat ID | Severity | Disposition | Mitigation Evidence | Status |
|-----------|----------|-------------|---------------------|--------|
| T-108-01 | high | mitigate | One active peer per endpoint; concurrent peers are rejected and runtime egress targets only the current peer. | closed |
| T-108-02 | high | mitigate | Exact bare readiness and host-frozen registration establish identity; peer binding claims are terminally rejected before dispatch. | closed |
| T-108-03 | high | mitigate | Pre-ready traffic returns before `Runtime.handleMessage`; raw-socket tests prove capability traffic is inert. | closed |
| T-108-04 | high | mitigate | The unchanged decoded canonical envelope is passed to the public runtime, and noncanonical egress is rejected. | closed |
| T-108-05 | medium | mitigate | Payload-bearing readiness is ignored and emits one redacted diagnostic without creating a session or init. | closed |
| T-108-06 | low | accept | POSIX pathname ownership and same-UID access are not cryptographic peer authentication; the accepted boundary is logged below and documented publicly. | closed |
| T-108-SC | high | mitigate | `@kehto/runtime` is a first-party `workspace:^` dependency; package build and type-check resolve the local public contract. | closed |
| T-108-07 | high | mitigate | Current peer identity/generation is retired before cleanup; stale replacement regressions prove old callbacks cannot remove the successor. | closed |
| T-108-08 | high | mitigate | Cleanup order is retire, `destroyWindow`, session unregister, then carrier cleanup, removing subscriptions, services, and INC state. | closed |
| T-108-09 | high | mitigate | The projection delegates immutable environment, host-domain, ACL, firewall, and capability enforcement to the public runtime. | closed |
| T-108-10 | high | mitigate | Runtime recipient eligibility and the window-indexed current ready route prevent cross-peer or stale delivery. | closed |
| T-108-11 | medium | mitigate | Composition shutdown joins record-owned close promises, awaits endpoint cleanup, and destroys the shared runtime exactly once. | closed |
| T-108-12 | medium | mitigate | Named raw-socket tests cover graceful, abrupt, endpoint-close, unregister, and host-shutdown ownership. | closed |
| T-108-13 | high | mitigate | Ingress requires both the callback's frozen registration identity and the active opaque peer before runtime dispatch. | closed |
| T-108-14 | high | mitigate | Window-indexed targeted egress plus a two-endpoint test proves no cross-delivery. | closed |
| T-108-15 | high | mitigate | Endpoint handles are generation-bound; obsolete handles cannot close or unregister replacements. | closed |
| T-108-16 | high | mitigate | Runtime/session cleanup precedes carrier teardown, while peer-only disconnect retains the listener for reconnection. | closed |
| T-108-17 | medium | mitigate | Endpoint close, unregister, and shutdown join one idempotent record-owned promise retained until carrier cleanup settles. | closed |
| T-108-18 | high | mitigate | An unchanged shared runtime produces canonical `inc.channel.closed` for the surviving peer, which remains usable after sibling teardown. | closed |

## Accepted Risks Log

| Threat ID | Accepted Boundary | Rationale | Compensating Controls | Revisit Trigger |
|-----------|-------------------|-----------|-----------------------|-----------------|
| T-108-06 | Hostile processes already able to access the same private Unix-socket pathname under the same OS user are outside this experimental carrier's authentication guarantee. | NIP-5D and the pinned NAP documents define no IPC carrier or cryptographic local-peer authentication contract. Claiming authentication here would exceed the protocol authority checked at `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`. | Mode-0700 owned temporary directory, host-only pathname exposure, frozen host registration, rejection of peer identity claims, bounded framing/queues, and redacted diagnostics. | Revisit before supporting mutually hostile same-UID processes, pathname sharing, multi-user brokers, or a future NAP IPC authentication contract. |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Accepted | Open | Run By |
|------------|---------------|--------|----------|------|--------|
| 2026-08-20 | 19 | 18 | 1 | 0 | Codex autonomous security hook |

## Sign-Off

- [x] All plan-time threats have a disposition and implementation/test evidence.
- [x] The sole accepted low-risk carrier boundary is explicitly logged.
- [x] No high-severity threat remains open.
- [x] `threats_open: 0` confirmed at ASVS L1 with `block_on: high`.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-08-20
