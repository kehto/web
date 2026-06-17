---
"@kehto/runtime": minor
---

feat(runtime): per-instance storage scope via the per-call `scope` wire field

Implements NAP-STORAGE per-instance storage (napplet/naps#3) so multiple open
windows of the *same* napplet (e.g. several Feed windows) keep isolated,
independently-persisted state.

- Every `storage.{get,set,remove,keys}` request now honors an optional
  `scope: "shared" | "instance"` (default `"shared"`). `"instance"` folds a
  stable per-window discriminator (`@i/<windowId>:`) into the storage key; the
  napplet never sees or names an instance id — it sets `scope` and relies on the
  shell's **Unique** (windows never share a namespace) and **Stable** (same
  window resolves to the same namespace across reloads) guarantees.
- `scope: "shared"` (or absent) addresses the napplet-wide `(dTag, aggregateHash)`
  namespace and is **byte-identical to prior behavior**, including the triple-read
  migration path. Existing napplets that never set `scope` are unaffected.
- `storage.keys` with `scope: "shared"` excludes per-instance sub-keys (reserved
  `@i/` marker) so per-window data never leaks into a shared listing; with
  `scope: "instance"` it returns only the calling window's keys. `remove` is
  likewise scoped.
- Per-napplet quota is unchanged: instance sub-keys draw from the same identity
  budget.
- An unrecognized `scope` value is an invalid request and yields a `.result`
  envelope with `error` set.

This is the per-call model from the canonical spec — instancing is a property of
the *data*, not the napplet — and **supersedes** the earlier per-napplet
`SessionEntry.instanceable` capability shape on `feat/instanceable-storage-scope`.
No `SessionEntry` change; `scope` is read off the wire, so kehto is forward-
compatible once the published `@napplet/nap` storage SDK exposes `scope` / the
`storage.instance.*` sugar surface (tracked separately on napplet/web).
