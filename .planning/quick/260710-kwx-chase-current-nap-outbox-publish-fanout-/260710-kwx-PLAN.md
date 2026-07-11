# Plan: Chase NAP-OUTBOX Publish Fanout

## Goal

Align Kehto with the current NAP-OUTBOX publish contract from `napplet/naps` and the
released `napplet/web` packages: `OutboxPublishOptions` uses `relays`,
`toOutbox`, and `toInboxes`; `targetAuthors` is retired.

## Scope

- Update Kehto OUTBOX service/router types, option sanitization, and publish fanout.
- Pin supported Napplet packages to the current published versions/ranges.
- Update docs and changesets for shipped package metadata/runtime behavior.
- Add regression coverage proving `toOutbox` and required `toInboxes` behavior.

## Verification

- Focused services unit tests while iterating.
- `pnpm install --lockfile-only` after dependency edits.
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- AI-slop gate before push/PR.
