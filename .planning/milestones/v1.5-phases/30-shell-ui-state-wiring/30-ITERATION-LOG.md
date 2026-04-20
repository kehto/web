---
phase: 30-shell-ui-state-wiring
recorded: 2026-04-19T23:35:00Z
iterations: 1
test_baseline_before: 49
test_baseline_after: 49
delta: 0
---

# Phase 30 Iteration Log

No new specs shipped in Phase 30 (E2E-16 is Phase 31 scope). All three fixes land without regressing the 49-spec baseline.

## Iteration 1 — post-wave-1 confirmation

**Date:** 2026-04-19T23:35:00Z
**Commits covered:**
- `80928b2` feat(30-01): add service-level activity routing to installActivityProjection()
- `a03f58e` fix(30-02): swap aclAdapter.snapshot() gate from info.pubkey to info.authenticated
- `b894786` feat(30-03): dynamic lane derivation in sequence-diagram (UI-03)

**Build:** `pnpm build` — 22/22 successful
**Type-check:** `pnpm type-check` — 0 errors
**Playwright suite:** `pnpm test:e2e` — **49 passed / 0 failed / 0 skipped**

### Manual UAT evidence (Playwright MCP automated)

Demo booted via `pnpm --filter @kehto/demo preview --port 4174` against the fresh post-wave-1 build. Observations from the browser:

#### UI-01 — Service activity counters (fix verified)

Read via `document.getElementById('topology-node-service-${name}')` + regex parse of `innerText`:

| Service | Activity | Last Action | Result |
|---|---|---|---|
| identity | 4 recent | identity-request | ✓ populated |
| keys | 2 recent | ipc-receive | ✓ populated |
| media | 2 recent | ipc-receive | ✓ populated |
| relay | 12 recent | relay-subscribe | ✓ populated |
| signer | 4 recent | identity-request | ✓ (was already working pre-30) |
| storage | 12 recent | state-read | ✓ populated |
| notifications | 0 recent | — | ✓ expected (no boot-time notifications) |
| theme | 0 recent | — | ✓ expected (theme changes are user-triggered) |
| ifc | (not in topology.services) | — | ✓ correctly skipped by includes() guard |

**Pre-Phase-30 state:** all 8 non-signer services showed `ACTIVITY: 0 recent` and `LAST ACTION: —`. Post-fix: 6 services show non-zero activity on boot traffic; 2 (notifications/theme) remain at 0 by design (no boot-time traffic).

#### UI-02 — ACL Capability Matrix (fix verified)

Opened via the "Open Policy Matrix" button exposed when the ACL topology node is selected in the inspector:

```
rowCount: 10
emptyText: null  (no "No authenticated napplets" fallback)
napplets: [chat, bot, composer, preferences, toaster, feed, profile-viewer,
           theme-switcher, hotkey-chord, media-controller]
```

**Pre-Phase-30 state:** modal showed "No authenticated napplets" regardless of auth state. Post-fix: all 10 authenticated napplets appear as rows.

#### UI-03 — Sequence Diagram lanes (fix verified)

Sequence tab in the debugger shadow root rendered one SVG with 11 lane headers:

```
bot, chat, composer, feed, hotkey-chord, Shell, media-controller,
preferences, profile-viewer, theme-switcher, toaster
```

Exact ordering: alphabetical split at midpoint (ceil(10/2)=5) → left 5 + Shell centered + right 5. Matches CONTEXT.md Area 2 UI-03 locked decision exactly.

**Pre-Phase-30 state:** 3 hardcoded lanes (`Chat`, `Shell`, `Bot`) regardless of which napplets were sending traffic. Post-fix: 11 lanes derived dynamically from observed message windowIds.

### Anti-feature hygiene

Post-wave-1 grep sweep across changed files returned 0 matches for all anti-term patterns (`window.nostr`, `signer-service`, `signer.sign`, `BusKind`, `kind === 2900[12]`, `core-compat`). Zero raw `window.addEventListener('message')` introduced.

### Conclusion

All three shell-UI state surfaces now populate with live NUB envelope traffic. 49/0/0 Playwright baseline preserved. Phase 30 ready for verification + close. E2E-16 automated regression coverage will ship in Phase 31.
