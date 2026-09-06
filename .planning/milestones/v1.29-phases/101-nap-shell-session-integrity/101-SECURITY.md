---
phase: 101
slug: nap-shell-session-integrity
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-23
---

# Phase 101 — Security

> Verification of the plan-time STRIDE registers against the committed
> runtime, shell, Paja, playground, and regression-test implementation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| iframe source → host origin registry | A browser frame is associated with a host-created identity and registration lifecycle. | `MessageEvent.source`, dTag, aggregate hash, registration ID |
| `shell.ready` → trusted session | An untrusted readiness signal requests creation of one capability session. | Bare ready signal; no caller identity claims |
| host wiring → `shell.init` | Live host capabilities are narrowed to a per-frame immutable environment. | Domain and service names |
| parent → injected namespace | The frame receives its first trusted initialization snapshot. | Frozen `ShellEnvironment` |
| verified artifact → executable srcdoc | Paja and playground add host bootstrap without changing artifact identity provenance. | Verified HTML bytes and injected bootstrap |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation / evidence | Status |
|-----------|----------|-----------|----------|-------------|-----------------------|--------|
| T-101-01 | Spoofing / Elevation | `handleShellReady` | high | mitigate | Registry-derived identity; forged payload regression in `shell-bridge.test.ts`. | closed |
| T-101-02 | Elevation | `createMessageHandler` | high | mitigate | Pre-session return precedes ACL, firewall, service, and domain dispatch; spies prove no side effect. | closed |
| T-101-03 | Tampering / Elevation | `initSent` and session registry | high | mitigate | Registration-scoped one-shot init and duplicate-ready regression. | closed |
| T-101-04 | Information Disclosure | per-frame init environment | high | mitigate | Fresh frozen environment snapshots and independent-frame mutation tests. | closed |
| T-101-05 | Spoofing | injected init receiver | high | mitigate | Parent-only, first-init-only receiver with sibling/child/replay rejection. | closed |
| T-101-06 | Elevation | identity-less registered frame | high | mitigate | Missing creation identity returns before session, resolver, or init. | closed |
| T-101-07 | Spoofing / Tampering | origin registry boundary | high | mitigate | Source and registration resolved from the host registry; only explicit re-registration starts a new lifecycle. | closed |
| T-101-08 | Elevation | capability subset resolver | high | mitigate | Exact live-and-granted intersection rejects additions, aliases, case drift, duplicates, and prefix adjacency. | closed |
| T-101-09 | Information Disclosure / Tampering | `resolveShellEnvironment` | high | mitigate | Per-call copy/freeze with no shared references across identities. | closed |
| T-101-10 | Spoofing | ready identity handoff | high | mitigate | Creation identity is resolved once and passed explicitly to session and environment construction. | closed |
| T-101-11 | Elevation | identity-less registration | high | mitigate | No identity means no resolver call, session, or init. | closed |
| T-101-12 | Tampering | duplicate ready | high | mitigate | Same-registration return occurs before identity/environment reconstruction. | closed |
| T-101-13 | Spoofing | `makeShell` init listener | high | mitigate | Exact parent-source and first-valid-init checks with adversarial source/replay vectors. | closed |
| T-101-14 | Elevation | unary `supports` | high | mitigate | Exact string membership with prefix, case, empty, invalid, and adjacency tests. | closed |
| T-101-15 | Tampering / Information Disclosure | cached environment | high | mitigate | Nested arrays are validated, copied, and frozen per frame. | closed |
| T-101-16 | Tampering | public contract drift | medium | mitigate | Cross-surface contract test and classified active-source guard. | closed |
| T-101-04-01 | Spoofing | Paja iframe registration | high | mitigate | Trusted creation identity is registered before executable srcdoc; ordering guard is green. | closed |
| T-101-04-02 | Elevation of Privilege | Paja environment resolution | high | mitigate | Paja delegates to the shared live/disabled-aware host resolver. | closed |
| T-101-04-03 | Information Disclosure | Paja environment snapshots | high | mitigate | Registry stores copied frozen environments; parity tests prove isolation. | closed |
| T-101-04-04 | Tampering | Paja reload registration | high | mitigate | Reload removes stale runtime/session/origin state before the new generation. | closed |
| T-101-04-05 | Tampering | verified srcdoc provenance | high | mitigate | Verified `indexHtml` remains identity input; bootstrap is injected afterward and guarded. | closed |
| T-101-05-01 | Spoofing | playground source registration | high | mitigate | Verified identity and source are registered before srcdoc and rebound only on replacement. | closed |
| T-101-05-02 | Information Disclosure | concurrent playground environments | high | mitigate | Per-frame frozen environments and simultaneous-profile browser coverage. | closed |
| T-101-05-03 | Elevation of Privilege | playground environment resolution | high | mitigate | Shared resolver uses concrete live wiring, disables, and trusted identity. | closed |
| T-101-05-04 | Tampering | gateway/srcdoc provenance | high | mitigate | Verified bytes establish identity; gateway data and injected bootstrap cannot. | closed |
| T-101-05-05 | Denial of Service | duplicate ready/reload | medium | mitigate | Duplicate ready is idempotent; a registered reload receives exactly one init. | closed |

*Status: open · closed · open below threshold (non-blocking)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-23 | 26 | 26 | 0 | GSD security auditor |

---

## Sign-Off

- [x] All threats have a disposition.
- [x] No accepted risks require documentation.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-07-23
