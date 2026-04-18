# Phase 22 Iteration Log — Docs Refresh & Release Rehearsal

**Phase:** 22-docs-refresh-release-rehearsal
**Requirements covered:** DOCS-01..03, REL-01..04, E2E-10, E2E-11 (closed here)
**Cross-cutting gate:** E2E-11 (build → run → Playwright → fix loop)
**Started:** 2026-04-18T12:21:58Z

---

## REL-01 — publint

**Command:** `pnpm dlx publint packages/<pkg>` for each of acl / runtime / shell / services
**Executed:** 2026-04-18T12:22:38Z
**Tool version:** publint v0.3.18

### @kehto/acl

```
Running publint v0.3.18 for @kehto/acl...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0

### @kehto/runtime

```
Running publint v0.3.18 for @kehto/runtime...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0

### @kehto/shell

```
Running publint v0.3.18 for @kehto/shell...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0

### @kehto/services

```
Running publint v0.3.18 for @kehto/services...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0

### Combined for-loop verification

```
Running publint v0.3.18 for @kehto/acl...
Packing files with `pnpm pack`...
Linting...
All good!
EXIT[acl]=0
Running publint v0.3.18 for @kehto/runtime...
Packing files with `pnpm pack`...
Linting...
All good!
EXIT[runtime]=0
Running publint v0.3.18 for @kehto/shell...
Packing files with `pnpm pack`...
Linting...
All good!
EXIT[shell]=0
Running publint v0.3.18 for @kehto/services...
Packing files with `pnpm pack`...
Linting...
All good!
EXIT[services]=0
```

### Findings + Fixes

