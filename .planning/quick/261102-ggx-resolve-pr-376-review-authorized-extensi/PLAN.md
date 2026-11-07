---
quick_id: 261102-ggx
slug: resolve-pr-376-review-authorized-extensi
date: 2026-11-02
branch: feat/nap-mocks
status: complete
---

# Resolve PR #376 review: authorized extension pushes and relay delivery ownership

## Goal

Address the review comment on kehto/web#376
(`https://github.com/kehto/web/pull/376#issuecomment-6562223057`), which found
two integration defects between `@kehto/mocks` and the real runtime:

1. **Extension pushes are dropped.** `ServiceRuntimeContext.sendToEligibleNapplet`
   only knows the built-in ACL recipient map, so a custom-domain push such as
   `class.assigned` is refused. The mock ignored that boolean, recorded the
   envelope in `mock.sent`, and `assign()` reported success.
2. **Relay fan-out is wrong under a runtime.** The mock suppressed the
   publisher's own subscriptions while the runtime ring buffer also skipped the
   publisher and fanned a second copy (legacy `['EVENT', …]` array, no relay
   scope) to every other window.

## Spec authority

- NAP-CLASS @ `napplet/naps` PR #16 head `4828279800dc`: `class.assigned` is
  shell -> napplet, at most once per lifecycle, no napplet response; the shell
  advertises `nap:class` support. Delivery is gated by the host exposing the
  domain, not by an ACL capability.
- NAP-RELAY @ `napplet/naps` PR #2 head `9f30b3505335`: the shell forwards
  subscriptions to its relay pool and delivers matching events as `relay.event`
  to the subscribing napplet; a relay echoes an accepted publish to every
  matching subscription, including the publisher's own; `relay` scope on a
  subscription targets a single relay.

## Tasks

1. `@kehto/runtime`: add `ServiceHandler.pushCapabilities` (explicit
   shell -> napplet push types for custom domains, recipient capability or
   `null`) and let `sendToEligibleNapplet` honor it under the same gates as the
   inbound extension router (registration, live unblocked source, explicit
   `isDomainAllowed` grant, declared capability). Built-in domains keep the ACL
   recipient map.
2. `@kehto/runtime`: when a registered relay service accepts a publish, it owns
   storage and fan-out; the runtime ring buffer no longer buffers or re-delivers
   that event. Add a `Runtime.handleMessage` regression.
3. `@kehto/mocks`: `pushToWindow` returns the runtime's verdict and records only
   delivered envelopes; `defineMockService` gains `pushes` (emitted as
   `pushCapabilities`); every extension mock that pushes declares its types.
4. `@kehto/mocks` relay: drop sender suppression; deliver fan-out through each
   subscription's own runtime `send` (liveness + `relay:read`), preserving relay
   scope and echoing to the publisher.
5. Regression through the real runtime: `createRuntime` + mocks, two windows,
   scoped and unscoped subscriptions, publish, class assignment, denial paths.
6. Docs (`register-service.md`, runtime README/docs, mocks docs), changesets,
   gates (`pnpm build`, `type-check`, `test:unit`, `docs:check`, aislop), push,
   reply on the PR.

## Out of scope

- The adapter `relayPool` path still fans out from the ring buffer; real relays
  echo too, but changing the non-service path is not part of this review.
- Built-in domains whose pushes have no recipient capability in `@kehto/acl`
  (for example `serial.event`) are now reported as undelivered by the mocks
  instead of silently dropped; adding recipient mappings is a separate ACL task.
