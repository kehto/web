# Technology Stack — v1.7 Stack Additions

**Project:** Kehto Runtime — v1.7 NIP-5D Spec Adoption & New NUB Domains
**Researched:** 2026-04-24
**Scope:** NEW stack additions only. Existing validated stack (TypeScript strict, tsup, turborepo, pnpm workspaces, changesets, nostr-tools, Vite 6, Playwright, Vitest) is confirmed compatible and not re-researched here.

---

## 1. Upstream @napplet/nub Publish State

**Verdict: PARTIAL BLOCKER — class and connect subpaths do not exist anywhere yet; resource exists in source but is unpublished.**

### What is on npm today

npm registry `@napplet/nub@0.2.1` (published 2026-04-19, sole published version):

- **Source:** `https://registry.npmjs.org/@napplet/nub/-/nub-0.2.1.tgz`
- **gitHead:** `226657c92042a16ddae39e6b424554caa05b6fa8`
- **Description (npm):** "All 9 napplet NUB domains (relay, storage, ifc, keys, theme, media, notify, identity, config)"
- **Subpath exports present in tarball dist/:**
  - `./relay`, `./relay/types`, `./relay/shim`, `./relay/sdk`
  - `./storage`, `./storage/types`, `./storage/shim`, `./storage/sdk`
  - `./ifc`, `./ifc/types`, `./ifc/shim`, `./ifc/sdk`
  - `./keys`, `./keys/types`, `./keys/shim`, `./keys/sdk`
  - `./theme`, `./theme/types`
  - `./media`, `./media/types`, `./media/shim`, `./media/sdk`
  - `./notify`, `./notify/types`, `./notify/shim`, `./notify/sdk`
  - `./identity`, `./identity/types`, `./identity/shim`, `./identity/sdk`
  - `./config`, `./config/types`, `./config/shim`, `./config/sdk`
- **NOT in tarball:** `class`, `connect`, `resource` — confirmed by `npm pack @napplet/nub@0.2.1 --dry-run --json`

### What is in napplet/napplet main branch (unpublished)

Repo: `github.com/napplet/napplet` (org, not `sandwichfarm/napplet` which does not exist)

`packages/nub/src` directories on main branch:
`config`, `identity`, `ifc`, `keys`, `media`, `notify`, `relay`, `resource`, `storage`, `theme`

`packages/nub/package.json` on main (version `0.2.1`):
- **Description:** "All 10 napplet NUB domains (relay, storage, ifc, keys, theme, media, notify, identity, config, resource)"
- **Exports map includes:** `./resource`, `./resource/types`, `./resource/shim`, `./resource/sdk`
- **Does NOT include:** `./class`, `./connect`

`resource` was added in commit `45661375e9df` (feat(126-01)) on 2026-04-20 — after the 0.2.1 publish. No changeset file exists for a pending bump (only `README.md` and `config.json` and `deprecate-nub-domain-packages.md` are in `.changeset/`). The repo has no open PRs. The `changeset-release/main` branch exists (auto-managed by changesets CI) and `feat/strict-model` branch exists, but neither contains `class` or `connect` NUB directories.

**Conclusion by domain:**

| NUB Domain | npm 0.2.1 | napplet/napplet main | Needed for v1.7 |
|------------|-----------|----------------------|-----------------|
| config | YES | YES | YES (NUB-CONFIG reference service) |
| resource | NO | YES (unpublished) | YES (NUB-RESOURCE reference service) |
| class | NO | NO | YES (NUB-CLASS adoption) |
| connect | NO | NO | YES (NUB-CONNECT adoption) |

### Blocker details

**NUB-RESOURCE (SOFT BLOCKER):** Types and SDK are complete on `napplet/napplet` main but not yet published. A `@napplet/nub@0.2.2` (or `0.3.0`) publish is needed before `@kehto/services` can import `@napplet/nub/resource` without pinning to a git ref. Version bump requires a changeset to be filed upstream and the `changeset-release/main` CI to cut a release PR. Kehto v1.7 phases that implement NUB-RESOURCE should start against the source and must gate the "lock peerDependency range" step on the upstream publish.

**NUB-CLASS and NUB-CONNECT (HARD BLOCKER):** No source exists anywhere. These NUB domains have not been designed, let alone published. The `class.assigned` envelope shape and the `connect-src` policy wire format are not specced. Kehto v1.7 cannot implement NUB-CLASS or NUB-CONNECT adoption against `@napplet/nub` subpath imports — there is nothing to import. Options:
1. Define the wire types locally within `@kehto/shell` and `@kehto/services` as interim types, explicitly marked `// provisional — pending @napplet/nub/class publish`.
2. Block NUB-CLASS and NUB-CONNECT phases until upstream designs and publishes the domains.
3. Draft the NUB spec inline in the kehto v1.7 planning artifacts and open upstream issues/PRs first.

