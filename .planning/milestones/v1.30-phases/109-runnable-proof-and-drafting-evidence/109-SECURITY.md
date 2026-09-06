---
phase: 109
slug: runnable-proof-and-drafting-evidence
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-08-20
---

# Phase 109 — Security

> ASVS L1 verification of the runnable raw-process proof, public drafting evidence, and release metadata.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Host → spawned napplet | The host supplies only the selected socket path and proof mode to the exact child it spawns. | Host-owned pathname and bounded mode |
| Raw child → IPC projection | The untrusted process sends locally framed canonical envelopes without trusted identity. | RFC 7464 records over `node:net` |
| Raw child stdout → proof host | Child observations are untrusted, bounded, allowlisted, and cannot create host success milestones. | Limited JSON-line observation records |
| Service runtime → current peer | Result and push evidence must traverse real runtime dispatch and recipient eligibility. | Same-ID result and `intent.changed` push |
| Proof lifecycle → filesystem/process table | Normal, forced, and adversarial exits must reap the exact child and release only owned socket resources. | Child PID, endpoint route, socket path, owned directory |
| Implementation evidence → public docs | Local carrier choices must not be presented as NAP authority or cryptographic authentication. | Parity classifications, drafting findings, security limits |

## Threat Register

| Threat ID | Severity | Disposition | Mitigation Evidence | Status |
|-----------|----------|-------------|---------------------|--------|
| T-109-01 | high | mitigate | Host supplies only path/mode; raw child accepts only those arguments; frozen registration and exact readiness remain host-owned. | closed |
| T-109-02 | high | mitigate | Same-ID result and success milestones originate at the registered service path; forged child observations cannot advance proof. | closed |
| T-109-03 | high | mitigate | Push uses retained `ServiceRuntimeContext.sendToEligibleNapplet()` and requires successful runtime eligibility. | closed |
| T-109-04 | high | mitigate | Child pipes are drained; parsing is bounded and awaited; failures enter `finally`, terminate/reap the exact child, and close composition. | closed |
| T-109-05 | medium | mitigate | Host and child evidence records use bounded, allowlisted fields rather than arbitrary payload logging. | closed |
| T-109-06 | medium | mitigate | Forced proof requires observed `SIGKILL`; both modes prove session, route, socket path, and owned-directory cleanup. | closed |
| T-109-07 | low | accept | Same-UID pathname access is not peer authentication; the accepted boundary is logged below and stated conspicuously in public docs. | closed |
| T-109-08 | high | mitigate | Docs pin `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`, state that it defines no IPC carrier, and label all local choices experimental. | closed |
| T-109-09 | high | mitigate | Public security guidance denies authentication, authorization, cryptographic identity, and hostile same-UID resistance. | closed |
| T-109-10 | medium | mitigate | README/package docs derive from public exports and exact runnable commands, with build/process/docs verification. | closed |
| T-109-11 | medium | mitigate | The parity matrix uses explicit shared, carrier-specific, intentionally absent, and unresolved classifications. | closed |
| T-109-12 | medium | mitigate | Public evidence links only bounded reference artifacts; child output is filtered before host re-emission. | closed |
| T-109-13 | low | mitigate | Canonical VitePress route exists and both package documents link it under the strict docs gate. | closed |
| T-109-14 | medium | mitigate | One sole minor changeset records the new 0.x package's complete shipped scope. | closed |
| T-109-15 | high | mitigate | Final-source release evidence records actual successful commands and counts; verification reran the proof and full gate chain. | closed |
| T-109-16 | high | mitigate | Static diff guards prove no runtime, browser-shell, E2E, or playground source changes. | closed |
| T-109-17 | medium | mitigate | Normal proof has a CI-safe deadline; adversarial fixtures opt into short bounds; all paths reap the exact child. | closed |
| T-109-18 | medium | mitigate | Repository-local AI-slop scan exits successfully with no security findings and unchanged policy. | closed |
| T-109-19 | medium | mitigate | Explicit-path staging and status checks preserve unrelated workspace state outside the milestone deliverables. | closed |

## Accepted Risks Log

| Threat ID | Accepted Boundary | Rationale | Compensating Controls | Revisit Trigger |
|-----------|-------------------|-----------|-----------------------|-----------------|
| T-109-07 | A hostile process sharing the host operating-system UID may access a POSIX pathname available to that UID. | Private directories and pathname secrecy are operational containment only. The pinned NAP authority defines no IPC carrier or authenticated local-peer binding, so this experiment cannot honestly claim authentication, authorization, cryptographic identity, or hostile same-UID resistance. | Mode-0700 owned directories, host-held pathname distribution, frozen host registration, terminal rejection of peer identity claims, bounded framing/queues/control records, and exact-child lifecycle cleanup. | Revisit before mutually hostile same-UID use, pathname sharing, multi-user brokers, remote transport, or adoption of an upstream IPC authentication contract. |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Accepted | Open | Run By |
|------------|---------------|--------|----------|------|--------|
| 2026-08-20 | 19 | 18 | 1 | 0 | Codex autonomous security hook |

## Sign-Off

- [x] All plan-time threats have a disposition and current implementation/test evidence.
- [x] The sole accepted low-risk local-peer boundary is explicit and bounded.
- [x] No high-severity threat remains open.
- [x] `threats_open: 0` confirmed at ASVS L1 with `block_on: high`.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-08-20
