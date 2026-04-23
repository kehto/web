# Phase 34: `@kehto/nip66` Extract & Publish - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

`@kehto/nip66` ships as a standalone publishable package at `0.1.0` — community shells (hyprgate, nadar, others) can add one dep and get a ready-made kind-30166 relay-discovery aggregator without re-inventing per-shell. Publish-only; no demo wiring.

Scope-in:
- New workspace `packages/nip66/` registered in `pnpm-workspace.yaml` (already has `packages/*` glob; pnpm auto-picks up)
- `@kehto/nip66@0.1.0` package declared ESM-only, tsup build, turbo type-check
- Factory `createNip66Aggregator(options)` + pluggable `Nip66RelayPool` interface
- Public API: `start`, `resync`, `getRelaySet`, `getRelaysSupportingNip`, `relaySupportsNip`
- `packages/nip66/README.md` with public API docs + integration example against `ShellAdapter.relayConfig.getNip66Suggestions`
- `.changeset/v1-6-nip66.md` — initial publish entry
- Peer dep: `nostr-tools` (range matching `@kehto/shell`: `>=2.23.3 <3.0.0`); NO `@napplet/core`

Scope-out:
- Wiring into the demo shell (`apps/demo/src/shell-host.ts`) — deferred to v1.7+ per NIP66-05
- Negentropy / NIP-77 support — deferred; stream-only subscribe in v1.6
- Default bootstrap relay list shipped in the package — consumer supplies their own
- Use as a NUB (this is a framework-agnostic util, NOT a napplet-visible NUB domain)

</domain>

<decisions>
## Implementation Decisions

### API Surface (Grey Area 1/1 — all locked)

- **Relay-pool shape:** Pluggable `Nip66RelayPool` interface that consumers implement. Single method: `subscribe(relays: ReadonlyArray<string>, filter: Nip66Filter, onEvent: (event: NostrEvent) => void): () => void` returning an unsubscribe handle. Decouples `@kehto/nip66` from any specific pool lib (applesauce-relay, nostr-tools SimplePool, @snort/worker-relay, etc.). Pattern-mirrors v1.4's `HostKeysBridge` / `HostMediaBridge`.
- **API shape:** Factory + module API. `createNip66Aggregator({ pool, bootstrap, networks? })` returns an aggregator object: `{ start(): void, resync(): void, getRelaySet(): ReadonlySet<string>, getRelaysSupportingNip(nip: number): string[], relaySupportsNip(url: string, nip: number): boolean }`. Multi-instance safe; unit-testable without monkey-patching module globals. Each factory call constructs its own closure-scoped `Set<string>` + `Map<string, Set<number>>` state.
- **Negentropy / NIP-77:** Out of v1.6 scope. Plain streaming subscribe only. Consumers who need negentropy delta-sync wire it into their `Nip66RelayPool` implementation (e.g., hyprgate wraps `syncDataset` which handles the negentropy-or-fallback logic internally). `@kehto/nip66` itself knows nothing about NIP-77.
- **Bootstrap relay list:** Required option `bootstrap: ReadonlyArray<string>`. Consumer passes their own curated list. No default shipped. Reasoning: shipping a default list is a policy decision (which monitors are trusted?) — belongs to the shell, not the library.