Recommendation: Option 3 (draft → open upstream PR → implement kehto side using local provisional types → swap to `@napplet/nub/class` import when published). This is how NUB-RESOURCE should be tracked as well.

**What versions kehto v1.7 needs when upstream ships:**
- NUB-RESOURCE: `@napplet/nub@^0.2.2` (or the next semver that includes resource)
- NUB-CLASS + NUB-CONNECT: `@napplet/nub@^0.3.0` (new domains = minor bump per semver)

---

## 2. NIP-5D Upstream Diff (v1.2 pinned → current)

**Canonical source:** `github.com/dskvr/nips` branch `nip/5d`, file `5D.md`
**Fetch method:** GitHub Contents API (`/contents/5D.md?ref=nip/5d`) — confirmed accessible, 122 lines.

### Diff summary (`diff specs/NIP-5D.md <upstream>`)

Three changes from the v1.2-pinned copy:

**Change 1 — Header comment block (kehto-local, not upstream):**
Lines 1-7 in `specs/NIP-5D.md` are the kehto-added sync header. These do not exist upstream. Not a spec delta — remove on re-sync, add back as a comment block.

**Change 2 — Security Considerations item 1 extended:**
Local (item 1):
```
1. Iframe sandbox: `allow-scripts` is the only required token -- shells MUST NOT add `allow-same-origin`.
```
Upstream (item 1):
```
1. Iframe sandbox: `allow-scripts` is the only required token -- shells MUST NOT add `allow-same-origin`. Adding `allow-same-origin` would grant the napplet a real origin, allowing it to register a service worker, read shell `localStorage`, and bypass shell mediation entirely -- this prohibition is the load-bearing precondition for browser-enforced isolation of any kind.
```
Impact: explanatory prose only. No new MUST/SHOULD obligations. No kehto implementation change required.

**Change 3 — Class-posture delegation paragraph (NEW, key addition):**
Upstream adds this paragraph in the Security Considerations section:

> **Class-posture delegation.** NUBs MAY define napplet classes with different security postures delivered through shell-controlled HTTP response headers. Class taxonomy, the mechanism for assigning a class to a napplet, and the wire or header shapes used to express a class are out of scope for this NIP. NUB specs that define class-contributing capabilities document their own posture and their own shell responsibilities; NIP-5D provides only the transport, identity, manifest-negotiation, and capability-query primitives on which such NUB-level machinery can layer.

Impact for v1.7: This is the canonical authorization for the HTTP-header authority requirement. The spec explicitly delegates class machinery to NUB specs and says posture is delivered via "shell-controlled HTTP response headers." This is the load-bearing sentence that makes NUB-CONNECT's CSP `connect-src` header approach spec-compliant. The spec does NOT define the mechanism — that is for NUB-CLASS and NUB-CONNECT specs to define.

**Re-sync action required:** Copy upstream verbatim (without local comment block), add the comment block back. Two sentences changed, one paragraph added. No conformance obligation changes.

---

## 3. NUB-CONNECT HTTP-Header Authority Infrastructure

**Context:** NIP-5D Security Considerations item 1 (upstream) explicitly states that `allow-same-origin` being absent is "the load-bearing precondition for browser-enforced isolation." The class-posture delegation paragraph authorizes per-class postures delivered via HTTP response headers. NUB-CONNECT's `connect-src` enforcement therefore requires the shell to control the HTTP `Content-Security-Policy` header on the iframe document response. `<meta http-equiv="Content-Security-Policy">` is an inferior fallback the spec intends shells to detect and refuse.

The demo Vite config (`apps/demo/vite.config.ts`) already has a custom middleware plugin `serveDemoNapplets` that intercepts napplet document requests and calls `res.setHeader(...)`. This is the exact extension point for per-napplet CSP injection.

### Option A: Vite dev-server middleware (dev-only)

**Mechanism:** Extend `serveDemoNapplets` plugin's `configureServer` and `configurePreviewServer` to call `res.setHeader('Content-Security-Policy', buildCsp(nappletId))` before streaming the napplet HTML. Shell maintains a per-napplet CSP grants store; the middleware reads it at request time.

