# Pitfalls Research

**Domain:** Adding NIP-5D spec resync + 4 new NUB domains + soft-gated NIP-44 decrypt to existing iframe-sandboxed postMessage protocol runtime (kehto v1.7)
**Researched:** 2026-04-24
**Confidence:** HIGH (derived from direct codebase analysis — acl-store.ts, shell-bridge.ts, enforce.ts, runtime.ts, capabilities.ts, types.ts, nip66/src/index.ts, wm/src/index.ts, apps/demo/src/shell-host.ts, demo-config.ts, specs/NIP-5D.md, v1.3-research/PITFALLS.md, v1.6-MILESTONE-AUDIT.md, PROJECT.md Key Decisions 11–22)

**Scope note:** All pitfalls from v1.0–v1.6 that are already structurally solved are excluded. This file covers only pitfalls that emerge when ADDING the v1.7 features to the existing system. The eight v1.3 pitfalls (Playwright frameLocator timing, postMessage origin mismatch, dev/preview aggregateHash drift, pnpm symlink deduplication, ACL state bleed, test escape hatches, changeset peer dep dry-run, and iteration loop anti-patterns) remain accurate and are not re-listed here — they apply equally in v1.7 and should be re-referenced in phase plans as needed.

---

## Critical Pitfalls

### Pitfall C-01: NUB-CLASS Pre-Assignment Race — Napplet Messages Arrive Before `class.assigned` Dispatch

**Severity:** CRITICAL

**What goes wrong:**
NUB-CLASS requires the shell to emit a `class.assigned` envelope after shim bootstrap, which the ACL then uses to gate class-posture-dependent capabilities. The napplet's shim bootstrap is async: it fires `shell.ready`, receives `shell.init`, and begins issuing NUB requests immediately. If the shell's class-assignment logic runs after the first substantive NUB request arrives (e.g., `relay.subscribe`, `identity.getPublicKey`), those requests are evaluated by the ACL with no class posture loaded — the permissive default allows them through regardless. The danger is that the permissive default IS the wrong policy for class-restricted napplets. A napplet that should be restricted to `class: viewer` (no relay:write) will successfully publish events during the window between its first request and the `class.assigned` envelope arriving.

The race window is real: in the existing demo with 10 napplets, shim bootstrap completes in under 100ms on fast hardware but the shell's class-assignment pathway must await the host's NIP-5D manifest fetch and class delegation logic — potentially 200–500ms on a cold run.

**Why it happens:**
The existing `shell.ready → shell.init` handshake is synchronous from the shell's perspective: `handleMessage` sees `shell.ready`, immediately responds with `shell.init`, and returns. Class assignment is a new second step with its own latency. There is no existing protocol mechanism to hold NUB requests until class is assigned; the napplet shim starts sending requests as soon as it receives `shell.init`.

**How to avoid:**
The class-assignment phase MUST complete before `shell.init` is sent, not after. The shell should: (1) resolve class posture synchronously at iframe creation time (not on `shell.ready`), using the identity the host provides via `onNip5dIframeCreate`; (2) include `class` in the `shell.init` payload so the shim receives it atomically with capability advertisement; (3) the ACL gate must read class from the session entry, not from a subsequent message. Do NOT implement class assignment as a separate async step that follows `shell.init`. The session entry written by `onNip5dIframeCreate` is the correct injection point — extend it to include `class: string | null` and populate it at iframe creation.

**Warning signs:**
- A NUB-CLASS spec test that sends `relay.publish` immediately after `shell.ready` and expects denial for a `class: viewer` napplet passes when it should fail — the request arrived in the window before class was set.
- `grep -n 'class.assigned' packages/shell/src/shell-bridge.ts` returns a match that appears AFTER the `shell.init` post call.
- E2E spec for NUB-CLASS sends a request before `class.assigned` fires and gets a 200 OK response from the ACL instead of a denial.

**Phase to address:**
SPEC resync phase (first phase of v1.7). The class-assignment injection point must be defined in the SPEC resync plan before any NUB-CLASS implementation work begins. The requirement should read: "class posture resolves synchronously at iframe creation via `onNip5dIframeCreate`; `shell.init` payload includes resolved class; no `class.assigned` async round-trip is required."

---

### Pitfall C-02: Cross-NUB Class-Posture Invariant Regression — Class Check in One NUB Handler, Forgotten in Another

**Severity:** CRITICAL

**What goes wrong:**
When NUB-CLASS adds class-posture gating, the enforcement must apply uniformly across ALL NUB handlers that carry class-gated capabilities. The existing enforcement architecture in `enforce.ts` uses `createNubEnforceGate`, which calls `resolveCapabilitiesNub` from `@kehto/acl` to map message types to required capabilities. If class-posture gating is implemented as an ad-hoc check inside one NUB handler (e.g., `relay` handler checks class, but `storage` handler does not), then a class-restricted napplet can bypass the restriction by using the storage NUB instead.

The kehto runtime dispatches through `@napplet/core`'s `createDispatch` + `registerNub`. Each NUB handler is registered independently. A developer adding class posture to the relay handler who does not also update the storage, identity, keys, media, notify, theme, config, and resource handlers creates eight separate bypass paths.

**Why it happens:**
Class posture gating is conceptually a "capability modifier" that sits above the per-NUB capability check. The temptation is to add it inside the most-used NUB handler first and ship the rest as a follow-up. But the ACL's permissive default means "missing check = allowed," so the follow-up never comes before a bypass is found.

**How to avoid:**
Class posture must be enforced at the dispatch gate, not inside individual NUB handlers. The `createNubEnforceGate` function in `enforce.ts` is the single enforcement chokepoint — extend it to include class-posture evaluation before the per-capability check. This way, adding a new NUB handler (CONFIG, RESOURCE) automatically inherits class gating without any per-handler work. The Layer-B NUB-CLASS invariant spec (required per the v1.7 milestone) must assert class gating across EVERY NUB domain, not just relay — test at minimum one message per domain (relay, storage, identity, keys, media, notify, theme, config, resource).

**Warning signs:**
- `grep -n 'class' packages/runtime/src/` finds class-posture checks scattered across multiple handler files rather than concentrated in `enforce.ts`.
- The NUB-CLASS Layer-B spec only tests `relay.*` messages against the class gate — no `storage.*`, `identity.*`, or `config.*` assertions.
- A `class: viewer` napplet successfully issues `state.set` (storage write) in an E2E test.

**Phase to address:**
NUB-CLASS adoption phase. Phase plan must include a "cross-NUB invariant spec" requirement that explicitly lists all NUB domains and asserts each one is gated. Success criterion: `grep -rn 'class' packages/runtime/src/enforce.ts` shows the gate is centralized there, not in handler files.

---

### Pitfall C-03: NUB-CONNECT Residual Meta-CSP HTML Tags in Production Build

**Severity:** CRITICAL

**What goes wrong:**
NUB-CONNECT specifies that the shell MUST refuse to serve napplets whose HTML contains residual `<meta http-equiv="Content-Security-Policy">` tags. This is the "refuse-to-serve" invariant. The risk is that napplet developers building against kehto include a meta-CSP in their `index.html` template (common default from Vite scaffold templates) and the kehto demo ships that napplet without detecting the violation. The CI has no automated check — the violation is discovered only when a production user reports that a specific URL was blocked.

