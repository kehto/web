---
"@kehto/runtime": minor
---

feat(runtime): per-instance storage scoping driven by a declarative napplet capability

Resolves kehto/web#35. Adds an opt-in, runtime-owned per-window storage scope to
the NAP-STORAGE handler so multiple open windows of the *same* napplet can keep
isolated, independently-persisted state — without the napplet ever learning its
own window id or changing a single storage call.

- `SessionEntry` gains an optional `instanceable?: boolean`. When the runtime has
  elected to instance a napplet (the napplet declares the capability and the host
  agrees), `handleStorageNub` transparently folds a stable per-window discriminator
  (`@i/<windowId>:`) into every storage key for that napplet. The napplet calls
  `storage.get/set/remove/keys` exactly as before — no `scope` argument, no
  reserved prefix, no `windowId` awareness.
- Non-instanceable napplets are **byte-identical to today** (default scope keyed
  per `(dTag, aggregateHash)`); existing `state-handler` tests pass untouched.
- Graceful degrade: if the runtime declines to instance, storage is simply shared
  and the napplet still works unchanged.
- `keys()` is window-scoped for instanceable napplets and never leaks instance
  sub-keys into a shared listing (reserved `@i/` marker).
- `cleanupNappState` already covers instance sub-keys via the shared identity
  prefix; per-instance writes are summed under the napplet's existing quota.

Supersedes the earlier per-call `scope` / reserved-prefix shape per maintainer
feedback (napplet/naps#3): authoring stays trivial and instancing is a runtime
concern. The capability *declaration* placement (manifest / NIP-5A / NAP-CLASS)
is resolved when the `SessionEntry` is built and is tracked upstream in
napplet/naps.
