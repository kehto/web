---
status: investigating
trigger: WebRTC room creation and napplet.soy CVM work on napplet.soy but fail in Paja for the supplied boost-ball naddr.
created: 2026-11-17
updated: 2026-11-17
---

## Symptoms

- Expected: the same signed napplet can host a room and use its CVM service in Paja.
- Actual: `webrtc.open timed out`; Paja logs inbound `webrtc.open` but no result. CVM filter shows shell.init and interface toggles only.
- Timeline: unknown; reported November 17, 2026.
- Constraint: detect configuration where possible, otherwise expose configuration; no provider-specific hardcoding. Open a PR.

## Current Focus

hypothesis: independent host registration, CVM registry, signaling profile and transport identity gaps explain the failures.
next_action: implement provider-neutral registry and multiplayer configuration after committing the verified registration fix.

## Evidence

- Primary checkout contains unrelated package.json/work-in-progress shell skills; preserved. Existing branch PR #421 is merged. Investigation uses a clean worktree from origin/main ddd369ff.
- Checked NAP-WEBRTC draft napplet/naps#59 at fb4dd6f0e6294e1837733d2af61931e3e114bd97: every recognized request requires same-ID result; signaling scheme is host policy, not standardized. Temporary session identity is permitted.
- Checked NAP-CVM draft napplet/naps#31 at 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f: discovery/registry and direct requests are separate APIs; unsupported recognized requests require explicit results.
- NAP-SHELL checked at master 377bf939c6c906817084b43dd21d424de646dbc2: injected domains must reflect available handlers; shell.ready is not authorization.
- Reproduced in Chromium: start without signer, select Dev, iframe receives webrtc namespace and shell.init advertises it, but runtime serviceRegistry is the construction-time copy. No handler receives open. Synchronizing changed service registrations before frame reload fixes this; browser regression passes.
- Downloaded signed manifest 718883d0dd34e466a8b1b9143ff0b512700338ce22aabee8a7ca9c685557eac6 from wss://relay.napplet.soy. Downloaded artifact from nostr.download and SHA-256 verified 8acd049bff5f4edca3bf5616bb39e32b6100f1d734399a05a5ee7b1de64af057. It declares optional cvm and webrtc.
- Browser probe: injected cvm.registry is undefined. Upstream @napplet/nap 0.40.0 does export registry helpers; the omission is Kehto makeCvm. Upstream registry wire still uses family, whereas pinned draft requires selector. Existing mocks already document this drift.
- Soy source/docs in local napplet-soy-reference at 51707d3 describe soy-rtc/1: kind 25050, d namespace hash over profile/verified address/scope/channel/protocol, per-session nonces, NIP-44 offer/answer, repeated hello. Paja uses r room hash and type tags, so relays alone cannot make them interoperate.
- Soy shares a host-owned transport signer across CVM and WebRTC per napplet/tab; Paja CVM generates independent keys while WebRTC uses the user signer. Game's soy_session actor must match authenticated WebRTC peer keys.
- Live https://napplet.soy/.well-known/napplet.json returns version 1 backend public key/relays only; it does not advertise signaling profiles, families, ICE, or identity coupling. Automatic inference of these would be a spec gap. Explicit host configuration is the bounded solution.

## Implementation plan

1. Synchronize dynamic service lifecycle and prove WebRTC request/reply after signer changes (implemented; focused unit and browser checks pass).
2. Expose canonical CVM registry requests in injected namespace, with bounded documented compatibility for the existing string-family SDK API. Provide configurable provider/family selection with verified tool schemas, ordinary CVM authorization, cancellation and isolation.
3. Add explicit multiplayer profile configuration (relays, signaling profile, shared per-window transport identity, optional ICE settings). No host URL, provider key, family or app identity special cases. Use verified NIP-5D identity for namespaces.
4. Prove real CVM and WebRTC flows including independent peer interoperability, negative authorization/lifecycle cases, signed artifact srcdoc provenance, documentation and changesets. Run required build/type/unit/docs/quality/E2E gates; push and open PR.

## Resolution

Pending investigation and verification.
