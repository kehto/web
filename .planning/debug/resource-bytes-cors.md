---
slug: resource-bytes-cors
status: resolved
trigger: "resolve https://github.com/kehto/web/issues/243 — this is a new issue that was introduced sometime within the last few releases."
created: 2026-08-22
updated: 2026-08-22
---

# Debug: Static-browser `resource.bytes()` CORS failure (issue #243)

## Symptoms

**Expected:** A static browser shell either returns bytes for an externally hosted profile picture that the browser can display, or returns a specific, documented unsupported/CORS result without granting the sandboxed napplet direct network authority.

**Actual:** `resource.bytes(profile.picture)` ultimately uses browser `fetch()`. A cross-origin redirect without `Access-Control-Allow-Origin` rejects before the shell can inspect the redirect, read `Location`, classify bytes, or return a Blob. Kehto maps the browser's indistinguishable `TypeError: Failed to fetch` to `network-error`.

**Error messages:** `{ "ok": false, "message": "network-error" }`; direct browser fetch rejects with `TypeError: Failed to fetch`.

**Timeline:** Reported against `@kehto/services@0.20.0`, `@kehto/runtime@0.22.0`, `@napplet/sdk@0.27.2`, and `@napplet/nap@0.31.1`. The reporter says the regression appeared within the last few releases.

**Reproduction:** From a static Vite host, request `https://nostr.build/i/nostr.build_029831470fc213b50dca90bd35ae0fea4e2a2540388bb1d459ab73d1c1a51f5c.jpg` through `resource.bytes()`. Its initial 301 lacks CORS headers while the final `image.nostr.build` response has them. A normal `<img>` displays the URL, but browser `fetch()` cannot expose its bytes.

## Current Focus

hypothesis: CONFIRMED. `@kehto/services@0.20.0` began treating advisory `resource.info.schemes` as an authorization allowlist in commit `d237979`. That contradicts the draft's explicit rule that scheme disclosure does not grant fetch authority and made Kehto, the neutral toolkit, choose a runtime policy. Kehto now delegates to the injected runtime resolver by default while retaining its optional identity/origin-grant tooling for runtimes that choose it. Paja deliberately accepts arbitrary browser-readable HTTP(S) resource origins; its content-addressed Blossom path remains separate and conditional on configured servers.
test: Prove a URL omitted from `resource.info.schemes` still reaches the injected resolver, prove a resolver's own `unsupported-scheme` remains intact, prove optional grants still reject before I/O, and reproduce redirect/final-response CORS behavior in Chromium.
expecting: Kehto never turns advisory disclosure into permission. A runtime-resolved CORS-readable HTTPS URL returns bytes; ordinary browser-fetch failure remains canonical `network-error`; runtimes can opt into grants and scheme restrictions without Kehto imposing either by default.
next_action: push the verified branch, open the issue-closing PR, and confirm its required CI checks.

## Evidence

- timestamp: 2026-08-22
  finding: `napplet/naps` merged `master` at `a040914b4bbd3a5cd8a14b0f316a723c968ebfb2`, `naps/NAP-IDENTITY.md`, says profile `picture` and `banner` bytes MUST be fetched through NAP-RESOURCE and napplets MUST NOT perform direct image network loads.
  confirms: The identity contract makes a host-mediated resource path mandatory for profile media.
- timestamp: 2026-08-22
  finding: Open `napplet/naps` PR #80 at exact head `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`, `naps/NAP-RESOURCE.md`, defines runtime-owned `https:` fetching and a `network-error` limited to DNS/TCP/TLS/upstream failures, but has no static-browser CORS limitation or CORS-specific error.
  confirms: The runtime resolver owns scheme and network behavior; Kehto cannot invent a global browser-only prohibition or a new CORS error code.
- timestamp: 2026-08-22
  finding: The same draft says `resource.info` is optional/advisory and explicitly says `resource.info.schemes` does not grant fetch authority. Commit `d23797957fe7430a20f98a051627f910a305b2a9`, released as `@kehto/services@0.20.0`, added a pre-fetch scheme check against that advisory list and changed its default to an empty list.
  confirms: The recent regression is Kehto policy coupling, not the runtime-mediated byte path.
- timestamp: 2026-08-22
  finding: Kehto is the unopinionated kernel/toolkit, the playground visualizes its mechanisms, and Paja is the reference runtime. Paja now advertises and resolves `data:`, `https:`, and `http:`; it advertises `blossom:` only with at least one usable configured server and keeps all other schemes behind its own `unsupported-scheme` decision.
  confirms: Grant and scheme decisions belong in runtime-supplied hooks/resolvers; the toolkit preserves those tools without selecting defaults, while Paja makes an explicit developer-friendly choice.
