# Feature Research: v1.7 — NIP-5D Spec Adoption & New NUB Domains

**Domain:** Napplet runtime / shell-side protocol adoption
**Researched:** 2026-04-24
**Confidence:** HIGH — all canonical spec files verified in local napplet repo (`/home/sandwich/Develop/napplet`) plus upstream type definitions in `@napplet/nub/src/`

---

## Research Notes

Sources consulted:

- `napplet/specs/SHELL-CLASS-POLICY.md` — NUB-CLASS shell checklist (authoritative)
- `napplet/specs/SHELL-CONNECT-POLICY.md` — NUB-CONNECT shell checklist (authoritative)
- `napplet/specs/SHELL-RESOURCE-POLICY.md` — NUB-RESOURCE shell checklist (authoritative)
- `napplet/packages/nub/src/class/types.ts` — `ClassAssignedMessage` wire type (authoritative)
- `napplet/packages/nub/src/class/shim.ts` — shim install pattern (authoritative)
- `napplet/packages/nub/src/connect/types.ts` — `NappletConnect` + `normalizeConnectOrigin` (authoritative)
- `napplet/packages/nub/src/config/types.ts` — all config NUB wire types (authoritative)
- `napplet/packages/nub/src/resource/types.ts` — all resource NUB wire types (authoritative)
- `napplet/packages/nubs/config/README.md` — NUB-CONFIG developer-facing API (authoritative)
- `napplet/.changeset/v0.29.0-nub-connect-class.md` — NUB-CLASS + NUB-CONNECT ship notes
- `napplet/.changeset/v0.30.0-class-gated-decrypt-surface.md` — NIP-44 decrypt gating notes
- `kehto/packages/wm/src/index.ts` — current v0.0.0 skeleton (what exists today)
- `kehto/packages/nip66/README.md` — ShellAdapter integration seam
- `kehto/apps/demo/src/shell-host.ts` — 10-napplet demo structure, service wiring patterns

---

## Feature Landscape

### Table Stakes (Must-Have for v1.7 Milestone Goal)

| Feature | Why Required | Complexity | Category |
|---------|--------------|------------|----------|
| SPEC resync (`specs/NIP-5D.md`) | All CLASS/CONNECT adoption depends on the current upstream spec text; local pin is v1.2-vintage | LOW | Spec |
| NUB-CLASS shell emission (`class.assigned`) | Core spec-adoption deliverable; shell-authority guarantee | MEDIUM | ShellAuthority |
| NUB-CLASS ACL + dispatch honor | Without this, `class.assigned` is paper — actual capability decisions unchanged | MEDIUM | ShellAuthority |
| NUB-CLASS Layer-B invariant spec (E2E) | Validates the cross-NUB wire contract at Playwright level; gates milestone close | MEDIUM | ShellAuthority |
| NUB-CONFIG reference service (9th domain) | Part of stated milestone goal; `@kehto/services` handler | MEDIUM | NewNUBs |
| NUB-CONFIG demo napplet (11th napplet) | Required for Layer-A + Layer-B E2E evidence | MEDIUM | NewNUBs |
| NUB-RESOURCE reference service (10th domain) | Part of stated milestone goal; `@kehto/services` handler | MEDIUM | NewNUBs |
| NUB-RESOURCE demo napplet (12th napplet) | Required for Layer-A + Layer-B E2E evidence | MEDIUM | NewNUBs |
| SHELL-CLASS-POLICY.md audit checklist | Deployment sign-off gate specified in SHELL-CLASS-POLICY.md | LOW | ShellAuthority |

### Differentiators (Valuable but Not Milestone-Critical)

