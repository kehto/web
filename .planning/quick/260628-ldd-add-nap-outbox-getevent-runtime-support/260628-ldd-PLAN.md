# Quick Task 260628-ldd: Add NAP-OUTBOX getEvent runtime support

## Scope

Add Kehto runtime support for the NAP-OUTBOX single-event lookup request:

- `outbox.getEvent` -> `outbox.getEvent.result`

Keep this PR limited to OUTBOX. RESOURCE and UPLOAD land in separate PRs.

## Tasks

1. Update `@kehto/services` outbox handling with local `OutboxEventOptions` / `OutboxEventResult` types, request handling, event ID verification, and focused unit tests.
2. Add ACL regression coverage for `outbox.getEvent` request/result handling and update package docs/exports.
3. Add a patch changeset and run focused/full verification before opening the PR.
