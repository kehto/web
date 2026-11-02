---
name: maintain-nap-mocks
description: Use when an agent must keep @kehto/mocks in sync with napplet/naps — auditing recorded spec refs against master and open PR heads, adding a mock for a new NAP document, updating a mock after a draft changes, retiring a mock when a PR closes, and shipping the change with tests, docs, changeset, and PR.
---

# Maintain the NAP mocks

`packages/mocks` mirrors every NAP document in `napplet/naps`: the merged
`naps/*.md` on `master` and every document added by an open pull request.
Each mock records the exact head it was written against in a `*_SPEC_REF`
literal; `MOCK_NAP_REGISTRY` lists them; `src/registry.test.ts` pins the
inventory. This skill is the loop that keeps those three in agreement with
upstream.

## Rules you cannot skip

1. The NAP document is the authority — not `@napplet/nap` types, not the
   existing kehto service, not the previous mock. Read it before editing.
2. Record the ref you read: `source`, `pr`, `sha` (12 hex), `path`. Cite PRs by
   number and sha only. Never write upstream branch names into this repo (the
   vocabulary guard in `tests/unit/no-legacy-vocabulary.test.ts` rejects some).
3. Transfer-oriented domains (torrent, nzb, soulseek, resource, upload, fs,
   blossom, hashtree, git) only ever model Linux distribution images from
   `src/fixtures/linux-distros.ts`.
4. Deterministic only: `rng`, `mockHex`, `clock.now()`, injected `scheduler`.
   No `Math.random`, `Date.now()`, network, or DOM.
5. Every exported symbol gets JSDoc with `@example`; every referenced type is
   exported (typedoc runs with `--treatWarningsAsErrors`).
6. Follow the repo SDLC (`AGENTS.md`): branch, atomic commits, tests + docs in
   the same PR, changeset for `@kehto/mocks`, PR opened.

## Step 1 — Audit

```bash
pnpm --filter @kehto/mocks audit:naps          # needs `gh` auth
pnpm --filter @kehto/mocks audit:naps -- --json
```

The report has four buckets:

| Bucket | Meaning | Action |
|--------|---------|--------|
| `current` | Recorded sha matches the live head. | None. |
| `stale` | The PR head (or master) moved since the mock was written. | Step 3. |
| `retired` | The PR closed, or the document left master. | Step 4. |
| `missing` | A NAP document exists upstream with no mock. | Step 2. |

`--strict` exits non-zero when any bucket but `current` is non-empty; wire it
into a scheduled job if you want drift surfaced automatically.

## Step 2 — Add a mock for a new NAP

1. Fetch the document at its head and read it fully:
   ```bash
   gh pr view <N> -R napplet/naps --json headRefOid,title,isDraft
   gh api repos/napplet/naps/contents/naps/NAP-<X>.md?ref=<sha> --jq .content | base64 -d
   ```
2. Decide the kind:
   - `service` — only for domains the runtime's built-in dispatcher routes to
     `serviceRegistry[domain]` (`packages/runtime/src/domain-handlers.ts`,
     `relay-handler.ts`, `identity-handler.ts`, `count-handler.ts`). Adding a
     new built-in domain is runtime work, not mock work.
   - `extension` — every other wire domain. `defineMockService` publishes each
     route in `messageCapabilities` with `null`; map a route to an existing ACL
     capability only when the NAP says it reuses one. Every shell -> napplet
     push the mock emits outside a request (`pushToWindow`) must be listed in
     `pushes` (published as `pushCapabilities`), or the runtime refuses it and
     `pushToWindow` returns `false`. Live subscription events that belong to an
     earlier request go through that request's `send` with `pushThrough`.
   - `adapter` / `runtime-owned` / `posture` — no factory; export the spec ref,
     an entry with a `note`, and any helper the shell needs.
3. Create `src/domains/<domain>.ts` from the template below and
   `src/domains/<domain>.test.ts` (see `src/domains/link.test.ts` for a
   compact example; `src/core/handler.test.ts` shows the scheduler pattern).
4. Register it in `src/domains/index.ts` (import the `<UPPER>_MOCK_ENTRY`, add
   an `export *` line, append the entry to `DOMAIN_ENTRIES`) and add the row to
   `INVENTORY` in `src/registry.test.ts`. Social domains that read Nostr data
   take `store`/`user` options and belong in `MOCK_SOCIAL_DOMAINS`
   (`src/registry.ts`) so `createMockNapEnvironment` shares one store.
