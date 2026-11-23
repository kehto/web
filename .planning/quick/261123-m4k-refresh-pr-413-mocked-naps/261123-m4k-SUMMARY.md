---
quick_id: 261123-m4k
status: complete
date: 2026-11-23
branch: feat/paja-mocked-naps
---

# Refresh PR 413 against current main

Merged main at 9a2a9693 (merge c1280cb1) and resolved 7 conflicts (shell prelude realm-lock + bindings
argument, browser admission, Paja host/simulation imports, shell docs, Paja jsr.json with @kehto/mocks ^0.2.0).

Track check (napplet MCP, napplet/naps@377bf93): NAP-MESH is retracted (mock retired on main in #464), so its
generated binding is gone. NAP-CLASS (#16) is labeled DEFERRED, so Paja no longer exposes `class`
(`PAJA_UNMOCKED_DOMAINS`) and the class.assigned readiness hook is removed. The other 16 mocked domains
match their pinned draft heads.

Collisions now resolve gracefully at every layer:
- `installMockServices` (mocks): a real service wins; KEHTO_MOCK_DOMAIN_ALREADY_DEFINED once per skipped domain.
- `createMockNapServices`: duplicate registry domains keep the first entry; KEHTO_MOCK_REGISTRY_DUPLICATE_DOMAIN.
- `serializeDomainBindings` (shell): built-in domain bindings ignored; KEHTO_BINDING_BUILT_IN_DOMAIN once per domain per page.
- Prelude: a napplet's own non-empty window.napplet.<domain> (e.g. a bundled SDK shim) wins over a host table,
  before or after the prelude; KEHTO_BINDING_DOMAIN_DEFINED_BY_NAPPLET once per domain per frame.
- Paja: createPajaMockedServices installs through installMockServices instead of Object.assign.

Packaged contract: @napplet/core 0.45 ships TorrentApi, BlossomApi, CatalogApi, NavigationApi and SoulseekApi.
Torrent's onState/onProgress/onError were unbound (no API Surface row); the generator now adds them, and a
type-checked parity test pins all five domains (blossom parseUri/formatUri stay documented local-helper gaps).
The NIP-5D policy's deferred-domain paragraph now says those five are mock-served only.

Verification on 54792fa4: build 20/20, type-check 23/23, unit 351 files / 4656 tests, docs:check OK,
bindings:check current, JSR/doc version sync 0 updates, full e2e 185 passed / 1 skipped (Chromium),
aislop 0.12.0 100/100 (existing browser-llm-panel.ts warning).
