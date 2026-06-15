---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/services": minor
"@kehto/shell": minor
---

feat: implement NAP-INTENT archetype intent dispatch

Adds shell-side support for NAP-INTENT, which lets a napplet invoke *another*
napplet by its **archetype** (a shared role like `note` or `emoji-list`) without
addressing it directly. The napplet names a role, an action, and an opaque
payload tagged by a NAP-N protocol; the shell resolves the archetype to an
installed handler (honoring the user's default-handler preference), creates or
focuses its window, and delivers the payload. Routing (`archetype`) and payload
format (`protocol`) are orthogonal — the shell owns resolution, default
handling, window lifecycle, and the cross-napplet trust boundary.

- `@kehto/acl`: new `intent:read` / `intent:write` capabilities and `intent.*`
  capability resolution (`invoke` → write; `available`/`handlers` → read;
  `changed`/`*.result`/`*.error` pushes → recipient read).
- `@kehto/runtime`: routes the `intent` domain to a registered `intent` service
  with ACL enforcement; `class-2` excludes `intent:write` (mirrors `relay:write`
  / `outbox:write` — a read-only class can introspect but not dispatch).
- `@kehto/services`: `createIntentService` (pure `intent.*` envelope router with
  `intent.changed` broadcast) and `createCatalogIntentResolver` (concrete
  catalog-backed resolver: archetype→handler resolution, default handling,
  "open with…" chooser, action/protocol validation, and window create/focus).
  The `IntentRequest`/`IntentResult`/`IntentAvailability` value types are defined
  locally (wire-compatible with the upstream draft), as the pinned
  `@napplet/core` predates them.
- `@kehto/shell`: advertises `intent` via `shell.supports("intent")` when an
  available intent dispatcher is wired.
