# Phase 107 research

## Evidence

Working base is origin/main 545a0373, not the older primary checkout used for the proposal. Current main already implements intent.deliver plus buffered onDelivery and tracked INC listener compatibility, but services and invocation binding retain the old request/result/candidate shapes. Installed @napplet/nap 0.32.0 intent/types re-exports the old @napplet/core types; it omits contracts, id, handlerHint and IntentDelivery. Do not copy that packaged drift into the new feature.

NAP-INTENT PR #106 fc121fc264615482143eda86125863d2e1f741a2 is working authority. NIP-5D PR #2303 020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7 has been read: signed event, one x artifact hash, verified self-contained bytes, allow-scripts srcdoc and authenticated MessageEvent.source are required. An external URL supplies no verified source. Use a bundled signed launcher artifact, independently verify signature and artifact hash with the existing resolver, and bind its real frame to the runtime. Never synthesize a target or host sender. Native host-origin semantics remain deferred.

## Integration

- packages/nip/src/5d/current-manifest.ts retains intents.parameters but its archetypes projection currently forms a cartesian product. Correct to same-role contracts; unusable z/i ads contribute no contract without invalidating a valid manifest.
- packages/paja/src/installed-napplet-catalog.ts currently drops params and keys records by dTag. Preserve full verified identity and contract fields.
- packages/services/src/catalog-intent-resolver.ts exposes dTag candidates and handled/windowId results. Adopt canonical catalog IDs, contracts, strict normalized requests, recommendations and acceptance-owned lifecycle. Migrate playground consumers alongside shared APIs.
- packages/paja/src/browser-intent-controller.ts already retains copied values across generations/readiness retries; make acceptance independent from completion and add observable terminal completion for host UX.
- packages/shell/src/napplet-namespace.ts has buffered intent.deliver and a protected makeIntent, but invoke accepts only legacy objects. Add URI normalization and current options without allowing sender or malformed normalization on the wire. Keep any retained legacy path explicit, warned and tested.
- browser-host.ts creates a catalog on every load and restores tabs. Intent review must rehydrate verified catalog facts without auto-running all tabs, and consume each launch once. Preserve pointer-only and local HTML flows.

## Validation Architecture

Vitest units cover parser and serializable namespace execution, resolver policy, real signed manifests and catalog preservation, runtime source identity and lifecycle. Existing tests/e2e/paja* specs host real Paja servers and mock signed manifests/resources; extend those patterns for builder/copy/navigation/review/cold/warm/no-replay/mobile. Run pnpm build, pnpm type-check, pnpm test:unit, pnpm test:e2e, pnpm docs:check and the configured aisloP command from CI/config. Pinned config cannot be weakened.

## Research execution note

The delegated research pass produced useful interim findings but no report after bounded finish requests; it was interrupted. The orchestrator verified these findings directly and completed this report. No production code was changed during research.
