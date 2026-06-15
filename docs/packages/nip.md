# @kehto/nip

Tree-shakable bundle of framework-agnostic Nostr NIP utilities — the NIPs that
`nostr-tools` does not ship but relay-aware runtimes commonly need. Each NIP
lives in its own folder at its own subpath (e.g. `@kehto/nip/66`); the barrel
re-exports them and `sideEffects: false` lets bundlers drop any NIP a consumer
does not import.

> **Alpha status:** This utility can support Kehto and other napplet runtimes.
> Its integration points may change while NIP-5D runtime implementations evolve.

## Install

```bash
pnpm add @kehto/nip nostr-tools
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/nip/package.json`, `packages/nip/src/index.ts` |
| Version | `0.1.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `nostr-tools` | `>=2.23.3 <3.0.0` |

## Primary APIs

| Subpath | NIP | Exports |
|---------|-----|---------|
| `@kehto/nip/51` | NIP-51 lists & sets | `parseList`, `getTagValues`, `decryptPrivateItems`, `isListKind`, `isSetKind`, `listKindName`, `LIST_KINDS`, `SET_KINDS` |
| `@kehto/nip/65` | NIP-65 relay lists | `parseNip65RelayList`, `selectWriteRelays`, `selectReadRelays`, `createNip65Registry` (outbox/inbox resolution) |
| `@kehto/nip/66` | NIP-66 relay discovery | `createNip66Aggregator`, `Nip66RelayPool`, `Nip66Filter`, `Nip66AggregatorOptions` |
| `@kehto/nip/89` | NIP-89 app handlers | `parseHandlerInformation`, `parseHandlerRecommendation`, `handlesKind`, `buildHandlerUrl` |

Each subpath ships its own `README.md` with full API docs and examples.

## Selection criteria

A NIP earns a place here only if it is **unique** (not already provided by
`nostr-tools` — re-wrapping `nip04`/`nip19`/`nip25`/`nip44`/`nip57`/… would be a
no-op), **broadly needed** across runtimes, and **substantive** (a real common
case, no framework coupling, no module-global state).

## Scope Boundaries

- Ships unique NIP utilities only; each NIP is importable from its own subpath so unused NIPs tree-shake away.
- All stateful helpers are closure-scoped factories (`create*`) — multi-instance safe, never module globals.
- Crypto and relay concerns are injected (pool adapters, NIP-44 decryptors), so the package carries no crypto or relay-library dependency.
- Does not bundle bootstrap relay policy, NIP-77 sync, OPFS cache priming, or Kehto runtime dependencies.

## API Reference

- Generated module: <a href="../api/modules/_kehto_nip.html" target="_self"><code>docs/api/modules/_kehto_nip.html</code></a>