No findings — all 4 packages clean on first pass. Each @kehto/* package.json already conforms to the canonical ESM-only shape documented in the plan (`type: module`, `exports` map with `types` before `import`, `files: ["dist"]`, `sideEffects: false`, `publishConfig.access: public`, `repository` + `keywords` present). No package.json modifications required.

### REL-01 Status

**CLOSED — publint clean on all 4 @kehto/* packages.**

---

## REL-02 — attw (@arethetypeswrong/cli --profile esm-only)

**Command:** `pnpm dlx @arethetypeswrong/cli --profile esm-only --pack packages/<pkg>` for each of acl / runtime / shell / services
**Executed:** 2026-04-18T12:23:54Z
**Flag discretion (W1):** `--pack` included — attw runs `npm pack` on each directory and checks the packed tarball (mirrors real-publish semantics). D-04 only mandates `--profile esm-only`; `--pack` is Claude's-discretion choice for higher-fidelity rehearsal.

### @kehto/acl

```
@kehto/acl v0.1.0

Build tools:
- typescript@^5.9.3
- tsup@^8.5.0

 (ignoring resolutions: 'node10', 'node16-cjs')

(ignored per resolution) ⚠️ A require call resolved to an ESM JavaScript file, which is an error in Node and some bundlers. CommonJS consumers will need to use a dynamic import. https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md


┌───────────────────┬────────────────────────────────────────┐
│                   │ "@kehto/acl"                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from ESM) │ 🟢 (ESM)                               │
├───────────────────┼────────────────────────────────────────┤
│ bundler           │ 🟢                                     │
├───────────────────┼────────────────────────────────────────┤
│ node10            │ (ignored) 🟢                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from CJS) │ (ignored) ⚠️ ESM (dynamic import only) │
└───────────────────┴────────────────────────────────────────┘
```
Exit code: 0

### @kehto/runtime

```
@kehto/runtime v0.1.0

Build tools:
- typescript@^5.9.3
- tsup@^8.5.0

 (ignoring resolutions: 'node10', 'node16-cjs')

(ignored per resolution) ⚠️ A require call resolved to an ESM JavaScript file, which is an error in Node and some bundlers. CommonJS consumers will need to use a dynamic import. https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md


┌───────────────────┬────────────────────────────────────────┐
│                   │ "@kehto/runtime"                       │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from ESM) │ 🟢 (ESM)                               │
├───────────────────┼────────────────────────────────────────┤
│ bundler           │ 🟢                                     │
├───────────────────┼────────────────────────────────────────┤
│ node10            │ (ignored) 🟢                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from CJS) │ (ignored) ⚠️ ESM (dynamic import only) │
└───────────────────┴────────────────────────────────────────┘
```
Exit code: 0

### @kehto/shell

```
@kehto/shell v0.1.0

Build tools:
- typescript@^5.9.3
- tsup@^8.5.0

 (ignoring resolutions: 'node10', 'node16-cjs')

(ignored per resolution) ⚠️ A require call resolved to an ESM JavaScript file, which is an error in Node and some bundlers. CommonJS consumers will need to use a dynamic import. https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md


┌───────────────────┬────────────────────────────────────────┐
│                   │ "@kehto/shell"                         │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from ESM) │ 🟢 (ESM)                               │
├───────────────────┼────────────────────────────────────────┤
│ bundler           │ 🟢                                     │
├───────────────────┼────────────────────────────────────────┤
│ node10            │ (ignored) 🟢                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from CJS) │ (ignored) ⚠️ ESM (dynamic import only) │
└───────────────────┴────────────────────────────────────────┘
```
Exit code: 0

### @kehto/services

```
@kehto/services v0.1.0

Build tools:
- typescript@^5.9.3
- tsup@^8.5.0

 (ignoring resolutions: 'node10', 'node16-cjs')

(ignored per resolution) ⚠️ A require call resolved to an ESM JavaScript file, which is an error in Node and some bundlers. CommonJS consumers will need to use a dynamic import. https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md


┌───────────────────┬────────────────────────────────────────┐
│                   │ "@kehto/services"                      │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from ESM) │ 🟢 (ESM)                               │
├───────────────────┼────────────────────────────────────────┤
│ bundler           │ 🟢                                     │
├───────────────────┼────────────────────────────────────────┤
│ node10            │ (ignored) 🟢                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from CJS) │ (ignored) ⚠️ ESM (dynamic import only) │
└───────────────────┴────────────────────────────────────────┘
```
Exit code: 0

### Combined for-loop verification

```
EXIT[acl]=0
EXIT[runtime]=0
EXIT[shell]=0
EXIT[services]=0
```

### Findings + Fixes

No findings — all 4 packages ESM-only clean on first pass. All three relevant resolutions are green:

- `node16 (from ESM)` 🟢 — Node 16 ESM consumers resolve the types + JS entry correctly.
- `bundler` 🟢 — Bundler-aware consumers (Vite, Webpack, Rollup, esbuild) resolve the exports map cleanly.
- `node10` (ignored) 🟢 — Legacy Node 10 resolution would also succeed, informational only (ignored by `--profile esm-only`).

The `node16 (from CJS)` row shows `(ignored) ⚠️ ESM (dynamic import only)` which is **expected and correct for an ESM-only package**: CommonJS consumers must use `await import()` rather than `require()`. The `--profile esm-only` switch explicitly suppresses this resolution because it is out-of-contract for ESM-only packages (the "ignoring resolutions: 'node10', 'node16-cjs'" line confirms the profile filter is active). Not a finding, not a fix — this is the by-design behavior.

No package.json modifications required.

### Post-attw publint regression spot-check

To confirm no regression (per acceptance criterion), re-ran publint on `@kehto/acl` after attw (spot re-check, 1 package suffices since no package.json changes were made):

```
Running publint v0.3.18 for @kehto/acl...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0 — no regression.

### REL-02 Status

**CLOSED — attw `--profile esm-only` clean on all 4 @kehto/* packages.**

---

## REL-03 — changeset version dry-run

**Command:** `pnpm changeset version && pnpm install --frozen-lockfile` on throwaway branch
**Branch:** `gsd/release-rehearsal-v1.3` (created, exercised, deleted within this plan)
**Executed:** 2026-04-18T13:10:12Z

### Pre-rehearsal state

```
main HEAD before: ad5357cc96f34eeaf87773201f4808ac86f76c06
Branch: main

@kehto/acl: 0.1.0
@kehto/runtime: 0.1.0
@kehto/shell: 0.1.0
@kehto/services: 0.1.0
```

Throwaway branch `gsd/release-rehearsal-v1.3` did not pre-exist (`git branch --list gsd/release-rehearsal-v1.3` empty). Staged changesets: `.changeset/v1-2-acl.md`, `v1-2-runtime.md`, `v1-2-shell.md`, `v1-2-services.md` (all `minor`).

### changeset version output

```
🦋  All files have been updated. Review them and commit at your leisure
```
Exit code: 0

### pnpm install --frozen-lockfile output

```
Scope: all 21 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date

Done in 545ms using pnpm v10.8.0
```
Exit code: 0

No lockfile drift — `pnpm-lock.yaml` unchanged by version bumps (expected: bumps mutate only `version` fields, not the dependency tree structure).

### Post-bump versions

| Package | Before | After | Bump |
|---------|--------|-------|------|
| @kehto/acl | 0.1.0 | 0.2.0 | minor |
| @kehto/runtime | 0.1.0 | 0.2.0 | minor |
| @kehto/shell | 0.1.0 | 0.2.0 | minor |
| @kehto/services | 0.1.0 | 0.2.0 | minor |

Internal-dep fan-out (via `updateInternalDependencies: patch` in `.changeset/config.json`):

| Package | Before | After | Bump |
|---------|--------|-------|------|
| @kehto/demo (private) | 0.0.0 | 0.0.1 | patch |
| @test/harness (private) | 0.0.0 | 0.0.1 | patch |

Both are `"private": true` in their `package.json`; they bump but are excluded from any future `changeset publish`.

### Peer-dependency audit

Captured verbatim from the throwaway branch post-bump:

```
[acl] peerDependencies:
{
  "@napplet/core": "^0.2.0",
  "@napplet/nub-identity": "^0.2.0",
  "@napplet/nub-ifc": "^0.2.0",
  "@napplet/nub-keys": "^0.2.0",
  "@napplet/nub-media": "^0.2.0",
  "@napplet/nub-notify": "^0.2.0",
  "@napplet/nub-relay": "^0.2.0",
  "@napplet/nub-storage": "^0.2.0",
  "@napplet/nub-theme": "^0.2.0"
}
[runtime] peerDependencies:
{
  "@napplet/core": "^0.2.0",
  "@napplet/nub-identity": "^0.2.0",
  "@napplet/nub-ifc": "^0.2.0",
  "@napplet/nub-keys": "^0.2.0",
  "@napplet/nub-media": "^0.2.0",
  "@napplet/nub-notify": "^0.2.0",
  "@napplet/nub-relay": "^0.2.0",
  "@napplet/nub-storage": "^0.2.0",
  "@napplet/nub-theme": "^0.2.0"
}
[shell] peerDependencies:
{
  "@napplet/core": "^0.2.0",
  "@napplet/nub-identity": "^0.2.0",
  "@napplet/nub-ifc": "^0.2.0",
  "@napplet/nub-keys": "^0.2.0",
  "@napplet/nub-media": "^0.2.0",
  "@napplet/nub-notify": "^0.2.0",
  "@napplet/nub-relay": "^0.2.0",
  "@napplet/nub-storage": "^0.2.0",
  "@napplet/nub-theme": "^0.2.0",
  "nostr-tools": ">=2.23.3 <3.0.0"
}
[services] peerDependencies:
{
  "@napplet/core": "^0.2.0",
  "@napplet/nub-identity": "^0.2.0",
  "@napplet/nub-ifc": "^0.2.0",
  "@napplet/nub-keys": "^0.2.0",
  "@napplet/nub-media": "^0.2.0",
  "@napplet/nub-notify": "^0.2.0",
  "@napplet/nub-relay": "^0.2.0",
  "@napplet/nub-storage": "^0.2.0",
  "@napplet/nub-theme": "^0.2.0"
}
```

**Assertion:** `@napplet/core` peer-dep range is `^0.2.0` in all 4 packages post-bump (identical to pre-bump — direct `git show main:packages/<pkg>/package.json` comparison confirms unchanged). All `@napplet/nub-*` ranges remain `^0.2.0`. `nostr-tools` range in `@kehto/shell` unchanged. **No unexpected peer-dep range changes.**

(The CHANGELOG bodies contain prose like "@napplet/core bumped from >=0.1.0 to ^0.2.0" — that is documentation of the historical v1.1→v1.2 peer-dep bump from the original changeset body, not a new mutation applied by this `changeset version` run.)

### Full diff

```diff
=== DIFF AGAINST main ===
diff --git a/.changeset/v1-2-acl.md b/.changeset/v1-2-acl.md
deleted file mode 100644
index b588064..0000000
--- a/.changeset/v1-2-acl.md
+++ /dev/null
@@ -1,13 +0,0 @@
----
-"@kehto/acl": minor
----
-
-ACL full 8-domain coverage. `resolveCapabilitiesNub` now maps capabilities for identity, ifc, keys, media, notify, relay, storage, theme. Signer domain removed (getPublicKey/getRelays moved to identity; signEvent/nip04/nip44 are shell-mediated via relay.publish/publishEncrypted). New capability constants: identity:read, keys:bind, keys:forward, media:control, notify:send, notify:channel, theme:read.
-
-**Breaking changes:**
-- Removed capability constants: sign:event, sign:nip04, sign:nip44
-- Removed `resolveCapabilitiesNub` case 'signer'
-
-**Peer deps:**
-- @napplet/core bumped from >=0.1.0 to ^0.2.0
-- Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)
diff --git a/.changeset/v1-2-runtime.md b/.changeset/v1-2-runtime.md
deleted file mode 100644
index 9d3e262..0000000
--- a/.changeset/v1-2-runtime.md
+++ /dev/null
@@ -1,17 +0,0 @@
----
-"@kehto/runtime": minor
----
-
-NIP-5D 8-nub dispatch and shell-mediated signing. Runtime now uses `createDispatch()` + `registerNub()` from `@napplet/core` instead of a hand-rolled 8-case switch. All eight nub domains (identity, ifc, keys, media, notify, relay, storage, theme) are registered through `registerNub()` adapters at runtime startup. The `signer` domain is deleted; `relay.publishEncrypted` is now the canonical NIP-44 path and synthesizes a `relay.publish` into the registered relay service after shell-side encryption. ifc channel sub-protocol routed via per-runtime registry; `ifc.subscribe` emits the canonical `subscribe.result` envelope. `theme` dispatch added with a fallback default theme envelope so napplets without a registered theme service still get spec-correct replies.
-
-**Breaking changes:**
-- Removed `case 'signer'` and all signer.* dispatch paths
-- Removed the hand-rolled domain switch in `runtime.ts`; inbound routing delegates to `dispatch()`
-- `storage.clear` no longer dispatched (not in `@napplet/nub-storage`); internal cleanup helper retained for lifecycle use only
-
-**Peer deps:**
-- @napplet/core bumped from >=0.1.0 to ^0.2.0
-- Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)
-
-**Known carry-over:**
-- `packages/runtime/src/core-compat.ts` is retained as a v1.2-deviation compat shim (DRIFT-CORE-06) to re-export legacy @napplet/core symbols (Capability, BusKind, ALL_CAPABILITIES, DESTRUCTIVE_KINDS, REPLAY_WINDOW_SECONDS, TOPICS.STATE_*, AUTH_KIND, SHELL_BRIDGE_URI, PROTOCOL_VERSION, ServiceDescriptor) removed in @napplet/core v0.2.0. Slated for deletion once @napplet/core restores those exports or consumers migrate.
diff --git a/.changeset/v1-2-services.md b/.changeset/v1-2-services.md
deleted file mode 100644
index d1b51d7..0000000
--- a/.changeset/v1-2-services.md
+++ /dev/null
@@ -1,15 +0,0 @@
----
-"@kehto/services": minor
----
-
-Reference services realigned to the 8-nub protocol. `signer-service` is deleted; its responsibilities are split into a new `identity-service` (read-only `getPublicKey` / `getRelays` / `getProfile` / `getFollows` / `getList` / `getZaps` / `getMutes` / `getBlocked` / `getBadges`) and shell-mediated signing/encryption inside `relay.publish` / `relay.publishEncrypted`. New reference handlers added for the other four new nub domains: `keys-service` (keyboard actions — bindings/register/forward), `media-service` (MediaSession create/update/destroy + controls), `notify-service` (send/permission/channel register/dismiss/badge), and `theme-service` (get/changed broadcast with `publishTheme`/`getCurrentTheme` host-facing bundle). Legacy `audio-service` and `notification-service` remain for ifc-emit topics and coexist with the new NIP-5D envelope handlers.
-
-**Breaking changes:**
-- `signer-service` REMOVED. Napplets and hosts depending on `registerService('signer', ...)` must either register an `identity` service or remove the call; signing/encryption happens inside the shell via relay publishes.
-
-**Migration note:**
-- `tests/unit/shell-runtime-integration.test.ts` was removed in v1.2 — its v1.1 BusKind / signer.* assertions no longer apply to the 8-nub protocol model. Equivalent coverage is provided by the per-package integration tests added in v1.2 Phases 12-03 (identity), 12-04 (ifc), 12-08 (relay publishEncrypted), and 12-09 (storage).
-
-**Peer deps:**
-- @napplet/core bumped from >=0.1.0 to ^0.2.0
-- Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)
diff --git a/.changeset/v1-2-shell.md b/.changeset/v1-2-shell.md
deleted file mode 100644
index 69cd2e8..0000000
--- a/.changeset/v1-2-shell.md
+++ /dev/null
@@ -1,14 +0,0 @@
----
-"@kehto/shell": minor
----
-
-Canonical NIP-5D shell posture. `window.nostr` injection is removed — napplet iframes no longer see a host-provided `window.nostr` at any lifecycle point. `shell.supports()` now uses the `perm:<permission>` namespace for sandbox permissions (e.g., `shell.supports('perm:popups')`); bare names continue to resolve NUB capabilities. Signing and NIP-44 encryption are shell-mediated exclusively via `relay.publish` / `relay.publishEncrypted` — napplets never receive raw signing keys or plaintext of encrypted payloads. New per-domain proxies (identity, keys, media, notify, storage) are available as optional composition seams for host-app interception. `keys-forwarder` module published for host-app DOM-event bridging. `ShellBridge.publishTheme()` added as a first-class broadcast API so host apps can push theme changes to every registered napplet.
-
-**Breaking changes:**
-- `window.nostr` injection REMOVED (reverses v1.1 SH-I02). Napplets relying on `window.nostr` must migrate to `nostr.publish(...)` / `nostr.publishEncrypted(...)` via the shell bridge.
-- `shell.supports('<permission>')` renamed to `shell.supports('perm:<permission>')` for sandbox-permission checks.
-- Signer-side shell exports removed (no `signEvent` / `nip04` / `nip44` surface).
-
-**Peer deps:**
-- @napplet/core bumped from >=0.1.0 to ^0.2.0
-- Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)
diff --git a/packages/acl/package.json b/packages/acl/package.json
index 52bc38f..a56a540 100644
--- a/packages/acl/package.json
+++ b/packages/acl/package.json
@@ -1,6 +1,6 @@
 {
   "name": "@kehto/acl",
-  "version": "0.1.0",
+  "version": "0.2.0",
   ...
diff --git a/packages/runtime/package.json b/packages/runtime/package.json
-  "version": "0.1.0",
+  "version": "0.2.0",
diff --git a/packages/services/package.json b/packages/services/package.json
-  "version": "0.1.0",
+  "version": "0.2.0",
diff --git a/packages/shell/package.json b/packages/shell/package.json
-  "version": "0.1.0",
+  "version": "0.2.0",

=== FILE CHANGES SUMMARY ===
 .changeset/v1-2-acl.md         | 13 -------------
 .changeset/v1-2-runtime.md     | 17 -----------------
 .changeset/v1-2-services.md    | 15 ---------------
 .changeset/v1-2-shell.md       | 14 --------------
 packages/acl/package.json      | 14 +++++++++++---
 packages/runtime/package.json  | 14 +++++++++++---
 packages/services/package.json | 15 ++++++++++++---
 packages/shell/package.json    | 14 +++++++++++---
 8 files changed, 45 insertions(+), 71 deletions(-)
```

Truncation note: the package.json diffs for `runtime`, `services`, `shell` are structurally identical to the `acl` diff above (same `version` line change plus JSON array re-formatting — no semantic content changes beyond the bump). Full 315-line raw diff was captured to `/tmp/changeset-diff.txt` during branch life; the four package.json diffs were inspected in full before the rollback and confirmed to contain only `version` bumps + whitespace-only JSON re-formatting (expansion of single-line `"files": ["dist"]` and `"keywords": [...]` arrays to multi-line form). Internal-dependency fan-out on `apps/demo/package.json` (0.0.0 → 0.0.1) and `tests/e2e/harness/package.json` (0.0.0 → 0.0.1) was captured separately (both `private: true`, untouched by any publish). CHANGELOG.md files were generated as untracked new files in `packages/{acl,runtime,shell,services}/` and `apps/demo/` — contents verbatim-preserved in `/tmp/rel-03-notes/rel-03-notes.md` during branch life before the branch was discarded.

### Generated CHANGELOG.md summaries (untracked on throwaway branch; discarded at rollback)

- `packages/acl/CHANGELOG.md` — 17 lines, `## 0.2.0 · Minor Changes` with verbatim body from `.changeset/v1-2-acl.md`
- `packages/runtime/CHANGELOG.md` — 27 lines, `## 0.2.0 · Minor Changes` + `Patch Changes → Updated dependencies [226cdca] @kehto/acl@0.2.0`
- `packages/shell/CHANGELOG.md` — 25 lines, `## 0.2.0 · Minor Changes` + `Patch Changes → Updated dependencies @kehto/acl@0.2.0, @kehto/runtime@0.2.0`
- `packages/services/CHANGELOG.md` — 25 lines, `## 0.2.0 · Minor Changes` + `Patch Changes → Updated dependencies @kehto/runtime@0.2.0`
- `apps/demo/CHANGELOG.md` — 10 lines, `## 0.0.1 · Patch Changes → Updated dependencies runtime/services/shell → 0.2.0`

Release-note hash emitted by changesets: `226cdca`.

### Rollback proof

After `git checkout main && git branch -D gsd/release-rehearsal-v1.3`:

```
$ git branch --show-current
main

$ git branch --list gsd/release-rehearsal-v1.3
(empty)

$ git rev-parse HEAD
ad5357cc96f34eeaf87773201f4808ac86f76c06
```

`MAIN_SHA_BEFORE == MAIN_SHA_AFTER` assertion: `ad5357cc96f34eeaf87773201f4808ac86f76c06 == ad5357cc96f34eeaf87773201f4808ac86f76c06` ✓.

Deleted-branch reflog tombstone: `Deleted branch gsd/release-rehearsal-v1.3 (was ad5357c)` — confirms the throwaway branch was created from main and deleted at the same SHA (no commits were made on it, so the deletion message echoes main's SHA). All `changeset version` mutations were stored only in the working tree of the throwaway branch's checkout and were explicitly restored from `HEAD` (`git checkout HEAD -- …`) plus `rm` of the untracked `CHANGELOG.md` files during the cleanup step, leaving `main`'s working tree byte-identical to its pre-rehearsal state modulo pre-existing `.planning/` modifications that pre-date this plan.

### Hard-rule audit

- `pnpm changeset publish` was **NOT invoked** at any point in this plan (explicit hard rule per D-05 and REQUIREMENTS.md out-of-scope).
- `gsd/release-rehearsal-v1.3` was **NOT pushed** to any remote (local-only branch, now deleted).
- `gsd/release-rehearsal-v1.3` was **NOT merged** into `main`.
- `git reflog | grep -i publish` returns nothing attributable to this plan.

### REL-03 Status

**CLOSED — `pnpm changeset version` dry-run clean on throwaway branch `gsd/release-rehearsal-v1.3`; `pnpm install --frozen-lockfile` clean post-bump; all 4 @kehto/* packages bump minor 0.1.0 → 0.2.0 as expected; no peer-dep range mutations (all `@napplet/*` ranges remain `^0.2.0`); throwaway branch discarded (`git branch --list gsd/release-rehearsal-v1.3` empty); `main` HEAD unchanged (`ad5357c` both before and after); `pnpm changeset publish` explicitly NOT invoked.**

---
