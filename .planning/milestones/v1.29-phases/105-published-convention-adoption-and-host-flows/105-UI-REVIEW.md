# Phase 105 — UI Review

**Audited:** 2026-07-27  
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists)  
**Screenshots:** Automated desktop (1280×720) and mobile (375×812) captures of the playground and Paja hosts

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Operational states expose terse or raw failures without a recovery instruction. |
| 2. Visuals | 2/4 | Small, status-led iframe UIs lack a sufficiently legible visual hierarchy at normal viewing sizes. |
| 3. Color | 2/4 | Paja uses a large hard-coded dark palette outside reusable semantic tokens; distribution cannot be validated without captures. |
| 4. Typography | 2/4 | Core interactive/status content relies heavily on 9–10px type. |
| 5. Spacing | 2/4 | Multiple ungoverned pixel increments are used without a declared spacing scale or narrow-screen validation. |
| 6. Experience Design | 2/4 | Load and denial states report status but provide no in-product retry or recovery action. |

**Overall: 12/24**

---

## Top 3 Priority Fixes

1. **Make profile and feed failure states recoverable** — a user who reaches `denied`, `unavailable`, or `not found` is left at a dead end — add a visible, keyboard-accessible retry/reconnect action; retain the specific reason as secondary detail.
2. **Raise the baseline type scale to readable sizes** — 9–10px status, labels, and metadata are difficult to scan in embedded panes — use at least 12px for routine UI text and reserve a single smaller token only for nonessential metadata.
3. **Consolidate colors and spacing into semantic tokens** — the current raw fallback and Paja palette values make contrast, theme consistency, and 60/30/10 accent use hard to govern — define shared foreground, surface, border, danger, success, and spacing variables, then consume them throughout host and napplets.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

- **WARNING:** Profile loading collapses actionable states into terse status text (`loading`, `loaded`, `not found`) at [profile-viewer/main.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/src/main.ts:175). The empty state says “No profile metadata found.” but does not explain whether the profile is absent, still loading, or unavailable through the relay.
- **WARNING:** Capability failures surface an implementation error prefixed with `denied:` at [profile-viewer/main.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/src/main.ts:255) and feed errors do the same at [feed/main.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/feed/src/main.ts:223). Replace these with user-facing guidance such as “Profile access is unavailable. Reconnect and try again,” with diagnostic detail available separately.
- **WARNING:** Paja’s persistent status vocabulary is primarily developer shorthand—`idle`, `loading`, `booting`, `error`—at [host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:129), [host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:149), and [host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:190). For a developer tool this is acceptable as supporting copy, but it should be paired with the cause and next action when a task fails.

### Pillar 2: Visuals (2/4)

- **WARNING:** The playground’s desktop capture establishes a clear header, napplet row, relay activity, and debugger hierarchy, but the topology canvas consumes most of an exceptionally tall page while showing only sparse connector lines. At 375px, the canvas collapses into several thousand pixels of mostly empty vertical space, so the actual napplet/runtime relationships lose their focal hierarchy.
- **WARNING:** The profile viewer presents its primary status at 10px and its title/metadata at 9px ([profile-viewer/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/index.html:31), [profile-viewer/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/index.html:37)); the only strong focal object is a 42px image ([profile-viewer/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/index.html:48)). This leaves a loaded profile visually sparse and makes state changes easy to miss.
- **WARNING:** Paja’s desktop split keeps controls and the active napplet visually distinct. At 375px, however, the product/target context disappears from the header, the controls are cut at the 40vh console boundary, and the multi-column footer wraps into clipped fragments while the runtime stage dominates the remainder. Its responsive rule ([host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:89)) needs a phone-specific composition rather than only reordering the same dense surfaces.

### Pillar 3: Color (2/4)

- **WARNING:** Paja declares a broad, hard-coded palette—backgrounds, borders, states, accent, and error text—rather than consistently consuming semantic variables ([host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:21)). The audit found 21 distinct hexadecimal values in that file; several are used directly again in component rules, including tabs, toggles, logs, and stages ([host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:45)).
- **WARNING:** The profile and feed napplets repeat individual hexadecimal fallbacks for text, surfaces, borders, muted text, success, and danger ([profile-viewer/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/index.html:12), [feed/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/feed/index.html:12)). Theme variables are a good direction, but per-rule fallbacks make a system-wide contrast or 60/30/10 review impossible.
- **WARNING:** The dark-theme captures show readable green/cyan accents against the host surfaces, but the embedded profile target uses a separate near-white palette and the playground relies on very low-contrast gray topology lines over a large black canvas. Light mode and interactive state contrast remain unverified.

