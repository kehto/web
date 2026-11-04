---
quick_id: 261104-pr336
status: complete
---

# PR 336 merge with main

Executed inline rather than through planner/executor subagents, because each hunk needed judgment from the same context.

## Ported onto main's rewrites

- `media-service.ts`: main's registry plus Firewall session approval, generations, and revocation. `media.command` joins the approved operations because it is a napplet-to-shell effect on shell-owned sessions.
- `ResourceService.openStream`: resource and network approvals replace the origin-grant options this branch retired. Host-owned `signal` keeps the playback lifetime.
- `legacy-firewall-gate.ts` and `service-types.ts`: main's LLM denial shape and `onCapabilityRevoked`.
- `admitBrowserDocument`: new `experimental` option carries the nested-context lock.
- `scopePajaService`: forwards `onPermissionRevoked` to window-scoped services.
- `confirmPajaExternalLink`: user activation and source-currentness checks.

## Removed

All remaining playground sources, specs, and doc claims this branch had added.

## Known gaps

- `createLlmService` keeps NAP-LLM host consent and has no `authorizeOperation` call.
- `installPajaLlmPanel` length warning is inherited from main (slop 99/100).
