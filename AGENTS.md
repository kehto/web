# AGENTS.md

This file is the source of truth for agents working in this repo. `CLAUDE.md` is a
symlink to it.

## Agent SDLC

Follow this lifecycle for **every** task. The goal: cohesive, shippable units of work —
no lost changes, no stray commits on the wrong branch, no drift between code, tests,
and docs.

### 0. Orient before you touch anything (dirty-state protocol)

Before the first edit, ALWAYS run `git status`, `git branch --show-current`, and
`git log --oneline -5`. Then:

- **Clean tree, on the default branch** → branch (step 1) and start.
- **Dirty tree or an unexpected branch** → STOP and understand it before doing anything
  else. Read the diff (`git diff`, `git diff --staged`), recent commits, and any
  `.planning/` artifacts to classify what you found:
  - **Interrupted / unfinished execution of a prior task** → finish it FIRST. Recover the
    intent, rectify it, complete it, and ship (or commit) it before starting the new
    prompt. Never pile new work on top of a half-done change or paper over it.
  - **Unrelated WIP that isn't yours** → do not absorb it into your work. Branch off,
    stage only your own files by path, and leave their changes untouched — or
    `git stash push -m "<why>" -- <paths>` and restore them when you're done.
- **Never discard work you didn't create.** No `git reset --hard`, `git checkout -- <path>`,
  branch deletion, or force-push over someone else's changes without explicit
  confirmation. When in doubt, stash (recoverable) rather than discard (gone).

### 1. Branch — never work on the default branch

One descriptive branch per concern, cut off an up-to-date default branch BEFORE the
first edit:

```bash
git checkout main && git pull --ff-only
git checkout -b <type>/<slug>     # feat/… fix/… chore/… release/…
```

If you discover you're already on `main` with uncommitted edits, branch immediately
(`git checkout -b …` carries the changes with you) before committing. Direct pushes to
`main` are blocked — always land work through a PR.

### 2. Pick the workflow by size

| Work                            | Entry point |
|---------------------------------|-------------|
| New feature set / version cycle | `/gsd:new-milestone` → optional `/gsd:discuss-phase` + `/gsd:plan-phase` → `/gsd:autonomous` → `/gsd:ship` |
| Single planned phase            | `/gsd:plan-phase` → `/gsd:execute-phase` → `/gsd:ship` |
| Small fix / doc / ad-hoc        | `/gsd:quick` |
| Investigation / bug             | `/gsd:debug` |

Use `/gsd:discuss-phase` and `/gsd:plan-phase` whenever the work is ambiguous or
multi-step; skip them for trivial changes. Prefer `/gsd:autonomous` for multi-phase
milestones so each phase runs discuss→plan→execute without per-step prompting.

### 3. Commit early and often

- Commit at every green checkpoint — a passing test, a finished sub-step. Many small
  atomic commits beat one big drop.
- Never carry a large uncommitted diff across steps or a context boundary. If you must
  pause, commit WIP (`wip: …`) or stash with a message — **uncommitted work is the only
  work that gets lost.**
- Conventional Commits (`feat(scope): …`). Credit the authoring agent with a
  `Co-Authored-By:` trailer.
- Stage by explicit path. Never `git add -A` / `-u` when unrelated changes are present.

### 4. No drift — code, tests, and docs move together

In the SAME branch/PR as the code change:

- **Tests**: update or add tests for every behavior you change; assert real vectors, not
  invented values. Keep `pnpm test:unit` green; run `pnpm test:e2e` when you touch the
  playground, shell wiring, or anything the Playwright specs cover.
- **Docs**: update every README, `docs/*`, and package doc that references what you
  changed. The docs gate (`pnpm docs:check`) requires a full doc set per `@kehto/*`
  package and runs typedoc with `--treatWarningsAsErrors`, so re-export every referenced
  type. Grep for stale strings (versions, kinds, exports, option names) before
  committing: `grep -rn "<old>" --include=*.md --include=*.ts .`
- **AI-slop gate**: after each iteration, re-run the slop gate and restore it to passing
  (target 100/100) before shipping. `.aislop/config.yml` is pinned; a new rule disable
  needs a documented, justified reason. Re-assess it after later edits — not just once.

#### NAP / NIP-5D conformance guardrails

When a NAP interface changes, or when shell/runtime code starts accepting a new NAP
message field, finish the full kehto wiring in the same change. Do not stop at the
first package that compiles.

- Treat `@napplet/nap/*/types` as the canonical wire contract. Compare the new/changed
  message field against kehto runtime handlers, shell/playground adapters, reference
  services, ACL/capability mapping, docs, and tests.
- For NAP-RELAY subscribe fields, update all relay subscribe surfaces together:
  `packages/runtime/src/relay-handler.ts`, `packages/services/src/relay-pool-service.ts`,
  `packages/services/src/coordinated-relay.ts`, `apps/playground/src/playground-relay-service.ts`,
  and the matching unit/static guards in `tests/unit/nip5d-conformance-guard.test.ts`,
  `packages/services/src/*relay*.test.ts`, and `tests/unit/playground-relay-service.test.ts`.
- If the shell or playground adds support for a NAP field, add a guard that proves the
  reference service implementation consumes the same field. Example: an explicit
  `relay.subscribe` relay hint must bypass relay selection in runtime fallback,
  `createRelayPoolService`, `createCoordinatedRelay`, and the playground relay service.
- If a canonical NAP message gains a field that is intentionally ignored by a kehto
  surface, document that decision in the nearby test or source comment. Silent omission
  is treated as drift.