5. Document it: regenerate the domain tables in `docs/packages/mocks.md` and
   `packages/mocks/README.md`:
   ```bash
   pnpm --filter @kehto/mocks build && pnpm --filter @kehto/mocks docs:table
   ```
   (`node scripts/render-domain-table.mjs --check` fails when they are stale.)
   Keep notes free of raw `<placeholder>` text — VitePress parses it as HTML.

Template:

```ts
/**
 * domains/<domain>.ts — Mock NAP-<X> service.
 *
 * Spec: naps/NAP-<X>.md @ napplet/naps PR #<N> head <sha> (draft)
 * Routes: <domain>.a, <domain>.b
 * Spec gaps / decisions: <what was ambiguous and what you chose>
 */
import { defineMockService } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

export const <UPPER>_SPEC_REF: NapSpecRef = { nap: 'NAP-<X>', status: 'draft', source: 'pr', pr: <N>, sha: '<12-hex>', path: 'naps/NAP-<X>.md' };
export interface Mock<Pascal>State { /* … */ }
export interface Mock<Pascal>Options extends MockServiceOptions { /* seeds */ }
export type Mock<Pascal>Service = MockService<Mock<Pascal>State> & { /* controls */ };
export function createMock<Pascal>Service(options: Mock<Pascal>Options = {}): Mock<Pascal>Service { /* defineMockService(...) */ }
export const <UPPER>_MOCK_ENTRY: MockDomainEntry = { domain: '<domain>', kind: 'extension', spec: <UPPER>_SPEC_REF, create: (o) => createMock<Pascal>Service(o) };
```

## Step 3 — Update a stale mock

1. Diff the document between the recorded sha and the live head:
   ```bash
   gh api repos/napplet/naps/compare/<recorded>...<live> --jq '.files[] | select(.filename=="naps/NAP-<X>.md") | .patch'
   ```
2. For each changed message, field, error, or lifecycle rule: update the route,
   the state, and the test vector together. Add negative tests when a field or
   message is retired.
3. Bump `sha` in `<UPPER>_SPEC_REF`, update the header comment, and note any
   new spec gap decision there.
4. If the change is only editorial, bump the sha and say so in the commit.

## Step 4 — Retire or promote

- **PR merged**: the document now lives on master. Change the ref to
  `{ status: 'merged', source: 'master', sha: <master sha>, path }`, drop `pr`,
  re-read the merged text (merge may differ from the last head), and update
  `INVENTORY` (`'master'` instead of the PR number).
- **PR closed without merge**: keep the mock only if the user wants it. If it
  goes, delete the module, its index/registry/test/doc rows, and record the
  removal in the changeset.
- **Superseded draft** (a newer PR replaces an older one for the same domain):
  point the ref at the newer PR and note the older one in the header.

## Step 5 — Ship

```bash
pnpm --filter @kehto/mocks type-check
npx vitest run packages/mocks
pnpm build && pnpm type-check && pnpm test:unit
pnpm docs:check            # docs/packages/mocks.md row + typedoc
```

Add `.changeset/<slug>.md` for `@kehto/mocks` (`patch` for a ref bump or
fixture tweak, `minor` for a new or removed domain), commit atomically, push,
and open the PR. The PR body must state which `napplet/naps` refs were checked
and whether each mock is conformant, intentionally deferred (spec gap), or
blocked by upstream drift.

## Pitfalls

- `nap 0.32.0` types may lag a draft; prefer the document, note the drift in
  the header, and do not widen the mock to satisfy stale types.
- Changing a route key changes `messageCapabilities` for extension kinds — the
  registry test asserts the two stay equal. Push types live in `pushes`, must
  belong to the domain, and must not double as routes.
- `pushToWindow` returns the runtime's verdict; never treat a push as sent when
  it returns `false`, and keep state (assignments, cursors) unchanged on refusal.
- Do not reach into another domain's state. Shared data belongs in
  `src/fixtures/`.
- Files stay under 700 lines and functions under 150 (the aislop gate); split
  fixtures into `<domain>-fixtures.ts` when a catalog grows.
