---
phase: 113-service-authorization-boundaries
plan: 15
subsystem: services-gamepad-media-notify
tags: [firewall, approvals, gamepad, media, notify]
dependency_graph:
  requires: [113-02]
  provides: [approved-gamepad-input, approved-media-sessions, approved-notifications]
  affects: [services, paja]
tech_stack:
  added: []
  patterns: [source-generation, immutable-payload, exact-resource-approval]
key_files:
  modified:
    - packages/services/src/gamepad-service.ts
    - packages/services/src/media-service.ts
    - packages/services/src/notify-service.ts
    - packages/services/src/notification-service.ts
    - packages/paja/src/browser-notify.ts
decisions:
  - GAMEPAD has no per-device wire handle; the host-private gamepad:input resource covers the shared reader.
  - Remote notification icons and media artwork are not fetched by these reference hosts without approved NAP-RESOURCE mediation.
  - The older notify.create/list/read registry remains a warned Kehto compatibility path; it is not NAP-NOTIFY wire.
metrics:
  focused_tests: 86
status: complete
---

# Phase 113 Plan 15: Local interaction approvals Summary

GAMEPAD starts its one native reader only after source-bound resource approval and stops it on revoke. MEDIA mutations are restricted to the creating window and the exact session, with OS callbacks removed on revocation. NAP-NOTIFY approves presentation, permission requests, badges, and channels before host effects; Paja binds notification permission to the current verified artifact and suppresses late answers.

## Protocol authority

- NAP-GAMEPAD: merged `napplet/naps` master `19de5ce1cea40cd4c76089cdd8126e9f87648049`; implementation preserves its fire-and-forget subscribe/unsubscribe and blocked-state shapes.
- NAP-MEDIA: draft PR #10 head `7806f438530251fce5129f8e6239d6b642278759`; implementation preserves media session ownership and result/event shapes. Direct remote artwork in `MediaMetadata` is deferred pending NAP-RESOURCE mediation, so the browser bridge omits it.
- NAP-NOTIFY: draft PR #11 head `67877ef6c31ec8acee3125c1d8b4c781010e37dc`; implementation preserves correlated send/permission results and owner-only dismiss. URL-shaped icons are rejected under a bounded reference-host policy; NAP-NOTIFY permits shell validation/rejection of icons.
- NIP-5D: `nostr-protocol/nips` PR #2303 head `5560820fa4f37f45b8ab742a11aeb3001b17dc67` for injected domain availability and source-bound host delivery.
- `createNotificationService` has no owning NAP. Its retained registry is a Kehto compatibility path and remains separate from NAP-NOTIFY.

## Verification

- `pnpm exec vitest run packages/services/src/gamepad-service.test.ts packages/services/src/notify-service.test.ts packages/services/src/notification-service.test.ts packages/paja/src/browser-notify.test.ts` — 44 passed; media service focused suite — 42 passed.
- `pnpm docs:check` is temporarily blocked by concurrent WebRTC source edits and missing generated `@kehto/services` declarations after an interrupted services build. Re-run after the service plans settle.
- The pinned AI-slop scan found no findings in the notification files after the dispatch refactor; remaining cross-plan findings are tracked for Plan 18.

## Migration and release

`FW-GAMEPAD-LEGACY-001`, `FW-NOTIFY-LEGACY-001`, and `FW-NOTIFICATION-LEGACY-001` are registered in `docs/compatibility.md` with warning frequency, canonical tests, and removal prerequisites. `.changeset/notification-gamepad-approvals.md` records changed services and Paja output. The media service change uses the final Phase 113 services changeset.

## Commits

- `865b2f10` GAMEPAD approval and tests.
- `80ac6362` MEDIA cross-window mutation guard; `e7c377b1` MEDIA approval and artwork bound.
- `65a46d1b` NAP-NOTIFY and legacy registry approval; `59e5d276` notification dispatch refactor; `d3fe5ba0` URL-shaped icon rejection.
- `93a726a7` documentation, compatibility, changeset, and warning regressions.
