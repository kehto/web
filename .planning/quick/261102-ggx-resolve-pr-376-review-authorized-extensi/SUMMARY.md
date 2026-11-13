---
quick_id: 261102-ggx
slug: resolve-pr-376-review-authorized-extensi
date: 2026-11-02
branch: feat/nap-mocks
status: complete
---

# Summary — PR #376 review: extension pushes and relay delivery ownership

Resolves `https://github.com/kehto/web/pull/376#issuecomment-6562223057`.

## `@kehto/runtime`

- `ServiceHandler.pushCapabilities`: explicit shell -> napplet push types for a
  domain outside the built-in dispatcher (recipient capability or `null`).
  `ServiceRuntimeContext.sendToEligibleNapplet` honors it under the inbound
  router's gates: registered handler, live unblocked source, explicit
  `isDomainAllowed` grant, declared capability. Built-in domains keep the ACL
  recipient map; `pushCapabilities` cannot widen them.
- A registered `relay` service owns storage and fan-out of accepted publishes;
  the ring buffer no longer re-delivers them (publisher skipped, scope lost,
  duplicate legacy `['EVENT', …]` copies). Adapter-pool publishes unchanged.
- Tests: `service-extensions.test.ts` (push delivery, nine refusal paths,
  built-in guard), `relay-service-delivery.test.ts` (ownership, late subscriber,
  adapter-pool contrast).

## `@kehto/mocks`

- `pushToWindow` returns the runtime verdict and records only delivered
  envelopes; `defineMockService({ pushes })` emits `pushCapabilities`; every
  extension mock that pushes outside a request declares its types (capture,
  class, hashtree, location, mesh, motion, pow, torrent, value, worker).
- Relay mock: no sender suppression; fan-out goes through each subscription's
  own runtime `send` (`pushThrough`), preserving relay scope and echoing to the
  publisher. `MockRelaySubscription.send` added.
- `class.assign()` now truthfully reports a refused push and records nothing.
- Regression through the real runtime:
  `tests/unit/nap-mocks-runtime-delivery.test.ts` (createRuntime + mocks:
  scoped/unscoped subscriptions, publish echo, late subscriber, relay:read
  revocation, class exposure denial, lifecycle reset).

## Spec check

NAP-CLASS @ `napplet/naps` PR #16 head `4828279800dc` and NAP-RELAY @ PR #2
head `9f30b3505335` re-read; both fixes conform (class.assigned once per
lifecycle gated on advertised support; relay.event per matching subscription
with `relay` scope).

## Gates

`pnpm build`, `pnpm type-check`, `pnpm test:unit` (2922 tests), `pnpm docs:check`
green; aislop 94/100 with the branch's pre-existing size warnings only.