- NIP-5D loader and napplet-demo exceptions stay under `tests/unit/nip5d-conformance-guard.test.ts`;
  add allowlist rows there only with matching policy text in `docs/policies/NIP-5D-CONFORMANCE.md`.

### 5. Definition of done = shipped, without being asked

"Done" is an open PR, not "code written." Run the whole chain yourself before reporting
back — **do not wait to be told to push or open a PR**:

1. `pnpm build` green
2. `pnpm type-check` green
3. `pnpm test:unit` green (tests updated per step 4)
4. docs / READMEs synced (`pnpm docs:check` if docs changed)
5. AI-slop gate passing
6. atomic commits made
7. `git push -u origin <branch>`
8. `gh pr create` with a clear body: what, why, any surfaced decision, verification
   output, and out-of-scope notes.

`/gsd:ship` performs steps 6–8 (PR + review) inside a GSD flow. Outward-facing actions
(push, PR, publish) are authorized as the closing step of the task you were given — you
do not need a second prompt for them. Stage by path so the PR never sweeps in unrelated
dirty files left in the tree.

### 6. Releases (changesets)

Publishing runs from GitHub Actions — the `release.yml` workflow is **tag-triggered**
(`v*` tags, plus manual `workflow_dispatch`), not push-to-`main`. It publishes to **npm
and JSR** in one run (both via OIDC, no tokens). Do not `pnpm publish-packages` locally.

1. Add a changeset for each package whose **shipped output** changed. A test- or
   comment-only change ships nothing — do not bump it. On 0.x, a breaking change is a
   `minor` bump.
2. `pnpm version-packages` (bumps `package.json`, writes `CHANGELOG.md`). The release
   workflow re-syncs each `jsr.json#version` from its `package.json` before the JSR
   publish (`scripts/sync-jsr-versions.mjs`), so you don't bump `jsr.json` by hand.
3. Commit, push, open the release PR; merge it, then push the `v*` tag. The tag fires
   `release.yml`, which re-validates build + type-check + unit + e2e, then runs
   `changeset publish` (npm) followed by `npx jsr publish` for every `packages/*`
   (topological order). Already-published versions are skipped on both registries.
4. Every `@kehto/*` package needs an OIDC Trusted Publisher registered on npm **and** a
   JSR package linked to `kehto/web` under the `@kehto` scope, or that registry's publish
   404s. Confirm new packages are registered on both before relying on the automated
   publish.

## Project Overview

This is the **kehto** monorepo — runtime packages for the napplet protocol. Kehto provides the server-side (shell) runtime that hosts napplet sandboxed iframe apps, including the protocol engine, ACL enforcement, service handlers, and browser adapter.

Extracted from [@napplet](https://github.com/sandwichfarm/napplet) (v0.13.0 milestone). The @napplet repo retains the portable SDK packages (core, shim, sdk, vite-plugin); this repo contains the runtime and shell implementation.

## Packages

- `packages/acl` — **@kehto/acl** — Pure ACL module (zero deps, WASM-ready)
- `packages/runtime` — **@kehto/runtime** — Protocol engine (message dispatch, AUTH, subscription lifecycle)
- `packages/shell` — **@kehto/shell** — Browser adapter (ShellBridge, signer proxy, storage proxy)
- `packages/services` — **@kehto/services** — Reference service handlers (audio, notifications)
- `packages/firewall` — **@kehto/firewall** — Pure firewall-policy module + runtime gate
- `packages/nip` — **@kehto/nip** — NIP-5A/5D resolver (content-addressed napplet resolution)
- `packages/wm` — **@kehto/wm** — Window-manager primitives for the shell

## Tech Stack

- **TypeScript** (strict, ESM-only)
- **tsup** for building each package
- **turborepo** for monorepo orchestration
- **pnpm** workspaces
- **changesets** for versioning and publishing
- **@napplet/core** as peer dependency (protocol types and constants)
- **nostr-tools** as peer dependency (shell package)

## Build & Test

```bash
pnpm install
pnpm build          # Build all via turborepo
pnpm type-check     # TypeScript validation
pnpm test:unit      # vitest unit suite
pnpm test:e2e       # Playwright e2e (builds first; CI runs workers=1)
```

## Publishing

Publishing runs from GitHub Actions on a `v*` tag (`release.yml`), not from local
`pnpm publish-packages`. One tagged run publishes to **npm** (`changeset publish`) and
**JSR** (`npx jsr publish` per `packages/*`), both via OIDC. Prepare release metadata
locally, then push the tag and let the workflow publish:

```bash
pnpm version-packages
```

## Relationship to @napplet

- This repo contains the **runtime/shell implementation** packages
- @napplet contains the **portable SDK** (core, shim, sdk, vite-plugin)
- @napplet/core is this repo's foundational dependency (protocol types, constants, message definitions)
- Napplets are wire-only coupled (NIP-5D JSON envelope), so the two repos version independently
- Both repos follow identical code conventions and monorepo tooling

## Code Conventions

- ESM-only (no CJS output)
- Zero framework dependencies (no Svelte, React, etc.)
- All public API exports have JSDoc with @param, @returns, @example
- 2-space indentation
- TypeScript strict mode with verbatimModuleSyntax
- File naming: lowercase with hyphens (acl-store.ts, storage-proxy.ts)
- PascalCase for interfaces/types, camelCase for functions/variables
- UPPER_SNAKE_CASE for constants

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