Beyond the demo napplets, the concern is the two NEW demo napplets (config-napplet, resource-napplet) that must be scaffolded for v1.7. If the scaffold template includes a meta-CSP (from Vite's default `index.html`), both new napplets ship with the violation from their first commit.

**Why it happens:**
Vite's default `index.html` scaffold does not include a meta-CSP, but common Vite plugin presets (e.g., `vite-plugin-html`, security-hardening plugins, some CSP-aware PWA plugins) inject meta-CSP tags during build. Developers installing these plugins for legitimate reasons poison the napplet output without realizing NIP-5D forbids it.

Additionally, if the napplet's `vite.config.ts` uses `htmlPlugin` or any plugin that calls `transformIndexHtml`, that hook can inject a meta-CSP at build time that does not appear in the source `index.html` — making grep of source files insufficient.

**How to avoid:**
Add a CI audit step that greps the BUILT output (not source) for residual meta-CSP tags. The check must run against `dist/index.html` of every napplet after `pnpm build`:

```bash
grep -rn 'http-equiv.*Content-Security-Policy\|http-equiv.*content-security-policy' \
  apps/demo/napplets/*/dist/index.html && echo "FAIL: residual meta-CSP found" && exit 1
```

This check should be a required success criterion in the NUB-CONNECT phase plan. It should be wired into the `pnpm test:build` step or as a separate `pnpm audit:csp` script. Additionally, the two new napplet scaffolds (config, resource) must be verified before their first commit by running this grep against their initial dist output.

**Warning signs:**
- `grep -rn 'http-equiv' apps/demo/napplets/*/dist/` returns any match.
- A Vite plugin is added to any napplet's `vite.config.ts` that has `transformIndexHtml` in its name or plugin list.
- `apps/demo/napplets/config-napplet/index.html` or `resource-napplet/index.html` includes `<meta http-equiv` in the source template.

**Phase to address:**
NUB-CONNECT adoption phase. The phase plan's first requirement should be the CI audit script; all other NUB-CONNECT work depends on it being green.

---

### Pitfall C-04: CSP `connect-src` Allowlist Surviving User Revocation

**Severity:** CRITICAL

**What goes wrong:**
NUB-CONNECT grants are keyed on `(dTag, aggregateHash)` and persist in localStorage via `aclStore`. The `connect-src` allowlist for a napplet is derived from its active grants. When a user revokes a grant, `aclStore.revoke()` updates the in-memory store and calls `persist()`, but the HTTP response header `Content-Security-Policy: connect-src ...` was already sent when the napplet's iframe was served. HTTP headers cannot be retroactively updated for existing responses. If the shell serves napplets via a Vite middleware (or any HTTP server that computes the CSP header at serve time), the iframe's CSP is the one from its initial load — not the one reflecting the current grant state.

The result: a user revokes a napplet's permission to connect to `wss://relay.damus.io`, but the napplet's iframe already has a CSP header that allows it. The revocation is enforced in the ACL for future NUB-RELAY requests (the shell will deny `relay.subscribe` calls), but the napplet can still open a direct WebSocket to that URL outside the shell's protocol — because the browser's CSP enforcement still allows it.

This is a defense-in-depth failure. It matters for NUB-RESOURCE, which acts as a shell proxy for HTTP fetches — a napplet that can bypass CSP via a direct `fetch()` doesn't need the shell's proxy.

**Why it happens:**
HTTP response headers are immutable after delivery. CSP is a header-based mechanism. Grant revocation changes software state but cannot change a delivered HTTP response. Developers implementing NUB-CONNECT focus on the grant persistence path and do not consider the "revoke after load" scenario.

**How to avoid:**
Document explicitly that CSP enforcement is per-load, not per-grant-change. The NUB-CONNECT implementation must include an iframe reload mechanism: when a grant is revoked, the shell destroys and recreates the napplet's iframe (which triggers a new HTTP request with the updated CSP). This is a UX tradeoff — frame reload loses napplet state — but is the only correct mechanism. The phase plan must include this as a requirement, not an optional polish item. Alternatively, document clearly that revocation takes effect at next load and surface this constraint in the consent UI ("Permission will take effect on next reload").

**Warning signs:**
- `aclStore.revoke()` is called but no iframe reload or destroy/recreate is triggered.
- The NUB-CONNECT consent flow has a "Revoke" button that calls `aclStore.revoke()` and returns — the iframe stays in place.
- E2E spec for revocation asserts that `aclStore.check()` returns false but does not verify that the napplet's CSP header was regenerated.

**Phase to address:**
NUB-CONNECT adoption phase. The revocation UX requirement must state: "Revoking a connect grant triggers iframe destroy + recreate within the current session."

---

### Pitfall C-05: Shell-HTTP-Header Authority Disappears in Production Deploy

**Severity:** CRITICAL

**What goes wrong:**
NUB-CONNECT requires the shell to become the HTTP-header authority for napplet iframes — it must serve napplet responses with computed `Content-Security-Policy` headers. In development, this works via Vite's `configureServer` middleware hook (already present in `apps/demo/vite.config.ts` for the napplet serve middleware). In production, the demo is deployed as static files served by whatever CDN or web server the operator chooses. That web server does not run Vite middleware. Unless the production deployment explicitly configures CSP headers (e.g., via Netlify `_headers`, Vercel `vercel.json`, Nginx config), the napplet iframes are served with no CSP at all — silently defeating the entire NUB-CONNECT security model.

This is structurally identical to the "configureServer vs configurePreviewServer" gap documented in v1.3 PITFALLS.md Pitfall 3, but at a higher severity because it is a security invariant, not just a dev/preview behavior difference.

**Why it happens:**
`configureServer` and `configurePreviewServer` cover `vite dev` and `vite preview` respectively, but neither covers a static CDN deployment. The Vite plugin lifecycle ends at build time. Developers test NUB-CONNECT in `vite preview`, confirm CSP headers appear, and consider the feature done — but production deploy doesn't have Vite.

**How to avoid:**
The v1.7 NUB-CONNECT implementation plan must explicitly document the production deployment gap as a known limitation of the demo (which is a developer showcase, not a CDN-deployed product). For the demo specifically: add `configurePreviewServer` alongside the existing `configureServer` hook in `apps/demo/vite.config.ts` to ensure `pnpm preview` also emits CSP headers, and verify this with an E2E assertion that checks `Response.headers['content-security-policy']` during Playwright runs. The SHELL-CONNECT-POLICY.md audit checklist (specified in the milestone goal) must include a section titled "Production deployment gap" that tells implementors what they must configure outside Vite.

**Warning signs:**
- `grep -n 'configurePreviewServer' apps/demo/vite.config.ts` returns no match after NUB-CONNECT is implemented.
- `curl -I http://localhost:4173/napplets/config-napplet/` (preview URL) returns no `Content-Security-Policy` header.
- The Playwright E2E spec for NUB-CONNECT only tests against `vite dev` (port 5173), not `vite preview` (port 4173).

**Phase to address:**
NUB-CONNECT adoption phase. Add `configurePreviewServer` as an explicit requirement. E2E spec must assert the CSP header is present in preview mode.

---

### Pitfall C-06: NIP-44 Decrypted Plaintext Routing to Wrong Iframe

**Severity:** CRITICAL

**What goes wrong:**
NIP-44 decrypt (soft-gated, kehto#9) runs on the shell side: the napplet sends a ciphertext to the shell, the shell derives the conversation key and decrypts, then routes the plaintext back. If the shell uses `originRegistry.getAllWindowIds()` to broadcast (the same pattern used by `publishTheme` in `shell-bridge.ts`), the decrypted plaintext is delivered to every registered napplet — including napplets that did not make the decrypt request. For a Nostr DM, this means leaking private message content to all running napplets.

Looking at `shell-bridge.ts:publishTheme`, it explicitly iterates `originRegistry.getAllWindowIds()` and posts to all of them. A naive NIP-44 decrypt implementation copy-pasted from `publishTheme` carries this broadcast behavior.

**Why it happens:**
Broadcast is the easy path — it's already implemented and working for theme pushes. Developers implementing decrypt see `publishTheme` as the model for "shell sends message to napplet" and use the same pattern without recognizing that theme pushes are public while decrypt responses are private.

**How to avoid:**
NIP-44 decrypt response MUST be routed exclusively to the requesting `windowId`. The pattern is: `const win = originRegistry.getIframeWindow(windowId); if (win) win.postMessage(decryptedResponse, '*')` where `windowId` is the one extracted from the decrypt request in `handleMessage`. Never use `getAllWindowIds()` for decrypt responses. The phase plan must include a specific test assertion: "decrypt response is received by the requesting iframe and NOT received by any other iframe in the same page."

**Warning signs:**
- `packages/shell/src/` contains any decrypt handler that calls `originRegistry.getAllWindowIds()` instead of using the request's specific `windowId`.
- A Layer-B E2E spec for NIP-44 decrypt loads two napplets and only asserts that the requesting napplet received the plaintext — it does not assert that the non-requesting napplet did NOT receive it.

**Phase to address:**
NIP-44 decrypt phase (soft-gated on napplet/napplet#3). The routing constraint must be stated as a hard requirement in the phase plan, not as a review comment.

---

## High-Severity Pitfalls

### Pitfall H-01: NUB-CONNECT `srcdoc` vs `src` — Meta-CSP Applies Only When There Is an HTTP Response

**Severity:** HIGH

**What goes wrong:**
The NIP-5D transport spec (specs/NIP-5D.md) notes that `allow-same-origin` MUST NOT be present. It does not restrict whether iframes use `src=` (HTTP request, gets response headers including CSP) or `srcdoc=` (inline HTML, no HTTP request, therefore HTTP CSP headers never apply). If any napplet in kehto is currently or in the future loaded via `srcdoc`, the shell-HTTP-header authority model for NUB-CONNECT is silently inapplicable — the browser ignores HTTP headers for `srcdoc` iframes.

The v1.3 PITFALLS.md documents `srcdoc` as "test fixtures only — not demo app." If that discipline was maintained, this is not a current problem. However, NUB-CONNECT implementation may tempt developers to use `srcdoc` for the new config/resource demo napplets to simplify local testing.

**Why it happens:**
`srcdoc` is convenient for small demo napplets — no build step required, content is inline. The v1.3 PITFALLS.md records this trap but the guard is tribal knowledge, not a CI check.

**How to avoid:**
Add a CI assertion that no napplet iframe in the demo HTML uses `srcdoc`:
```bash
grep -n 'srcdoc' apps/demo/index.html apps/demo/src/*.ts && echo "FAIL: srcdoc iframe found" && exit 1
```
Wire this into `pnpm audit:csp` alongside the meta-CSP check. The two new napplet scaffolds (config, resource) must use the standard `src=` pattern.

**Warning signs:**
- `grep -n 'srcdoc' apps/demo/` returns any match.
- A new napplet is added to `DEMO_NAPPLETS` but has no corresponding entry in `apps/demo/napplets/` (suggesting the content is inline rather than a built dist).

**Phase to address:**
NUB-CONNECT adoption phase. Add `srcdoc` prohibition to the CI audit.

---

### Pitfall H-02: NUB-CONNECT Grant Key Hash Collision on Napplet Rebuild

**Severity:** HIGH

**What goes wrong:**
NUB-CONNECT grants are keyed on `(dTag, aggregateHash)`. The `aggregateHash` is the SHA-256 of the napplet's build artifacts — it changes on every rebuild if any source file changes. A user who grants `connect: wss://relay.damus.io` to napplet `chat` at `aggregateHash: abc123` has their grant silently invalidated when the napplet is updated and now has `aggregateHash: def456`. From the user's perspective, they granted permission "to the chat napplet" but are now re-prompted every time the developer ships an update. For a frequently updated napplet, this is permission-prompt fatigue that degrades UX.

This is by design per the NIP-5D spec (aggregate hash verification guards against supply-chain attacks on napplet code), but NUB-CONNECT must implement a specific UX policy for this case.

**Why it happens:**
The ACL's permissive default means missing grants fail silently (capabilities allowed). But NUB-CONNECT grants are RESTRICTIVE — absent grant = no connection. So a hash change means the napplet's network access silently stops working until the user re-grants. The developer sees "connect works after install, breaks on update" and may not connect the symptom to the hash change.

**How to avoid:**
The NUB-CONNECT phase plan must specify a hash-upgrade UX policy before implementation begins. Options: (a) re-prompt silently on hash change using the existing `config.getNappUpdateBehavior()` hook (already in `ConfigHooks`); (b) migrate grants from old hash to new hash automatically if the shell's `onHashMismatch` hook fires and the manifest pubkey is trusted. The `onHashMismatch` callback in `ShellAdapter` (already defined in `types.ts`) is the correct injection point. The phase plan should specify that NUB-CONNECT wires into `onHashMismatch` to trigger a grant migration or re-consent flow.

**Warning signs:**
- The NUB-CONNECT grant storage key format is `${dTag}:${aggregateHash}` (same as existing ACL) but there is no `onHashMismatch` handler defined for grant migration.
- An E2E spec for NUB-CONNECT tests grant persistence but does NOT test what happens when the napplet is rebuilt with a new hash.
- `config.getNappUpdateBehavior()` returns `'auto-grant'` but NUB-CONNECT does not consult it.

**Phase to address:**
NUB-CONNECT adoption phase. The grant key design and hash-upgrade policy must be specified in the first plan of the phase, before the consent flow UI is implemented.

---

### Pitfall H-03: NUB-RESOURCE Without NUB-CONNECT Grants Enables Shell-Proxied Exfiltration

**Severity:** HIGH

**What goes wrong:**
NUB-RESOURCE provides a shell-proxied HTTP fetch surface — napplets send a `resource.fetch` request and the shell performs the fetch on their behalf, returning the response. If NUB-RESOURCE checks only the `resource:fetch` capability (an ACL gate like `relay:read`) but does NOT require an active NUB-CONNECT grant for the requested URL, then a napplet can exfiltrate data to any URL without the user's consent. The distinction: NUB-CONNECT's `connect-src` allowlist governs direct iframe WebSocket/fetch; NUB-RESOURCE's proxy governs shell-mediated fetches. They must share the same allowlist.

**Why it happens:**
NUB-RESOURCE is implemented as a reference service in `@kehto/services` following the existing `ServiceHandler` pattern. The `handleMessage` implementation naturally checks the ACL capability (`resource:fetch`) but NUB-CONNECT's grants are stored separately. A developer who does not read both specs simultaneously will implement NUB-RESOURCE without consulting NUB-CONNECT's URL allowlist — there is no structural coupling between them in the current architecture.

**How to avoid:**
NUB-RESOURCE's `handleMessage` must validate that the requested URL is present in the napplet's active NUB-CONNECT grant list before performing the fetch. This requires NUB-RESOURCE to receive the grant store as a dependency at factory creation time — i.e., `createResourceService({ getConnectGrants: (windowId) => connectGrantStore.get(windowId) })`. This dependency must be explicit in the factory signature from day one; retrofitting it after the fact requires breaking the `ServiceHandler` pattern. The phase plan must specify this as a "day one coupling" requirement.

**Warning signs:**
- `packages/services/src/resource-service.ts` exists but does not import from or reference any connect-grant store.
- The NUB-RESOURCE Layer-A spec does not test that a URL absent from the NUB-CONNECT grant list is denied.
- `createResourceService` factory signature accepts no grant-lookup parameter.

**Phase to address:**
NUB-RESOURCE reference service phase. The factory signature must include `getConnectGrants` before the first line of implementation code.

---

### Pitfall H-04: `@kehto/wm` Over-Prescribed Layout API Locking Consumers Out

**Severity:** HIGH

**What goes wrong:**
The v1.6 WM skeleton defines `Layout = 'dwindle' | 'master-stack' | 'floating' | (string & {})` as a type and `WmHostHooks.selectLayout(strategy: Layout)`. The `'dwindle'` and `'master-stack'` string literals are hardcoded in the public type. Any consumer that wants a layout system not matching these names (e.g., `'tabs'`, `'grid'`, `'singleview'`) must use the `(string & {})` escape hatch, which loses type safety. If v1.7 adds abstract base classes or concrete layout primitives keyed to these names, consumers who want different layouts are forced to subclass a layout algorithm they do not use.

The problem manifests as: a consumer (e.g., hyprgate v3.0) has a tab-based layout system. The kehto WM package enforces a tiling metaphor. The consumer abandons `@kehto/wm` and re-implements their own WM package, duplicating the interface contract.

**Why it happens:**
The skeleton was authored based on hyprgate's current layout needs (BSP/master-stack). v1.7 adds "structural primitives / base classes / abstract interfaces" per the milestone goal. Without a consumer use case beyond hyprgate, the primitives are shaped by hyprgate's needs rather than being genuinely generic.

**How to avoid:**
v1.7 WM work must ship abstract interfaces and type vocabulary only — no concrete layout algorithm primitives (BSP node splitting, stack tracking, etc.). The `Layout` type should remain an open string union with no new named constants added. The `WmHostHooks` contract should express notification semantics ("a window was created at rect") not layout commands ("split this node left"). Concrete layout algorithms stay in hyprgate's local implementation. The phase plan success criterion: `packages/wm/src/index.ts` contains no algorithm-specific types (no `BspNode`, no `MasterSlaveRatio`, no `StackDirection`).

**Warning signs:**
- `packages/wm/src/index.ts` exports a type or interface with `Bsp`, `Stack`, `Tiling`, or `Column` in the name.
- The WM package grows beyond ~200 lines of pure interface definitions.
- The WM README example shows a call to a layout-selection function that takes tiling-specific parameters.

**Phase to address:**
`@kehto/wm` abstractions phase. Phase plan must explicitly state: "No concrete layout algorithms. Interfaces and type vocabulary only."

---

### Pitfall H-05: DEMO_NAPPLETS Drift — New Napplets Missing Class Assignment in Shell-Host

**Severity:** HIGH

**What goes wrong:**
v1.7 adds two new demo napplets (config-napplet, resource-napplet) to `DEMO_NAPPLETS` in `apps/demo/src/shell-host.ts`. NUB-CLASS requires the shell to assign a class posture to each napplet at load time via the `onNip5dIframeCreate` hook. If the developer adds the new napplet entries to `DEMO_NAPPLETS` but does NOT update the class-assignment logic in `onNip5dIframeCreate` to handle the new dTag values, the new napplets receive no class posture — which defaults to permissive behavior. This is the v1.5 DEMO-02 silent-drift pattern (Key Decision 16) applied to NUB-CLASS.

The symptom is subtle: the demo loads, the new napplets appear functional, all E2E specs that don't specifically test class gating pass. The class assignment gap is invisible until a cross-napplet security test checks that `config-napplet` (a `class: viewer`) cannot call `relay.publish` — and finds it can.

**Why it happens:**
`DEMO_NAPPLETS` is the single source of truth for napplet rendering (Key Decision 16), but it is a UI-loop construct. Class assignment is a separate concern in `onNip5dIframeCreate`. There is no structural coupling between adding a napplet to `DEMO_NAPPLETS` and providing its class posture.

**How to avoid:**
The `onNip5dIframeCreate` hook implementation must be data-driven from the same source as `DEMO_NAPPLETS`, not a switch-case that must be manually updated. Define a `CLASS_BY_DTAG` lookup map alongside `DEMO_NAPPLETS`:

```ts
const CLASS_BY_DTAG: Record<string, string | null> = {
  'chat': null,        // no class restriction
  'config-napplet': 'viewer',  // NUB-CLASS gated
  'resource-napplet': 'viewer',
  // ...
};
```

And drive `onNip5dIframeCreate` from this map:

```ts
onNip5dIframeCreate: (windowId) => {
  const dTag = ... // from originRegistry
  return { dTag, aggregateHash, class: CLASS_BY_DTAG[dTag] ?? null };
}
```

The NUB-CLASS Layer-B spec must include an assertion for each demo napplet that its actual class posture matches `CLASS_BY_DTAG`.

**Warning signs:**
- `grep -n 'config-napplet\|resource-napplet' apps/demo/src/shell-host.ts` finds the napplets in `DEMO_NAPPLETS` but not in any class-assignment logic.
- The `onNip5dIframeCreate` implementation uses a switch-case or if-else chain rather than a lookup map.
- A new napplet is added to `DEMO_NAPPLETS` in a commit that does NOT also touch class-assignment code.

**Phase to address:**
NUB-CLASS adoption phase. The data-driven `CLASS_BY_DTAG` map must be introduced before the two new napplets are scaffolded in the NUB-CONFIG/RESOURCE phases.

---

### Pitfall H-06: NIP-44 Key Derivation Error — Conversation Key Uses pub+priv, Not pub+pub

**Severity:** HIGH

**What goes wrong:**
NIP-44 conversation key derivation is `getConversationKey(privateKey, publicKey)` — the caller's private key PLUS the recipient's public key. A naive implementation that derives the key from two public keys (the napplet sender's pubkey and the recipient's pubkey) produces a different key than the standard and silently fails to decrypt. This fails silently because `decrypt()` returns an error result rather than throwing — the napplet receives a `null` or empty plaintext with no indication of why.

In kehto's architecture, the shell holds the user's private key (via `AuthHooks.getSigner()`). The shell must call `getConversationKey(userPrivateKey, senderPublicKey)` to derive the conversation key for decryption. A developer who reads the NIP-44 spec quickly may misread the key derivation as "the two parties' public keys" because the spec describes it in terms of the two parties' identities.

**Why it happens:**
NIP-44 key derivation uses ECDH — the shared secret is derived from one party's private key and the other's public key. Both sides perform the same ECDH operation with their respective private keys and get the same result. This is easy to misread as "just use both public keys" especially when looking at example code that abstracts the private key access.

**How to avoid:**
The NIP-44 decrypt phase plan must include a unit test that verifies key derivation against a known test vector from the NIP-44 spec (the NIP-44 reference implementation includes test vectors). The test must explicitly assert that `getConversationKey(privKey, pubKey)` produces the expected output for the canonical test vector. Do not test only against live Nostr events — the test vector is the authoritative check.

**Warning signs:**
- `packages/shell/src/` decrypt implementation calls any key derivation function with two arguments that are both public-key-shaped (64 hex chars each).
- No unit test for the decrypt path exists that uses NIP-44 test vectors.
- The decrypt implementation imports from `nostr-tools` but uses `nip04.decrypt` (which uses NIP-04 ECDH, not NIP-44) — different algorithm.

**Phase to address:**
NIP-44 decrypt phase. First requirement: "Unit test for key derivation against NIP-44 spec test vector passes."

---

### Pitfall H-07: NUB-CONFIG Scope Creep Into NUB-STORAGE Territory

**Severity:** HIGH

**What goes wrong:**
NUB-CONFIG is a new NUB domain for napplet configuration (structured settings, user preferences per napplet). NUB-STORAGE handles general key-value state. If NUB-CONFIG's reference service implementation accepts arbitrary key-value pairs without a schema or namespace, it becomes a second general storage surface. Downstream napplets that should use NUB-STORAGE for ephemeral state may use NUB-CONFIG instead because "config" sounds right for settings. Over time, NUB-CONFIG and NUB-STORAGE diverge in implementation (different persistence strategies, different ACL bits, different quota accounting) while serving overlapping purposes.

Looking at `capabilities.ts`, the current ACL surface has `state:read` / `state:write` for NUB-STORAGE. If NUB-CONFIG introduces `config:read` / `config:write` capabilities (the obvious naming), capability count grows while the distinction is unclear to consumers.

**Why it happens:**
The distinction between "config" and "state" is conceptually unclear. "Config" implies structured, schema-validated, user-visible settings. "State" implies ephemeral, app-internal, arbitrary data. But developers using both see them as "storage with different names." The reference implementation does not enforce the conceptual boundary — it only enforces the capability gate.

**How to avoid:**
The NUB-CONFIG phase plan must define the scope boundary in the service descriptor: "NUB-CONFIG is for shell-managed configuration that survives napplet rebuilds (user preferences, settings). NUB-STORAGE is for napplet-private state that is valid only for the current `(dTag, aggregateHash)` tuple." The reference service must validate that CONFIG message payloads include a schema identifier, not just raw key-value pairs. Include a "scope anti-pattern" section in the NUB-CONFIG README: "Do NOT use NUB-CONFIG as a general key-value store — use NUB-STORAGE for that."

**Warning signs:**
- `createConfigService` factory accepts `get(key: string)` / `set(key: string, value: unknown)` without schema validation.
- A demo napplet that uses NUB-CONFIG to store `{ lastScrollPosition: 420 }` — that is NUB-STORAGE territory.
- The NUB-CONFIG and NUB-STORAGE capabilities use identical payload shapes in their Layer-A specs.

**Phase to address:**
NUB-CONFIG reference service phase. Scope boundary must be defined in the first plan before implementation.

---

### Pitfall H-08: `@napplet/nub` Publish Cadence Forcing Mid-Milestone Lockfile Churn

**Severity:** HIGH

**What goes wrong:**
All 4 new NUB domains (CLASS, CONNECT, CONFIG, RESOURCE) depend on upstream `@napplet/nub` publishing their subpaths before kehto can import them. v1.6 demonstrated this: the `@napplet/nub>@napplet/core` workspace-specifier publish bug (SEED-001) required `pnpm.overrides` as a workaround, and that workaround is still live. If `@napplet/nub` publishes CLASS, CONNECT, CONFIG, and RESOURCE in separate releases (e.g., CLASS in nub@0.3.0, CONNECT in nub@0.3.1, CONFIG in nub@0.3.2), kehto must bump the peer dep range and re-run `pnpm install` at each step, producing three lockfile churn cycles mid-milestone. Each cycle risks reintroducing the SEED-001 bug or breaking the `pnpm.overrides` workaround.

**Why it happens:**
Upstream and downstream have independent release cadences. The upstream NUB authors may not coordinate their publish schedule with kehto's milestone timeline. This was explicitly flagged in the v1.7 milestone context: "All 4 new NUB domains (CLASS, CONNECT, CONFIG, RESOURCE) depend on canonical NUB spec availability in `@napplet/nub`. Upstream NUB publish state must be verified before locking phase plans."

**How to avoid:**
The SPEC resync phase (first phase of v1.7) must verify upstream publish state as its first action before any implementation work. If CLASS, CONNECT, CONFIG, and RESOURCE are not yet published in a single `@napplet/nub` release, the phase plan must defer NUB-specific implementation work until they are — or define a local stub that the phase can use while waiting. Under no circumstances should kehto plan four separate peer dep bumps mid-milestone. If the upstream publishes incrementally, keep all four on a local `link:` override pointing to the napplet checkout until all four are published together, then do a single bump.

**Warning signs:**
- The SPEC resync phase plan does not include "Verify @napplet/nub publish state" as its first step.
- `pnpm ls @napplet/nub` shows version `0.2.x` — none of the four new NUB domains are present.
- The v1.7 milestone has more than one `pnpm install` + lockfile commit mid-milestone for NUB peer dep bumps.

**Phase to address:**
SPEC resync phase (Phase 37). Gating requirement: all four new NUB subpaths are resolvable before phase closes.

---

### Pitfall H-09: registerNub Dispatch Order Collision When NUB Type Prefixes Overlap

**Severity:** HIGH

**What goes wrong:**
`@napplet/core`'s `createDispatch` + `registerNub` dispatch by `type` field prefix — a `class.*` message is routed to the `class` NUB handler. If NUB-CLASS introduces a `class.*` prefix AND the existing dispatch has any handler registered under a prefix that starts with `class` (e.g., a hypothetical `classify.*` handler), the first-registered handler that matches wins. More concretely: NUB-CONNECT introduces `connect.*` message types. If any existing NUB handler inadvertently uses a `connect.*` type in its error responses or acknowledgment messages, those messages are silently rerouted to the NUB-CONNECT handler instead of their origin domain.

This is also relevant for NUB-CONFIG: `config.*` must not collide with any `config.getNappUpdateBehavior` or similar internal message type that may exist in the test harness or existing NUB domains.

**Why it happens:**
Each NUB owns its message prefix by convention, but there is no registry that enforces uniqueness at `registerNub` time. The existing 8 NUBs have non-overlapping prefixes (relay, identity, storage, ifc, theme, keys, media, notify) but the 4 new ones (class, connect, config, resource) have not been verified against existing type strings in the codebase.

**How to avoid:**
Before implementing any new NUB, grep the entire codebase for any existing usage of the proposed message type prefix:

```bash
# Before implementing NUB-CLASS:
grep -rn '"class\.' packages/ apps/ tests/
# Before implementing NUB-CONNECT:
grep -rn '"connect\.' packages/ apps/ tests/
# Before implementing NUB-CONFIG:
grep -rn '"config\.' packages/ apps/ tests/
# Before implementing NUB-RESOURCE:
grep -rn '"resource\.' packages/ apps/ tests/
```

If any match is found, the existing usage must be renamed or accounted for before registering the new NUB. Additionally, verify `@napplet/nub`'s type definitions confirm no existing NUB emits these prefixes as secondary message types.

**Warning signs:**
- Any existing test fixture, E2E harness, or service handler emits a message with `type: 'config.*'`, `type: 'connect.*'`, `type: 'class.*'`, or `type: 'resource.*'`.
- `grep -rn '"connect\.accepted"' tests/` returns a match from the harness (could be an existing connection-acknowledgment message).

**Phase to address:**
SPEC resync phase. The prefix collision grep must be a required step in the first plan before any NUB handler is registered.

---

### Pitfall H-10: NIP-44 Ciphertext Origin Spoofing — Shell Cannot Verify Relay Provenance

**Severity:** HIGH

**What goes wrong:**
A napplet sends a decrypt request to the shell: `{ type: 'identity.decrypt', ciphertext: '...', senderPubkey: 'alice' }`. The shell trusts `senderPubkey` and derives the conversation key using the user's private key and Alice's public key, then decrypts. But the napplet controls `senderPubkey` — it can claim the ciphertext came from Alice when it actually came from someone else. If decryption succeeds (the ciphertext was encrypted to the user by the napplet itself using Alice's pubkey as a stand-in), the shell has been tricked into decrypting a message the user never received from Alice.

More critically: the napplet cannot forge a ciphertext that decrypts correctly without knowing the user's private key. ECDH means an invalid ciphertext produces garbage or a MAC verification failure — it does not produce a valid plaintext. NIP-44's AEAD guarantees MAC integrity. So the spoofing risk is limited to: a napplet that obtained a valid ciphertext from somewhere (e.g., via relay.subscribe for DMs) and claims it came from a different pubkey than the actual sender.

**Why it happens:**
The shell's decrypt surface takes a ciphertext and a claimed sender pubkey from the napplet. The napplet has relay:read access and can observe DMs it received. It cannot forge a valid ciphertext but it can relay a real ciphertext with a misattributed sender pubkey. The result is the shell tells the napplet "this message is from Alice" when it is actually from Bob.

**How to avoid:**
The NIP-44 decrypt phase plan must document this as a known limitation of the interface: "The shell decrypts using the napplet-provided senderPubkey. If the napplet provides a wrong senderPubkey, decryption fails (MAC error). The shell cannot verify relay provenance independently." This is acceptable because: (1) wrong senderPubkey means decryption fails with MAC error — no false-positive decryption; (2) the napplet only benefits from this if it already has the ciphertext AND knows the conversation key, which it cannot derive without the user's private key. Document the limitation in the NIP-44 decrypt spec comment; do not attempt to "fix" it by adding relay provenance tracking (scope creep).

**Warning signs:**
- The phase plan includes a requirement to "verify sender pubkey against relay metadata" — this is scope creep.
- The decrypt implementation silently succeeds when MAC validation fails (wrong senderPubkey → wrong conversation key → MAC failure should propagate, not be swallowed).

**Phase to address:**
NIP-44 decrypt phase. The limitation must be documented in a code comment at the decrypt handler call site.

---

## Medium-Severity Pitfalls

### Pitfall M-01: NUB-CLASS Napplet Cannot Forge Its Own Class — But This Must Be Enforced at the Shell, Not Trusted from the Napplet

**Severity:** MEDIUM

**What goes wrong:**
Napplets are untrusted. A napplet that attempts to send `{ type: 'class.request', class: 'admin' }` to elevate its own privileges must be silently dropped. The risk is that a NUB-CLASS handler implementation processes the `class.request` message and updates the session's class posture based on the napplet's claim.

Looking at the existing `enforce.ts`, the ACL gate is the correct chokepoint. But if NUB-CLASS implements a `class.request` handler (to allow class renegotiation), it must validate that the request is honored only when the SHELL initiates the assignment, not when the napplet requests it.

**Why it happens:**
The v1.7 milestone says "shell emits `class.assigned` envelope after shim bootstrap." If a `class.*` NUB handler also processes inbound `class.request` from napplets, a developer might implement the request path as "update the session class if napplet asks." This is a classic confused-deputy mistake.

**How to avoid:**
NUB-CLASS must have NO inbound handler for `class.request` from napplets. Class is shell-assigned only. The NIP-5D spec (section: Security Considerations) states napplets are untrusted — class assignment is a shell authority. If the spec defines a `class.request` message type for negotiation, that message must be silently dropped by the shell (per the "Unrecognized message types are silently ignored" rule in NIP-5D). Confirm this in the Layer-A spec: send `class.assign` from the napplet side and assert the session class does not change.

**Warning signs:**
- `packages/runtime/src/` contains a handler for `class.request` or `class.assign` that comes from the napplet direction.
- The NUB-CLASS Layer-A spec does not include a test asserting that napplet-originated class requests are ignored.

**Phase to address:**
NUB-CLASS adoption phase.

---

### Pitfall M-02: CACHE Polish Breaking Existing `createCacheService` Consumers via Type Rename

**Severity:** MEDIUM

**What goes wrong:**
The v1.7 scope includes adding a `HostCacheBridge` type alias to `createCacheService` for naming parity with `HostKeysBridge` / `HostMediaBridge`. The v1.6 audit (MILESTONE-AUDIT.md) explicitly documented this as "cosmetic polish only — existing options already provide the injection point functionally." The risk: if the implementation renames `CacheServiceOptions` to `HostCacheBridge` (removing the old name), any downstream consumer that imports `CacheServiceOptions` from `@kehto/services` has a type-level breaking change.

Looking at `cache-service.ts`, the current export is `CacheServiceOptions` and `createCacheService`. Hyprgate imports `createCacheService` and provides an inline options object — it does not import `CacheServiceOptions` directly. But other consumers might.

**Why it happens:**
"Rename for parity" sounds cosmetic. Developers perform the rename without checking downstream import sites. `pnpm type-check` only catches usages within the monorepo — not in external consumers.

**How to avoid:**
`HostCacheBridge` must be ADDED as a type alias that re-exports `CacheServiceOptions`, not a rename:

```ts
/** @deprecated Use HostCacheBridge */
export type CacheServiceOptions = HostCacheBridge;
export interface HostCacheBridge { /* same shape */ }
```

Or more simply: `export type HostCacheBridge = CacheServiceOptions;` with both names exported. Do NOT remove `CacheServiceOptions`. The changeset for this work must be classified as `patch` (not `minor` or `major`) because it is additive-only.

**Warning signs:**
- The CACHE polish PR removes `export interface CacheServiceOptions` and replaces it with `export interface HostCacheBridge`.
- The changeset for CACHE polish is classified `minor` or `major`.

**Phase to address:**
CACHE polish phase. First requirement: "Add `HostCacheBridge` as additive alias. Do NOT rename or remove `CacheServiceOptions`."

---

### Pitfall M-03: `@kehto/nip66` SimplePool Resource Leak on Demo Page Unload

**Severity:** MEDIUM

**What goes wrong:**
The v1.7 milestone wires `@kehto/nip66` demo integration (NIP66-05 follow-up). `createNip66Aggregator` holds an `unsubscribe` closure that callers must invoke on teardown. If the demo page wires the aggregator in `shell-host.ts` and calls `aggregator.start()` but does not call `aggregator.resync()` or the `unsubscribe` handle on page unload, the SimplePool subscription stays open for the lifetime of the browser tab even after the demo is "closed" (e.g., the user navigates away within the same SPA).

Looking at `nip66/src/index.ts`, `start()` saves `unsubscribe` in closure scope but exposes no `stop()` or `destroy()` method on the public `Nip66Aggregator` interface. Callers who want to clean up must call `resync()` (which unsubscribes then re-subscribes — wrong for teardown) or directly call the internal unsubscribe via the `relaySet` (which is not exposed).

**Why it happens:**
The `Nip66Aggregator` interface has `start()` and `resync()` but no `stop()` or `destroy()`. Demo wiring that calls `start()` on page load has no clean teardown path. The developer wires `start()` in `shell-host.ts` and assumes the connection is managed by the browser (which closes WebSockets on page unload). But if the demo is a SPA that does not fully unload, the subscription leaks.

**How to avoid:**
Add a `stop()` method to `Nip66Aggregator` before wiring the demo:

```ts
stop(): void {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
```

The demo wiring must call `aggregator.stop()` in its cleanup path (equivalent to `bridge.destroy()` in `ShellBridge`). Adding `stop()` is a backward-compatible addition to the `Nip66Aggregator` interface — it requires a patch or minor changeset for `@kehto/nip66`.

**Warning signs:**
- `Nip66Aggregator` interface in `packages/nip66/src/index.ts` has no `stop()` or `destroy()` method.
- The demo wiring code calls `aggregator.start()` without registering any cleanup for it.
- DevTools Network tab shows a persistent WebSocket connection to the bootstrap relay after the napplet demo is dismissed.

**Phase to address:**
`@kehto/nip66` demo wiring phase. First action: add `stop()` to the aggregator interface before wiring.

---

### Pitfall M-04: NUB-CONNECT Consent Flow Implicit Grant on Dialog Dismiss

**Severity:** MEDIUM

**What goes wrong:**
NUB-CONNECT requires a user consent flow when a napplet requests network access. The UX question: what happens when the user closes/dismisses the consent dialog without explicitly clicking "Allow" or "Deny"? If dismiss is treated as an implicit Allow (to reduce friction), a napplet can pop the dialog and the user can accidentally grant access. If dismiss is treated as Deny but the napplet re-requests on the next action, the user faces repeated prompts.

The existing `ConsentHandler` pattern in `shell-bridge.ts` uses `request.resolve(allowed: boolean)` — dismiss must call `resolve(false)`. But the timeout behavior (what happens if `resolve` is never called, e.g., user closes their browser) is not specified.

**Why it happens:**
Consent dialog UX is underspecified in the phase plan. The implementor picks a behavior that feels natural (often implicit Allow on dismiss) without considering the security implications.

**How to avoid:**
The NUB-CONNECT phase plan must specify the consent dialog contract: "Dismiss = Deny. Timeout = Deny. The consent flow MUST call `resolve(false)` on dismiss, close, or timeout. No implicit Allow." Wire this as a test: the E2E spec for NUB-CONNECT consent triggers a request, waits for the dialog to appear, presses Escape (dismiss), and asserts that the grant was NOT created.

**Warning signs:**
- The consent dialog handler calls `resolve(true)` on the dialog's `close` event.
- No E2E test for the dismiss/Escape behavior of the consent flow.
- `ConsentHandler` usage has no timeout guard.

**Phase to address:**
NUB-CONNECT adoption phase.

---

### Pitfall M-05: Anti-Term List Stale — New NUB Domain Short Names Not Yet Covered

**Severity:** MEDIUM

**What goes wrong:**
v1.6 added anti-term enforcement for `@napplet/nub-*` split form (Key Decision 20). The v1.7 milestone may introduce new banned patterns — e.g., if the canonical import for NUB-CLASS is `@napplet/nub/class` but some developer uses `@napplet/nub-class` (the old split form), the existing anti-term grep catches it. But if NUB-CONNECT introduces a new canonical import path that diverges from the existing subpath pattern (e.g., a combined `@napplet/nub/connect` vs. a hypothetical dedicated package), the anti-term list must be updated.

Beyond imports: if NUB-CLASS introduces new message type strings (`class.assigned`, `class.request`), demo code or test fixtures that use wrong casing or old names (e.g., `nub-class.assign` — an old draft name) will not be caught unless added to the anti-term list.

**Why it happens:**
Anti-term enforcement is grep-based and must be manually maintained. As new NUB domains and canonical names are defined, the list does not auto-update.

**How to avoid:**
The SPEC resync phase plan must include a step: "Update anti-term list with any new canonical names and their banned variants." After NUB-CLASS and NUB-CONNECT subpaths are confirmed in `@napplet/nub`, add both the correct form (to confirm it exists) and the banned form (to catch regressions) to the enforcement grep. This step should be a success criterion of the SPEC resync phase.

**Warning signs:**
- `grep -rn 'nub-class\|nub-connect\|nub-config\|nub-resource' packages/ apps/ tests/` returns matches after v1.7 begins (indicates split-form usage in new code).
- The SPEC resync phase plan has no anti-term update step.

**Phase to address:**
SPEC resync phase.

---

### Pitfall M-06: `@kehto/nip66` Multi-Instance Crosstalk via Shared SimplePool

**Severity:** MEDIUM

**What goes wrong:**
`createNip66Aggregator` is closure-scoped and multi-instance safe (each call owns its own `relaySet` and `relaySupportedNips` — no module globals). However, the `Nip66RelayPool` adapter injected by the consumer often wraps a shared `SimplePool` instance. If the consumer creates two aggregators pointing at the same `pool` instance with different `bootstrap` relays, the shared pool's subscription management may produce events from relay A in aggregator B's callback if SimplePool deduplicates subscriptions internally.

This is not a kehto bug but a consumer integration trap. The demo wiring (v1.7 NIP66-05 follow-up) creates a single aggregator — no multi-instance risk there. But if hyprgate creates multiple aggregators (e.g., one for clearnet, one for Tor), and they share a single pool, event routing may be non-deterministic.

**Why it happens:**
The `Nip66RelayPool` adapter pattern correctly isolates per-aggregator state. But the shared `SimplePool` beneath the adapter is a third-party library with its own subscription deduplication behavior that kehto does not control.

**How to avoid:**
The `@kehto/nip66` README must document: "If creating multiple aggregators, use separate pool instances or a pool that supports independent subscription namespaces." The demo wiring uses a single aggregator — no risk there. For the multi-instance case, consumers should create a fresh `new SimplePool()` per aggregator.

**Warning signs:**
- The demo wiring creates two `createNip66Aggregator` calls sharing the same `pool` instance.
- `packages/nip66/README.md` has no warning about shared-pool multi-instance behavior.

**Phase to address:**
`@kehto/nip66` demo wiring phase. Add the shared-pool warning to the README before wiring.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Implement NUB-CLASS as async `class.assigned` message after `shell.init` | Avoids refactoring `onNip5dIframeCreate` | Race window where napplet requests arrive before class is assigned; class-restricted napplets issue privileged requests | Never — class must resolve synchronously at iframe creation |
| Add class-posture check inside individual NUB handlers rather than `enforce.ts` | Fast to implement in one handler | All other NUB handlers become bypass paths; every new NUB handler must remember to add the check | Never — class gating belongs in the enforce gate |
| Use `publishTheme`'s `getAllWindowIds()` loop as the model for NIP-44 decrypt response | Reuses existing infrastructure | Decrypted plaintext broadcasted to all napplets — critical privacy breach | Never — decrypt responses must be single-target |
| Add `HostCacheBridge` by renaming `CacheServiceOptions` | Clean naming parity | Breaking change for downstream consumers importing the old name | Never — add alias, keep old name |
| Skip CSP header in `configurePreviewServer` hook | Simpler implementation | NUB-CONNECT security model broken in `pnpm preview` and production | Never |
| Implement NUB-RESOURCE without NUB-CONNECT grant validation | Simpler reference service | Shell becomes an unconstrained proxy; any napplet can exfiltrate to any URL | Never |
| Wire `@kehto/nip66` demo without adding `stop()` to aggregator | No interface change needed | Permanent WebSocket subscription leak in SPA demos | Only if demo page always fully unloads on teardown — not guaranteed |
| Allow consent dialog dismiss as implicit grant | Reduced UX friction | Users accidentally grant network access; napplets can pop-and-close to harvest grants | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NUB-CLASS × `onNip5dIframeCreate` | Resolving class asynchronously after `shell.init` is sent | Class must be resolved before `shell.init`; extend `onNip5dIframeCreate` return type to include `class` field |
| NUB-CONNECT × `aclStore` | Storing connect grants as boolean capabilities in the existing ACL bitfield | Connect grants are URL-scoped, not boolean; they need their own grant store keyed on `(dTag, aggregateHash, url)` — not a new `Capability` string |
| NUB-RESOURCE × NUB-CONNECT grants | Implementing `createResourceService` without access to the connect grant store | `createResourceService` factory must accept `getConnectGrants` as a required dependency at construction time |
| NIP-44 × `relay.subscribe` | Assuming napplet-received DMs can be verified for provenance by the shell | Shell cannot verify which relay sent a ciphertext; document as known limitation and rely on NIP-44 MAC for integrity |
| `@kehto/nip66` × SimplePool | Creating multiple aggregators with shared pool instances | Each aggregator should receive its own pool instance if routing independence is required |
| NUB-CONNECT × Vite deploy | Testing CSP headers only in `vite dev` mode | `configurePreviewServer` must be added alongside `configureServer`; test in preview mode with `curl -I` |
| `HostCacheBridge` × existing consumers | Renaming `CacheServiceOptions` | Export `HostCacheBridge` as a type alias that preserves `CacheServiceOptions`; both names live concurrently |
| NUB-CLASS × `DEMO_NAPPLETS` | Adding new napplets to the loop without updating class-assignment logic | Drive class assignment from a `CLASS_BY_DTAG` map that lives alongside `DEMO_NAPPLETS` |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| NUB-CLASS implemented as napplet-upgradeable (processing `class.request` from napplet) | Napplet self-elevates to unrestricted class | Never process napplet-originated class assignment; class is shell-only authority |
| NIP-44 decrypt response broadcast to all iframes | Decrypted DM plaintext delivered to every napplet in the shell | Route decrypt response exclusively to the requesting `windowId` |
| NUB-RESOURCE without connect-grant validation | Shell becomes an unconstrained proxy; napplets exfiltrate to arbitrary URLs | `createResourceService` must check connect grant for requested URL before performing fetch |
| Meta-CSP `<meta http-equiv="Content-Security-Policy">` surviving into napplet dist | NUB-CONNECT refuse-to-serve invariant violated; spec non-compliant | CI grep of built dist: `grep -rn 'http-equiv.*Content-Security-Policy' apps/demo/napplets/*/dist/` |
| Consent dialog dismiss treated as implicit grant | Napplet harvests access by triggering and immediately closing consent dialog | Dismiss and timeout MUST call `resolve(false)` |
| NIP-44 key derivation using two public keys | Decryption silently fails (wrong key → MAC error) or produces garbage | Unit test against NIP-44 spec test vector before any live integration |
| CSP revocation not enforced until iframe reload | User revokes grant but browser's loaded CSP still allows direct connections | Revocation must trigger iframe destroy + recreate; document this in UX copy |

---

## "Looks Done But Isn't" Checklist

- [ ] **NUB-CLASS class assignment:** Class posture appears in session registry for new napplets — but is it assigned BEFORE `shell.init` is sent (not after)? Verify: add a napplet that immediately sends `relay.publish` after `shell.ready` and assert the class gate was applied to that first message.
- [ ] **NUB-CLASS cross-NUB invariant:** Layer-B spec asserts class gating for the relay domain — but does it also assert class gating for `storage.*`, `identity.*`, `config.*`, and `resource.*`? Verify: `grep -rn 'class' tests/e2e/` and confirm at least one assertion per NUB domain.
- [ ] **NUB-CONNECT CSP headers in preview mode:** CSP headers appear in `vite dev` — but do they also appear in `vite preview`? Verify: `curl -I http://localhost:4173/napplets/config-napplet/` shows `Content-Security-Policy` header.
- [ ] **NUB-CONNECT residual meta-CSP:** New napplet scaffolds (config-napplet, resource-napplet) have no meta-CSP in source `index.html` — but does the BUILD output also lack it? Verify: `grep -n 'http-equiv' apps/demo/napplets/config-napplet/dist/index.html` returns no match.
- [ ] **NUB-CONNECT revocation:** Grant revoked in ACL — but is the iframe destroyed and recreated? Verify: E2E spec revokes a grant and asserts the iframe `src` was reset (iframe reload occurred).
- [ ] **NUB-RESOURCE × NUB-CONNECT coupling:** `createResourceService` factory compiles — but does it accept and validate a `getConnectGrants` dependency? Verify: call `createResourceService` in a unit test with a grant store that returns empty; assert `resource.fetch` for an unknown URL is denied.
- [ ] **CACHE polish additive-only:** `HostCacheBridge` type exported from `@kehto/services` — but is `CacheServiceOptions` also still exported? Verify: `grep -n 'CacheServiceOptions' packages/services/src/cache-service.ts` returns an export declaration.
- [ ] **`@kehto/nip66` teardown:** `aggregator.start()` called in demo wiring — but does the cleanup path call `aggregator.stop()`? Verify: `grep -n 'aggregator.stop\|aggregator.destroy' apps/demo/src/shell-host.ts` returns a match.
- [ ] **NIP-44 key derivation:** Decrypt implementation calls `getConversationKey(privateKey, publicKey)` — but is `privateKey` actually the user's private key (from `AuthHooks.getSigner()`) not a public key? Verify: unit test against NIP-44 spec test vector.
- [ ] **NUB-CLASS new napplets:** `config-napplet` and `resource-napplet` added to `DEMO_NAPPLETS` — but are they also in `CLASS_BY_DTAG`? Verify: `grep -n 'config-napplet\|resource-napplet' apps/demo/src/shell-host.ts` returns matches in both `DEMO_NAPPLETS` and the class map.
- [ ] **registerNub prefix collision:** New NUB domains registered — but were the prefixes (`class`, `connect`, `config`, `resource`) verified against existing type strings? Verify: `grep -rn '"config\.\|"connect\.\|"class\.\|"resource\.' packages/ apps/ tests/` before any new NUB registration.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Class-posture race condition (messages arriving before class assigned) | HIGH | Refactor `onNip5dIframeCreate` return type to include `class`; update `shell.init` payload; remove async `class.assigned` step; re-run full E2E baseline |
| Cross-NUB class invariant regression | MEDIUM | Add missing class gate to `enforce.ts`; add Layer-B assertions for all NUB domains; one regression = add test + fix gate |
| Meta-CSP in napplet dist | LOW | Remove offending Vite plugin or add `exclude` rule; rebuild napplet; re-run CI grep |
| CSP allowlist surviving revocation | MEDIUM | Add iframe destroy/recreate on revocation; update UX copy; E2E test for reload behavior |
| Shell-HTTP-header authority missing in preview | LOW | Add `configurePreviewServer` hook alongside existing `configureServer`; verify with `curl -I` |
| NIP-44 decrypt broadcast to all iframes | CRITICAL | Replace `getAllWindowIds()` loop with single `originRegistry.getIframeWindow(windowId)` call; add E2E isolation test |
| NUB-RESOURCE without connect-grant validation | HIGH | Add `getConnectGrants` to factory signature; implement URL validation before fetch; all existing callers must provide grant store |
| `HostCacheBridge` breaking rename | LOW | Revert to additive alias pattern; re-publish patch changeset |
| SimplePool resource leak in nip66 demo | LOW | Add `stop()` to `Nip66Aggregator` interface + implementation; wire to demo cleanup |
| NUB-CONNECT implicit grant on dismiss | LOW | Change dialog handler to call `resolve(false)` on close event; add E2E dismiss test |
| NIP-44 key derivation error | MEDIUM | Identify wrong key parameter; fix derivation call; verify against spec test vector; note: if wrong key was used in production, all previously decrypted results may be invalid |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| C-01: NUB-CLASS pre-assignment race | SPEC resync + NUB-CLASS adoption — class resolves synchronously in `onNip5dIframeCreate` | E2E: napplet sends request immediately after `shell.ready`; class gate applied to first request |
| C-02: Cross-NUB class invariant regression | NUB-CLASS adoption — gate in `enforce.ts`, not handlers | Layer-B spec asserts class gating for ALL 10 NUB domains |
| C-03: Residual meta-CSP in dist | NUB-CONNECT adoption — CI audit script | `pnpm audit:csp` returns exit 0; `grep -rn 'http-equiv.*Content-Security-Policy' apps/demo/napplets/*/dist/` empty |
| C-04: CSP allowlist surviving revocation | NUB-CONNECT adoption — iframe reload on revocation | E2E: revoke grant → assert iframe reload occurred |
| C-05: Shell-HTTP-header authority missing in production | NUB-CONNECT adoption — `configurePreviewServer` + SHELL-CONNECT-POLICY.md | `curl -I http://localhost:4173/napplets/...` returns CSP header |
| C-06: NIP-44 plaintext routed to wrong iframe | NIP-44 decrypt phase — single-target routing | E2E: two iframes; decrypt request from iframe A; assert iframe B does NOT receive plaintext |
| H-01: `srcdoc` iframe bypassing meta-CSP check | NUB-CONNECT adoption — CI anti-srcdoc grep | `grep -n 'srcdoc' apps/demo/index.html apps/demo/src/*.ts` returns no matches |
| H-02: Grant key hash collision on rebuild | NUB-CONNECT adoption — hash-upgrade UX policy in `onHashMismatch` | E2E: rebuild napplet with new hash; assert consent re-prompt fires (or auto-migrate fires) |
| H-03: NUB-RESOURCE exfiltration without connect grant | NUB-RESOURCE phase — `getConnectGrants` in factory | Layer-A spec: `resource.fetch` denied for URL not in connect grant list |
| H-04: `@kehto/wm` over-prescribed layout API | WM abstractions phase — interfaces only | `packages/wm/src/index.ts` exports no algorithm-specific types; size < 200 lines |
| H-05: DEMO_NAPPLETS drift on new napplets | NUB-CLASS adoption — `CLASS_BY_DTAG` map | `grep 'config-napplet\|resource-napplet' apps/demo/src/shell-host.ts` matches both DEMO_NAPPLETS and CLASS_BY_DTAG |
| H-06: NIP-44 key derivation pub+pub error | NIP-44 decrypt phase — unit test with spec test vector | `packages/shell/src/` decrypt unit test passes NIP-44 spec test vector |
| H-07: NUB-CONFIG scope creep into NUB-STORAGE | NUB-CONFIG phase — scope boundary in README and descriptor | `createConfigService` requires schema identifier in payload; README anti-pattern section present |
| H-08: `@napplet/nub` publish cadence lockfile churn | SPEC resync phase — verify publish state before planning | `pnpm ls @napplet/nub/class @napplet/nub/connect` resolves before any NUB implementation work begins |
| H-09: registerNub dispatch prefix collision | SPEC resync phase — prefix grep before each NUB registration | `grep -rn '"class\.\|"connect\.\|"config\.\|"resource\.' packages/ tests/` returns no legacy usage |
| H-10: NIP-44 ciphertext origin spoofing | NIP-44 decrypt phase — documented limitation, MAC integrity | Code comment at decrypt handler; MAC failure propagates, not swallowed |
| M-01: Napplet-forged class elevation | NUB-CLASS adoption — no inbound class handler | Layer-A spec: napplet-originated `class.assign` is silently ignored |
| M-02: CACHE polish breaking rename | CACHE polish phase — additive alias only | `grep -n 'export.*CacheServiceOptions' packages/services/src/cache-service.ts` returns match post-polish |
| M-03: SimplePool resource leak | `@kehto/nip66` demo wiring phase — add `stop()` first | `Nip66Aggregator.stop()` method exists; demo wiring cleanup path calls it |
| M-04: Consent dialog implicit grant on dismiss | NUB-CONNECT adoption — resolve(false) on dismiss | E2E: press Escape on consent dialog; assert grant NOT created |
| M-05: Anti-term list stale | SPEC resync phase — update anti-term list | Anti-term grep covers `nub-class`, `nub-connect`, `nub-config`, `nub-resource` |
| M-06: `@kehto/nip66` multi-instance crosstalk | `@kehto/nip66` demo wiring phase — README warning | README warns about shared-pool multi-instance behavior |

---

## Sources

- Direct codebase analysis: `packages/shell/src/acl-store.ts` — grant keying on `(dTag, aggregateHash)`, `aclStore.revoke()` + `persist()` not triggering iframe reload
- Direct codebase analysis: `packages/shell/src/shell-bridge.ts` — `publishTheme` broadcast pattern via `getAllWindowIds()` (decrypt must NOT use this), `handleMessage` windowId extraction
- Direct codebase analysis: `packages/shell/src/enforce.ts` — `createNubEnforceGate` as single enforcement chokepoint; class posture must be added here, not in handlers
- Direct codebase analysis: `packages/shell/src/types.ts` — `ShellAdapter.onNip5dIframeCreate`, `ConsentHandler`, `onHashMismatch`, `ConfigHooks.getNappUpdateBehavior` — all relevant injection points for NUB-CLASS and NUB-CONNECT
- Direct codebase analysis: `packages/acl/src/capabilities.ts` — current capability surface (8 NUBs × their caps); new NUB-CLASS, NUB-CONNECT, NUB-CONFIG, NUB-RESOURCE must add caps without colliding
- Direct codebase analysis: `packages/services/src/cache-service.ts` — `CacheServiceOptions` export shape; CACHE polish must be additive
- Direct codebase analysis: `packages/nip66/src/index.ts` — `Nip66Aggregator` interface has no `stop()` method; `unsubscribe` closure not exposed; multi-instance safety confirmed via closure scope
- Direct codebase analysis: `packages/wm/src/index.ts` — skeleton confirms `Layout = 'dwindle' | 'master-stack' | 'floating' | (string & {})` with hardcoded layout names; risk of over-prescription
- Direct codebase analysis: `packages/runtime/src/enforce.ts` — `createNubEnforceGate` is the correct injection point for class posture gating
- Direct codebase analysis: `apps/demo/src/shell-host.ts` — `DEMO_NAPPLETS` data-driven pattern (Key Decision 16); no existing class-assignment map
- Direct codebase analysis: `apps/demo/vite.config.ts` — `configureServer` and `configurePreviewServer` both present for napplet serve middleware; NUB-CONNECT must follow same pattern for CSP header injection
- Direct codebase analysis: `specs/NIP-5D.md` — Transport section: `allow-same-origin` MUST NOT be present; Security Considerations: napplets are untrusted; shell is trusted; `MessageEvent.source` is unforgeable; Security item 6: shells MUST NOT sign or broadcast events containing ciphertext received from a napplet
- `.planning/PROJECT.md` Key Decisions 11–22 — especially KD-16 (data-driven shell UI to prevent DEMO-02 drift), KD-18 (HostXxxBridge injection pattern), KD-19 (audit-before-execute for carryover items)
- `.planning/milestones/v1.6-MILESTONE-AUDIT.md` — CACHE-01..05 dropped because existing `CacheServiceOptions` already functioned as bridge; SEED-001 for `@napplet/nub` publish bug; confirms DEMO_NAPPLETS drift risk pattern
- `.planning/milestones/v1.3-research/PITFALLS.md` — v1.3 pitfalls confirmed still applicable; `srcdoc` trap documented at "test fixtures only"; `configurePreviewServer` gap documented as Pitfall 3 analog

---
*Pitfalls research for: kehto v1.7 — NIP-5D Spec Adoption & New NUB Domains*
*Researched: 2026-04-24*