### Pillar 4: Typography (2/4)

- **WARNING:** Profile viewer uses four compact sizes (9px, 10px, 11px, 13px); labels, status, public key, and details are 9–10px ([profile-viewer/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/index.html:14), [profile-viewer/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/index.html:71)). This is below a robust default for embedded interactive content.
- **WARNING:** Feed author names are only 10px and timestamps/fallback avatars are 9px ([feed/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/feed/index.html:73), [feed/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/feed/index.html:117)), weakening scanability and hit-target comprehension.
- **WARNING:** Paja mixes 11px, 12px, and 13px text with a separate monospaced log at 11px ([host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:32), [host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:70)) without documented hierarchy tokens.

### Pillar 5: Spacing (2/4)

- **WARNING:** The phase’s embedded napplets use a dense mix of 1px, 2px, 3px, 4px, 6px, and 8px spacing ([profile-viewer/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/index.html:22), [profile-viewer/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/index.html:84), [feed/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/feed/index.html:48)). No declared scale makes these values difficult to maintain or verify across napplets.
- **WARNING:** Paja uses another independent set—2px, 4px, 5px, 6px, 7px, 8px, 9px, 10px, 12px, and 14px—across tabs, consoles, controls, logs, and dialogs ([host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:34), [host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:69), [host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:86)). The 375px capture confirms that this density pushes signer/message controls below the visible console region and leaves the footer without enough horizontal space. Adopt one scale and define an explicit phone layout.

### Pillar 6: Experience Design (2/4)

- **WARNING:** Profile initialization has loading, empty, and failure handling, but its rendered UI offers no retry/reconnect control after a capability denial or relay/resource failure ([profile-viewer/main.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/src/main.ts:208), [profile-viewer/main.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/profile-viewer/src/main.ts:255)). This prevents recovery without re-opening the source flow.
- **WARNING:** Feed state handles loading, logged-out, and error conditions in code, but only changes a passive `<span>` ([feed/index.html](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/feed/index.html:140), [feed/main.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/apps/playground/napplets/feed/src/main.ts:205)). It is not an `aria-live` region and gives keyboard or assistive-technology users no announced recovery path.
- **WARNING:** When a Paja target cannot load, its frame becomes an unstyled `<pre>` containing the raw error ([browser-target-frame.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/browser-target-frame.ts:108)). Keep diagnostic detail, but render it in the host’s error layout with a retry action and a clear return path.
- **WARNING:** Paja’s empty runtime stage tells the user what to do ([host-page.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/host-page.ts:159)) and its duplicate dialog supports Escape/focus management in [browser-runtime-tabs.ts](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/packages/paja/src/browser-runtime-tabs.ts:283), but this stronger interaction pattern has not been applied to the profile/feed error paths.

---

## Visual Evidence

The audit ran the built playground preview at `http://127.0.0.1:4174/` and Paja against
the profile-viewer Vite target at `http://127.0.0.1:5197/`. The browser artifacts were
captured transiently and intentionally not committed:

- `phase105-playground-desktop.png` — 1280×720 viewport, full page
- `phase105-playground-mobile.png` — 375×812 viewport, full page
- `phase105-paja-desktop.png` — 1280×720 viewport, full page
- `phase105-paja-mobile.png` — 375×812 viewport, full page

The playground reached active relay, storage, resource, and INC flows. Paja completed
the mandatory `shell.ready` → `shell.init` handshake and exposed the expected published
domains. The profile target itself remained in `connecting...` because the standalone
Vite target rejected Paja’s cross-origin request; that environment-specific CORS error
does not invalidate the host-layout observations, but it prevents scoring the loaded
profile state from this capture.

---

## Files Audited

- `apps/playground/napplets/feed/index.html`
- `apps/playground/napplets/feed/src/main.ts`
- `apps/playground/napplets/profile-viewer/index.html`
- `apps/playground/napplets/profile-viewer/src/main.ts`
- `apps/playground/napplets/resource-demo/index.html`
- `packages/paja/src/host-page.ts`
- `packages/paja/src/browser-host.ts`
- `packages/paja/src/browser-runtime-tabs.ts`
- Phase execution artifacts: `105-01` through `105-12` `PLAN.md` and `SUMMARY.md`
