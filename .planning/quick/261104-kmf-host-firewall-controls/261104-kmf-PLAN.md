---
quick_id: 261104-kmf
description: Host firewall and dispatch controls for shell and runtime (#397-#400)
base_branch: release/host-firewall-controls
---

# Quick Task 261104-kmf: host firewall and dispatch controls

Each issue lands as its own PR against `release/host-firewall-controls`. That
branch then has one PR into `main`, so every changeset reaches one Version
Packages release.

| Issue | Branch | Change |
|-------|--------|--------|
| #397 | `fix/397-shell-firewall-hooks` | Forward `getFocusContext`, `onFirewallEvent` and `firewallPersistence` through `ShellAdapter` and `adaptHooks` |
| #398 | `feat/398-acl-default-policy` | Optional host-selected ACL default policy, permissive when omitted |
| #399 | `feat/399-pre-dispatch-filter` | Pre-dispatch port traffic hook the transport honours |
| #400 | `feat/400-firewall-budget-setters` | Setters for `unfocusedMultiplier` and the burst guard |

## Constraints

- Canonical behaviour stays the same when a host sets none of the new options.
- Each PR carries its own tests, docs and changeset.
- GitHub applies closing keywords only on merges into the default branch, so the
  PR from this branch into `main` also lists `Closes` for all four issues.
- `.planning/STATE.md` and the summary are updated on this branch, not in the
  issue PRs, to keep the four PRs free of conflicts with each other.
