# @kehto/nip

Tree-shakable bundle of framework-agnostic Nostr NIP utilities. Each NIP lives
at its own subpath (e.g. `@kehto/nip/66`); the barrel re-exports them and
`sideEffects: false` lets bundlers drop any NIP a consumer does not import.

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

| Area | Exports |
|------|---------|
| NIP-66 factory | `createNip66Aggregator` (subpath `@kehto/nip/66`) |
| Pool contract | `Nip66RelayPool`, `Nip66Filter` |
| Options | `Nip66AggregatorOptions` |
| Handle | `Nip66Aggregator` with `start`, `resync`, `stop`, `getRelaySet`, `getRelaysSupportingNip`, and `relaySupportsNip` |

## Scope Boundaries

- Ships unique NIP utilities only; each NIP is importable from its own subpath so unused NIPs tree-shake away.
- NIP-66 parses kind-30166 `d` tags into relay URLs and uppercase `N` tags into NIP support maps.
- Accepts a user-supplied relay-pool adapter.
- Does not bundle bootstrap relay policy, NIP-77 sync, OPFS cache priming, or Kehto runtime dependencies.

## API Reference

- Generated module: <a href="../api/modules/_kehto_nip.html" target="_self"><code>docs/api/modules/_kehto_nip.html</code></a>