**Package needed:** None. Pure Node.js `http.ServerResponse.setHeader`. Already demonstrated by the existing `res.setHeader('Access-Control-Allow-Origin', '*')` call in `serveNappletFile`.

**Vite version:** Locked at `^6.3.0` (resolved `6.4.2` in lockfile). Vite 6's `configureServer` + `configurePreviewServer` hooks expose `server.middlewares` (Connect-style). No version change needed.

**Dev posture:** Works perfectly for demo + E2E testing. The Playwright test harness (`tests/e2e/harness/vite.config.ts`) uses the same `serveNapplets` pattern — extend it the same way.

**Production posture:** The Vite `preview` server is not a production server. In production, a real HTTP server must emit the header. This is out of scope for kehto's reference demo (which ships as a Vite build artifact, not a deployable server), but must be documented as a host-app responsibility.

**Demo-wiring implications:** The demo already routes napplet docs through its middleware. Adding CSP header injection is a ~10-line change to `serveNappletFile`. Per-napplet grants keyed on `(dTag, aggregateHash)` are held in shell memory and read at HTTP request time — no IPC, no external store.

**Audit-gate implications:** The NUB-CONNECT audit checklist (SHELL-CONNECT-POLICY.md) can include a Playwright assertion that verifies the `Content-Security-Policy` response header contains the expected `connect-src` value. Playwright's `page.on('response', ...)` intercepts responses including iframes. HIGH confidence this works.

**Recommendation: Use this for the demo and E2E gates.**

### Option B: Service worker intercepting iframe doc requests

**Mechanism:** Register a service worker in the shell origin. Service worker intercepts `fetch` events for napplet document URLs and injects CSP headers via `new Response(body, { headers: { 'Content-Security-Policy': ... } })`.

**Constraint:** NIP-5D explicitly forbids `allow-same-origin` in napplet sandboxes. A napplet cannot register its own service worker. But the SHELL can register a service worker at the shell origin — and if napplet documents are served from the same origin as the shell, the shell's service worker can intercept those requests.

**Problem:** This only works if napplet documents are same-origin as the shell. Cross-origin napplet URLs (e.g., napplets hosted on a different domain) are outside the service worker's scope. In the demo, napplets are served at `/napplets/<name>/index.html` — same origin as the shell — so a service worker would work. But this is a demo-only coincidence, not a general architecture.

**Package needed:** None (native browser API). But requires careful lifecycle management (update, skipWaiting, claim) to avoid stale CSP rules.

**Verdict:** Viable for same-origin napplet deployments only. More complex than Option A (service worker install, update events, postMessage for grant updates). Do not use for the v1.7 demo — Option A is simpler with equivalent coverage.

### Option C: Reverse proxy (nginx / Express / Cloudflare Worker)

**Mechanism:** In a production host-app deployment, a reverse proxy layer sits in front of the shell server. When a request for a napplet document arrives, the proxy consults the shell's grants API and injects the `Content-Security-Policy` header before forwarding the response.

**Package needed (if Express):** `express@^5.1.0` or similar. For Cloudflare Workers: native `Response` API. For nginx: `add_header` directive with `map` block.

**Dev posture:** Not applicable — this is production infrastructure.

**Production posture:** This is the canonical production pattern for host apps that embed napplets. Kehto's reference demo is not production infrastructure, so this is host-app territory, not kehto territory. The `@kehto/shell` package should document the pattern and the expected header shape (e.g., `Content-Security-Policy: connect-src 'self' wss://relay.example.com`) but does not ship the proxy.

**Demo-wiring implications:** Not wired in demo.

**Audit-gate implications:** Not testable by Playwright against the local Vite server.

**Verdict:** Document as the production architecture in SHELL-CONNECT-POLICY.md. Do not ship as part of kehto packages.

### Option D: `<meta http-equiv="Content-Security-Policy">` fallback

**Why it matters:** The canonical NIP-5D class-posture delegation paragraph says posture is delivered "through shell-controlled HTTP response headers." The upstream spec's intent (and the NUB-CONNECT design rationale in kehto#9 context) requires the shell to detect meta-CSP and refuse to serve napplets that rely on it instead of real headers. This is the "residual-meta-CSP refuse-to-serve" requirement in the PROJECT.md milestone scope.

**Why meta-CSP is inferior:**
1. `<meta>` CSP applies AFTER the parser has seen the meta tag — any script that executes before the meta tag parses is not covered.
2. Browsers apply meta-CSP at the document level, not the navigation level. A service worker or redirect can strip it.
3. `frame-ancestors` and `sandbox` directives are ignored in meta-CSP (per CSP Level 2 spec).
4. `connect-src` in a meta tag is processed but not enforced identically across browsers.