- timestamp: 2026-08-22
  finding: The service maps non-abort, non-`ResourceServiceError` resolver rejection to canonical `network-error`, while preserving explicit runtime errors such as `unsupported-scheme` and `blocked-by-policy`.
  confirms: Browser CORS and runtime policy remain runtime outcomes; advisory discovery is not involved.
- timestamp: 2026-08-22
  finding: Real Chromium from `http://localhost:4174` reproduced the report exactly: fetch of the original `nostr.build/i/...jpg` rejected `TypeError: Failed to fetch`; fetch of the final `image.nostr.build/...jpg` succeeded as a CORS response with 8,948 readable bytes; an `<img>` using the original redirecting URL loaded at 195x194.
  confirms: A displayable image does not imply readable bytes, and the host cannot recover the redirect target through ordinary browser fetch.
- timestamp: 2026-08-22
  finding: The focused regressions pass with both runtime modes: no grant hooks delegates permissively, while a complete `isOriginGranted`/`getConnectGrants`/`resolveIdentity` adapter still blocks an ungranted origin before resolver I/O.
  confirms: The fix removes Kehto's policy choice without removing runtime grant functionality.
- timestamp: 2026-08-22
  finding: The combined services/Paja regression run passes 27 tests; full workspace build/type-check and the strict docs gate also pass.
  confirms: The public option relaxation, Paja's browser resolver, conditional Blossom disclosure, and revised toolkit/runtime documentation agree at compile time and in focused behavior.
- timestamp: 2026-08-22
  finding: The complete Vitest suite passes 1,685 tests across 142 files, the complete Playwright suite passes all 82 scenarios, and the AI-slop gate reports 100/100 with no issues.
  confirms: The runtime-owned resource boundary is covered across unit, integration, documentation, and real-browser behavior without regressions elsewhere in the workspace.
- timestamp: 2026-08-22
  finding: Immediately before shipment, open `napplet/naps` PR #80 still points to exact head `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1` on branch `nub-resource`.
  confirms: The implementation and final verification remain aligned with the exact draft authority originally checked.

## Eliminated

- hypothesis: The July profile napplet migration from a URL assignment to `resource.bytes` is the resource-service regression.
  evidence: Playground napplet history is not authority for the toolkit/runtime byte pipeline. The version-matched service regression is the `d237979` advisory-scheme gate released in 0.20.0.
- hypothesis: Changing redirect mode to `follow` lets a static host read this URL.
  evidence: Chromium's default-follow `fetch(originalUrl)` still rejects because the cross-origin redirect response lacks CORS permission; only direct fetch of the final URL succeeds.
- hypothesis: Kehto should classify every browser `TypeError` as CORS-specific.
  evidence: Browser fetch intentionally exposes CORS, DNS, TLS, CSP, and related failures through the same rejection surface, while the NAP defines no CORS-specific code. Re-labeling every TypeError would be false.
- hypothesis: A browser-only shell must not advertise or resolve generic HTTP(S).
  evidence: No NIP-5D/NAP rule says that. NAP-RESOURCE assigns resolution and policy to the runtime and makes `resource.info` advisory; Kehto remains inclusive, and Paja chooses permissive HTTP(S) origins for its developer environment.
- hypothesis: Making Kehto permissive by default means removing grant support.
  evidence: The optional grant adapter remains fully enforced when supplied. Permissive default and runtime-owned opinionated policy are separate requirements.

## Resolution

root_cause: Commit `d23797957fe7430a20f98a051627f910a305b2a9` made optional `resource.info.schemes` an authorization allowlist and defaulted the list to empty, so `@kehto/services@0.20.0` rejected URLs before the runtime resolver could apply its own policy.
fix: `createResourceService` now requires only the injected resolver, treats scheme disclosure as advisory, preserves the complete optional origin-grant adapter, and preserves resolver-selected errors. Paja independently enables browser HTTP(S), data, and conditional Blossom resolution. The playground retains its grant visualization and adds a deterministic browser CORS regression fixture.
verification: Focused services/Paja tests pass 27/27; full build and type-check pass; strict docs checks pass; the complete unit suite passes 1,685/1,685 across 142 files; the complete Playwright suite passes 82/82; and the AI-slop gate reports 100/100 with no issues.
files_changed: Resource service and tests; Paja browser resolver, adapter, tests, and docs; playground grant fixture and browser E2E; toolkit boundary documentation; package changeset.
