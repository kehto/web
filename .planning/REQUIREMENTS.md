# Requirements: v1.31 Firewall approvals

Source: [original implementation goal](FIREWALL-GOAL.md). User authorized autonomous execution on 2026-10-17.

## Policy core and independent rate limits

- [ ] **FW-01**: Pure typed approvals for interface, resource, network, and explicitly registered future categories.
- [ ] **FW-02**: Verified manifest/publisher/artifact principals; explicit isolated development principals.
- [ ] **FW-03**: Deterministic allow/deny/ask precedence, composed scopes, once/session/persistent lifetimes.
- [ ] **FW-04**: Versioned grants, strict validation, migrations, revocation and visible storage failure behavior.
- [ ] **RATE-01**: Independent temporal module for token buckets, bursts, focus budgets, and prompt limits.
- [ ] **RATE-02**: Permission approval cannot bypass rate controls; classify content matchers separately.

## Runtime approval lifecycle

- [ ] **RUN-01**: Bound pending requests and equivalent prompts; preserve one-use semantics during concurrency.
- [ ] **RUN-02**: Revalidate endpoint generation, identity, exact request and current policy before execution.
- [ ] **RUN-03**: Cancel on teardown/replacement/revocation and settle/execute at most once.
- [ ] **RUN-04**: Enforce policy at ingress and sensitive side-effect boundaries, with ACL as a subordinate constraint.
- [ ] **RUN-05**: Preserve canonical domain results, cancellation exceptions, errors and correlation; no generic invented errors.

## Service authorization boundaries

- [ ] **SVC-01**: Link approval holds and settles the current request; preserve URL validation and opener isolation.
- [ ] **SVC-02**: Resource authorization covers each URL, cache hits, redirect destinations and scheme resolvers.
- [ ] **SVC-03**: Network authorization covers actual selected relay/service destinations and inherited domain calls.
- [ ] **SVC-04**: Filesystem/device/upload and other implemented approval paths use the shared mechanism with operation-specific constraints.
- [ ] **SVC-05**: Long-lived subscriptions/handles recheck and revoke authority without leaking data.

## Paja and playground approval flows

- [ ] **HOST-01**: Paja and playground resolve interface approval before execution; required denial blocks launch and optional denial narrows the injected environment.
- [ ] **HOST-02**: Consistent host approval UI exposes requesting identity, operation, scope, lifetime and revocation.
- [ ] **HOST-03**: All host paths including installed intent targets, local development and reloads enforce the same model.
- [ ] **HOST-04**: Network CSP grants are explicit; infrastructure discovery hints never automatically authorize app network access.
- [ ] **HOST-05**: Migrate host callbacks, signer consent, simulation, config and diagnostics without parallel authorization stores.

## Regression audit and shipping

- [ ] **SHIP-01**: All affected package/app consumers, fixtures and examples migrated and traced in consumer matrix.
- [ ] **SHIP-02**: Unit, integration and browser regression coverage proves every acceptance requirement including negative and lifecycle boundaries.
- [ ] **SHIP-03**: README/API/architecture/host guides and compatibility register describe the tested final implementation.
- [ ] **SHIP-04**: Changesets for all shipped package changes, atomic commits, push and open PR with exact spec refs.
- [ ] **SHIP-05**: Build, type-check, full unit, full relevant e2e, docs and configured AI-slop gates pass.

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| FW-01 | 111 | Pending |
| FW-02 | 111 | Pending |
| FW-03 | 111 | Pending |
| FW-04 | 111 | Pending |
| RATE-01 | 111 | Pending |
| RATE-02 | 111 | Pending |
| RUN-01 | 112 | Pending |
| RUN-02 | 112 | Pending |
| RUN-03 | 112 | Pending |
| RUN-04 | 112 | Pending |
| RUN-05 | 112 | Pending |
| SVC-01 | 113 | Pending |
| SVC-02 | 113 | Pending |
| SVC-03 | 113 | Pending |
| SVC-04 | 113 | Pending |
| SVC-05 | 113 | Pending |
| HOST-01 | 114 | Pending |
| HOST-02 | 114 | Pending |
| HOST-03 | 114 | Pending |
| HOST-04 | 114 | Pending |
| HOST-05 | 114 | Pending |
| SHIP-01 | 115 | Pending |
| SHIP-02 | 115 | Pending |
| SHIP-03 | 115 | Pending |
| SHIP-04 | 115 | Pending |
| SHIP-05 | 115 | Pending |
