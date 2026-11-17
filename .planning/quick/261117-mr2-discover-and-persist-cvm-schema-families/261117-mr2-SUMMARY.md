---
status: complete
---

# CVM discovery and persistent families

Implemented in `a4b7f00d` and `5d8c03ae` on `feat/paja-cvm-discovery`.

- One input detects nevent (including nostr:), tool schema hash, or HTTPS website/hostname. User explicitly narrowed naddr/nevent to nevent after the addressable-manifest gap was explained.
- Signed inventories and CEP-15 hashes are verified. Nevent hints and signed CEP-17 operational relay lists are supported; URL discovery uses version-1 backend hints. Hash searches require indexed i tags. Malformed, incomplete, mismatched and stale replacement inventories fail closed.
- Multiple providers require selection. Local label and selected tools generate source-labelled read-only JSON; manual copies are editable. Saved families coexist, survive reload, can be viewed/removed, and merge with configured entries in both plain CVM and multiplayer modes.
- Settings section open state survives save/reload. Saved host choices do not select WebRTC signaling, ICE or invoke tools during discovery.
- Docs and a Paja minor changeset are included. No compatibility path was introduced.

## Verification

- `pnpm build` / `pnpm test:build`: pass, 18 tasks.
- `pnpm type-check`: pass, 20 tasks.
- `pnpm test:unit`: 3,494 tests, 274 files, all pass.
- `pnpm docs:check`: pass, including strict TypeDoc and package docs audit.
- Full Playwright suite (`pnpm test:build` then `pnpm exec playwright test --trace off`): 138 passed, one existing identity.changed skip.
- After final checkbox layout/provider-label polish: focused browser tests 3/3, focused unit tests 38/38, build/types pass. No transport behavior changed after the full suite.
- AI-slop 0.12.0: changed-source scan 100/100. Full scan passes 99/100 with two pre-existing function-length warnings in unchanged browser-llm-panel.ts and cvm-service-handler.ts; config unchanged. Whitespace check passes.
- Live Chromium: entering https://napplet.soy resolved its well-known document and signed inventory, verified all 30 hashes, populated read-only JSON with key/relay/tool pins and source event. Screenshot `/tmp/paja-cvm-discovery-live.png` inspected.
- Trace-enabled Playwright runs hit a Node 26 trace-export teardown timeout after assertions completed; trace-off runs pass. An early browser failure exposed missing multiplayer-section persistence, now fixed and covered.

## Contracts and limits

NAP-CVM draft PR 31 head rechecked before shipment: `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`. Conformant host configuration and existing canonical registry selectors; no wire changes. CEP-6, draft CEP-15 and draft CEP-17 checked. Named-family manifests remain a documented spec gap; labels and tool membership are explicit local choices.

External issue https://github.com/soytec/napplet-soy/issues/70 and tracker https://github.com/kehto/web/issues/444 cover Soy's missing i/k announcement tags. URL discovery works now. naddr is intentionally unsupported per user clarification. Browser URL discovery requires CORS; announcements must be present on queried relays. No runtime fallback bypasses missing discovery tags or schema verification.

## PR visual proof

`visual-proof.png` is an unaltered Chromium screenshot of the final UI against
live napplet.soy. Two locally labelled tool families were imported and saved,
then the page was reloaded. The screenshot shows both persisted entries and the
selected room family's source-labelled JSON; its `readOnly` property was checked
as true. The PR body embeds this screenshot directly from its immutable commit.
No application code changed for this follow-up.
