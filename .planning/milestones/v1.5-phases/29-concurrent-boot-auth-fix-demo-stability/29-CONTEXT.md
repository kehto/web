# Phase 29: Concurrent-boot AUTH Fix + Demo Stability - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Smart-discuss batch acceptance (user accepted all 3 grey-area recommendations)

<domain>
## Phase Boundary

Fix the two post-v1.4 UAT bugs classified as demo stability regressions:

- **DEMO-01:** The user-observed "7/10 napplets stuck on LOADING" — root cause confirmed during scout: NOT an AUTH failure. It's a **status-text display bug** in `apps/demo/src/main.ts:refreshAclPanelsIfNeeded()`. That function only updates the DOM status text for `chat` + `bot` (hardcoded at lines 761-769). For composer/preferences/toaster/feed/profile-viewer/theme-switcher it adds them to the `aclRendered` set but **never updates their status DOM element** — so the visual stays at "loading…" even after the napplet authenticates. For hotkey-chord + media-controller (v1.4 additions) there is NO handling at all in the function. The `aclRendered.size < 8` guard at main.ts:794 is also stale (v1.3 count; should be 10).

- **DEMO-02:** Media Play/Pause buttons do not transition playback state. Root cause unknown pre-fix. Likely downstream of DEMO-01 (if napplet never AUTHs internally, buttons noop) OR an ACL-grant issue (`media:control` capability ungranted by default in demo boot — the hotkey-chord napplet uses a `__grantKeysForward__` manual-grant hook; media-controller may need a similar auto-grant or on-interaction grant). Investigation-first: fix DEMO-01, verify media in browser, then decide.

In scope:
- Data-driven rewrite of `refreshAclPanelsIfNeeded()` in `apps/demo/src/main.ts` — iterate over the canonical napplet list (imported from shell-host.ts) and update each napplet's status DOM text when its NappletInfo.authenticated flips to true.
- Remove the `aclRendered.size < 8` stale guard.
- Preserve the existing 200ms setTimeout debounce (v1.3 timing lesson — depends on session registry write-back).
- DEMO-02 investigation + fix: observe Play/Pause behavior after DEMO-01 fix. If ACL-gated, pre-grant `media:control` at demo boot following the hotkey-chord pattern adjusted for auto-grant. If something else, document findings and escalate.
- Hard gate: 49 existing Playwright specs remain green after changes.
- Phase close with manual UAT screenshot: `pnpm --filter @kehto/demo preview` + browser at `:4174` shows all 10 napplets AUTHENTICATED within 10s.

Out of scope (deferred to Phase 30):
- Shell UI state wiring for service activity counters (UI-01) — `node-details.ts:installActivityProjection()` does not route to service-level nodes. Phase 30 work.
- ACL Capability Matrix authenticated-napplet lookup (UI-02). Phase 30 work.
- Debugger Sequence Diagram lane generation (UI-03). Phase 30 work.

Out of scope (deferred to Phase 31):
- New Playwright specs — E2E-15 guards DEMO-01 + E2E-16 guards UI-01/02/03. Phase 29 uses manual UAT.

</domain>

<decisions>
## Implementation Decisions

### Area 1: Phase 29 Scope Boundary (ACCEPTED)

- **Scope strictly to DEMO-01 + DEMO-02.** All other UI wiring (service activity, ACL matrix rows, sequence-diagram lanes) is Phase 30 scope. Maintains v1.5's clean 3-phase shape.
- **Implementation strategy — data-driven loop.** Rewrite `refreshAclPanelsIfNeeded()` in `main.ts` as a single loop iterating over `DEMO_NAPPLETS` (imported from `apps/demo/src/shell-host.ts`). For each entry: look up its NappletInfo in the nappletInfos map; if `authenticated === true` and not already in `aclRendered`, update the status DOM (`document.getElementById(napplet.statusId)`) text to 'authenticated' + color `#39ff14` and add to `aclRendered`. Drop the per-napplet hardcoded if-blocks (chat, bot, composer, preferences, toaster, feed, profile-viewer, theme-switcher — 8 blocks that become 1 loop). Drop the `aclRendered.size < 8` guard — make the per-napplet check idempotent via the Set membership test.
- **DEMO-02 — investigate-first.** After DEMO-01 fix lands, manually verify media Play/Pause in a browser. Three observations to pin down root cause:
  1. Does `#media-controller-status` transition from `session-ready` → `playing`|`paused` on click?
  2. Does the napplet console or shell console log ACL denials (e.g., `denied: media:control`)?
  3. Does `navigator.mediaSession.playbackState` change when read via DevTools?
  
  If (1) fires but (3) stays stale → shell-mediasession wiring bug. If (2) shows denial → ACL gate needs pre-grant for `media:control`. If (1) doesn't even fire → napplet-internal click handler bug.
  
  Fix accordingly — most likely path: ACL pre-grant for `media:control` at demo boot. Mirror hotkey-chord's pattern but auto-grant (no `__grantMediaControl__` manual hook needed — that was E2E-only).