| Feature | Value Proposition | Complexity | Category |
|---------|-------------------|------------|----------|
| NUB-CONNECT adoption (CSP + consent flow) | Full Class-2 posture; enables network-capable napplets | LARGE | ShellAuthority |
| NUB-CONNECT residual meta-CSP scan | Safety gate for Class-2 deployment; parser-based, 5-fixture conformance | MEDIUM | ShellAuthority |
| NUB-CONNECT grant persistence `(dTag, aggregateHash)` | Keying contract that prevents silent supply-chain upgrade | MEDIUM | ShellAuthority |
| NUB-CONNECT SHELL-CONNECT-POLICY.md audit checklist | Deployment sign-off gate | LOW | ShellAuthority |
| `@kehto/nip66` demo wiring | NIP66-05 follow-up; proves `getNip66Suggestions()` end-to-end | LOW | Polish |
| `@kehto/wm` structural primitives | Consumer-facing abstract API; unblocks hyprgate wm.ts portability | MEDIUM | Polish |
| CACHE naming parity (`HostCacheBridge`) | Cosmetic; functional injection already works (kehto#1) | LOW | Polish |
| NIP-44 decrypt surface (soft-gated) | Blocks on napplet/napplet#3 upstream decision | MEDIUM | SoftGated |

### Anti-Features (Do Not Build in v1.7)

| Feature | Why Requested | Why Problematic | What To Do Instead |
|---------|---------------|-----------------|-------------------|
| Dynamic mid-session class re-assignment | Seems like a clean "upgrade" path for running napplets | Explicitly out of scope per NUB-CLASS spec; at-most-one envelope per lifecycle — a second is a protocol violation | Tear down + recreate the iframe (Option A per SHELL-CLASS-POLICY.md) |
| Shell-side `window.nostr` injection | NIP-07 compat for napplets that directly call `window.nostr` | Forbidden by NIP-5D §Transport; shell MUST NOT provide window.nostr; plaintext decrypt must go through `identity.decrypt` (NUB-CLASS-1 gated) | Require napplets to use `identity.getPublicKey()` + `relay.publish` protocol path; NIP-44 decrypt via `identity.decrypt` when upstream unblocks |
| Generic `config.set` wire message | Napplets wanting to write their own config | Spec says shell is sole writer — no `config.set` wire message exists in NUB-CONFIG by design; napplet writes create TOCTOU issues across shared shell settings UI | Napplets declare schema; shell renders settings UI; values flow shell→napplet only |
| CSP via `<meta http-equiv>` in napplet HTML | Simpler than HTTP-header authority | Browser intersection semantics silently suppress Class-2 grants; NUB-CONNECT explicitly requires HTTP header delivery; residual meta-CSP must be refused-to-serve for Class-2 napplets | Shell becomes HTTP response-header authority (required infrastructure for NUB-CONNECT) |
| NUB-CONNECT MIME/SVG filtering | Tempting to add byte-level controls on CONNECT traffic | NUB-CONNECT explicitly N/A for MIME sniffing, SVG rasterization, redirect limits — browser CSP is transparent to shell post-grant | Those controls belong to NUB-RESOURCE (already scoped for v1.7); CONNECT is consent-gated only |

---

## Feature Semantic Details

### 1. NUB-CLASS Semantics

**What a "class posture" is:**
A shell-assigned integer that selects a concrete security envelope. Class 1 = NUB-CLASS-1 (strict baseline: `connect-src 'none'`, zero direct egress, eligible for `identity.decrypt`). Class 2 = NUB-CLASS-2 (user-approved direct-network posture: `connect-src <granted-origins>`, cannot decrypt). The integer is extensible — future `NUB-CLASS-N` members can be added without changing the wire format.

**Wire format for `class.assigned`:**

```typescript
// From napplet/packages/nub/src/class/types.ts (authoritative)
interface ClassAssignedMessage {
  type: 'class.assigned';
  id: string;       // fresh correlation UUID; no napplet response expected
  class: number;    // non-negative integer; 1 = strict, 2 = user-approved network
}
```

No napplet→shell messages exist in NUB-CLASS. The domain is shell→napplet only, one envelope per lifecycle.

**When the shell emits it:**
After shim bootstrap complete (shim emits its ready signal → shell dispatches synchronously). Never before (lost in dead listener), never after napplet code can branch on class (race). Coupling to the shim's ready signal is the canonical approach per SHELL-CLASS-POLICY.md §Wire Timing.

In kehto terms: the ShellBridge already tracks the first envelope arrival from napplet→shell as the "authenticated" moment for NIP-5D napplets (see `shell-host.ts` Path B). The `class.assigned` send should be wired to that same boundary: on the first inbound envelope from the napplet's iframe, the runtime dispatches `class.assigned` synchronously before any other outbound envelope.

**ACL decisions based on class posture:**
- Class 1 napplets: eligible for `identity.decrypt` (when NIP-44 decrypt surface lands); zero direct-network egress enforced by CSP
- Class 2 napplets: `identity.decrypt` returns `class-forbidden`; direct network access to user-approved origins via browser CSP
- ACL `@kehto/acl` does not directly key on class integer today — the class influences which capabilities are *grantable*, not whether granted caps are checked. Class becomes an additional ACL pre-filter layer: `if (classPosture === 2 && capability === 'identity:decrypt') → deny`

**Layer-B cross-NUB invariants (concrete examples):**
1. `class === 2` iff `connect.granted === true` at `class.assigned` send time. Any other combination is non-conformant and MUST NOT be emitted by the shell.
2. `class.assigned` MUST arrive exactly once per napplet lifecycle; a second envelope is a protocol violation (E2E spec must assert that the shell does NOT emit two).
3. `class === undefined` (pre-assignment) is distinct from `class === 1`; a napplet that reads `window.napplet.class` before the envelope arrives MUST observe `undefined`, not `1`.

### 2. NUB-CONNECT Semantics

**What NUB-CONNECT does:**
Grants a napplet direct network access (WebSocket, fetch POST, SSE, streaming) to a user-approved origin list. This bypasses the shell-as-proxy model entirely. The shell enforces the grant via the HTTP `Content-Security-Policy: connect-src <origins>` response header — there is no postMessage wire protocol for NUB-CONNECT itself.

**Wire format:** None. NUB-CONNECT has NO postMessage wire surface. Instead:
- **Manifest tags:** `['connect', '<origin>']` per approved origin (declared by napplet at build time via `@napplet/vite-plugin`'s `connect: string[]` option)
- **HTTP header (shell-emitted):** `Content-Security-Policy: connect-src <granted-origins>` in the HTTP response for the napplet's HTML
- **Shell-injected meta tag:** `<meta name="napplet-connect-granted" content="<origins>">` read by the shim synchronously at install time, populating `window.napplet.connect.{granted, origins}`

**Consent UX pattern (from SHELL-CONNECT-POLICY.md):**
1. Shell detects `['connect', '<origin>']` tags in NIP-5A manifest
2. Shell checks `(dTag, aggregateHash)` against grant persistence store
3. If no prior decision: shell surfaces consent prompt with:
   - Napplet name from manifest
   - Full verbatim origin list (no truncation, no "4 others")
   - Explicit "send AND receive any data with these origins"
   - Explicit "shell cannot see or filter post-grant traffic"
   - Visible marking of any `http:`/`ws:` cleartext origins
4. User approves → shell persists `{dTag, aggregateHash, origins, decision: 'approved', decidedAt}` to ALLOWED state
5. User denies → persists to DENIED state; never deleted on revocation

**Grant persistence key:** `(dTag, aggregateHash)` composite — exact match required. `aggregateHash` includes the `connect:origins` fold (ASCII-sorted origins → SHA-256), so any origin-set change in a rebuild produces a new key → fresh consent prompt.

**Residual meta-CSP scan:**
For Class-2 napplets only (manifest has `['connect', ...]` tags), the shell MUST run a WHATWG-compliant HTML parser scan before serving. If any `<meta http-equiv="Content-Security-Policy">` element is found in the napplet's HTML, refuse-to-serve with a diagnostic. For Class-1 napplets, skip the scan (intersection of `'none'` and `'none'` is harmless). Must use `parse5` or `htmlparser2` — not regex.

**Infrastructure requirement:**
Shell MUST control HTTP response headers for napplet HTML. For kehto's demo shell (Vite dev server + `vite preview`), this means a Vite server plugin that intercepts requests to `/napplets/*/index.html` and injects the per-napplet `Content-Security-Policy` header. Direct serving + CDN cache-invalidation-on-grant-change must be documented.

**"Refuse-to-serve scan" in CI context:**
This is NOT a CI check in the traditional sense. It is a shell-side runtime guard that fires when the shell serves the napplet HTML. The distinction: CI runs once at build time; the residual-meta-CSP scan runs at serve time in the shell process for every Class-2 napplet load. A CI-time analog (scanning dist/index.html during the napplet build) is complementary but not a substitute — the shell-side scan is the normative one because napplet HTML may be fetched live from a CDN.

### 3. NUB-CONFIG Semantics

**What the 9th domain does:**
Per-napplet structured configuration. The shell renders a settings UI, validates values against a JSON Schema declared by the napplet, persists values scoped by `(dTag, aggregateHash)`, and delivers live validated+defaulted values to the napplet via snapshot + push. The napplet is read-only; no `config.set` message exists.

**Key difference from NUB-STORAGE:**
- `storage` NUB: napplet-controlled key/value store, arbitrary data, napplet reads and writes
- `config` NUB: shell-controlled settings surface, JSON-Schema-validated, shell writes, napplet reads only; shell owns the settings UI and renders it from the schema

**Wire messages (from `napplet/packages/nub/src/config/types.ts`):**

Napplet → Shell:
- `config.registerSchema` — `{id, schema: JSONSchema7, version?}` — register schema at runtime (escape hatch; prefer manifest-declared)
- `config.get` — `{id}` → one-shot snapshot
- `config.subscribe` — `{}` → start live push stream
- `config.unsubscribe` — `{}` → stop push stream
- `config.openSettings` — `{section?}` → deep-link shell settings UI

Shell → Napplet:
- `config.registerSchema.result` — `{id, ok: boolean, code?, error?}` — ACK or rejection
- `config.values` — `{id?, values: Record<string,unknown>}` — dual-use: correlated response (with `id`) OR push (without `id`)
- `config.schemaError` — `{code, error}` — uncorrelated error push

**Schema subset restrictions:**
- Allowed types: `string`, `number`, `integer`, `boolean`, `object` (top-level), `array` of primitives
- Allowed keywords: `default`, `title`, `description`, `enum`, `minimum`/`maximum`, `minLength`/`maxLength`
- Not allowed: `pattern` (ReDoS risk per CVE-2025-69873), `$ref`, `oneOf`/`anyOf`/`allOf`, `x-napplet-secret: true` + `default` combined

**Expected handler API shape** (following `createNotificationService` + `createKeysService` patterns):

```typescript
export interface ConfigServiceOptions {
  /** Load persisted values for a napplet (keyed by dTag + aggregateHash). */
  getValues(dTag: string, aggregateHash: string): Promise<ConfigValues>;
  /** Persist values after shell settings UI update. */
  setValues(dTag: string, aggregateHash: string, values: ConfigValues): Promise<void>;
  /** Called when the shell's settings UI should open for this napplet. */
  onOpenSettings?(dTag: string, aggregateHash: string, section?: string): void;
}

export function createConfigService(options: ConfigServiceOptions): ServiceHandler;
```

The handler maps `windowId` → `(dTag, aggregateHash)` via the session registry to scope all reads/writes correctly. Subscribe/unsubscribe is ref-counted per the NUB-CONFIG spec. The `config.values` push must fire immediately on subscribe (initial snapshot) and on every `setValues` call for subscribed windows.

### 4. NUB-RESOURCE Semantics

**What the 10th domain does:**
Shell-as-fetch-proxy for napplets. Napplets request bytes by URL; the shell fetches them with full policy enforcement (private-IP block list, MIME byte-sniffing, SVG rasterization, redirect chain limits, size/rate/quota caps) and delivers a single Blob back. Napplets cannot directly `fetch()` or open WebSockets in Class-1 posture — NUB-RESOURCE is the only network path.

**What a "resource" is:**
A URL-addressable byte payload. Four canonical schemes in v0.28.0+: `data:` (RFC 2397, decoded in-shim), `https:` (full policy), `blossom:sha256:<hex>` (hash-verified), `nostr:<bech32>` (NIP-19 single-hop resolution). Read-only from napplet perspective — no `PUT`, `POST`, or WebSocket.

**Relationship to NUB-CONNECT:**
NUB-RESOURCE and NUB-CONNECT are complementary:
- NUB-RESOURCE: shell-mediated, policy-filtered, read-only; works in all class postures; recommended default
- NUB-CONNECT: direct browser fetch, user-consent-gated, bidirectional; only available in Class-2

Wire messages (from `napplet/packages/nub/src/resource/types.ts`):

Napplet → Shell:
- `resource.bytes` — `{id, url}` — fetch request
- `resource.cancel` — `{id}` — cancel in-flight request

Shell → Napplet:
- `resource.bytes.result` — `{id, blob: Blob, mime: string}` — success
- `resource.bytes.error` — `{id, error: ResourceErrorCode, message?}` — typed failure

Error codes: `not-found`, `blocked-by-policy`, `timeout`, `too-large`, `unsupported-scheme`, `decode-failed`, `network-error`, `quota-exceeded`

**Expected handler API shape** (following `HostCacheBridge` / `HostMediaBridge` injection pattern, Decision 18):

```typescript
export interface ResourceServiceOptions {
  /**
   * Fetch bytes for a URL and return the response.
   * Shell implements full policy enforcement here (private-IP block, MIME sniff, etc.).
   * The host bridge IS the options object per Decision 18.
   */
  fetch(url: string, signal?: AbortSignal): Promise<{ blob: Blob; mime: string }>;
  /** Whether the resource service is available (e.g., false in pure-offline shells). */
  isAvailable?(): boolean;
}

export function createResourceService(options: ResourceServiceOptions): ServiceHandler;
```

The handler manages per-napplet in-flight request tracking (for cancel support), delegates to `options.fetch` with an AbortSignal, and enforces rate/quota caps. Policy enforcement (private-IP block, SVG rasterization) lives in the `options.fetch` implementation provided by the host — the reference service hands responsibility to the consumer per the kehto framework-agnostic philosophy (Decision 7).

### 5. `@kehto/wm` Structural Primitives

**Current state:** v0.0.0 throwing stub. `WmService`, `WmHostHooks`, `WindowId`, `WorkspaceId`, `Rect`, `Layout` type union already exported. The factory `createWmService({ hooks })` throws with a design note.

**What "structural primitives" means for consumers:**
Hyprgate runs its own WM impl at `apps/shell/src/lib/services/wm.ts`. The ask is: abstract shapes that consumers implement to wire their own layout logic without re-inventing the vocabulary. No concrete layout algorithms ship in this package.

**Candidate API shapes:**

**Option A — Abstract class (OOP, explicit override points):**
```typescript
// Consumer subclasses and overrides arrange()
export abstract class LayoutEngine {
  abstract arrange(windows: ReadonlyArray<WindowRect>): ReadonlyArray<WindowRect>;
  abstract onWindowAdded(id: WindowId, preferred: Rect): void;
  abstract onWindowRemoved(id: WindowId): void;
  abstract onWindowFocused(id: WindowId): void;
}

export interface WindowRect extends Rect {
  id: WindowId;
  focused: boolean;
  workspace: WorkspaceId;
}
```

**Option B — Interface + factory protocol (functional, options-bag):**
```typescript
// Consumer implements the interface; factory wires it to the service
export interface LayoutStrategy {
  arrange(windows: ReadonlyArray<WindowState>): ReadonlyArray<WindowPlacement>;
}

export interface WindowState {
  id: WindowId;
  rect: Rect;
  focused: boolean;
  workspace: WorkspaceId;
}

export interface WindowPlacement {
  id: WindowId;
  rect: Rect;
}

export function createLayoutService(options: {
  strategy: LayoutStrategy;
  hooks: WmHostHooks;
}): WmService;
```

**Option C — Tree-structured node primitive (BSP-oriented):**
```typescript
export type LayoutNode =
  | { kind: 'leaf'; windowId: WindowId; rect: Rect }
  | { kind: 'split'; direction: 'h' | 'v'; ratio: number; children: [LayoutNode, LayoutNode] };

export interface LayoutTree {
  root: LayoutNode | null;
  insert(id: WindowId, preferredSplit?: 'h' | 'v'): LayoutTree;
  remove(id: WindowId): LayoutTree;
  reflow(containerRect: Rect): LayoutTree;
  rects(): ReadonlyMap<WindowId, Rect>;
}
```

**Recommendation:** Option B is most idiomatic for kehto patterns. The existing `createWmService({ hooks })` factory already takes an options bag; extending it with `strategy: LayoutStrategy` follows the `createKeysService({ reservedChords, onForward })` and `createMediaService({ onSessionCreate })` precedents exactly. Option A requires consumers to subclass, which conflicts with kehto's zero-framework-dep philosophy (class inheritance is framework-ish). Option C is powerful but ships concrete layout semantics (BSP) that belong in hyprgate's impl, not the abstract primitive layer.

**Concrete REQ-ID-ready signatures for Option B:**

```typescript
// WM-04: export WindowState interface
export interface WindowState {
  readonly id: WindowId;
  readonly rect: Rect;
  readonly focused: boolean;
  readonly workspace: WorkspaceId;
  readonly title: string;
  readonly class: string;
}

// WM-05: export WindowPlacement interface
export interface WindowPlacement {
  readonly id: WindowId;
  readonly rect: Rect;
}

// WM-06: export LayoutStrategy interface
export interface LayoutStrategy {
  /** Called whenever the window set changes. Returns desired placements. */
  arrange(
    windows: ReadonlyArray<WindowState>,
    containerRect: Rect,
  ): ReadonlyArray<WindowPlacement>;
  /** Optional: called before first arrange so strategy can initialize from persisted state. */
  restore?(state: unknown): void;
  /** Optional: serialize strategy state for persistence. */
  serialize?(): unknown;
}

// WM-07: update createWmService to accept strategy
export function createWmService(opts: {
  hooks: WmHostHooks;
  strategy: LayoutStrategy;
}): WmService;
// Note: still throws in v0.0.0 — the signature update enables downstream type-checking
// without landing a real implementation. Strategy is optional in v1.7 (LayoutStrategy | undefined)
// with a no-op default, so hyprgate can adopt the signature without being forced
// to port its impl immediately.
```

### 6. `@kehto/nip66` Demo Wiring

**Current state:** `getNip66Suggestions: () => null` in `shell-host.ts:createDemoHooks()`. The aggregator factory (`createNip66Aggregator`) is published but no demo napplet uses it.

**What "goes live" means:**
`getNip66Suggestions` returns `Array.from(aggregator.getRelaySet())` — a live string[] drawn from accumulated kind-30166 events. In the demo shell, this surfaces via the relay NUB's add-relay / relay config surface.

**Which napplet exercises it:**
The `feed` napplet is the most natural — it subscribes to relays and benefits from relay suggestions. The alternative is adding a dedicated relay-manager napplet (12th/13th napplet), but that increases scope. Simpler path: enhance the existing `feed` napplet to call `window.napplet.shell.supports('nub:relay')` and display suggested relays from the `relay.getConfig` response.

The third option (matching the demo's DEMO_NAPPLETS data-driven pattern from Decision 16) is that the relay-config panel in the shell host UI (not an iframe napplet) shows the suggestions dropdown. Since `getNip66Suggestions()` is a `ShellAdapter.relayConfig` hook — not a NUB-domain wire message — it lives in the shell layer and its output can be shown in the shell's own relay-config UI without requiring a new napplet at all.

**What the user sees:**
In the demo's ACL panel or a new relay-config panel: a dropdown/list of suggested relay URLs populated live from the aggregator. These are relays discovered from kind-30166 events. The user can click to add them to their relay tiers.

**Layer-B spec asserts:**
The demo shell's `getNip66Suggestions()` returns a non-null array (not `null`) after `aggregator.start()` has run long enough for at least one event. Since the demo uses `createMockRelayPool()`, this requires either: (a) the mock pool emits fake kind-30166 events, or (b) the E2E spec waits for real events from a live monitor relay (fragile). Recommended: option (a) — extend `mock-relay-pool.ts` to emit 2-3 fixture kind-30166 events so the aggregator always has suggestions in the demo without network dependency.

### 7. Feature Categorization

```
Category: Spec
  SPEC resync (NIP-5D local pin update)

Category: ShellAuthority
  NUB-CLASS adoption — class.assigned emission, ACL honor, Layer-B invariant spec
  NUB-CONNECT adoption — CSP authority, consent flow, residual scan, grant persistence, SHELL-CONNECT-POLICY audit

Category: NewNUBs
  NUB-CONFIG reference service + demo napplet (9th domain)
  NUB-RESOURCE reference service + demo napplet (10th domain)

Category: Polish
  @kehto/nip66 demo wiring (NIP66-05 follow-up)
  @kehto/wm structural primitives (WM-04..07)
  CACHE naming parity (HostCacheBridge alias, kehto#1)

Category: SoftGated
  NIP-44 decrypt surface (blocks on napplet/napplet#3)
```

---

## Feature Dependencies

```
SPEC resync
    └──prerequisite──> NUB-CLASS adoption (class-posture delegation paragraph is in the updated spec)
    └──prerequisite──> NUB-CONNECT adoption (SHELL-CONNECT-POLICY cross-refs updated spec)

NUB-CLASS adoption
    └──prerequisite──> @napplet/nub publish state (nub/class subpath must be in published @napplet/nub@^0.2.x)
    └──enhances──> NUB-CONNECT adoption (cross-NUB invariant: class===2 iff connect.granted===true)
    └──prerequisite──> NIP-44 decrypt surface (class-forbidden enforcement at shell requires knowing class)

NUB-CONNECT adoption
    └──requires──> Shell HTTP-header authority (new infrastructure: Vite server plugin or dev-server hook)
    └──requires──> Grant persistence store (new data store keyed on dTag+aggregateHash)
    └──requires──> Residual meta-CSP scanner (parse5/htmlparser2 dep)
    └──requires──> @napplet/nub publish state (nub/connect subpath)
    └──enhances──> NUB-CLASS adoption (both required for cross-NUB invariant)

NUB-CONFIG reference service
    └──requires──> @napplet/nub publish state (nub/config subpath, already in napplet/nubs/config)
    └──mirrors pattern──> existing notify-service.ts, cache-service.ts handler shapes

NUB-RESOURCE reference service
    └──requires──> @napplet/nub publish state (nub/resource subpath)
    └──mirrors pattern──> cache-service.ts (options-as-bridge, isAvailable pattern)
    └──independent──> NUB-CONNECT (parallel fetch paths, different security postures)

@kehto/nip66 demo wiring
    └──requires──> mock-relay-pool.ts kind-30166 fixture events
    └──independent──> NUB-CLASS, NUB-CONNECT, NUB-CONFIG, NUB-RESOURCE

@kehto/wm structural primitives
    └──independent──> all other v1.7 features
    └──builds on──> existing v0.0.0 type vocabulary (WindowId, WorkspaceId, Rect, Layout, WmHostHooks, WmService)

CACHE naming parity
    └──independent──> all other v1.7 features

NIP-44 decrypt surface (soft-gated)
    └──blocks on──> napplet/napplet#3 (upstream NUB surface decision: relay.subscribeEncrypted vs identity.decrypt)
    └──requires (if identity.decrypt path)──> NUB-CLASS adoption (class-forbidden enforcement)
```

### Dependency Notes

- **@napplet/nub publish state is the single largest upstream risk.** NUB-CLASS, NUB-CONNECT, NUB-CONFIG, NUB-RESOURCE all require their respective subpaths to be present in a published `@napplet/nub` version. As of v1.6, `@kehto/*` pins `@napplet/nub@^0.2.1`. The class/connect/config/resource subpaths exist in the napplet repo's `packages/nub/src/` but may not be published yet. **This MUST be verified before locking phase plans** (per PROJECT.md Key Context bullet: "Upstream NUB publish state must be verified before locking phase plans").

- **NUB-CONNECT requires HTTP-header authority, which is new infrastructure.** The current demo serves napplets from Vite's dev server without per-napplet CSP headers. Adding this requires either a Vite server plugin (for dev + preview) or a separate Express/Hono server handling napplet HTML requests. This is the highest-complexity single item in the milestone.

- **NUB-CLASS depends on SPEC resync for semantic correctness** but can be coded from the local SHELL-CLASS-POLICY.md and nub/class types.ts independently. SPEC resync can run in parallel with early implementation.

- **NUB-CONFIG and NUB-RESOURCE are mutually independent** — they share no infrastructure. They can be phased sequentially or in parallel.

---

## MVP Definition

### v1.7 Table Stakes (close the milestone)

- [ ] SPEC resync — update `specs/NIP-5D.md` from `dskvr/nips` `nip/5d` branch
- [ ] NUB-CLASS: shell emits `class.assigned` after shim bootstrap, ACL gates honor class posture, Layer-B Playwright spec locks the cross-NUB invariants
- [ ] NUB-CONFIG: `createConfigService()` handler in `@kehto/services`, demo napplet (11th), Layer-A + Layer-B E2E coverage
- [ ] NUB-RESOURCE: `createResourceService()` handler in `@kehto/services`, demo napplet (12th), Layer-A + Layer-B E2E coverage
- [ ] SHELL-CLASS-POLICY audit checklist authored in `.planning/` as deployment evidence
- [ ] E2E baseline: 54 → grows with new napplets + invariant specs

### Add If NUB Publish State Confirms (v1.7 stretch)

- [ ] NUB-CONNECT full adoption (CSP authority, consent flow, residual scan, grant persistence) — gates on HTTP-header infrastructure + @napplet/nub/connect publish state
- [ ] @kehto/nip66 demo wiring — LOW complexity, add if the NUB-CONFIG/RESOURCE phases leave room
- [ ] @kehto/wm WM-04..07 structural primitive signatures — LOW risk, add after NUB-CONFIG/RESOURCE phases

### Defer to v1.8 (conditions not met in v1.7)

- [ ] NIP-44 decrypt surface — blocks on napplet/napplet#3 upstream decision; slip to v1.8 if unblocked
- [ ] CACHE naming parity — cosmetic, no downstream urgency; slip to whenever kehto#1 gets filed
- [ ] Electron / Tauri HostXxxBridge reference impls — carryover from v1.4 tech debt

---

## Handler API Shapes Summary

Quick reference for REQ-ID authoring:

| Domain | Factory | Options Interface | Key Callbacks |
|--------|---------|------------------|---------------|
| config | `createConfigService(opts)` | `ConfigServiceOptions` | `getValues(dTag, hash)`, `setValues(dTag, hash, vals)`, `onOpenSettings?` |
| resource | `createResourceService(opts)` | `ResourceServiceOptions` | `fetch(url, signal?)`, `isAvailable?()` |
| class | (not a service handler — ShellBridge lifecycle hook) | n/a | Shell emits `class.assigned` on first inbound napplet envelope |
| connect | (not a service handler — HTTP-header authority + grant store) | n/a | Grant store + HTML scanner + consent UI |
| wm (v1.7 primitives) | `createWmService({ hooks, strategy })` | `{ hooks: WmHostHooks; strategy?: LayoutStrategy }` | `strategy.arrange(windows, containerRect)` |
| nip66 demo | (ShellAdapter wiring, not a service handler) | n/a | `getNip66Suggestions: () => Array.from(aggregator.getRelaySet())` |

---

## Sources

- `/home/sandwich/Develop/napplet/specs/SHELL-CLASS-POLICY.md` (HIGH confidence — canonical deployer guide)
- `/home/sandwich/Develop/napplet/specs/SHELL-CONNECT-POLICY.md` (HIGH confidence — canonical deployer guide)
- `/home/sandwich/Develop/napplet/specs/SHELL-RESOURCE-POLICY.md` (HIGH confidence — canonical deployer guide)
- `/home/sandwich/Develop/napplet/packages/nub/src/class/types.ts` (HIGH confidence — authoritative wire types)
- `/home/sandwich/Develop/napplet/packages/nub/src/class/shim.ts` (HIGH confidence — authoritative shim timing pattern)
- `/home/sandwich/Develop/napplet/packages/nub/src/connect/types.ts` (HIGH confidence — authoritative wire types)
- `/home/sandwich/Develop/napplet/packages/nub/src/config/types.ts` (HIGH confidence — authoritative wire types)
- `/home/sandwich/Develop/napplet/packages/nub/src/resource/types.ts` (HIGH confidence — authoritative wire types)
- `/home/sandwich/Develop/napplet/packages/nubs/config/README.md` (HIGH confidence — published API reference)
- `/home/sandwich/Develop/napplet/.changeset/v0.29.0-nub-connect-class.md` (HIGH confidence — ship notes)
- `/home/sandwich/Develop/napplet/.changeset/v0.30.0-class-gated-decrypt-surface.md` (HIGH confidence — ship notes)
- `kehto/packages/wm/src/index.ts` (HIGH confidence — current skeleton to extend)
- `kehto/packages/nip66/README.md` (HIGH confidence — current ShellAdapter seam)
- `kehto/apps/demo/src/shell-host.ts` (HIGH confidence — current demo wiring patterns)
