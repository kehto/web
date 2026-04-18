# Phase 18 — Napplet SDK Migration — Iteration Log

This log captures the build → preview → Playwright → fix cycles per E2E-11.
Each iteration appends below.

---

## Iteration 1 — 2026-04-18T00:50Z

### Build

- pnpm ls @napplet/core: **single instance** — all 4 kehto packages link to `link:../../../napplet/packages/core` (workspace override); no dedupe needed
  ```
  @kehto/acl: @napplet/core link:../../../napplet/packages/core
  @kehto/runtime: @napplet/core link:../../../napplet/packages/core
  @kehto/services: @napplet/core link:../../../napplet/packages/core
  @kehto/shell: @napplet/core link:../../../napplet/packages/core
  ```
- pnpm build (turbo): **PASS** — 16 modules transformed (bot), 16 modules transformed (chat); all 11 tasks successful, 8 cached, 3 rebuilt; total: 1.301s
- napplet aggregate hashes: bot `dist/index.html` content="" | chat `dist/index.html` content="" — both **empty** (VITE_DEV_PRIVKEY_HEX not set — `[nip5a-manifest] skipping manifest generation`); hash stays empty without a signing key; ACL and AUTH still function with empty hash because the shell keys storage on `dTag:aggregateHash` composite and the shim does not validate the hash value

### Spec Results (full v1.3 Layer-B suite)

| Spec | Outcome | Notes |
|------|---------|-------|
| demo-boot | PASS | 8 topology service nodes visible on load |
| demo-node-inspector | PASS | All 6 sub-tests green — ACL/runtime/napplet/service/open-close/anti-term |
| demo-debugger | PASS | Both tests green — notify.create envelope visible in debugger |
| demo-service-toggle | PASS | Both tests green — toggle and anti-term |
| demo-notification-service | PASS | All 6 tests green — toast/list/read/dismiss/anti-term |
| napplet-auth (NEW) | PASS | chat #chat-status → "authenticated" within 10s; bot #status-text → "authenticated" within 10s |
| ifc-roundtrip (NEW) | PASS | "hello" typed in chat → "[bot] hey there!" appears in #messages within 8s; both napplets authenticated before round trip |

**Total: 20/20 tests PASS** — full suite green on first iteration.

### Anti-term grep

```
grep -rE "addEventListener\(['\""]message|BusKind|kind === 2900[12]|window\.nostr|signer-service|\['REGISTER'|\['EVENT'|\['OK'|\['CLOSED'|\['NOTICE'|pendingAcks" apps/demo/napplets/bot/src apps/demo/napplets/chat/src
```

Result: **2 comment-only matches found** at:
- `apps/demo/napplets/chat/src/main.ts:12: * NO window.addEventListener('message') — shim handles AUTH implicitly (D-01).`
- `apps/demo/napplets/chat/src/main.ts:13: * NO NIP-01 arrays, NO BusKind, NO window.nostr (anti-features).`

Both matches are inside JSDoc `/** ... */` block comment (lines starting with ` * `). **Zero live-code matches**. Clean per Phase 17 decision: "Explanatory JSDoc comments referencing banned terms are permitted — grep patterns checking functional code must exclude comment lines."

Note: `sendBtn.addEventListener('click', ...)` and `inputEl.addEventListener('keydown', ...)` on lines 127-128 of chat/src/main.ts are legitimate DOM event listeners that do NOT match the anti-term pattern (pattern requires `addEventListener('message'` or `addEventListener("message"`).

### Fixes (Iteration 1)

None — gate green on first iteration. All 20 Layer-B tests passed without any code changes. The SDK migration from Plans 18-01 and 18-02 is complete and regression-free.

---

## Phase Close Gate

- [✓] All 20 Layer-B tests GREEN against pnpm preview build (20/20 passed — 14.9s)
- [✓] No Phase 17 (E2E-06) regressions introduced — demo-boot, demo-node-inspector, demo-debugger, demo-service-toggle, demo-notification-service all PASS
- [✓] napplet-auth.spec.ts + ifc-roundtrip.spec.ts both pass (3 tests across 2 specs)
- [✓] Anti-term grep over apps/demo/napplets/{bot,chat}/src is clean (zero live-code matches; 2 comment-only matches are permitted per Phase 17 decision)
- [✓] pnpm ls @napplet/core: single instance (Pitfall 4 guard — workspace link: to napplet/packages/core for all 4 kehto packages)
- [⚠] Both napplet dist/index.html files carry empty napplet-aggregate-hash (VITE_DEV_PRIVKEY_HEX not set — signing key not available in this environment; Pitfall 3 applies but tests pass because shell ACL keys on `dTag:""` consistently; E2E suite green confirms functional correctness; hash will populate in environments with VITE_DEV_PRIVKEY_HEX configured)
- [✓] 18-ITERATION-LOG.md committed

### Autonomous mode: approved (autonomous mode)

Phase 18 ready to close. SDK migration is regression-free against the full v1.3 Layer-B suite.