**Shell responsibility:** When the shell serves (or proxies) a napplet document, it MUST verify that the response carries a real `Content-Security-Policy` HTTP header. If only a `<meta http-equiv="Content-Security-Policy">` is present, the shell MUST refuse to load the napplet. Detection method: Playwright (E2E) can assert `response.headers()['content-security-policy']` is set; at runtime the shell can inspect its own middleware response or require host-apps to attest header presence.

**Package needed:** None — detection is a string check on the HTTP response header, not a parsing library.

**Verdict:** Not an implementation option. Meta-CSP is what the shell detects and rejects, not what the shell emits.

### CSP String Construction

**Do not add a CSP parsing library.** The `connect-src` value is a comma-separated list of origins (strings). Construction is:
```typescript
const csp = `connect-src ${grants.connectSrc.join(' ')}; default-src 'none'`;
res.setHeader('Content-Security-Policy', csp);
```
No library needed. Adding `helmet`, `content-security-policy`, or similar packages would add ~10KB of machinery for a string join. This is a case where a dependency is actively wrong.

**HIGH confidence** on this recommendation — confirmed by reviewing the CSP spec and the existing kehto codebase's pattern of inline string construction for other policy surfaces.

---

## 4. NIP-44 Decrypt via `nostr-tools`

**Installed version:** `nostr-tools@2.23.3` (pinned in pnpm-lock.yaml, resolved via pnpm virtual store at `/home/sandwich/Develop/kehto/node_modules/.pnpm/nostr-tools@2.23.3_typescript@5.9.3/`)

**NIP-44 module path:** `@napplet/nub/./nip44` (export key) → resolves to `lib/esm/nip44.js` or `lib/cjs/nip44.js`. Import as:
```typescript
import * as nip44 from 'nostr-tools/nip44'
```

**Confirmed public API** (from installed `lib/types/nip44.d.ts`):
```typescript
export declare function getConversationKey(privkeyA: Uint8Array, pubkeyB: string): Uint8Array;
export declare function encrypt(plaintext: string, conversationKey: Uint8Array, nonce?: Uint8Array): string;
export declare function decrypt(payload: string, conversationKey: Uint8Array): string;
export declare const v2: {
  utils: { getConversationKey: typeof getConversationKey; calcPaddedLen: typeof calcPaddedLen; };
  encrypt: typeof encrypt;
  decrypt: typeof decrypt;
};
```

**Correct usage for shell decrypt surface:**
```typescript
import { getConversationKey, decrypt } from 'nostr-tools/nip44';
// privkey = Uint8Array (the shell's signer private key, from HostKeysBridge)
// senderPubkey = hex string (pubkeyB)
const conversationKey = getConversationKey(privkeyAsUint8Array, senderPubkeyHex);
const plaintext = decrypt(ciphertextPayload, conversationKey);
```

**Version pin:** No change needed. `nostr-tools@2.23.3` is both the installed version and the minimum in the `>=2.23.3 <3.0.0` peer range. NIP-44 has been stable since nostr-tools 2.x. The `v2` export is the canonical NIP-44 v2 implementation; the top-level exports (`getConversationKey`, `encrypt`, `decrypt`) are re-exports from `v2`.

