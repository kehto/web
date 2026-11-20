---
quick_id: 261120-str
issue: kehto/web#523 (discovery, chooser, App handlers panel)
spec: napplet/naps master 377bf939 naps/NAP-INTENT.md (Runtime Behavior, Recommended handler resolution); NIP-5D nips#2303 f60550c3
---

# Offer not-installed intent handlers; App handlers panel

Decisions (issue open questions):
1. `#i` relay search only behind an explicit "Search for apps" click; the handlerHint coordinate is looked up in the same gated search.
2. Per-archetype defaults only (NAP-mandated); per-intent overrides deferred.
3. 31129 sync deferred to kehto/web#532.
4. Badge fix shipped first (PR #530).

Tasks:
- services: `offerUninstalledHandlers` resolver hook (not for explicit handler; reload-verified catalog; available/handlers installed-only).
- paja: `findPajaIntentHandlers` (exact `i`, `z` role, signature, dedupe, installed skip, `intent.discoveryLimit`; relay failure is a discovery error).
- paja: chooser "No installed app opens this" + "Not installed yet"; install via resolvePajaPointer + catalog.install.
- paja: App handlers sidebar panel (make default / forget default / uninstall).
- docs, changesets, unit + e2e.