- **Code location.** `main.ts:refreshAclPanelsIfNeeded()` refactor in place. Preserve the split: main.ts owns UI rendering; shell-host.ts owns AUTH state detection. No cross-file restructuring.

### Area 2: Verification Strategy (ACCEPTED)

- **Defer automated coverage to Phase 31.** E2E-15 (`demo-concurrent-boot.spec.ts`) was scoped explicitly to guard DEMO-01. Phase 29 closes with manual UAT proof — writing a full concurrent-boot spec inline would duplicate E2E-15.
- **Hard gate on 49 existing specs.** Post-fix `pnpm clean && pnpm build && pnpm test:e2e` must exit 49 passed / 0 failed / 0 skipped. Baseline preserved exactly. Record in a small Phase 29 iteration-log entry (no new-spec delta).
- **Preserve 200ms setTimeout debounce.** The existing `setTimeout(() => refreshAclPanelsIfNeeded(), 200)` in the tap.onMessage handler stays. Timing rationale: 200ms gives the session registry time to write back after the AUTH envelope is observed, so `info.authenticated` is guaranteed true when the status-update runs. This is a Phase 20-era lesson; removing it would introduce a race.
- **Manual UAT reporting.** Phase 29 SUMMARY.md closes with:
  - A screenshot (`.planning/phases/29-.../29-manual-uat.png` or inline description) showing all 10 napplets in the topology panel displaying AUTHENTICATED.
  - A written test-path description: "Ran `pnpm --filter @kehto/demo preview`, loaded `:4174`, waited 10s, confirmed all 10 DEMO_NAPPLETS show AUTHENTICATED. Clicked Play in media-controller — [result]. Clicked Pause — [result]."
  - Mirrors Phase 27's HUMAN-UAT.md pattern but at smaller scope (two tests rather than formal UAT infrastructure).

### Area 3: Plan Structure (ACCEPTED)