### Claude's Discretion
- File layout inside `packages/nip66/src/`: single `index.ts` vs split into `aggregator.ts` + `parse.ts` + `types.ts`. Pick based on line count (single file if < 250 lines, split if more).
- Internal helper names (`parseNipSupport`, `processEvent`) — free to rename or inline; external API is what's fixed.
- Whether to export `Nip66Filter` type shape or inline it in the `subscribe` signature. Suggest: export a minimal type alias `type Nip66Filter = { kinds: [30166]; '#n'?: ReadonlyArray<string> }` for consumer type safety.
- Unit test strategy: mock pool implementation as a tiny in-memory stub; assert aggregator state transitions on fed events. Use vitest (workspace standard).
- README structure: follow the existing pattern of `packages/services/README.md` (h1 title, short intro, public API table, @example block, integration note).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Reference impl:** `/home/sandwich/Develop/hyprgate/apps/shell/src/lib/relay/nip66-monitor.ts` (188 lines) — the extraction source. Key functions to port: `processEvent`, `parseNipSupport`, `getNip66RelaySet`, `getRelaysSupportingNip`, `relaySupportsNip`, `resyncNip66` (rename to instance method `resync`). Hyprgate-specific bits to abstract: `syncDataset` → `pool.subscribe`, `getWorkerRelay` → out of scope (consumer's problem), `NIP66_MONITOR_RELAYS` → `bootstrap` option, `getEnabledNetworks` → `networks` option.
- **Existing kehto shell hook:** `packages/shell/src/types.ts:130` declares `relayConfig.getNip66Suggestions()` — THE hook a shell populates from the `Nip66Aggregator.getRelaySet()` output. Confirms the integration pattern README should demonstrate.
- **Existing pool-shape:** `packages/shell/src/types.ts:115` declares `subscription(relayUrls, filters): { subscribe(observer): { unsubscribe } }` — an RxJS-adjacent observable shape. `@kehto/nip66`'s `Nip66RelayPool` shape is SIMPLER (direct callback, no observable wrapper); consumers bridging from the kehto shell pool write a ~3-line adapter.
- **Template workspace:** `packages/services/` — reference for ESM-only, tsup, turbo, changeset patterns. Mirror `package.json`, `tsconfig.json`, `tsup.config.ts` structure.

### Established Patterns
- `packages/{pkg}/package.json` ESM exports map with `./types`, `./shim`, `./sdk` subpaths where applicable — `@kehto/nip66` is small enough to have a single root export; no subpaths.
- `turbo.json` pipeline: `build`, `type-check`, `test` task definitions apply to every workspace pkg — no `turbo.json` edits needed.
- pnpm workspace glob `packages/*` — new `packages/nip66/` auto-included.
- Changeset format: `.changeset/v1-6-nip66.md` with `---\n'@kehto/nip66': minor\n---\n...` frontmatter; `minor` is correct for `0.0.0 → 0.1.0` (semver first real version).

### Integration Points
- `packages/nip66/package.json` — new file
- `packages/nip66/tsconfig.json` — extends monorepo base (mirror `packages/services/tsconfig.json`)
- `packages/nip66/tsup.config.ts` — new, ESM-only, dts output
- `packages/nip66/src/index.ts` — factory + types + helpers
- `packages/nip66/README.md` — public API + integration example
- `.changeset/v1-6-nip66.md` — initial-publish changeset

</code_context>

<specifics>
## Specific Ideas

- **Package name:** `@kehto/nip66` (confirmed — exported at root, no subpaths).
- **Version:** `0.1.0` — first real release.
- **Types shipped:**
  ```ts
  export interface Nip66RelayPool {
    subscribe(
      relays: ReadonlyArray<string>,
      filter: Nip66Filter,
      onEvent: (event: NostrEvent) => void,
    ): () => void;
  }
  export type Nip66Filter = { kinds: [30166]; '#n'?: ReadonlyArray<string> };
  export interface Nip66AggregatorOptions {
    pool: Nip66RelayPool;
    bootstrap: ReadonlyArray<string>;
    /** Optional network-type filter — passed as #n tag to the filter. */
    networks?: ReadonlyArray<string>;
  }
  export interface Nip66Aggregator {
    start(): void;
    resync(): void;
    getRelaySet(): ReadonlySet<string>;
    getRelaysSupportingNip(nip: number): string[];
    relaySupportsNip(url: string, nip: number): boolean;
  }
  export function createNip66Aggregator(options: Nip66AggregatorOptions): Nip66Aggregator;
  ```
- **`NostrEvent` source:** import from `nostr-tools` peer dep — matches kehto's existing convention.
- **Integration example (for README):**
  ```ts
  import { createNip66Aggregator } from '@kehto/nip66';
  import { SimplePool } from 'nostr-tools/pool';

  const pool = new SimplePool();
  const aggregator = createNip66Aggregator({
    pool: {
      subscribe: (relays, filter, onEvent) => {
        const sub = pool.subscribeMany(relays, [filter], { onevent: onEvent });
        return () => sub.close();
      },
    },
    bootstrap: ['wss://monitor1.example.com', 'wss://monitor2.example.com'],
  });

  aggregator.start();

  // Wire into ShellAdapter:
  const shell = createShellAdapter({
    hooks: {
      relayConfig: {
        getNip66Suggestions: () => Array.from(aggregator.getRelaySet()),
      },
    },
  });
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Demo wiring** (NIP66-05 explicitly scopes this out): standing up a small SimplePool in `apps/demo/src/shell-host.ts` and calling `aggregator.start()` — deferred to v1.7+.
- **NIP-77 negentropy support**: requires `applesauce-relay` (or equivalent) dep, out of framework-agnostic scope. Could land as `@kehto/nip66-negentropy` companion package or as an optional peer-dep branch — v1.7+ decision.
- **OPFS-cached delta sync**: hyprgate does this via `getWorkerRelay().query(...)`. Out of scope — consumer's problem; they provide a `Nip66RelayPool` that wraps their cache.
- **Publishing to npm**: this phase creates the package + changeset but does NOT run `changeset publish`. Publishing happens at milestone close alongside v1.6's `@kehto/*` minor bumps.

</deferred>
