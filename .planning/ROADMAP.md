# Roadmap: v1.31 Firewall approvals

All five phases are required. Package-only delivery does not satisfy the goal. Phases 108–110 are reserved for the independent rebrand PR #296. Existing phase history stays intact.

## Phase 111: Policy core and independent rate limits

**Requirements:** FW-01, FW-02, FW-03, FW-04, RATE-01, RATE-02
**Depends on:** Spec and consumer audit
**Status:** Pending

**Success criteria:**
- Pure typed approvals for interface, resource, network, and explicitly registered future categories.
- Verified manifest/publisher/artifact principals; explicit isolated development principals.
- Deterministic allow/deny/ask precedence, composed scopes, once/session/persistent lifetimes.
- Versioned grants, strict validation, migrations, revocation and visible storage failure behavior.
- Independent temporal module for token buckets, bursts, focus budgets, and prompt limits.
- Permission approval cannot bypass rate controls; classify content matchers separately.

## Phase 112: Runtime approval lifecycle

**Requirements:** RUN-01, RUN-02, RUN-03, RUN-04, RUN-05
**Depends on:** 111
**Status:** Pending

**Success criteria:**
- Bound pending requests and equivalent prompts; preserve one-use semantics during concurrency.
- Revalidate endpoint generation, identity, exact request and current policy before execution.
- Cancel on teardown/replacement/revocation and settle/execute at most once.
- Enforce policy at ingress and sensitive side-effect boundaries, with ACL as a subordinate constraint.
- Preserve canonical domain results, cancellation exceptions, errors and correlation; no generic invented errors.

## Phase 113: Service authorization boundaries

**Requirements:** SVC-01, SVC-02, SVC-03, SVC-04, SVC-05
**Depends on:** 112
**Status:** Pending

**Success criteria:**
- Link approval holds and settles the current request; preserve URL validation and opener isolation.
- Resource authorization covers each URL, cache hits, redirect destinations and scheme resolvers.
- Network authorization covers actual selected relay/service destinations and inherited domain calls.
- Filesystem/device/upload and other implemented approval paths use the shared mechanism with operation-specific constraints.
- Long-lived subscriptions/handles recheck and revoke authority without leaking data.

## Phase 114: Paja and playground approval flows

**Requirements:** HOST-01, HOST-02, HOST-03, HOST-04, HOST-05
**Depends on:** 113
**Status:** Pending

**Success criteria:**
- Paja and playground resolve interface approval before execution; required denial blocks launch and optional denial narrows the injected environment.
- Consistent host approval UI exposes requesting identity, operation, scope, lifetime and revocation.
- All host paths including installed intent targets, local development and reloads enforce the same model.
- Network CSP grants are explicit; infrastructure discovery hints never automatically authorize app network access.
- Migrate host callbacks, signer consent, simulation, config and diagnostics without parallel authorization stores.

## Phase 115: Regression audit and shipping

**Requirements:** SHIP-01, SHIP-02, SHIP-03, SHIP-04, SHIP-05
**Depends on:** 114
**Status:** Pending

**Success criteria:**
- All affected package/app consumers, fixtures and examples migrated and traced in consumer matrix.
- Unit, integration and browser regression coverage proves every acceptance requirement including negative and lifecycle boundaries.
- README/API/architecture/host guides and compatibility register describe the tested final implementation.
- Changesets for all shipped package changes, atomic commits, push and open PR with exact spec refs.
- Build, type-check, full unit, full relevant e2e, docs and configured AI-slop gates pass.