**Soft-gate status:** The shell NIP-44 decrypt surface (kehto#9) is gated on `napplet/napplet#3` (open issue, no PR, no NUB decision yet). Issue #3 documents Option A (`relay.subscribeEncrypted`) as preferred but notes Option B (`identity.decrypt`) is simpler to add. The nostr-tools API works for either option — the shell calls `getConversationKey` + `decrypt` internally regardless of which NUB owns the surface. The soft-gate is on the wire interface (which `type` string the napplet sends), not on nostr-tools availability.

**npm latest:** `nostr-tools@2.23.3` is current latest (confirmed via npm view). No version bump needed.

**Confidence: HIGH** — verified against installed .d.ts file in pnpm virtual store.

---

## 5. New npm Dependencies Required

**None required for the core v1.7 feature set.** Detailed justification:

| Potential dep | Why considered | Decision |
|---------------|---------------|----------|
| CSP parsing library (e.g. `content-security-policy`) | Parse/validate CSP strings | REJECT — connect-src is a string join; no parsing needed |
| `helmet` | HTTP security headers | REJECT — adds server-side middleware for a Vite-plugin context; overkill |
| `express` | HTTP server for production CSP | REJECT — production host-app responsibility, not kehto's |
| Worker-specific SW library | Service worker CSP injection | REJECT — Option A (Vite middleware) is sufficient for demo/E2E |
| `@napplet/nub@0.2.2+` | NUB-RESOURCE subpath imports | REQUIRED but upstream must publish first; keep `^0.2.1` until then |
| New `@napplet/nub` version for class/connect | NUB-CLASS/CONNECT types | REQUIRED but does not exist yet; use provisional local types |
| `SimplePool` from nostr-tools | nip66 demo wiring | Already a peer dep (`nostr-tools@2.23.3`); `SimplePool` is exported from `nostr-tools` directly. No new dep. |

**Peer dependency range changes (if/when upstream publishes):**

When `@napplet/nub` publishes resource + class + connect domains, kehto packages will need their peer dep ranges updated:
- `@kehto/services`: `"@napplet/nub": "^0.2.2"` (or minor that includes resource)
- `@kehto/shell`: same (for class/connect types)
- The pnpm.overrides `@napplet/nub>@napplet/core: ^0.2.1` workaround (SEED-001) should be retested on the new publish to see if the workspace-specifier bug is fixed.

---

## 6. What NOT to Add

**CSP library (`content-security-policy`, `csp-builder`, `helmet`):** The `connect-src` value for v1.7 is a list of WebSocket/HTTPS origins that napplet grants consent to connect. Construction is a string join. A library adds 10-50KB of machinery for no benefit. The audit checklist validates the header value with a simple string assertion, not a parser. Do not add.

**`helmet`:** Helmet is an Express middleware collection for setting HTTP security headers. The demo uses Vite's plugin API, not Express. Adding helmet to the Vite middleware chain is awkward (incompatible middleware signatures) and unnecessary. The CSP header is set directly via `res.setHeader`. Do not add.

**A new HTTP server (Express/Fastify/Hono) to the demo:** The demo already has a working Vite dev + preview server with custom middleware. Introducing a parallel HTTP server would require port management, CORS coordination, and dev/build environment divergence. The existing Vite middleware pattern handles the demo's CSP header requirement. Do not add.

**Service worker library (Workbox, etc.):** Service workers are not the right tool for per-napplet CSP injection in the v1.7 demo (see Option B above). Even if they were, Workbox adds complexity around cache strategies that have nothing to do with CSP headers. Do not add.

**`json-schema-to-ts`:** The `@napplet/nub` package lists this as an optional peer dep. It is unused in kehto — the kehto codebase derives types from TypeScript interfaces, not JSON schema. The optional peer already has `peerDependenciesMeta: { "json-schema-to-ts": { "optional": true } }`. Do not install.

**New pnpm.overrides entries:** The existing `@napplet/nub>@napplet/core: ^0.2.1` override is already in place for SEED-001. Do not add additional overrides unless a new transitive conflict is confirmed by a failed `pnpm install` or `pnpm type-check`.

**`@types/*` packages for existing deps:** All deps in play (nostr-tools, Vite, Node.js http module) are already typed. No additional `@types` packages needed.

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| @napplet/nub@0.2.1 published, 9 domains, no class/connect/resource | `npm view @napplet/nub --json` + `npm pack --dry-run` | HIGH |
| napplet/napplet main branch has resource but not class/connect | `gh api repos/napplet/napplet/contents/packages/nub/src` | HIGH |
| napplet/napplet nub package.json version still 0.2.1 on main | `gh api repos/napplet/napplet/contents/packages/nub/package.json` | HIGH |
| resource NUB added in commit 45661375e9df (2026-04-20) | `gh api repos/napplet/napplet/commits?path=packages/nub/src/resource` | HIGH |
| napplet/napplet#3 open, NIP-44 design undecided | `gh api repos/napplet/napplet/issues/3` | HIGH |
| NIP-5D upstream diff (class-posture delegation ¶) | `gh api repos/dskvr/nips/contents/5D.md?ref=nip/5d` + local diff | HIGH |
| nostr-tools nip44 API (getConversationKey, decrypt) | Installed .d.ts at node_modules/.pnpm/nostr-tools@2.23.3_typescript@5.9.3/.../nip44.d.ts | HIGH |
| nostr-tools@2.23.3 is current npm latest | `npm view nostr-tools --json` | HIGH |
| Vite middleware CSP injection pattern | Existing vite.config.ts in apps/demo (res.setHeader already in use) | HIGH |
| meta-CSP inferiority (frame-ancestors, pre-parse timing) | W3C CSP Level 2 spec; confirmed by MDN | MEDIUM |