- **2 plans**: 
  - `29-01-PLAN.md` — status-text fix (DEMO-01). Wave 1, no deps. Files: `apps/demo/src/main.ts`. Single atomic commit of the refreshAclPanelsIfNeeded rewrite + `< 8` guard removal.
  - `29-02-PLAN.md` — media play/pause investigation + fix (DEMO-02). Wave 2, depends on 29-01 (investigation runs against a working status-text baseline — without it, the investigator can't visually confirm media-controller is even AUTHENTICATED). Files: likely `apps/demo/src/shell-host.ts` (if pre-grant path) OR a note-only SUMMARY.md if escalated. Scope may expand during investigation; plan acknowledges up-front it's investigation-first and could produce a "no code change, here's what we found" outcome.
- **Napplet list source.** Import `DEMO_NAPPLETS` from `apps/demo/src/shell-host.ts` into main.ts. Already exported (line ~126); `statusId` and `name` fields already present on each entry. Zero new types needed.
- **DEMO-02 investigation first check.** Load `:4174` demo (post-29-01 fix), open media-controller napplet, click Play, observe three paths listed in Area 1 Q3. Root cause lands in one of three buckets (napplet-internal / ACL / shell-mediasession wiring).
- **DEMO-02 expected outcome.**
  - If ACL-gate-is-root: add `media:control` pre-grant to `bootShell()` for the media-controller napplet (parallel to hotkey-chord's pattern but auto-applied without a manual `__grantMediaControl__` hook call — that hook exists for E2E specs, not demo UX).
  - If napplet-internal: fix the napplet's click handler.
  - If shell-mediasession: fix the bridge wiring.
  - If unknown after scout: 29-02 SUMMARY.md documents findings + the scope escalates to a user decision (autonomous mode pauses with an AskUserQuestion at handle_blocker).

</decisions>

<code_context>
## Existing Code Insights

### Root cause evidence (scouted)

- `apps/demo/src/main.ts` lines 760-795 — `refreshAclPanelsIfNeeded()` function. Current shape:
  - Lines 761-769: hardcoded status-text update for `chat` and `bot` only.
  - Lines 774-791: 6 if-blocks adding composer/preferences/toaster/feed/profile-viewer/theme-switcher to `aclRendered` set — **NO status text update** for these napplets.
  - Line 794: `if (aclRendered.size < 8)` — stale v1.3 count; should be 10 OR the guard should be removed entirely since the Set membership check makes the loop idempotent.
  - hotkey-chord + media-controller: NO mentions in the function. Completely missing.

- `apps/demo/src/main.ts:802-810` — the tap.onMessage handler wraps refreshAclPanelsIfNeeded in `setTimeout(..., 200)`. Preserve this debounce.

- `apps/demo/src/shell-host.ts:126` — `DEMO_NAPPLETS` array exported. Each entry has `name`, `label`, `statusId`, `statusPrefix`, etc. Entries 1-8 are the v1.3 napplets; entries 9-10 are hotkey-chord + media-controller (v1.4). Authoritative source for the napplet inventory.

- `apps/demo/src/shell-host.ts:810-840` — Path A (NIP-01 OK) + Path B (NIP-5D first envelope) AUTH detection. Sets `info.authenticated = true` on each napplet's NappletInfo entry. This detection already works for all 10 napplets — the bug is purely in the display path.

### Reusable Assets

- `DEMO_NAPPLETS` constant (shell-host.ts:126) — the canonical 10-entry list.
- `NappletInfo` type with `authenticated: boolean` and `statusId: string` fields.
- `aclRendered: Set<string>` at main.ts:751 — per-napplet render-once guard. Keep this, use for idempotence.
- `renderAclPanels(aclRendered)` helper call at main.ts:793 — preserve.

### Established Patterns

- Status sentinel format: `<span class="topology-node-status" id="${napplet.statusId}">loading...</span>` in topology.ts:461.
- Authenticated style: `textContent = 'authenticated'; style.color = '#39ff14'`.
- 200ms setTimeout debounce on tap.onMessage → refreshAclPanelsIfNeeded.
- Per-napplet grant hooks for E2E (`__grantKeysForward__`, `__grantMediaControl__`) — NOT for demo UX; they're spec-gated capability shortcuts.

### Integration Points

- `apps/demo/src/main.ts` — refreshAclPanelsIfNeeded rewrite (29-01 scope).
- `apps/demo/src/shell-host.ts` — DEMO_NAPPLETS remains the source of truth; possibly edited in 29-02 if ACL pre-grant is the fix.
- `tests/e2e/**` — 49 existing specs must stay green. No new spec files in Phase 29.
- `.planning/phases/29-concurrent-boot-auth-fix-demo-stability/29-ITERATION-LOG.md` — small log recording the 49/0/0 baseline post-fix + manual UAT screenshot reference.

</code_context>

<specifics>
## Specific Ideas

- **Pseudocode for the refactored refreshAclPanelsIfNeeded:**
  ```ts
  function refreshAclPanelsIfNeeded(): void {
    for (const napplet of DEMO_NAPPLETS) {
      const info = nappletInfos.get(napplet.name);  // or however the info is keyed
      if (!info?.authenticated) continue;
      if (aclRendered.has(napplet.name)) continue;
      const statusEl = document.getElementById(napplet.statusId);
      if (statusEl) {
        statusEl.textContent = 'authenticated';
        statusEl.style.color = '#39ff14';
      }
      aclRendered.add(napplet.name);
    }
    if (aclRendered.size > 0) renderAclPanels(aclRendered);
    refreshNodeSummaries();
  }
  ```
  Note: `nappletInfos` map in main.ts holds NappletInfo references extracted from shell-host.ts's `napplets` map. Actual key and lookup pattern should follow existing main.ts code.

- **Plan 29-01 acceptance criteria (sample):**
  - `grep -c "chatStatus.textContent = 'authenticated'" apps/demo/src/main.ts` returns 0 (hardcoded block removed)
  - `grep -c "for (const napplet of DEMO_NAPPLETS)" apps/demo/src/main.ts` returns 1 (loop present)
  - `grep "aclRendered.size < 8" apps/demo/src/main.ts` returns nothing (stale guard removed)
  - `pnpm --filter @kehto/demo build` exits 0
  - `pnpm test:e2e` exits with 49 passed / 0 failed / 0 skipped

- **Plan 29-02 investigation plan:**
  1. Apply 29-01 fix.
  2. `pnpm --filter @kehto/demo preview` → browser at `:4174`.
  3. Wait for all 10 napplets to show AUTHENTICATED (verifies 29-01).
  4. Click Play button in media-controller's frame.
  5. Observe: `#media-controller-status` transition? Shell console ACL denial? `navigator.mediaSession.playbackState` value?
  6. Capture findings in 29-02-SUMMARY.md.
  7. Apply fix based on findings, or escalate with structured report.

- **ACL pre-grant candidate fix (if needed):** Add to `bootShell()` after sessionRegistry population — `aclState.grantCapability(mediaControllerPubkey, 'media:control', true)`. Pattern reference: `__grantMediaControl__` host hook at shell-host.ts:903 — but auto-applied at boot, not gated on manual test invocation.

</specifics>

<deferred>
## Deferred Ideas

- **Service-node activity counter wiring (UI-01)** — deferred to Phase 30. `node-details.ts:installActivityProjection` needs a route to service-level nodes.
- **ACL Matrix authenticated-row lookup (UI-02)** — deferred to Phase 30. `acl-modal.ts:openPolicyModal` iterates `adapter.snapshot()` which returns empty.
- **Sequence diagram lane generation (UI-03)** — deferred to Phase 30.
- **E2E spec for concurrent boot (E2E-15)** — deferred to Phase 31.
- **Chat storage.get storm (PERF-01)** — deferred to v1.6 per REQUIREMENTS.md Future Requirements.
- **Regression test for the status-text bug** — automated coverage ships in Phase 31; Phase 29 uses manual UAT.

</deferred>
